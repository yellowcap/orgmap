import { OrgDoc } from "../model/org";
import { fromJSON } from "../model/export";
import { loadOrg, saveOrg } from "../model/storage";
import { readBytes } from "./files";

export async function persist(org: OrgDoc) {
  await saveOrg({ id: org.id, name: org.view().root?.name ?? "", updatedAt: Date.now(), bytes: org.exportBytes() });
}

/**
 * Opens an `.orgmap` or JSON file. An `.orgmap` of an organisation already in
 * the library is merged into it, so edits made elsewhere are combined.
 */
export async function importFile(file: File, author: string): Promise<{ org: OrgDoc; merged: boolean }> {
  if (file.name.toLowerCase().endsWith(".json")) {
    const org = fromJSON(JSON.parse(await file.text()), author);
    await persist(org);
    return { org, merged: false };
  }
  const bytes = await readBytes(file);
  const incoming = OrgDoc.fromBytes(bytes, author);
  const stored = await loadOrg(incoming.id);
  if (!stored) {
    await persist(incoming);
    return { org: incoming, merged: false };
  }
  const existing = OrgDoc.fromBytes(stored.bytes, author);
  existing.merge(bytes);
  await persist(existing);
  return { org: existing, merged: true };
}
