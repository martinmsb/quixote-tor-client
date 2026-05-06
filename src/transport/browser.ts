import { GraphQLClient } from "graphql-request";
import type { QuixoteClientOptions, TorStatus } from "../types.js";

export function detectTorBrowser(): boolean {
  if (typeof window === "undefined") return false;
  // Tor Browser letterboxes the viewport to 1000×1000 by default.
  const { innerWidth, innerHeight } = window;
  return innerWidth === 1000 && innerHeight === 1000;
}

async function fetchOnion(url: string, onionUrl: string, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(onionUrl, { ...init, signal: AbortSignal.timeout(8000) });
    if (res.ok) return res;
    throw new Error(`onion fetch failed: ${res.status}`);
  } catch {
    return fetch(url, init);
  }
}

export function buildBrowserClient(
  options: QuixoteClientOptions,
  onionUrl?: string
): { client: GraphQLClient; status: TorStatus } {
  const { url, strictTor = false } = options;

  if (detectTorBrowser()) {
    const client = new GraphQLClient(url);
    return { client, status: "browser" };
  }

  if (onionUrl) {
    const client = new GraphQLClient(url, {
      fetch: (input, init) => fetchOnion(url, onionUrl, init),
    });
    return { client, status: "connected" };
  }

  if (strictTor) {
    throw new Error("No .onion URL provided and strictTor is enabled");
  }

  console.warn("[quixote-tor-client] No .onion URL — using clearnet");
  return { client: new GraphQLClient(url), status: "unavailable" };
}
