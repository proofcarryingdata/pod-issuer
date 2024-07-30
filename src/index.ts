import { serverConfig } from "./constants.ts";
import { serverStart } from "./server.ts";

const main = () => {
  console.log(
    `POD issuer @ http://${serverConfig.hostname}:${serverConfig.port}`,
  );

  Deno.addSignalListener("SIGINT", () => {
    console.log("Stopping server...");
    Deno.exit();
  });

  console.log("Press CTRL-C to stop server.");

  serverStart();
};

main();
