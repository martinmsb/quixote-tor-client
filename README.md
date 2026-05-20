# quixote-tor-client

TypeScript client SDK for reading [Quixote](https://github.com/bilinearlabs/quixote) indexed data privately. Routes GraphQL queries through Tor — new circuit per query by default, with clearnet fallback when Tor isn't available.

## Install

```bash
npm install quixote-tor-client
```

Requires Node.js ≥ 18 and a running Tor daemon (default: `socks5h://127.0.0.1:9050`).

## Usage

```ts
import { QuixoteClient, gql } from "quixote-tor-client";

// With clearnet fallback (Tor preferred, clearnet if unavailable)
const client = new QuixoteClient({
  url: "https://your-quixote-endpoint/graphql",
  onionUrl: "http://yourquixote.onion/graphql",
});

// Strict mode — Tor required, no clearnet fallback needed
const strictClient = await QuixoteClient.create({
  onionUrl: "http://yourquixote.onion/graphql",
  strictTor: true,
});

const data = await client.request<{ transfers: Transfer[] }>(gql`
  query Transfers($address: String!) {
    transfers(address: $address) { id amount }
  }
`, { address: "0xabc..." });
```

Check whether Tor is active:

```ts
const status = await client.torStatus(); // "connected" | "unavailable"
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `url` | `string` | — | Clearnet endpoint. Used directly when Tor is unavailable. Required unless `strictTor: true`. |
| `onionUrl` | `string` | — | `.onion` endpoint. Used instead of `url` when Tor is available. |
| `strictTor` | `boolean` | `false` | Throw instead of falling back to clearnet when Tor is unavailable. |
| `proxyUrl` | `string` | `socks5h://127.0.0.1:9050` | SOCKS5 proxy. The `socks5h://` scheme resolves DNS through Tor, preventing leaks. |
| `isolateStreams` | `boolean` | `true` | Embed random SOCKS5 credentials per request to force a new Tor circuit per query. |
| `probeTimeoutMs` | `number` | `1500` | Timeout for the startup Tor probe. |

## Privacy model

**DNS leaks**: The client always uses `socks5h://` — hostnames are resolved through the proxy, never by your local DNS resolver.

**Stream isolation**: With `isolateStreams: true` (default), each `request()` call gets a fresh random SOCKS5 username/password pair. Tor treats different credentials as different circuits, so queries cannot be correlated by a malicious exit node or the endpoint server.

**Clearnet fallback**: If the Tor proxy is unreachable and `url` is provided, the client logs a warning and connects directly. The `.onion` address is never attempted without Tor. Use `strictTor: true` (with only `onionUrl`) to require Tor and eliminate the fallback entirely.

## Startup behaviour

On every instantiation the client probes the SOCKS proxy by calling `check.torproject.org/api/ip` through it. This adds up to `probeTimeoutMs` (default 1.5 s) to cold start when Tor is unavailable. On a healthy local daemon the probe typically completes in under 100 ms.

### Eager error surfacing

The constructor kicks off the probe asynchronously, so errors surface on the first `await` (e.g. `request()` or `torStatus()`), not at construction time. Use the static factory to surface errors immediately at startup:

```ts
const client = await QuixoteClient.create({
  onionUrl: "http://yourquixote.onion/graphql",
  strictTor: true,
});
```

The plain constructor is still available; `create()` is purely additive.
