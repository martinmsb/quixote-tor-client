export type TorStatus = "connected" | "unavailable";

export interface QuixoteClientOptions {
  /** Clearnet endpoint. Used directly when Tor is unavailable. Required unless strictTor is true. */
  url?: string;
  /** .onion endpoint. Used instead of url when Tor is available. */
  onionUrl?: string;
  proxyUrl?: string;
  /** Force a new Tor circuit per query via SOCKS5 auth. Defaults to true. */
  isolateStreams?: boolean;
  /** Throw instead of falling back to clearnet when Tor is unavailable. */
  strictTor?: boolean;
  /** Timeout in ms for the Tor proxy probe on startup. Defaults to 1500. */
  probeTimeoutMs?: number;
}
