// The organisation document: a single Loro CRDT doc holding the whole org map.
//
// Every edit goes through a named mutation that ends in one commit with a
// human-readable message and the author's display name. That commit history is
// the change log: it powers undo/redo, version preview and restore, and later
// attributes edits once documents sync peer-to-peer.

import { LoroDoc, LoroList, LoroMap, UndoManager, VersionVector, type Change, type Frontiers, type TreeID } from "loro-crdt";
import { isCoreKind, type CoreKind, type RoleKind } from "./vocabulary";

export const SCHEMA_VERSION = 1;

export type NodeType = "circle" | "role";
export type ListField = "accountabilities" | "domains" | "policies";

export interface Filler {
  personId: string;
  focus: string;
}

export interface OrgNode {
  id: TreeID;
  parentId: TreeID | null;
  type: NodeType;
  kind: RoleKind;
  name: string;
  purpose: string;
  accountabilities: string[];
  domains: string[];
  policies: string[];
  fillers: Filler[];
  children: OrgNode[];
}

export interface Person {
  id: string;
  name: string;
}

export interface OrgView {
  id: string;
  createdAt: number;
  root: OrgNode | null;
  nodes: Map<TreeID, OrgNode>;
  people: Person[];
}

/**
 * A change-log message as a key and values rather than a sentence, so every
 * reader sees it in their own language (see src/i18n/log.ts).
 */
export interface LogMessage {
  key: string;
  values?: Record<string, LogValue>;
}
export type LogValue = string | number | LogMessage;

const msg = (key: string, values?: Record<string, LogValue>): LogMessage => ({ key, values });

/** An error the user can act on; `code` is translated by the UI. */
export class OrgError extends Error {
  constructor(readonly code: "notOrgmap" | "notOrgmapJson" | "roleHasChildren" | "moveIntoSelf" | "removeRoot" | "otherOrg") {
    super(code);
  }
}

export interface HistoryEntry {
  /** `${counter}@${peer}` of the change's last op; stable across peers. */
  key: string;
  peer: string;
  frontiers: Frontiers;
  lamport: number;
  /** Unix time in milliseconds. */
  time: number;
  author: string;
  message: LogMessage;
}

// Container names inside the Loro doc.
const META = "meta";
const STRUCTURE = "structure";
const PEOPLE = "people";

// Keys inside a tree node's data map.
const LIST_KEYS: Record<ListField, string> = {
  accountabilities: "acc",
  domains: "dom",
  policies: "pol",
};

type Listener = () => void;

export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Commit messages carry the author so attribution survives reverts and merges. */
function encodeMessage(author: string, message: LogMessage): string {
  return JSON.stringify({ a: author, k: message.key, v: message.values });
}

export function decodeMessage(raw: string | undefined): { author: string; message: LogMessage } {
  if (!raw) return { author: "", message: msg("unnamed") };
  try {
    const v = JSON.parse(raw);
    if (v && typeof v.k === "string") return { author: String(v.a ?? ""), message: msg(v.k, v.v) };
    // Earlier versions stored an English sentence.
    if (v && typeof v.m === "string") return { author: String(v.a ?? ""), message: msg("text", { text: v.m }) };
  } catch {
    // Plain-text message from a foreign writer.
  }
  return { author: "", message: msg("text", { text: raw }) };
}

export class OrgDoc {
  readonly doc: LoroDoc;
  private undoManager: UndoManager;
  private listeners = new Set<Listener>();
  private cached: OrgView | null = null;
  private pushLabel: LogMessage = msg("unnamed");
  private depth = 0;
  author: string;

  private constructor(doc: LoroDoc, author: string) {
    this.doc = doc;
    this.author = author;
    doc.setRecordTimestamp(true);
    // Keep one Loro change per user action so each has its own log entry.
    doc.setChangeMergeInterval(0);
    doc.getTree(STRUCTURE).enableFractionalIndex(0);
    this.undoManager = new UndoManager(doc, {
      mergeInterval: 0,
      maxUndoSteps: 200,
      onPush: () => ({ value: JSON.stringify(this.pushLabel), cursors: [] }),
    });
    // Loro may deliver events after a microtask; mutations also invalidate
    // synchronously (see `changed`) so reads right after an edit are fresh.
    doc.subscribe(() => this.changed());
  }

