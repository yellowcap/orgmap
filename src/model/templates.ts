// Starter structures offered when creating an organisation, per language.

import type { Lang } from "../i18n";
import type { ExportedOrg, ExportedRole } from "./export";

function role(name: string, purpose = "", accountabilities: string[] = []): ExportedRole {
  return { name, type: "role", purpose, accountabilities, domains: [], policies: [], people: [] };
}

function circle(name: string, purpose: string, roles: ExportedRole[], domains: string[] = []): ExportedRole {
  return { name, type: "circle", purpose, accountabilities: [], domains, policies: [], people: [], roles };
}

// The same housing cooperative in each language, in this order:
// organisation, its purpose; then each team or role with purpose and responsibilities.
const EXAMPLE_TEXT: Record<Lang, string[]> = {
  en: [
    "Example Cooperative", "Affordable, well-designed housing for the neighbourhood",
    "Strategy", "A clear direction everyone can act on", "Proposing yearly priorities", "Tracking progress against priorities",
    "Projects", "Buildings delivered on time and within budget", "Project schedules",
    "Project Lead", "Planning and coordinating project phases",
    "Architecture", "Producing plans and permits",
    "Site Coordination", "Scheduling contractors", "Weekly site reports",
    "Members", "Members feel informed and involved",
    "Member Care", "Answering member questions",
    "Events", "Organising the yearly assembly",
    "Finance", "Healthy finances and transparent books",
    "Bookkeeping", "Paying invoices", "Monthly accounts",
    "Funding", "Applying for grants and loans",
  ],
  de: [
    "Beispiel-Genossenschaft", "Bezahlbarer, gut gestalteter Wohnraum für das Quartier",
    "Strategie", "Eine klare Richtung, nach der alle handeln können", "Jahresprioritäten vorschlagen", "Fortschritt bei den Prioritäten verfolgen",
    "Projekte", "Bauten termingerecht und im Budget fertiggestellt", "Projekt-Terminpläne",
    "Projektleitung", "Projektphasen planen und koordinieren",
    "Architektur", "Pläne und Baugesuche erstellen",
    "Baustellenkoordination", "Handwerker einplanen", "Wöchentliche Baustellenberichte",
    "Mitglieder", "Mitglieder fühlen sich informiert und einbezogen",
    "Mitgliederbetreuung", "Fragen von Mitgliedern beantworten",
    "Anlässe", "Die jährliche Generalversammlung organisieren",
    "Finanzen", "Gesunde Finanzen und transparente Buchhaltung",
    "Buchhaltung", "Rechnungen bezahlen", "Monatsabschlüsse",
    "Finanzierung", "Fördermittel und Darlehen beantragen",
  ],
  fr: [
    "Coopérative exemple", "Des logements abordables et bien conçus pour le quartier",
    "Stratégie", "Une direction claire sur laquelle chacun peut agir", "Proposer les priorités annuelles", "Suivre l'avancement des priorités",
    "Projets", "Des bâtiments livrés dans les délais et le budget", "Plannings des projets",
    "Direction de projet", "Planifier et coordonner les phases du projet",
    "Architecture", "Établir les plans et les demandes de permis",
    "Coordination de chantier", "Planifier les entreprises", "Rapports de chantier hebdomadaires",
    "Membres", "Les membres se sentent informés et impliqués",
    "Suivi des membres", "Répondre aux questions des membres",
    "Événements", "Organiser l'assemblée générale annuelle",
    "Finances", "Des finances saines et une comptabilité transparente",
    "Comptabilité", "Payer les factures", "Bouclements mensuels",
    "Financement", "Demander des subventions et des prêts",
  ],
  it: [
    "Cooperativa di esempio", "Abitazioni accessibili e ben progettate per il quartiere",
    "Strategia", "Una direzione chiara su cui tutti possono agire", "Proporre le priorità annuali", "Seguire i progressi sulle priorità",
    "Progetti", "Edifici consegnati nei tempi e nel budget", "Programmi dei progetti",
    "Direzione progetto", "Pianificare e coordinare le fasi del progetto",
    "Architettura", "Preparare piani e domande di costruzione",
    "Coordinamento cantiere", "Pianificare le imprese", "Rapporti di cantiere settimanali",
    "Soci", "I soci si sentono informati e coinvolti",
    "Assistenza soci", "Rispondere alle domande dei soci",
    "Eventi", "Organizzare l'assemblea annuale",
    "Finanze", "Finanze sane e contabilità trasparente",
    "Contabilità", "Pagare le fatture", "Chiusure mensili",
    "Finanziamenti", "Richiedere contributi e prestiti",
  ],
};

export function exampleOrg(lang: Lang): ExportedOrg {
  const s = [...EXAMPLE_TEXT[lang]];
  const next = () => s.shift()!;
  const [orgName, orgPurpose] = [next(), next()];
  const strategy = role(next(), next(), [next(), next()]);
  const [projects, projectsPurpose, schedules] = [next(), next(), next()];
  const projectRoles = [role(next(), "", [next()]), role(next(), "", [next()]), role(next(), "", [next(), next()])];
  const [members, membersPurpose] = [next(), next()];
  const memberRoles = [role(next(), "", [next()]), role(next(), "", [next()])];
  const [finance, financePurpose] = [next(), next()];
  const financeRoles = [role(next(), "", [next(), next()]), role(next(), "", [next()])];
  return {
    format: "orgmap/v1",
    exportedAt: "2026-11-01T00:00:00.000Z",
    organisation: { id: "", name: orgName, vocabulary: {} },
    people: [],
    structure: circle(orgName, orgPurpose, [
      strategy,
      circle(projects, projectsPurpose, projectRoles, [schedules]),
      circle(members, membersPurpose, memberRoles),
      circle(finance, financePurpose, financeRoles),
    ]),
  };
}
