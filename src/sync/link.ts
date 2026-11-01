// Share links and the secrets behind them.
//
// A link looks like  https://host/path/#/join/<orgId>/<key>
// Everything after `#` stays in the browser: it is never sent to the web
// server. The key is the room password: peers without it cannot complete the
// connection handshake. The room name on the public signalling relays is
// derived from the key, so it reveals neither the organisation nor the key.

const KEY_PREFIX = "orgmap.room.";
const LIVE_PREFIX = "orgmap.live.";
const TURN_KEY = "orgmap.turn";

export function generateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function roomIdFor(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`orgmap-room:${key}`));
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function shareLink(orgId: string, key: string): string {
  return `${location.origin}${location.pathname}#/join/${encodeURIComponent(orgId)}/${key}`;
}

export function parseJoinHash(hash: string): { orgId: string; key: string } | null {
  const m = hash.match(/^#\/join\/([^/]+)\/([A-Za-z0-9_-]{16,})$/);
  return m ? { orgId: decodeURIComponent(m[1]), key: m[2] } : null;
}

// Keys are kept per browser, outside the document, so a shared .orgmap file
// does not grant access to the live session.

function get(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

function set(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    // Storage unavailable; sharing works for this session only.
  }
}

export const roomKey = {
  get: (orgId: string) => get(KEY_PREFIX + orgId),
  set: (orgId: string, key: string) => set(KEY_PREFIX + orgId, key),
};

/** Whether this browser should reconnect to the live session when the org opens. */
export const liveFlag = {
  get: (orgId: string) => get(LIVE_PREFIX + orgId) === "1",
  set: (orgId: string, on: boolean) => set(LIVE_PREFIX + orgId, on ? "1" : null),
};

export interface TurnSettings {
  urls: string;
  username: string;
  credential: string;
}

/** Optional TURN relay for networks that block direct connections. */
export const turnSettings = {
  get(): TurnSettings | null {
    try {
      const v = JSON.parse(get(TURN_KEY) ?? "null");
      return v && typeof v.urls === "string" && v.urls ? v : null;
    } catch {
      return null;
    }
  },
  set(v: TurnSettings | null) {
    set(TURN_KEY, v && v.urls.trim() ? JSON.stringify(v) : null);
  },
};
