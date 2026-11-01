import { describe, expect, it } from "vitest";
import { OrgDoc } from "./org";
import { fromJSON, toCSV, toJSON } from "./export";

function sample() {
  const org = OrgDoc.create({ name: "Acme", author: "Ada" });
  const root = org.view().root!.id;
  const ops = org.addNode(root, "circle", "Operations");
  const finance = org.addNode(root, "role", "Finance");
  return { org, root, ops, finance };
}

describe("OrgDoc structure", () => {
  it("creates an organisation with a root circle", () => {
    const { org } = sample();
    const v = org.view();
    expect(v.root?.name).toBe("Acme");
    expect(v.root?.type).toBe("circle");
    expect(v.root?.children.map((c) => c.name)).toEqual(["Finance", "Operations"]);
  });

  it("moves a role into another circle and rejects cycles", () => {
    const { org, root, ops, finance } = sample();
    org.move(finance, ops);
    expect(org.view().nodes.get(finance)?.parentId).toBe(ops);
    const sub = org.addNode(ops, "circle", "Sub");
    expect(() => org.move(ops, sub)).toThrow();
    expect(() => org.remove(root)).toThrow();
  });

  it("turns a role into a circle when it receives children", () => {
    const { org, finance } = sample();
    org.addNode(finance, "role", "Bookkeeping");
    expect(org.view().nodes.get(finance)?.type).toBe("circle");
  });

  it("adds the core roles once", () => {
    const { org, ops } = sample();
    org.addCoreRoles(ops);
    org.addCoreRoles(ops);
    const kinds = org.view().nodes.get(ops)!.children.map((c) => c.kind);
    expect(kinds).toEqual(["lead", "rep"]);
  });

  it("edits list fields", () => {
    const { org, finance } = sample();
    org.addListItem(finance, "accountabilities", "Paying invoices");
    org.addListItem(finance, "accountabilities", "Budgeting");
    org.updateListItem(finance, "accountabilities", 0, "Paying bills");
    org.moveListItem(finance, "accountabilities", 1, 0);
    expect(org.view().nodes.get(finance)?.accountabilities).toEqual(["Budgeting", "Paying bills"]);
    org.removeListItem(finance, "accountabilities", 0);
    expect(org.view().nodes.get(finance)?.accountabilities).toEqual(["Paying bills"]);
  });

  it("assigns people and cleans up when a person is removed", () => {
    const { org, finance } = sample();
    const bob = org.addPerson("Bob");
    org.assign(finance, bob, "20%");
    expect(org.view().nodes.get(finance)?.fillers).toEqual([{ personId: bob, focus: "20%" }]);
    org.removePerson(bob);
    expect(org.view().nodes.get(finance)?.fillers).toEqual([]);
    expect(org.view().people).toEqual([]);
  });
});

