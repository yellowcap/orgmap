// Portable exports. The `.orgmap` file (see OrgDoc.exportBytes) is the
// lossless format; JSON and CSV are readable hand-offs for other tools.

import type { TreeID } from "loro-crdt";
import { OrgDoc, type OrgNode, type OrgView } from "./org";
import { PRESET_IDS, type PresetId, type RoleKind } from "./presets";

export const JSON_FORMAT = "orgmap/v1";

export interface ExportedRole {
  name: string;
  type: "circle" | "role";
  /** Special role kind, e.g. "lead" or "rep"; omitted for normal roles. */
  kind?: string;
  /** Preset-specific name of the special role, e.g. "Circle Lead". */
  kindLabel?: string;
  purpose: string;
  accountabilities: string[];
  domains: string[];
  policies: string[];
  people: { name: string; focus?: string }[];
  roles?: ExportedRole[];
}

export interface ExportedOrg {
  format: typeof JSON_FORMAT;
  exportedAt: string;
  organisation: {
    id: string;
    name: string;
    preset: string;
    vocabulary: Record<string, string>;
  };
  people: { name: string }[];
  structure: ExportedRole | null;
}

export function toJSON(view: OrgView): ExportedOrg {
  const names = new Map(view.people.map((p) => [p.id, p.name]));
  const convert = (n: OrgNode): ExportedRole => {
    const special = view.preset.specialRoles.find((s) => s.kind === n.kind);
    const out: ExportedRole = {
      name: n.name,
      type: n.type,
      ...(n.kind !== "normal" ? { kind: n.kind, kindLabel: special?.name ?? n.kind } : {}),
      purpose: n.purpose,
      accountabilities: n.accountabilities,
      domains: n.domains,
      policies: n.policies,
      people: n.fillers.map((f) => ({ name: names.get(f.personId) ?? "?", ...(f.focus ? { focus: f.focus } : {}) })),
    };
    if (n.type === "circle") out.roles = n.children.map(convert);
    return out;
  };
  return {
    format: JSON_FORMAT,
    exportedAt: new Date().toISOString(),
    organisation: {
      id: view.id,
      name: view.root?.name ?? "",
      preset: view.preset.id,
      vocabulary: { ...view.preset.vocabulary },
    },
    people: view.people.map((p) => ({ name: p.name })),
    structure: view.root ? convert(view.root) : null,
  };
}

const CSV_COLUMNS = ["Path", "Name", "Type", "Special role", "Purpose", "Accountabilities", "Domains", "Policies", "People"];

/** One row per circle or role. Multi-value cells are separated by line breaks. */
export function toCSV(view: OrgView): string {
  const names = new Map(view.people.map((p) => [p.id, p.name]));
  const v = view.preset.vocabulary;
  const header = CSV_COLUMNS.map((c) =>
    c === "Purpose" ? v.purpose : c === "Accountabilities" ? v.accountabilities : c === "Domains" ? v.domains : c === "Policies" ? v.policies : c,
  );
  const rows: string[][] = [header];
  const walk = (n: OrgNode, path: string[]) => {
    const special = view.preset.specialRoles.find((s) => s.kind === n.kind);
    rows.push([
      path.join(" / "),
      n.name,
      n.type === "circle" ? v.circle : v.role,
      n.kind === "normal" ? "" : (special?.name ?? n.kind),
      n.purpose,
      n.accountabilities.join("\n"),
      n.domains.join("\n"),
      n.policies.join("\n"),
      n.fillers.map((f) => (names.get(f.personId) ?? "?") + (f.focus ? ` (${f.focus})` : "")).join("\n"),
    ]);
    n.children.forEach((c) => walk(c, [...path, n.name]));
  };
  if (view.root) walk(view.root, []);
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function csvCell(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function fileBaseName(view: OrgView): string {
  const name = (view.root?.name ?? "organisation")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  return `${name || "organisation"}-${date}`;
}

/** Builds a new organisation from an `orgmap/v1` JSON export or template, as one change. */
export function fromJSON(data: ExportedOrg, author: string): OrgDoc {
  if (data?.format !== JSON_FORMAT || !data.structure) throw new Error("Not an orgmap JSON export");
  const preset = (PRESET_IDS as string[]).includes(data.organisation.preset) ? (data.organisation.preset as PresetId) : "neutral";
  const org = OrgDoc.create({ name: data.structure.name, preset, author });
  const root = org.view().root!;
  org.batch(`Imported structure of ${data.structure.name}`, () => {
    const people = new Map<string, string>();
    const personId = (name: string) => {
      if (!people.has(name)) people.set(name, org.addPerson(name));
      return people.get(name)!;
    };
    data.people?.forEach((p) => personId(p.name));
    const fill = (id: TreeID, r: ExportedRole) => {
      if (r.purpose) org.setPurpose(id, r.purpose);
      for (const field of ["accountabilities", "domains", "policies"] as const) {
        r[field]?.forEach((t) => org.addListItem(id, field, t));
      }
      r.people?.forEach((p) => org.assign(id, personId(p.name), p.focus ?? ""));
      r.roles?.forEach((child) => {
        const kind = (child.kind ?? "normal") as RoleKind;
        const childId = org.addNode(id, child.type === "circle" ? "circle" : "role", child.name, kind);
        fill(childId, child);
      });
    };
    fill(root.id, data.structure!);
  });
  return org;
}
