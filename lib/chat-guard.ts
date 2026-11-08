import { BlockList, isIP } from "net";
import { lookup } from "dns/promises";

// The server's own keys (set in the hosting settings) are only ever sent to these
// fixed addresses, never to an address chosen by whoever calls /api/chat.
export const SERVER_PROVIDERS = {
  groq: { baseUrl: "https://api.groq.com/openai/v1", envKey: "GROQ_API_KEY" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", envKey: "OPENROUTER_API_KEY" },
  mistral: { baseUrl: "https://api.mistral.ai/v1", envKey: "MISTRAL_API_KEY" },
} as const;

export type ServerProvider = keyof typeof SERVER_PROVIDERS;

/** The provider whose fixed address is exactly `baseUrl`, or null for any other address. */
export function serverProviderFor(baseUrl: string): ServerProvider | null {
  const wanted = baseUrl.trim().replace(/\/+$/, "").toLowerCase();
  for (const [name, p] of Object.entries(SERVER_PROVIDERS)) {
    if (p.baseUrl === wanted) return name as ServerProvider;
  }
  return null;
}

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 127], // unspecified and loopback
  ["::ffff:0:0", 96], // IPv4-mapped
  ["64:ff9b::", 96], // NAT64
  ["2002::", 16], // 6to4
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

const PRIVATE_ADDRESS =
  "The base URL points at a private or local network address, which this site can't call.";

/**
 * Checks an OpenAI-compatible base URL that a user brought along with their own key.
 * Returns a message saying what's wrong, or null when the address may be called.
 * Local addresses (for example LM Studio on your own computer) only work in `npm run dev`.
 */
export async function checkCustomEndpoint(raw: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return "The base URL isn't a valid web address.";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "The base URL must start with https://.";
  }
  if (url.username || url.password) {
    return "The base URL must not contain a user name or password.";
  }
  if (process.env.NODE_ENV !== "production") return null;

  if (url.protocol !== "https:") return "The base URL must start with https://.";
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(host)) return isPublicAddress(host) ? null : PRIVATE_ADDRESS;
  if (
    !host.includes(".") ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return PRIVATE_ADDRESS;
  }
  try {
    const addresses = await lookup(host, { all: true });
    if (addresses.length === 0 || addresses.some((a) => !isPublicAddress(a.address))) {
      return PRIVATE_ADDRESS;
    }
  } catch {
    return "Couldn't find the server named in the base URL.";
  }
  return null;
}
