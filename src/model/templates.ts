// Starter structures offered when creating an organisation.

import type { ExportedOrg, ExportedRole } from "./export";

function role(name: string, purpose = "", accountabilities: string[] = []): ExportedRole {
  return { name, type: "role", purpose, accountabilities, domains: [], policies: [], people: [] };
}

function circle(name: string, purpose: string, roles: ExportedRole[], domains: string[] = []): ExportedRole {
  return { name, type: "circle", purpose, accountabilities: [], domains, policies: [], people: [], roles };
}

export const EXAMPLE_ORG: ExportedOrg = {
  format: "orgmap/v1",
  exportedAt: "2026-11-01T00:00:00.000Z",
  organisation: { id: "", name: "Example Cooperative", preset: "neutral", vocabulary: {} },
  people: [],
  structure: circle("Example Cooperative", "Affordable, well-designed housing for the neighbourhood", [
    role("Strategy", "A clear direction everyone can act on", ["Proposing yearly priorities", "Tracking progress against priorities"]),
    circle(
      "Projects",
      "Buildings delivered on time and within budget",
      [
        role("Project Lead", "", ["Planning and coordinating project phases"]),
        role("Architecture", "", ["Producing plans and permits"]),
        role("Site Coordination", "", ["Scheduling contractors", "Weekly site reports"]),
      ],
      ["Project schedules"],
    ),
    circle("Members", "Members feel informed and involved", [
      role("Member Care", "", ["Answering member questions"]),
      role("Events", "", ["Organising the yearly assembly"]),
    ]),
    circle("Finance", "Healthy finances and transparent books", [
      role("Bookkeeping", "", ["Paying invoices", "Monthly accounts"]),
      role("Funding", "", ["Applying for grants and loans"]),
    ]),
  ]),
};