describe("OrgDoc history", () => {
  it("records one attributed entry per change, newest first", () => {
    const { org, finance } = sample();
    org.rename(finance, "Money");
    const h = org.history();
    expect(h[0].message).toBe("Renamed “Finance” to “Money”");
    expect(h[0].author).toBe("Ada");
    expect(h.map((e) => e.message).at(-1)).toBe("Created organisation “Acme”");
  });

  it("undoes and redoes with labelled log entries", () => {
    const { org, finance } = sample();
    org.rename(finance, "Money");
    expect(org.undoLabel).toBe("Renamed “Finance” to “Money”");
    org.undo();
    expect(org.view().nodes.get(finance)?.name).toBe("Finance");
    expect(org.history()[0].message).toBe("Undid: Renamed “Finance” to “Money”");
    org.redo();
    expect(org.view().nodes.get(finance)?.name).toBe("Money");
    expect(org.history()[0].message).toBe("Redid: Renamed “Finance” to “Money”");
  });

  it("undoes a removal including nested roles and assignments", () => {
    const { org, ops } = sample();
    const shipping = org.addNode(ops, "role", "Shipping");
    const bob = org.addPerson("Bob");
    org.assign(shipping, bob);
    org.remove(ops);
    org.undo();
    const back = org.view().root!.children.find((c) => c.name === "Operations");
    expect(back?.children[0].fillers).toEqual([{ personId: bob, focus: "" }]);
  });

  it("does not offer to undo the creation of the organisation", () => {
    const org = OrgDoc.create({ name: "Acme", author: "Ada" });
    expect(org.canUndo).toBe(false);
  });

  it("previews and restores an earlier version without losing history", () => {
    const { org, ops, finance } = sample();
    org.addNode(ops, "role", "Shipping");
    const before = org.history()[0];
    org.remove(ops);
    org.rename(finance, "Money");
    expect(org.viewAt(before).nodes.has(ops)).toBe(true);
    org.restore(before);
    const v = org.view();
    expect(v.nodes.get(finance)?.name).toBe("Finance");
    // Deleted nodes come back with their content under a new id (Loro tree semantics).
    const restored = v.root!.children.find((c) => c.name === "Operations");
    expect(restored?.children.map((c) => c.name)).toEqual(["Shipping"]);
    expect(org.history()[0].message).toMatch(/^Restored version from/);
    expect(org.history().length).toBeGreaterThan(5);
  });

  it("batches several mutations into one entry", () => {
    const { org, root } = sample();
    const n = org.history().length;
    org.batch("Sketched marketing", () => {
      const m = org.addNode(root, "circle", "Marketing");
      org.addNode(m, "role", "Social media");
    });
    expect(org.history().length).toBe(n + 1);
    org.undo();
    expect([...org.view().nodes.values()].some((x) => x.name === "Marketing")).toBe(false);
  });
});

describe("files", () => {
  it("round-trips through .orgmap bytes with history", () => {
    const { org, finance } = sample();
    org.rename(finance, "Money");
    const copy = OrgDoc.fromBytes(org.exportBytes(), "Bob");
    expect(copy.id).toBe(org.id);
    expect(copy.view().nodes.get(finance)?.name).toBe("Money");
    expect(copy.history()[0].author).toBe("Ada");
  });

  it("merges two copies edited separately", () => {
    const { org, finance, ops } = sample();
    const copy = OrgDoc.fromBytes(org.exportBytes(), "Bob");
    org.rename(finance, "Money");
    copy.addListItem(ops, "domains", "Warehouse");
    org.merge(copy.exportBytes());
    const v = org.view();
    expect(v.nodes.get(finance)?.name).toBe("Money");
    expect(v.nodes.get(ops)?.domains).toEqual(["Warehouse"]);
    expect(org.history().some((e) => e.author === "Bob")).toBe(true);
  });

  it("refuses to merge a different organisation", () => {
    const a = OrgDoc.create({ name: "A", author: "x" });
    const b = OrgDoc.create({ name: "B", author: "x" });
    expect(() => a.merge(b.exportBytes())).toThrow();
  });

  it("round-trips the readable JSON export", () => {
    const { org, ops, finance } = sample();
    const bob = org.addPerson("Bob");
    org.assign(finance, bob, "Mondays");
    org.addCoreRoles(ops);
    org.addListItem(finance, "accountabilities", "Paying invoices");
    const json = toJSON(org.view());
    const copy = fromJSON(JSON.parse(JSON.stringify(json)), "Cy");
    const again = toJSON(copy.view());
    expect({ ...again, exportedAt: "", organisation: { ...again.organisation, id: "" } }).toEqual({
      ...json,
      exportedAt: "",
      organisation: { ...json.organisation, id: "" },
    });
    expect(copy.id).not.toBe(org.id);
  });

  it("exports CSV with escaped multi-line cells", () => {
    const { org, finance } = sample();
    org.addListItem(finance, "accountabilities", "Pay, on time");
    org.addListItem(finance, "accountabilities", "Budget");
    const csv = toCSV(org.view());
    expect(csv.split("\r\n")[0]).toBe("Path,Name,Type,Core role,Purpose,Responsibilities,Areas of authority,Agreements,People");
    expect(csv).toContain('Acme,Finance,Role,,,"Pay, on time\nBudget",,,');
  });
});
