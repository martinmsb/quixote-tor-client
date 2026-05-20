import type { GraphQLClient, Variables } from "graphql-request";
import type { DocumentNode } from "graphql";
import type { QuixoteClientOptions, TorStatus } from "./types.js";
import { probeProxy, buildNodeClient, DEFAULT_PROXY_URL } from "./transport/node.js";

export class QuixoteClient {
  private clientPromise: Promise<{ client: GraphQLClient; status: TorStatus }>;

  constructor(private options: QuixoteClientOptions) {
    this.clientPromise = this.init();
  }

  /**
   * Preferred constructor when using strictTor: true. Awaits the Tor probe
   * before returning, so misconfiguration errors are thrown here rather than
   * on the first request() call.
   */
  static async create(options: QuixoteClientOptions): Promise<QuixoteClient> {
    const instance = new QuixoteClient(options);
    await instance.clientPromise;
    return instance;
  }

  private async init(): Promise<{ client: GraphQLClient; status: TorStatus }> {
    const proxyUrl = this.options.proxyUrl ?? DEFAULT_PROXY_URL;
    const torAvailable = await probeProxy(proxyUrl, this.options.probeTimeoutMs);
    return buildNodeClient(this.options, torAvailable);
  }

  async request<T = unknown>(document: string | DocumentNode, variables?: Variables): Promise<T> {
    const { client } = await this.clientPromise;
    return client.request<T>(document as string, variables);
  }

  async torStatus(): Promise<TorStatus> {
    const { status } = await this.clientPromise;
    return status;
  }
}
