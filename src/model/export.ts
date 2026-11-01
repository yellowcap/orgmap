// Portable exports. The `.orgmap` file (see OrgDoc.exportBytes) is the
// lossless format; JSON and CSV are readable hand-offs for other tools. JSON
// keys are fixed; labels and CSV headers follow the interface language.

import type { TreeID } from "loro-crdt";
import { OrgDoc, OrgError, type OrgNode, type OrgView } from "./org";
import { isCoreKind } from "./vocabulary";
import { t } from "../i18n";
import { coreRoleName } from "../i18n/model";

export const JSON_FORMAT = "orgmap/v1";

export interface ExportedRole {
  name: string;
  type: "circle" | "role";
  /** Core role kind, "lead" or "rep"; omitted for normal roles. */
  kind?: string;
  /** Display name of the core role, e.g. "Lead". */
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
    vocabulary: Record<string, string>;
  };
  people: { name: string }[];
  structure: ExportedRole | null;
}

export function toJSON(view: OrgView): ExportedOrg {
  const names = new Map(view.people.map((p) => [p.id, p.name]));
  const convert = (n: OrgNode): ExportedRole => {
    const out: ExportedRole = {
      name: n.name,
      type: n.type,
      ...(n.kind !== "normal" ? { kind: n.kind, kindLabel: coreRoleName(n.kind) } : {}),
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
      vocabulary: vocabulary(),
    },
    people: view.people.map((p) => ({ name: p.name })),
    structure: view.root ? convert(view.root) : null,
  };
}

/** One row per circle or role. Multi-value cells are separated by line breaks. */
export function toCSV(view: OrgView): string {
  const names = new Map(view.people.map((p) => [p.id, p.name]));
  const v = vocabulary();
  const header = [t("csv.path"), t("common.name"), t("csv.type"), t("csv.coreRole"), v.purpose, v.accountabilities, v.domains, v.policies, t("csv.people")];
  const rows: string[][] = [header];
  const walk = (n: OrgNode, path: string[]) => {
    rows.push([
      path.join(" / "),
      n.name,
      n.type === "circle" ? v.circle : v.role,
      coreRoleName(n.kind) ?? "",
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

function vocabulary() {
  return {
    circle: t("vocab.circle"),
    role: t("vocab.role"),
    purpose: t("vocab.purpose"),
    accountabilities: t("vocab.accountabilities"),
    domains: t("vocab.domains"),
    policies: t("vocab.policies"),
    focus: t("vocab.focus"),
  };
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
  if (data?.format !== JSON_FORMAT || !data.structure) throw new OrgError("notOrgmapJson");
  const org = OrgDoc.create({ name: data.structure.name, author });
  const root = org.view().root!;
  org.batch({ key: "imported", values: { name: data.structure.name } }, () => {
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
        const kind = isCoreKind(child.kind) ? child.kind : "normal";
        const childId = org.addNode(id, child.type === "circle" ? "circle" : "role", child.name, kind);
        fill(childId, child);
      });
    };
    fill(root.id, data.structure!);
  });
  return org;
}
