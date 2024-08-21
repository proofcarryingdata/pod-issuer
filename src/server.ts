import { EmailPCD, EmailPCDPackage } from "@pcd/email-pcd";
import { podEntriesFromSimplifiedJSON, serializePODEntries } from "@pcd/pod";
import { PODPCD, PODPCDPackage } from "@pcd/pod-pcd";
import {
  SemaphoreSignaturePCD,
  SemaphoreSignaturePCDPackage,
} from "@pcd/semaphore-signature-pcd";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import basicAuth from "express-basic-auth";
import { credentials, serverConfig, siteDir } from "./constants.ts";
import {
  addMintablePOD,
  getMintablePODs,
  getMintLink,
  getPODContent,
  mintPOD,
  mintPODAndSerialise,
  removeMintablePOD,
} from "./util.ts";

/**
 * Instantiates mint server.
 */
export const serverStart = () => {
  // Instantiate ExpressJS
  const app = express();

  // Use CORS & parse bodies as JSON.
  app.use(cors());
  app.use(bodyParser.json());

  // Authentication for a subset of the API.
  [
    "/addPOD",
    "/api/getMintablePODs",
    "/api/addMintablePOD",
    "/api/removeMintablePOD",
  ].forEach((reqType) =>
    app.use(
      reqType,
      basicAuth({
        users: credentials,
        challenge: true,
        unauthorizedResponse:
          "Unauthorized access. Please provide valid credentials.",
      }),
    )
  );

  // Admin page for adding mintable PODs.
  app.use("/addPOD", express.static(siteDir));

  // Mintable POD getter for admin page.
  app.get("/api/getMintablePODs", (_req, res) => {
    res.send(JSON.stringify(getMintablePODs()));
  });

  // Mintable POD remover (by ID) for admin page.
  app.get("/api/removeMintablePOD/:podId", (req, res) => {
    const podId = req.params.podId;
    removeMintablePOD(podId);
    res.status(200).send(`POD ${podId} successfully removed.`);
  });

  // POD content fetcher for users.
  app.get("/api/getPODContent/:podId", (req, res) => {
    const podContent = getPODContent(req.params.podId);
    if (podContent) {
      res.send(serializePODEntries(podContent));
    } else {
      res.status(404).send(`POD ${req.params.podId} not found.`);
    }
  });

  // POD minting API for users.
  app.post("/api/mintPOD", async (req, res) => {
    try {
      const contentIDString = req.body.contentID;

      const pcd: SemaphoreSignaturePCD | EmailPCD =
        req.body.semaphoreSignaturePCD
          ? (await SemaphoreSignaturePCDPackage.deserialize(
            req.body.semaphoreSignaturePCD.pcd,
          )) as SemaphoreSignaturePCD
          : req.body.emailPCD
          ? (await EmailPCDPackage.deserialize(
            req.body.emailPCD.pcd,
          )) as EmailPCD
          : (() => {
            throw new TypeError("Missing identity-proving PCD.");
          })();

      // TODO: Timestamp check for Semaphore signature PCD.

      const serialisedMintedPOD = await mintPODAndSerialise(
        contentIDString,
        pcd,
      );

      res.send(serialisedMintedPOD);
    } catch (e) {
      res.status(400).send(String(e));
    }
  });

  /*

   */
  // Alternative POD minting API for users that returns a serialised PODPCD.
  app.post("/api/sign", async (req, res) => {
    try {
      const contentIDString = req.body.contentID;

      const pcd: SemaphoreSignaturePCD | EmailPCD =
        req.body.semaphoreSignaturePCD
          ? (await SemaphoreSignaturePCDPackage.deserialize(
            req.body.semaphoreSignaturePCD.pcd,
          )) as SemaphoreSignaturePCD
          : req.body.emailPCD
          ? (await EmailPCDPackage.deserialize(
            req.body.emailPCD.pcd,
          )) as EmailPCD
          : (() => {
            throw new TypeError("Missing identity-proving PCD.");
          })();

      // TODO: Timestamp check for Semaphore signature PCD.

      const mintedPOD = await mintPOD(
        contentIDString,
        pcd,
      );

      const mintedPODPCD = new PODPCD(crypto.randomUUID(), mintedPOD);

      const serialisedMintedPODPCD = await PODPCDPackage.serialize(
        mintedPODPCD,
      );

      res.send(serialisedMintedPODPCD);
    } catch (e) {
      res.status(400).send(String(e));
    }
  });

  // POD mint link getter for users. Convenient for keeping the address short.
  // TODO: Use an identifier shorter than the content ID!
  app.get("/api/getMintLink/:podId", (req, res) => {
    const podId = req.params.podId;
    const mintLink: string | undefined = podId && getMintLink(podId);

    if (mintLink) {
      res.redirect(mintLink);
    } else {
      res.sendStatus(404);
    }
  });

  // Mintable POD adder for admin page.
  app.post("/api/addMintablePOD", async (req, res) => {
    try {
      const podEntries = podEntriesFromSimplifiedJSON(req.body.podEntries);
      const signerPrivateKey = req.body.signerPrivateKey;
      const podFolder = req.body.podFolder;

      res.send(
        JSON.stringify(
          await addMintablePOD({ podEntries, signerPrivateKey, podFolder }),
        ),
      );
    } catch (e) {
      res.status(400).send(String(e));
    }
  });

  app.listen(serverConfig.port, serverConfig.hostname);
};