  static create(opts: { name: string; author: string }): OrgDoc {
    const org = new OrgDoc(new LoroDoc(), opts.author);
    org.change(msg("created", { name: opts.name }), () => {
      const meta = org.doc.getMap(META);
      meta.set("id", newId());
      meta.set("createdAt", Date.now());
      meta.set("schemaVersion", SCHEMA_VERSION);
      const root = org.doc.getTree(STRUCTURE).createNode();
      initNode(root.data, "circle", opts.name);
    });
    // Creation is not something to undo.
    org.undoManager.clear();
    return org;
  }

  static fromBytes(bytes: Uint8Array, author: string): OrgDoc {
    const doc = new LoroDoc();
    doc.import(bytes);
    const org = new OrgDoc(doc, author);
    if (!org.doc.getMap(META).get("id")) throw new OrgError("notOrgmap");
    return org;
  }

  /** An empty document that is filled by syncing with peers (see src/sync). */
  static blank(author: string): OrgDoc {
    return new OrgDoc(new LoroDoc(), author);
  }

  // ---- reading -------------------------------------------------------------

  /** The organisation's id; empty while a blank document waits for its first sync. */
  get id(): string {
    return (this.doc.getMap(META).get("id") as string | undefined) ?? "";
  }

  get ready(): boolean {
    return this.id !== "" && this.doc.getTree(STRUCTURE).roots().length > 0;
  }

