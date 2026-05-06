import { Agent, fetch } from "undici";
import { SocksClient } from "socks";
import { GraphQLClient } from "graphql-request";
import type { QuixoteClientOptions, TorStatus } from "../types.js";

export function buildProxyUrl(base: string, isolate: boolean): string {
  if (!isolate) return base;
  const rand = () => Math.random().toString(36).slice(2);
  const url = new URL(base);
  url.username = rand();
  url.password = rand();
  return url.toString();
}

function createSocksAgent(proxyUrl: string): Agent {
  const { hostname, port, username, password } = new URL(proxyUrl);
  return new Agent({
    connect: async (options, callback) => {
      try {
        const { socket } = await SocksClient.createConnection({
          proxy: { host: hostname, port: parseInt(port || "9050"), type: 5, userId: username || undefined, password: password || undefined },
          command: "connect",
          destination: { host: options.hostname!, port: typeof options.port === "string" ? parseInt(options.port) : options.port! },
        });
        callback(null, socket as any);
      } catch (err) {
        callback(err as Error, null as any);
      }
    },
  });
}

export async function probeProxy(proxyUrl: string, _fetch = fetch): Promise<boolean> {
  try {
    const res = await (_fetch as any)("https://check.torproject.org/api/ip", {
      dispatcher: createSocksAgent(proxyUrl),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return data.IsTor === true;
  } catch {
    return false;
  }
}

export function buildNodeClient(
  options: QuixoteClientOptions,
  torAvailable: boolean
): { client: GraphQLClient; status: TorStatus } {
  const { url, proxyUrl = "socks5h://127.0.0.1:9050", mode = "isolated", strictTor = false } = options;
  const isolate = mode === "isolated";

  if (!torAvailable) {
    if (strictTor) throw new Error("Tor proxy unavailable and strictTor is enabled");
    console.warn("[quixote-tor-client] Tor unavailable — falling back to clearnet");
    return { client: new GraphQLClient(url), status: "unavailable" };
  }

  const client = new GraphQLClient(url, {
    fetch: (input, init) => {
      const dispatcher = createSocksAgent(buildProxyUrl(proxyUrl, isolate));
      return fetch(input as string, { ...(init as any), dispatcher }) as unknown as Promise<Response>;
    },
  });

  return { client, status: "connected" };
}
