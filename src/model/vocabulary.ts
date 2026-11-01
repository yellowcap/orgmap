// The words the app uses for its building blocks, in plain language.
// Internally a team is a "circle" node; only these labels reach the screen.

export type CoreKind = "lead" | "rep";
export type RoleKind = "normal" | CoreKind;

export const VOCAB = {
  circle: "Team",
  circles: "Teams",
  role: "Role",
  roles: "Roles",
  purpose: "Purpose",
  accountabilities: "Responsibilities",
  domains: "Areas of authority",
  policies: "Agreements",
  focus: "Focus",
};

export type Vocabulary = typeof VOCAB;

/** Roles offered as "core roles" in every team, in display order. */
export const CORE_ROLES: { kind: CoreKind; name: string; purpose: string }[] = [
  { kind: "lead", name: "Lead", purpose: "Holds the team's priorities and structure" },
  { kind: "rep", name: "Representative", purpose: "Represents the team in the wider organisation" },
];

export function coreRoleName(kind: RoleKind): string | undefined {
  if (kind === "normal") return undefined;
  return CORE_ROLES.find((r) => r.kind === kind)?.name ?? kind;
}
