import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";

const mockHttpsRequest = jest.fn();

jest.unstable_mockModule("https", () => ({
  ...(jest.requireActual("https") as Record<string, unknown>),
  request: mockHttpsRequest,
}));

const { probeProxy, buildNodeClient, buildProxyUrl, DEFAULT_PROXY_URL } = await import("../transport/node.js");

// helpers
const baseOptions = (extra?: object) => ({
  url: "https://api.example.com/graphql",
  proxyUrl: DEFAULT_PROXY_URL,
  ...extra,
});

function respondWith(body: string) {
  mockHttpsRequest.mockImplementation((...args: any[]) => {
    args[1]({
      on: jest.fn((...a: any[]) => {
        if (a[0] === "data") a[1](body);
        if (a[0] === "end") a[1]();
      }),
    });
    return { on: jest.fn(), end: jest.fn() };
  });
}

function rejectWith(err: Error) {
  mockHttpsRequest.mockImplementation(() => ({
    on: jest.fn((...a: any[]) => { if (a[0] === "error") a[1](err); }),
    end: jest.fn(),
  }));
}

// ============================================
// probeProxy
// ============================================

describe("probeProxy", () => {
  beforeEach(() => { mockHttpsRequest.mockReset(); });

  it("returns true when IsTor is true", async () => {
    respondWith('{"IsTor":true,"IP":"1.2.3.4"}');
    expect(await probeProxy(DEFAULT_PROXY_URL)).toBe(true);
  });

  it("returns false when IsTor is false", async () => {
    respondWith('{"IsTor":false,"IP":"85.54.204.43"}');
    expect(await probeProxy(DEFAULT_PROXY_URL)).toBe(false);
  });

  it("returns false when the connection fails", async () => {
    rejectWith(new Error("ECONNREFUSED"));
    expect(await probeProxy(DEFAULT_PROXY_URL)).toBe(false);
  });

  it("returns false when response JSON is malformed", async () => {
    respondWith("not valid json");
    expect(await probeProxy(DEFAULT_PROXY_URL)).toBe(false);
  });
});

// ============================================
// buildProxyUrl
// ============================================

describe("buildProxyUrl", () => {
  it("returns base URL unchanged in shared mode", () => {
    expect(buildProxyUrl(DEFAULT_PROXY_URL, false)).toBe(DEFAULT_PROXY_URL);
  });

  it("generates unique credentials per call in isolated mode", () => {
    const a = new URL(buildProxyUrl(DEFAULT_PROXY_URL, true));
    const b = new URL(buildProxyUrl(DEFAULT_PROXY_URL, true));
    expect(`${a.username}:${a.password}`).not.toBe(`${b.username}:${b.password}`);
  });

  it("preserves host, port, and protocol", () => {
    const { protocol, hostname, port } = new URL(buildProxyUrl(DEFAULT_PROXY_URL, true));
    expect(protocol).toBe("socks5h:");
    expect(hostname).toBe("127.0.0.1");
    expect(port).toBe("9050");
  });
});

// ============================================
// buildNodeClient
// ============================================

describe("buildNodeClient", () => {
  let warnSpy: any;

  beforeEach(() => { warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); });

  it("returns connected status when Tor is available", () => {
    expect(buildNodeClient(baseOptions(), true).status).toBe("connected");
  });

  it("returns unavailable status and logs a warning when falling back to clearnet", () => {
    const { status } = buildNodeClient(baseOptions(), false);
    expect(status).toBe("unavailable");
    expect(warnSpy).toHaveBeenCalledWith("[quixote-tor-client] Tor unavailable — falling back to clearnet");
  });

  it("throws instead of warning when strictTor is true and Tor is unavailable", () => {
    expect(() => buildNodeClient(baseOptions({ strictTor: true }), false)).toThrow("Tor proxy unavailable");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
