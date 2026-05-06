import type { GraphQLClient, Variables } from "graphql-request";
import type { DocumentNode } from "graphql";
import type { QuixoteClientOptions, TorStatus } from "./types.js";

const isBrowser = typeof window !== "undefined";

export class QuixoteClient {
  private clientPromise: Promise<{ client: GraphQLClient; status: TorStatus }>;

  constructor(private options: QuixoteClientOptions) {
    this.clientPromise = this.init();
  }

  private async init(): Promise<{ client: GraphQLClient; status: TorStatus }> {
    if (isBrowser) {
      const { buildBrowserClient } = await import("./transport/browser.js");
      return buildBrowserClient(this.options, this.options.onionUrl);
    }

    const { probeProxy, buildNodeClient } = await import("./transport/node.js");
    const proxyUrl = this.options.proxyUrl ?? "socks5h://127.0.0.1:9050";
    const torAvailable = await probeProxy(proxyUrl);
    return buildNodeClient(this.options, torAvailable);
  }

  async request<T = unknown>(
    document: string | DocumentNode,
    variables?: Variables
  ): Promise<T> {
    const { client } = await this.clientPromise;
    return client.request<T>(document as string, variables);
  }

  async torStatus(): Promise<TorStatus> {
    const { status } = await this.clientPromise;
    return status;
  }
}
