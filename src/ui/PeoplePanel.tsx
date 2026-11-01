import { useState } from "react";
import type { TreeID } from "loro-crdt";
import type { OrgDoc, OrgNode, OrgView } from "../model/org";
import { VOCAB } from "../model/vocabulary";
import { TextField } from "./fields";

interface Props {
  org: OrgDoc;
  view: OrgView;
  readOnly: boolean;
  highlightPersonId: string | null;
  onHighlight: (id: string | null) => void;
  onSelectRole: (id: TreeID) => void;
}

export function PeoplePanel({ org, view, readOnly, highlightPersonId, onHighlight, onSelectRole }: Props) {
  const [draft, setDraft] = useState("");

  const rolesOf = new Map<string, OrgNode[]>();
  for (const n of view.nodes.values()) {
    for (const f of n.fillers) rolesOf.set(f.personId, [...(rolesOf.get(f.personId) ?? []), n]);
  }

  const add = () => {
    const name = draft.trim();
    if (name) org.addPerson(name);
    setDraft("");
  };

  return (
    <div className="people">
      <p className="muted hint">Select a person to see their {VOCAB.roles.toLowerCase()} on the plan.</p>
      <ul>
        {view.people.map((p) => {
          const roles = rolesOf.get(p.id) ?? [];
          const on = highlightPersonId === p.id;
          return (
            <li key={p.id} className={on ? "on" : ""}>
              <div className="person-row">
                <button
                  className={`ghost dot ${on ? "on" : ""}`}
                  onClick={() => onHighlight(on ? null : p.id)}
                  title={on ? "Stop highlighting" : "Highlight on plan"}
                  aria-pressed={on}
                />
                <TextField value={p.name} disabled={readOnly} aria-label="Name" onCommit={(v) => v && org.renamePerson(p.id, v)} />
                <span className="count">{roles.length}</span>
                {!readOnly && (
                  <button
                    className="ghost icon"
                    title="Remove person"
                    onClick={() => {
                      if (confirm(`Remove ${p.name} and their assignments? You can undo this.`)) {
                        if (on) onHighlight(null);
                        org.removePerson(p.id);
                      }
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              {roles.length > 0 && (
                <ul className="person-roles">
                  {roles.map((r) => (
                    <li key={r.id}>
                      <button className="link" onClick={() => onSelectRole(r.id)}>
                        {r.name}
                      </button>
                      {r.fillers.find((f) => f.personId === p.id)?.focus && (
                        <span className="muted"> · {r.fillers.find((f) => f.personId === p.id)?.focus}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {!readOnly && (
        <div className="assign">
          <input
            value={draft}
            placeholder="Add a person…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <button onClick={add} disabled={!draft.trim()}>
            Add
          </button>
        </div>
      )}
    </div>
  );
}
