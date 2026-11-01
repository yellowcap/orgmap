// Kinds of role. Display names live with the translations (src/i18n).

export const CORE_KINDS = ["lead", "rep"] as const;
export type CoreKind = (typeof CORE_KINDS)[number];
export type RoleKind = "normal" | CoreKind;

export function isCoreKind(v: unknown): v is CoreKind {
  return (CORE_KINDS as readonly unknown[]).includes(v);
}
