import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockProbeProxy = jest.fn<(proxyUrl: string, timeoutMs?: number) => Promise<boolean>>();
const mockBuildNodeClient = jest.fn();

jest.unstable_mockModule("../transport/node.js", () => ({
  DEFAULT_PROXY_URL: "socks5h://127.0.0.1:9050",
  probeProxy: mockProbeProxy,
  buildNodeClient: mockBuildNodeClient,
  buildProxyUrl: jest.fn(),
}));

const { QuixoteClient } = await import("../client.js");

describe("QuixoteClient", () => {
  beforeEach(() => {
    mockProbeProxy.mockReset();
    mockBuildNodeClient.mockReset();
  });

  it("create() returns a ready client when Tor is available", async () => {
    mockProbeProxy.mockResolvedValue(true);
    mockBuildNodeClient.mockReturnValue({ client: { request: jest.fn() }, status: "connected" });

    const client = await QuixoteClient.create({ url: "https://api.example.com/graphql" });

    expect(await client.torStatus()).toBe("connected");
  });

  it("create() throws immediately when strictTor is true and Tor is unavailable", async () => {
    mockProbeProxy.mockResolvedValue(false);
    mockBuildNodeClient.mockImplementation(() => {
      throw new Error("Tor proxy unavailable and strictTor is enabled");
    });

    await expect(
      QuixoteClient.create({ onionUrl: "http://example.onion/graphql", strictTor: true })
    ).rejects.toThrow("Tor proxy unavailable");
  });

  it("constructor starts the probe eagerly and resolves on first await", async () => {
    mockProbeProxy.mockResolvedValue(false);
    mockBuildNodeClient.mockReturnValue({ client: { request: jest.fn() }, status: "unavailable" });

    const client = new QuixoteClient({ url: "https://api.example.com/graphql" });

    expect(mockProbeProxy).toHaveBeenCalledTimes(1);
    expect(await client.torStatus()).toBe("unavailable");
  });

  it("passes probeTimeoutMs through to probeProxy", async () => {
    mockProbeProxy.mockResolvedValue(true);
    mockBuildNodeClient.mockReturnValue({ client: { request: jest.fn() }, status: "connected" });

    await QuixoteClient.create({ onionUrl: "http://example.onion/graphql", strictTor: true, probeTimeoutMs: 500 });

    expect(mockProbeProxy).toHaveBeenCalledWith(expect.any(String), 500);
  });

  it("request() delegates to the underlying GraphQL client", async () => {
    const mockRequest = jest.fn<(doc: string, vars?: unknown) => Promise<unknown>>().mockResolvedValue({ transfers: [] });
    mockProbeProxy.mockResolvedValue(true);
    mockBuildNodeClient.mockReturnValue({ client: { request: mockRequest }, status: "connected" });

    const client = await QuixoteClient.create({ url: "https://api.example.com/graphql" });
    const result = await client.request("{ transfers { id } }", { address: "0xabc" });

    expect(mockRequest).toHaveBeenCalledWith("{ transfers { id } }", { address: "0xabc" });
    expect(result).toEqual({ transfers: [] });
  });
});