  view(): OrgView {
    if (!this.cached) this.cached = buildView(this.doc);
    return this.cached;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---- structure -----------------------------------------------------------

  addNode(parentId: TreeID, type: NodeType, name: string, kind: RoleKind = "normal", purpose = ""): TreeID {
    const parent = this.node(parentId);
    let id!: TreeID;
    this.change(msg(type === "circle" ? "addCircle" : "addRole", { name, parent: parent.name }), () => {
      const tree = this.doc.getTree(STRUCTURE);
      // Roles are listed before sub-circles inside a circle.
      const siblings = parent.children;
      const index = type === "role" ? siblings.filter((c) => c.type === "role").length : siblings.length;
      const n = tree.createNode(parentId, index);
      initNode(n.data, type, name, kind, purpose);
      id = n.id;
      // A role that receives children becomes a circle.
      if (parent.type === "role") this.data(parentId).set("type", "circle");
    });
    return id;
  }

  /** Adds the given core roles (names in the editor's language) that the circle does not have yet. */
  addCoreRoles(circleId: TreeID, roles: { kind: CoreKind; name: string; purpose: string }[]) {
    const circle = this.node(circleId);
    const missing = roles.filter((s) => !circle.children.some((c) => c.kind === s.kind));
    if (missing.length === 0) return;
    this.change(msg("addCoreRoles", { name: circle.name }), () => {
      const tree = this.doc.getTree(STRUCTURE);
      missing.forEach((s, i) => {
        const n = tree.createNode(circleId, i);
        initNode(n.data, "role", s.name, s.kind, s.purpose);
      });
    });
  }

  rename(id: TreeID, name: string) {
    const n = this.node(id);
    if (n.name === name) return;
    this.change(msg("rename", { from: n.name, to: name }), () => this.data(id).set("name", name));
  }

  setPurpose(id: TreeID, purpose: string) {
    const n = this.node(id);
    if (n.purpose === purpose) return;
    this.change(msg("purpose", { name: n.name }), () => this.data(id).set("purpose", purpose));
  }

  setKind(id: TreeID, kind: RoleKind) {
    const n = this.node(id);
    if (n.kind === kind) return;
    this.change(msg("kind", { name: n.name }), () => this.data(id).set("kind", kind));
  }

  setType(id: TreeID, type: NodeType) {
    const n = this.node(id);
    if (n.type === type) return;
    if (type === "role" && n.children.length > 0) throw new OrgError("roleHasChildren");
    this.change(msg(type === "circle" ? "toCircle" : "toRole", { name: n.name }), () =>
      this.data(id).set("type", type),
    );
  }

  move(id: TreeID, newParentId: TreeID, index?: number) {
    const n = this.node(id);
    const target = this.node(newParentId);
    if (this.isAncestor(id, newParentId)) throw new OrgError("moveIntoSelf");
    const sameParent = n.parentId === newParentId;
    this.change(sameParent ? msg("reorder", { name: n.name }) : msg("move", { name: n.name, to: target.name }), () => {
      this.doc.getTree(STRUCTURE).move(id, newParentId, index);
      if (target.type === "role") this.data(newParentId).set("type", "circle");
    });
  }

  remove(id: TreeID) {
    const n = this.node(id);
    if (n.parentId === null) throw new OrgError("removeRoot");
    const message = n.children.length ? msg("removeNested", { name: n.name, n: countDescendants(n) }) : msg("remove", { name: n.name });
    this.change(message, () => this.doc.getTree(STRUCTURE).delete(id));
  }

  // ---- list fields (accountabilities, domains, policies) -------------------

  addListItem(id: TreeID, field: ListField, text: string) {
    const n = this.node(id);
    this.change(msg("itemAdd", { field: fieldMsg(field), name: n.name, text }), () => this.list(id, field).push(text));
  }

  updateListItem(id: TreeID, field: ListField, index: number, text: string) {
    const n = this.node(id);
    if (n[field][index] === text) return;
    this.change(msg("itemEdit", { field: fieldMsg(field), name: n.name, text }), () => {
      const list = this.list(id, field);
      list.delete(index, 1);
      list.insert(index, text);
    });
  }

  removeListItem(id: TreeID, field: ListField, index: number) {
    const n = this.node(id);
    this.change(msg("itemRemove", { field: fieldMsg(field), name: n.name, text: n[field][index] }), () =>
      this.list(id, field).delete(index, 1),
    );
  }

  moveListItem(id: TreeID, field: ListField, from: number, to: number) {
    const n = this.node(id);
    if (from === to) return;
    this.change(msg("itemReorder", { field: fieldMsg(field), name: n.name }), () => {
      const list = this.list(id, field);
      const text = list.get(from) as string;
      list.delete(from, 1);
      list.insert(to, text);
    });
  }

  // ---- people and assignments ----------------------------------------------

  addPerson(name: string): string {
    const id = newId();
    this.change(msg("personAdd", { name }), () => {
      const p = this.doc.getMap(PEOPLE).setContainer(id, new LoroMap());
      p.set("name", name);
      p.set("createdAt", Date.now());
    });
    return id;
  }

  renamePerson(id: string, name: string) {
    const p = this.person(id);
    if (p.name === name) return;
    this.change(msg("personRename", { from: p.name, to: name }), () => this.personMap(id).set("name", name));
  }

  removePerson(id: string) {
    const p = this.person(id);
    this.change(msg("personRemove", { name: p.name }), () => {
      for (const n of this.view().nodes.values()) {
        if (n.fillers.some((f) => f.personId === id)) this.fillers(n.id).delete(id);
      }
      this.doc.getMap(PEOPLE).delete(id);
    });
  }

  assign(roleId: TreeID, personId: string, focus = "") {
    const n = this.node(roleId);
    if (n.fillers.some((f) => f.personId === personId)) return;
    this.change(msg("assign", { person: this.person(personId).name, name: n.name }), () =>
      this.fillers(roleId).set(personId, focus),
    );
  }

  unassign(roleId: TreeID, personId: string) {
    const n = this.node(roleId);
    this.change(msg("unassign", { person: this.person(personId).name, name: n.name }), () =>
      this.fillers(roleId).delete(personId),
    );
  }

  setFocus(roleId: TreeID, personId: string, focus: string) {
    const n = this.node(roleId);
    const current = n.fillers.find((f) => f.personId === personId);
    if (!current || current.focus === focus) return;
    this.change(msg("focus", { person: this.person(personId).name, name: n.name }), () =>
      this.fillers(roleId).set(personId, focus),
    );
  }

  // ---- history -------------------------------------------------------------

  get canUndo() {
    return this.undoManager.canUndo();
  }

  get canRedo() {
    return this.undoManager.canRedo();
  }

  get undoLabel(): LogMessage {
    return parseLabel(this.undoManager.topUndoValue());
  }

  get redoLabel(): LogMessage {
    return parseLabel(this.undoManager.topRedoValue());
  }

  undo() {
    const label = this.undoLabel;
    this.pushLabel = label;
    this.doc.setNextCommitMessage(encodeMessage(this.author, msg("undo", { what: label })));
    this.undoManager.undo();
    this.changed();
  }

  redo() {
    const label = this.redoLabel;
    this.pushLabel = label;
    this.doc.setNextCommitMessage(encodeMessage(this.author, msg("redo", { what: label })));
    this.undoManager.redo();
    this.changed();
  }

  /** All changes, newest first. */
  history(): HistoryEntry[] {
    const changes: Change[] = [...this.doc.getAllChanges().values()].flat();
    return changes
      .map((c) => {
        const { author, message } = decodeMessage(c.message);
        const last = c.counter + c.length - 1;
        return {
          key: `${last}@${c.peer}`,
          peer: c.peer,
          frontiers: [{ peer: c.peer, counter: last }],
          lamport: c.lamport,
          time: c.timestamp * 1000,
          author,
          message,
        };
      })
      .sort((a, b) => b.lamport - a.lamport || b.peer.localeCompare(a.peer));
  }

  /** The organisation as it was right after the given change. */
  viewAt(entry: HistoryEntry): OrgView {
    return buildView(this.doc.forkAt(entry.frontiers));
  }

  /** Brings the org back to the state after `entry`, as a new change on top of history. */
  restore(entry: HistoryEntry) {
    this.change(msg("restore", { time: entry.time, what: entry.message }), () => this.doc.revertTo(entry.frontiers));
  }

  // ---- files ---------------------------------------------------------------

  /** Full document including history; the `.orgmap` file format. */
  exportBytes(): Uint8Array {
    return this.doc.export({ mode: "snapshot" });
  }

  /** Merges another copy of the same organisation (e.g. a file someone edited offline). */
  merge(bytes: Uint8Array) {
    const other = new LoroDoc();
    other.import(bytes);
    if (other.getMap(META).get("id") !== this.id) throw new OrgError("otherOrg");
    this.doc.import(bytes);
    this.changed();
  }

  // ---- sync ----------------------------------------------------------------

  /** Compact description of what this copy contains, to send to a peer. */
  versionBytes(): Uint8Array {
    return this.doc.oplogVersion().encode();
  }

  /** Everything this copy has that a peer with `version` is missing. */
  updatesSince(version: Uint8Array): Uint8Array {
    return this.doc.export({ mode: "update", from: VersionVector.decode(version) });
  }

  /** Called with the encoded update of every local change (edits, undo, restore). */
  onLocalUpdate(listener: (update: Uint8Array) => void): () => void {
    return this.doc.subscribeLocalUpdates(listener);
  }

  /** Applies an update received from a peer. */
  applyRemote(update: Uint8Array) {
    this.doc.import(update);
    this.changed();
  }

  // ---- internals -----------------------------------------------------------

  /** Groups several mutations into one change (one log entry, one undo step). */
  batch(message: LogMessage, fn: () => void) {
    this.change(message, fn);
  }

  private change(message: LogMessage, fn: () => void) {
    this.depth++;
    try {
      fn();
    } finally {
      this.depth--;
      this.cached = null;
    }
    if (this.depth > 0) return;
    this.pushLabel = message;
    this.doc.commit({ message: encodeMessage(this.author, message) });
    this.changed();
  }

  private changed() {
    this.cached = null;
    this.listeners.forEach((l) => l());
  }

  private node(id: TreeID): OrgNode {
    const n = this.view().nodes.get(id);
    if (!n) throw new Error(`Unknown node ${id}`);
    return n;
  }

  private person(id: string): Person {
    const p = this.view().people.find((x) => x.id === id);
    if (!p) throw new Error(`Unknown person ${id}`);
    return p;
  }

  private data(id: TreeID): LoroMap {
    const n = this.doc.getTree(STRUCTURE).getNodeByID(id);
    if (!n) throw new Error(`Unknown node ${id}`);
    return n.data;
  }

  private list(id: TreeID, field: ListField): LoroList {
    const data = this.data(id);
    const key = LIST_KEYS[field];
    const existing = data.get(key);
    if (existing instanceof LoroList) return existing;
    return data.setContainer(key, new LoroList());
  }

  private fillers(id: TreeID): LoroMap {
    const data = this.data(id);
    const existing = data.get("fillers");
    if (existing instanceof LoroMap) return existing;
    return data.setContainer("fillers", new LoroMap());
  }

  private personMap(id: string): LoroMap {
    const p = this.doc.getMap(PEOPLE).get(id);
    if (!(p instanceof LoroMap)) throw new Error(`Unknown person ${id}`);
    return p;
  }

  private isAncestor(ancestorId: TreeID, id: TreeID | null): boolean {
    const nodes = this.view().nodes;
    while (id) {
      if (id === ancestorId) return true;
      id = nodes.get(id)?.parentId ?? null;
    }
    return false;
  }
}

function initNode(data: LoroMap, type: NodeType, name: string, kind: RoleKind = "normal", purpose = "") {
  data.set("type", type);
  data.set("kind", kind);
  data.set("name", name);
  data.set("purpose", purpose);
}

function fieldMsg(field: ListField): LogMessage {
  return msg(`field.${field}`);
}

function parseLabel(value: unknown): LogMessage {
  try {
    if (typeof value === "string") return JSON.parse(value) as LogMessage;
  } catch {
    // fall through
  }
  return msg("unnamed");
}

function countDescendants(n: OrgNode): number {
  return n.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

interface TreeJSON {
  id: TreeID;
  parent: TreeID | null;
  meta: Record<string, unknown>;
  children: TreeJSON[];
}

function buildView(doc: LoroDoc): OrgView {
  const meta = doc.getMap(META);
  const nodes = new Map<TreeID, OrgNode>();

  const toNode = (t: TreeJSON, parentId: TreeID | null): OrgNode => {
    const m = t.meta;
    const fillers = (m.fillers ?? {}) as Record<string, string>;
    const node: OrgNode = {
      id: t.id,
      parentId,
      type: (m.type as NodeType) ?? "role",
      // Documents from earlier versions may hold other core-role kinds.
      kind: isCoreKind(m.kind) ? m.kind : "normal",
      name: (m.name as string) ?? "",
      purpose: (m.purpose as string) ?? "",
      accountabilities: (m[LIST_KEYS.accountabilities] as string[]) ?? [],
      domains: (m[LIST_KEYS.domains] as string[]) ?? [],
      policies: (m[LIST_KEYS.policies] as string[]) ?? [],
      fillers: Object.entries(fillers).map(([personId, focus]) => ({ personId, focus })),
      children: [],
    };
    nodes.set(node.id, node);
    node.children = t.children.map((c) => toNode(c, node.id));
    return node;
  };

  const roots = doc.getTree(STRUCTURE).toJSON() as TreeJSON[];
  const root = roots.length ? toNode(roots[0], null) : null;

  const peopleJson = doc.getMap(PEOPLE).toJSON() as Record<string, { name: string; createdAt: number }>;
  const people = Object.entries(peopleJson)
    .sort(([, a], [, b]) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
    .map(([id, p]) => ({ id, name: p.name }));

  return {
    id: meta.get("id") as string,
    createdAt: (meta.get("createdAt") as number) ?? 0,
    root,
    nodes,
    people,
  };
}
