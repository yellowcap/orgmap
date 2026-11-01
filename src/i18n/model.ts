// Translations for things that come from the data model: change-log messages,
// errors and core roles.

import { OrgError, type LogMessage } from "../model/org";
import { CORE_KINDS, type CoreKind, type RoleKind } from "../model/vocabulary";
import { en } from "./en";
import { formatDateTime, t, tp, type MessageKey, type Values } from "./index";

/** Renders a change-log message in the current language. */
export function formatLog(m: LogMessage): string {
  // Entries written by earlier versions as English sentences.
  if (m.key === "text") return String(m.values?.text ?? "");
  const values: Values = {};
  for (const [name, v] of Object.entries(m.values ?? {})) {
    if (typeof v === "object") values[name] = formatLog(v);
    else if (name === "time" && typeof v === "number") values[name] = formatDateTime(v);
    else values[name] = v === "" ? t("log.untitled") : v;
  }
  const key = `log.${m.key}`;
  if (key in en) return t(key as MessageKey, values);
  if (`${key}.other` in en) return tp(key, Number(values.n ?? 0), values);
  // Written by a newer version that knows more kinds of change.
  return m.key;
}

export function errorMessage(e: unknown): string {
  if (e instanceof OrgError) return t(`error.${e.code}`);
  return e instanceof Error ? e.message : String(e);
}

export function coreRoleName(kind: RoleKind): string | undefined {
  return kind === "normal" ? undefined : t(`core.${kind}.name`);
}

/** Core roles with names and purposes in the current language, for adding to a team. */
export function coreRoles(): { kind: CoreKind; name: string; purpose: string }[] {
  return CORE_KINDS.map((kind) => ({ kind, name: t(`core.${kind}.name`), purpose: t(`core.${kind}.purpose`) }));
}
