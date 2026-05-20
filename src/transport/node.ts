import * as https from "https";
import * as http from "http";
import { SocksProxyAgent } from "socks-proxy-agent";
import { GraphQLClient } from "graphql-request";
import type { QuixoteClientOptions, TorStatus } from "../types.js";

export const DEFAULT_PROXY_URL = "socks5h://127.0.0.1:9050";

export function buildProxyUrl(base: string, isolate: boolean): string {
  if (!isolate) return base;
  const rand = () => Math.random().toString(36).slice(2);
  const url = new URL(base);
  url.username = rand();
  url.password = rand();
  return url.toString();
}

function flattenHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((v, k) => { out[k] = v; });
    return out;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers as [string, string][]);
  }
  return headers as Record<string, string>;
}

function normalizeResponseHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
}

async function proxyFetch(url: string, proxyUrl: string, init?: RequestInit): Promise<Response> {
  const agent = new SocksProxyAgent(proxyUrl);
  const parsedUrl = new URL(url);
  const mod = parsedUrl.protocol === "https:" ? https : http;
  const port = parsedUrl.port
    ? parseInt(parsedUrl.port)
    : parsedUrl.protocol === "https:" ? 443 : 80;

  return new Promise<Response>((resolve, reject) => {
    const body = init?.body != null ? String(init.body) : null;
    const headers = flattenHeaders(init?.headers);
    if (body) headers["Content-Length"] = String(Buffer.byteLength(body, "utf8"));

    const req = mod.request(
      {
        hostname: parsedUrl.hostname,
        port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: (init?.method as string) ?? "POST",
        headers,
        agent,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve(
            new Response(Buffer.concat(chunks).toString("utf8"), {
              status: res.statusCode ?? 200,
              statusText: res.statusMessage,
              headers: new Headers(normalizeResponseHeaders(res.headers)),
            })
          );
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function probeProxy(proxyUrl: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const agent = new SocksProxyAgent(proxyUrl);
    return await new Promise<boolean>((resolve) => {
      const req = https.request(
        { hostname: "check.torproject.org", path: "/api/ip", agent, timeout: timeoutMs },
        (res) => {
          let data = "";
          res.on("data", (chunk: string) => { data += chunk; });
          res.on("end", () => {
            try { resolve(JSON.parse(data).IsTor === true); }
            catch { resolve(false); }
          });
        }
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => { req.destroy(); resolve(false); });
      req.end();
    });
  } catch {
    return false;
  }
}

export function buildNodeClient(
  options: QuixoteClientOptions,
  torAvailable: boolean
): { client: GraphQLClient; status: TorStatus } {
  const { url, onionUrl, proxyUrl = DEFAULT_PROXY_URL, isolateStreams = true, strictTor = false } = options;

  if (!torAvailable) {
    if (strictTor) throw new Error("[quixote-tor-client] Tor proxy unavailable and strictTor is enabled");
    if (!url) throw new Error("[quixote-tor-client] Tor proxy unavailable and no clearnet url provided");
    console.warn("[quixote-tor-client] Tor unavailable — falling back to clearnet");
    return { client: new GraphQLClient(url), status: "unavailable" };
  }

  const torUrl = onionUrl ?? url!;
  const client = new GraphQLClient(torUrl, {
    fetch: (_input, init) => proxyFetch(torUrl, buildProxyUrl(proxyUrl, isolateStreams), init),
  });

  return { client, status: "connected" };
}
