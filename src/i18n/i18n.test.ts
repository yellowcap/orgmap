import { afterAll, describe, expect, it } from "vitest";
import { de } from "./de";
import { en } from "./en";
import { fr } from "./fr";
import { it as itMessages } from "./it";
import { detectLang, setLang, t } from "./index";
import { formatLog } from "./model";
import { OrgDoc, decodeMessage } from "../model/org";
import { toCSV } from "../model/export";

afterAll(() => setLang("en", false));

describe("i18n", () => {
  it("picks the first supported browser language, else English", () => {
    expect(detectLang(["de-CH", "en"])).toBe("de");
    expect(detectLang(["es-ES", "fr-FR"])).toBe("fr");
    expect(detectLang(["it"])).toBe("it");
    expect(detectLang(["es", "pt-BR"])).toBe("en");
    expect(detectLang([])).toBe("en");
  });

  it("has every message in every language, with the same placeholders", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const messages of [de, fr, itMessages]) {
      expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect([key, names(messages[key])]).toEqual([key, names(en[key])]);
      }
    }
  });

  it("shows the change log in the reader's language", () => {
    const org = OrgDoc.create({ name: "Acme", author: "Ada" });
    const root = org.view().root!.id;
    const id = org.addNode(root, "role", "Finance");
    org.addListItem(id, "accountabilities", "Paying invoices");
    org.undo();
    const [undo, item] = org.history();
    setLang("de", false);
    expect(formatLog(item.message)).toBe("Verantwortlichkeit zu „Finance“ hinzugefügt: „Paying invoices“");
    expect(formatLog(undo.message)).toBe("Rückgängig: Verantwortlichkeit zu „Finance“ hinzugefügt: „Paying invoices“");
    setLang("fr", false);
    expect(formatLog(item.message)).toBe("Ajout à « Finance » (responsabilité) : « Paying invoices »");
    setLang("en", false);
    expect(formatLog(item.message)).toBe("Added responsibility to “Finance”: “Paying invoices”");
  });

  it("uses plural forms", () => {
    const org = OrgDoc.create({ name: "Acme", author: "Ada" });
    const root = org.view().root!.id;
    const team = org.addNode(root, "circle", "Ops");
    org.addNode(team, "role", "A");
    org.remove(team);
    setLang("it", false);
    expect(formatLog(org.history()[0].message)).toBe("Rimosso «Ops» e 1 elemento contenuto");
    setLang("en", false);
  });

  it("still shows entries written as English sentences by earlier versions", () => {
    const { message } = decodeMessage(JSON.stringify({ a: "Ada", m: "Renamed “A” to “B”" }));
    setLang("de", false);
    expect(formatLog(message)).toBe("Renamed “A” to “B”");
    setLang("en", false);
  });

  it("translates CSV headers", () => {
    const org = OrgDoc.create({ name: "Acme", author: "Ada" });
    setLang("fr", false);
    expect(toCSV(org.view()).split("\r\n")[0]).toBe(
      "Chemin,Nom,Type,Rôle clé,Raison d'être,Responsabilités,Périmètres de décision,Accords,Personnes",
    );
    expect(t("vocab.circle")).toBe("Équipe");
    setLang("en", false);
  });
});
