import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { buildNodeClient, buildProxyUrl, probeProxy } from "../transport/node.js";

const BASE_OPTIONS = {
  url: "https://api.example.com/graphql",
  proxyUrl: "socks5h://127.0.0.1:9050",
};

describe("probeProxy", () => {
  let mockFetch: any;

  beforeEach(() => { mockFetch = jest.fn(); });

  it("returns true when IsTor is true", async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ IsTor: true, IP: "1.2.3.4" }) });
    expect(await probeProxy("socks5h://127.0.0.1:9050", mockFetch)).toBe(true);
  });

  it("returns false when IsTor is false", async () => {
    mockFetch.mockResolvedValue({ json: async () => ({ IsTor: false, IP: "85.54.204.43" }) });
    expect(await probeProxy("socks5h://127.0.0.1:9050", mockFetch)).toBe(false);
  });

  it("returns false when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("connection refused"));
    expect(await probeProxy("socks5h://127.0.0.1:9050", mockFetch)).toBe(false);
  });
});

describe("buildNodeClient", () => {
  it("returns connected status when Tor is available", () => {
    expect(buildNodeClient(BASE_OPTIONS, true).status).toBe("connected");
  });

  it("returns unavailable status and falls back to clearnet", () => {
    expect(buildNodeClient(BASE_OPTIONS, false).status).toBe("unavailable");
  });

  it("throws when strictTor is true and Tor is unavailable", () => {
    expect(() => buildNodeClient({ ...BASE_OPTIONS, strictTor: true }, false))
      .toThrow("Tor proxy unavailable");
  });
});

describe("buildProxyUrl", () => {
  const base = "socks5h://127.0.0.1:9050";

  it("returns base URL unchanged when not isolating (shared mode)", () => {
    expect(buildProxyUrl(base, false)).toBe(base);
  });

  it("embeds random credentials when isolating (isolated mode)", () => {
    const { username, password } = new URL(buildProxyUrl(base, true));
    expect(username).not.toBe("");
    expect(password).not.toBe("");
  });

  it("generates unique credentials per call to force a new Tor circuit", () => {
    const a = new URL(buildProxyUrl(base, true));
    const b = new URL(buildProxyUrl(base, true));
    expect(`${a.username}:${a.password}`).not.toBe(`${b.username}:${b.password}`);
  });
});
