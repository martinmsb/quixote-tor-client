/** "isolated": new Tor circuit per query (default). "shared": reuse one circuit across queries. */
export type PrivacyMode = "isolated" | "shared";

export type TorStatus = "connected" | "unavailable" | "browser";

export interface QuixoteClientOptions {
  url: string;
  proxyUrl?: string;
  /** .onion equivalent of url, used in browser when not inside Tor Browser. */
  onionUrl?: string;
  /** Controls stream isolation. Defaults to "isolated" (new circuit per query). */
  mode?: PrivacyMode;
  /** Throw instead of falling back to clearnet when Tor is unavailable. */
  strictTor?: boolean;
}
