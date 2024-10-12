import { EmailPCD, EmailPCDPackage } from "@pcd/email-pcd";
import { GPCPCD, GPCPCDPackage } from "@pcd/gpc-pcd";
import { POD, PODEntries } from "@pcd/pod";
import { PODPCD, PODPCDPackage } from "@pcd/pod-pcd";
import {
    SemaphoreSignaturePCD,
    SemaphoreSignaturePCDPackage,
} from "@pcd/semaphore-signature-pcd";
import * as path from "@std/path";
import { v4 as uuid } from "uuid";
import {
    TIMESTAMP_EXPIRY_TIME,
    dataDir,
    jsonBig,
    podStore,
    podStoreFile,
    serverConfig,
} from "./constants.ts";
import { PODSignRequest, PODStore, ServerConfig } from "./types.ts";

/**
 * Creates a POD from a sign request.
 */
const createPODFromSignRequest = async (
  podEntrySignRequest: PODSignRequest,
  includeTimestamp?: boolean,
): Promise<POD> => {
  const podEntries = podEntrySignRequest.podEntries;
  const podSignerPrivateKey = podEntrySignRequest.signerPrivateKey === "" ||
      podEntrySignRequest.signerPrivateKey === undefined
    ? serverConfig.defaultPrivateKey
    : podEntrySignRequest.signerPrivateKey;
  const podFolder = podEntrySignRequest.podFolder === "" ||
      podEntrySignRequest.podFolder === undefined
    ? "PODs"
    : podEntrySignRequest.podFolder;
  if (podEntrySignRequest.owner !== undefined) {
    podEntries["owner"] = {
      type: "cryptographic",
      value: podEntrySignRequest.owner,
    };
  } else {
    delete podEntries.owner;
  }

  // Include timestamp if necessary.
  if (includeTimestamp) {
    podEntries.timestamp = { type: "int", value: BigInt(Date.now()) };
  }

  const pod = POD.sign(podEntries, podSignerPrivateKey);

  // If there's no owner field, add this to the store and save.
  if (podEntrySignRequest.owner === undefined) {
    podStore[pod.contentID.toString(16)] = {
      podEntries,
      signerPrivateKey: podSignerPrivateKey,
      podFolder,
      mintLink: await createMintUrl(serverConfig)(pod, podFolder),
    };
    savePODs(podStore);
  }

  return pod;
};

// TODO: Use a proper KV DB.
/**
 * Saves the current state of the POD store to disk.
 */
const savePODs = (podStore: PODStore): Promise<void> =>
  Deno.writeTextFile(
    path.join(dataDir, podStoreFile),
    jsonBig.stringify(podStore),
  );

// TODO: Replace with constructZupassPcdAddRequestUrl.
/**
 * Creates a mint link from an ownerless POD and a folder name.
 */
const createMintUrl =
  (serverConfig: ServerConfig) =>
  async (pod: POD, podFolder: string): Promise<string> => {
    const zupassClientUrl = serverConfig.zupassUrl;
    const podPCD = new PODPCD(uuid(), pod);
    const serialisedPODPCD = await PODPCDPackage.serialize(podPCD);
    const req = {
      type: "Add",
      mintUrl: serverConfig.mintUrl,
      returnUrl: serverConfig.zupassUrl,
      pcd: serialisedPODPCD,
      folder: podFolder,
      postMessage: false,
      redirectToFolder: true,
    };
    const eqReq = encodeURIComponent(JSON.stringify(req));
    return `${zupassClientUrl}#/add?request=${eqReq}`;
  };

/**
 * Gets single mintable POD content.
 */
export const getPODContent = (podId: string): PODEntries | undefined =>
  podStore[podId].podEntries;

/**
 * Gets mintable PODs as array of objects containing POD names and descriptions.
 */
export const getMintablePODs = () =>
  Object.fromEntries(
    Object.entries(podStore).map(
      ([
        podId,
        { podEntries, signerPrivateKey: _s, podFolder: _p, mintLink: _m },
      ]) => {
        return [podId, {
          podName: podEntries.zupass_title.value,
          podDescription: podEntries.zupass_description.value,
        }];
      },
    ),
  );

