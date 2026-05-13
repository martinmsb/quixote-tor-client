export type TorStatus = "connected" | "unavailable";

export interface QuixoteClientOptions {
  url: string;
  proxyUrl?: string;
  /** Force a new Tor circuit per query via SOCKS5 auth. Defaults to true. */
  isolateStreams?: boolean;
  /** Throw instead of falling back to clearnet when Tor is unavailable. */
  strictTor?: boolean;
}
