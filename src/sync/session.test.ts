import { describe, expect, it } from "vitest";
import { OrgDoc } from "../model/org";
import { SyncSession, type Channel, type Transport } from "./session";

/** In-memory network. Messages are queued and delivered by `flush`. */
class Hub {
  private members = new Map<string, Member>();
  queue: (() => void)[] = [];
  shuffle = false;

  join(id: string): Transport {
    const m = new Member(id, this);
    this.members.set(id, m);
    for (const other of this.members.values()) {
      if (other.id === id) continue;
      this.queue.push(() => other.joinHandler?.(id));
      this.queue.push(() => m.joinHandler?.(other.id));
    }
    return m.transport();
  }

  leave(id: string) {
    this.members.delete(id);
    for (const other of this.members.values()) this.queue.push(() => other.leaveHandler?.(id));
  }

  deliver(from: string, kind: string, data: unknown, to?: string) {
    for (const m of this.members.values()) {
      if (m.id === from || (to && m.id !== to)) continue;
      this.queue.push(() => m.handlers.get(kind)?.(data, from));
    }
  }

  flush() {
    while (this.queue.length) {
      const i = this.shuffle ? Math.floor(Math.random() * this.queue.length) : 0;
      this.queue.splice(i, 1)[0]();
    }
  }
}

class Member {
  handlers = new Map<string, (data: unknown, from: string) => void>();
  joinHandler?: (id: string) => void;
  leaveHandler?: (id: string) => void;
  constructor(
    readonly id: string,
    private hub: Hub,
  ) {}

  transport(): Transport {
    const ch = <T>(kind: string): Channel<T> => ({
      send: (data, to) => this.hub.deliver(this.id, kind, data, to),
      on: (h) => this.handlers.set(kind, h as (d: unknown, f: string) => void),
    });
    return {
      hello: ch("hello"),
      update: ch("update"),
      presence: ch("presence"),
      onPeerJoin: (h) => (this.joinHandler = h),
      onPeerLeave: (h) => (this.leaveHandler = h),
      leave: () => this.hub.leave(this.id),
    };
  }
}

function names(org: OrgDoc): string[] {
  return [...org.view().nodes.values()].map((n) => n.name).sort();
}

describe("SyncSession", () => {
  it("fills a blank document from a peer and then syncs both ways", () => {
    const hub = new Hub();
    const coach = OrgDoc.create({ name: "Acme", author: "Coach" });
    coach.addNode(coach.view().root!.id, "role", "Finance");
    const guest = OrgDoc.blank("Guest");

    const a = new SyncSession(coach, hub.join("a"), "Coach");
    const b = new SyncSession(guest, hub.join("b"), "Guest");
    hub.flush();

    expect(guest.ready).toBe(true);
    expect(guest.id).toBe(coach.id);
    expect(names(guest)).toEqual(["Acme", "Finance"]);
    expect(b.state.peers.map((p) => p.name)).toEqual(["Coach"]);
    expect(a.state.status).toBe("connected");

    guest.addNode(guest.view().root!.id, "circle", "Ops");
    coach.addPerson("Bob");
    hub.flush();
    expect(names(coach)).toEqual(["Acme", "Finance", "Ops"]);
    expect(guest.view().people.map((p) => p.name)).toEqual(["Bob"]);
    expect(coach.history().some((e) => e.author === "Guest")).toBe(true);
  });

  it("merges two copies that diverged offline", () => {
    const hub = new Hub();
    const a = OrgDoc.create({ name: "Acme", author: "A" });
    const b = OrgDoc.fromBytes(a.exportBytes(), "B");
    a.addNode(a.view().root!.id, "role", "Made by A");
    b.addNode(b.view().root!.id, "role", "Made by B");
    new SyncSession(a, hub.join("a"), "A");
    new SyncSession(b, hub.join("b"), "B");
    hub.flush();
    expect(names(a)).toEqual(names(b));
    expect(names(a)).toEqual(["Acme", "Made by A", "Made by B"]);
  });

  it("converges with three peers and out-of-order delivery", () => {
    const hub = new Hub();
    hub.shuffle = true;
    const a = OrgDoc.create({ name: "Acme", author: "A" });
    const docs = [a, OrgDoc.blank("B"), OrgDoc.blank("C")];
    docs.forEach((d, i) => new SyncSession(d, hub.join(String(i)), d.author));
    hub.flush();
    const root = a.view().root!.id;
    const ops = a.addNode(root, "circle", "Ops");
    hub.flush();
    docs[1].addNode(ops, "role", "Shipping");
    docs[2].rename(ops, "Operations");
    a.addPerson("Dee");
    hub.flush();
    const json = docs.map((d) => JSON.stringify(d.doc.toJSON()));
    expect(json[1]).toBe(json[0]);
    expect(json[2]).toBe(json[0]);
    expect(names(a)).toEqual(["Acme", "Operations", "Shipping"]);
  });

  it("ignores a peer that has a different organisation", () => {
    const hub = new Hub();
    const a = OrgDoc.create({ name: "A", author: "A" });
    const b = OrgDoc.create({ name: "B", author: "B" });
    const sa = new SyncSession(a, hub.join("a"), "A");
    new SyncSession(b, hub.join("b"), "B");
    hub.flush();
    b.addPerson("Intruder");
    hub.flush();
    expect(a.view().root!.name).toBe("A");
    expect(a.view().people).toEqual([]);
    expect(sa.state.error).toMatch(/different organisation/);
  });

  it("shares selection as presence and forgets peers that leave", () => {
    const hub = new Hub();
    const a = OrgDoc.create({ name: "Acme", author: "A" });
    const sa = new SyncSession(a, hub.join("a"), "A");
    const sb = new SyncSession(OrgDoc.blank("B"), hub.join("b"), "B");
    hub.flush();
    sb.setSelection(a.view().root!.id);
    hub.flush();
    expect(sa.state.peers[0].selectedId).toBe(a.view().root!.id);
    sb.leave();
    hub.flush();
    expect(sa.state.peers).toEqual([]);
    expect(sa.state.status).toBe("waiting");
  });
});
