import { type PODEntries } from "@pcd/pod";

export type Credentials = Record<string, string>;

export type PODStore = Record<
  string,
  {
    podEntries: PODEntries;
    signerPrivateKey: string;
    podFolder: string;
    mintLink: string;
  }
>;

// TODO: Name?
export type PODSignRequest = {
  podEntries: PODEntries;
  signerPrivateKey?: string;
  owner?: bigint;
  podFolder?: string;
};

export type ServerConfig = {
  hostname: string;
  port: number;
  mintUrl: string;
  zupassUrl: string;
  defaultPrivateKey: string;
};