/**
 * Removes a POD from the database of mintable PODs.
 */
export const removeMintablePOD = async (podId: string): Promise<void> => {
  if (podStore[podId] !== undefined) {
    delete podStore[podId];
    await savePODs(podStore);
  }
};

// TODO: Clean up!
/**
 * Mints a POD, i.e. it takes an ownerless POD ID and an identity-proving PCD, viz. a semaphore signature PCD or email PCD, verifies the latter
 * and issues a POD to the owner of the signature PCD in JSON-serialised form.
 */
export const mintPOD = async (
  podId: string,
  pcd: SemaphoreSignaturePCD | EmailPCD | GPCPCD,
): Promise<POD> => {
  // Nullifier check for GPCPCD
  // Check PCD and extract identity commitment.
  const [ownerCommitment, isValidPCD] = await (async () => {
    if (pcd instanceof EmailPCD) {
      return [pcd.claim.semaphoreId, await EmailPCDPackage.verify(pcd)];
    } else if (pcd instanceof SemaphoreSignaturePCD) {
      return [
        pcd.claim.identityCommitment,
        await SemaphoreSignaturePCDPackage.verify(pcd),
      ];
    } else if (pcd instanceof GPCPCD) {
      // Check timestamp and GPC proof.
      const currentTime = BigInt(Date.now());
      const timestampString =pcd.claim.revealed.owner?.externalNullifier?.value;
      const nullifierHash = pcd.claim.revealed.owner?.nullifierHash;
      if (!nullifierHash) {
        return [0n, false];
      } else if (podStore[podId]?.nullifiers?.[String(nullifierHash)]) {
        throw new Error("GPC identity proof nullifier already used.");
      }
      return [
        pcd.claim.revealed.pods.pod0?.entries.owner?.value ?? 0n,
        pcd.claim.config.pods.pod0.entries.owner.isRevealed && 
        pcd.claim.config.pods.pod0.entries.owner.isOwnerID 
          && timestampString &&
          ((currentTime - BigInt(timestampString)) < TIMESTAMP_EXPIRY_TIME) &&
          await GPCPCDPackage.verify(pcd)
      ];
    } else {
      throw new TypeError("Invalid identity-proving PCD.");
    }
  })();

  const podSignRequest = podStore[podId];
  if (podSignRequest !== undefined) {
    // Check owner commitment.
    if (!isValidPCD) {
      throw new Error("Invalid identity commitment.");
    } else {
      const mintedPOD = await createPODFromSignRequest({
        ...podSignRequest,
        owner: BigInt(ownerCommitment),
      }, pcd instanceof EmailPCD);

      // Nullify in case of GPCPCD
      if(pcd instanceof GPCPCD) {
      if(!podStore[podId].nullifiers) {
        podStore[podId].nullifiers = {};
      }
        podStore[podId].nullifiers[String(pcd.claim.revealed.owner.nullifierHash)] = true;
      }
      
      return mintedPOD;
    }
  } else {
    throw new Error("Invalid content ID.");
  }
};

export const mintPODAndSerialise = async (
  podId: string,
  pcd: SemaphoreSignaturePCD | EmailPCD | GPCPCD,
): Promise<string> => {
  const mintedPOD = await mintPOD(podId, pcd);
  return JSON.stringify(mintedPOD.toJSON());
};

/**
 * Adds a mintable POD to the database, returning an object containing that POD's content ID
 * if successful.
 */
export const addMintablePOD = async (
  podSignRequest: PODSignRequest,
): Promise<{ podId?: string }> => {
  // Remove owner commitment if present.
  delete podSignRequest.podEntries.owner;

  podSignRequest.podFolder = podSignRequest.podFolder === ""
    ? "Test Folder"
    : podSignRequest.podFolder;

  const pod = await createPODFromSignRequest(podSignRequest);

  return { podId: pod.contentID.toString(16) };
};

/**
 * Gets longer mint link from store.
 */
export const getMintLink = (podId: string): string | undefined =>
  podStore[podId].mintLink;

// /**
//  *
//  */
// export const isNullified = (
