import { podEntriesFromSimplifiedJSON } from "@pcd/pod";
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
  mintPOD,
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
  // app.get("/addPOD", (_req, res) => {
  //   res.sendFile(path.join(siteDir, "index.html"));
  // });

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

  // POD minting API for users.
  app.post("/api/mintPOD", async (req, res) => {
    try {
      const contentIDString = req.body.contentID;
      const semaphoreSigPCD: SemaphoreSignaturePCD =
        (await SemaphoreSignaturePCDPackage.deserialize(
          req.body.semaphoreSignaturePCD.pcd,
        )) as SemaphoreSignaturePCD;

      const serialisedMintedPOD = await mintPOD(
        contentIDString,
        semaphoreSigPCD,
      );
      res.send(serialisedMintedPOD);
    } catch (e) {
      res.status(400).send(String(e));
      throw e;
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
