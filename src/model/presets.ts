// Paradigm presets: vocabulary and the special roles each paradigm uses.
// Presets only change labels and suggestions; the underlying model is the same.

export type PresetId = "holacracy" | "sociocracy" | "s3" | "neutral";

export type SpecialKind = "lead" | "rep" | "facilitator" | "secretary";
export type RoleKind = "normal" | SpecialKind;

export interface Vocabulary {
  circle: string;
  circles: string;
  role: string;
  roles: string;
  purpose: string;
  accountabilities: string;
  domains: string;
  policies: string;
  focus: string;
}

export interface Preset {
  id: PresetId;
  label: string;
  description: string;
  vocabulary: Vocabulary;
  /** Special roles offered as "core roles" in every circle, in display order. */
  specialRoles: { kind: SpecialKind; name: string; purpose: string }[];
}

export const PRESETS: Record<PresetId, Preset> = {
  holacracy: {
    id: "holacracy",
    label: "Holacracy-style",
    description: "Circles, roles with purpose, accountabilities and domains; four core roles per circle.",
    vocabulary: {
      circle: "Circle",
      circles: "Circles",
      role: "Role",
      roles: "Roles",
      purpose: "Purpose",
      accountabilities: "Accountabilities",
      domains: "Domains",
      policies: "Policies",
      focus: "Focus",
    },
    specialRoles: [
      { kind: "lead", name: "Circle Lead", purpose: "Holds the circle's purpose, priorities and structure" },
      { kind: "rep", name: "Circle Rep", purpose: "Carries the circle's tensions into the broader circle" },
      { kind: "facilitator", name: "Facilitator", purpose: "Runs the circle's meetings according to the agreed process" },
      { kind: "secretary", name: "Secretary", purpose: "Schedules meetings and keeps the circle's records" },
    ],
  },
  sociocracy: {
    id: "sociocracy",
    label: "Sociocracy",
    description: "Circles with aims and domains, double-linked through leader and delegate.",
    vocabulary: {
      circle: "Circle",
      circles: "Circles",
      role: "Role",
      roles: "Roles",
      purpose: "Aim",
      accountabilities: "Responsibilities",
      domains: "Domain",
      policies: "Policies",
      focus: "Focus",
    },
    specialRoles: [
      { kind: "lead", name: "Leader", purpose: "Link from the parent circle; keeps operations on track" },
      { kind: "rep", name: "Delegate", purpose: "Link to the parent circle; carries the circle's view upwards" },
      { kind: "facilitator", name: "Facilitator", purpose: "Facilitates the circle's meetings" },
      { kind: "secretary", name: "Secretary", purpose: "Keeps minutes and the circle's records" },
    ],
  },
  s3: {
    id: "s3",
    label: "Sociocracy 3.0",
    description: "Domains described by their primary driver and key responsibilities.",
    vocabulary: {
      circle: "Domain",
      circles: "Domains",
      role: "Role",
      roles: "Roles",
      purpose: "Primary driver",
      accountabilities: "Key responsibilities",
      domains: "Sub-domains",
      policies: "Agreements",
      focus: "Focus",
    },
    specialRoles: [
      { kind: "rep", name: "Delegate", purpose: "Represents the team in another team's decisions" },
      { kind: "facilitator", name: "Facilitator", purpose: "Facilitates the team's meetings" },
    ],
  },
  neutral: {
    id: "neutral",
    label: "Neutral",
    description: "Plain language: teams, roles, responsibilities and areas of authority.",
    vocabulary: {
      circle: "Team",
      circles: "Teams",
      role: "Role",
      roles: "Roles",
      purpose: "Purpose",
      accountabilities: "Responsibilities",
      domains: "Areas of authority",
      policies: "Agreements",
      focus: "Focus",
    },
    specialRoles: [
      { kind: "lead", name: "Lead", purpose: "Holds the team's priorities and structure" },
      { kind: "rep", name: "Representative", purpose: "Represents the team in the wider organisation" },
    ],
  },
};

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];

export function kindLabel(preset: Preset, kind: RoleKind): string | undefined {
  if (kind === "normal") return undefined;
  return preset.specialRoles.find((r) => r.kind === kind)?.name ?? kind;
}
