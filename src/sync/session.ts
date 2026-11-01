// Live sync of one organisation between browsers.
//
// The protocol is small because the CRDT does the hard work:
// - when a peer connects, both sides send `hello` with their org id and version;
// - each side answers a `hello` with the updates the other is missing;
// - every local change is broadcast as an `update`;
// - `presence` carries display name, colour and current selection (never stored).
// Updates can arrive in any order or twice; Loro handles both.

import type { TreeID } from "loro-crdt";
import type { OrgDoc } from "../model/org";

// Type aliases (not interfaces) so they count as JSON for the transport.
export type Hello = {
  orgId: string;
  version: string; // base64 of Loro's encoded version vector
};

export type Presence = {
  name: string;
  selectedId: TreeID | null;
};

export interface Channel<T> {
  send(data: T, to?: string): void;
  on(handler: (data: T, from: string) => void): void;
}

/** What a session needs from the network; see trystero.ts for the real one. */
export interface Transport {
  hello: Channel<Hello>;
  update: Channel<Uint8Array>;
  presence: Channel<Presence>;
  onPeerJoin(handler: (peerId: string) => void): void;
  onPeerLeave(handler: (peerId: string) => void): void;
  leave(): void;
}

export interface Peer {
  id: string;
  name: string;
  colour: string;
  selectedId: TreeID | null;
  /** Set once we have received this peer's state. */
  synced: boolean;
}

export type SessionStatus = "waiting" | "connected" | "closed";

// Muted ink colours that read well on white next to the terracotta accent.
const PEER_COLOURS = ["#2f6690", "#5a7d2a", "#7b4f9d", "#a07a00", "#1f7a74", "#9c3d54", "#5c5c5c"];

export function peerColour(peerId: string): string {
  let h = 0;
  for (const c of peerId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PEER_COLOURS[h % PEER_COLOURS.length];
}

export class SyncSession {
  readonly org: OrgDoc;
  private transport: Transport;
  private me: Presence;
  private peers = new Map<string, Peer>();
  private rejected = new Set<string>();
  private listeners = new Set<() => void>();
  private stopLocal: () => void;
  private snapshot: { status: SessionStatus; peers: Peer[]; error: string } = { status: "waiting", peers: [], error: "" };
  private status: SessionStatus = "waiting";
  private error = "";

  constructor(org: OrgDoc, transport: Transport, name: string) {
    this.org = org;
    this.transport = transport;
    this.me = { name, selectedId: null };

    transport.onPeerJoin((id) => {
      this.peers.set(id, { id, name: "", colour: peerColour(id), selectedId: null, synced: false });
      transport.hello.send(this.hello(), id);
      transport.presence.send(this.me, id);
      this.emit();
    });

    transport.onPeerLeave((id) => {
      this.peers.delete(id);
      this.rejected.delete(id);
      this.emit();
    });

    transport.hello.on((msg, from) => {
      if (msg.orgId && this.org.id && msg.orgId !== this.org.id) {
        // Same link, different organisation: never mix documents.
        this.rejected.add(from);
        this.error = "Someone with this link has a different organisation open. Their changes are ignored.";
        this.emit();
        return;
      }
      if (this.org.ready) transport.update.send(this.org.updatesSince(fromBase64(msg.version)), from);
    });

    transport.update.on((bytes, from) => {
      if (this.rejected.has(from)) return;
      this.org.applyRemote(bytes);
      const peer = this.peers.get(from);
      if (peer && !peer.synced) {
        peer.synced = true;
        this.emit();
      }
    });

    transport.presence.on((p, from) => {
      const peer = this.peers.get(from) ?? { id: from, name: "", colour: peerColour(from), selectedId: null, synced: false };
      this.peers.set(from, { ...peer, name: p.name, selectedId: p.selectedId });
      this.emit();
    });

    this.stopLocal = org.onLocalUpdate((bytes) => transport.update.send(bytes));
  }

  get state() {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setName(name: string) {
    if (name === this.me.name) return;
    this.me = { ...this.me, name };
    this.transport.presence.send(this.me);
  }

  setSelection(selectedId: TreeID | null) {
    if (selectedId === this.me.selectedId) return;
    this.me = { ...this.me, selectedId };
    this.transport.presence.send(this.me);
  }

  leave() {
    this.stopLocal();
    this.transport.leave();
    this.peers.clear();
    this.status = "closed";
    this.emit();
  }

  private hello(): Hello {
    return { orgId: this.org.id, version: toBase64(this.org.versionBytes()) };
  }

  private emit() {
    if (this.status !== "closed") this.status = this.peers.size > 0 ? "connected" : "waiting";
    this.snapshot = { status: this.status, peers: [...this.peers.values()], error: this.error };
    this.listeners.forEach((l) => l());
  }
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
