// Edit the selected circle or role.

import { useState } from "react";
import type { TreeID } from "loro-crdt";
import type { ListField, OrgDoc, OrgNode, OrgView } from "../model/org";
import { CORE_ROLES, VOCAB, type RoleKind } from "../model/vocabulary";
import { ListEditor, TextField } from "./fields";

interface Props {
  org: OrgDoc;
  view: OrgView;
  node: OrgNode;
  readOnly: boolean;
  onSelect: (id: TreeID | null) => void;
}

export function Inspector({ org, view, node, readOnly, onSelect }: Props) {
  const [error, setError] = useState("");
  const vocab = VOCAB;
  const isCircle = node.type === "circle";
  const isRoot = node.parentId === null;
  const parent = node.parentId ? view.nodes.get(node.parentId) : null;

  const attempt = (fn: () => void) => {
    try {
      fn();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const list = (field: ListField, placeholder: string) => (
    <ListEditor
      label={vocab[field]}
      items={node[field]}
      placeholder={placeholder}
      onAdd={(t) => org.addListItem(node.id, field, t)}
      onUpdate={(i, t) => org.updateListItem(node.id, field, i, t)}
      onRemove={(i) => org.removeListItem(node.id, field, i)}
      onMove={(a, b) => org.moveListItem(node.id, field, a, b)}
    />
  );

  // Possible destinations for "Move to": any circle that is not this node or inside it.
  const destinations = [...view.nodes.values()].filter((n) => {
    if (n.type !== "circle" || n.id === node.parentId) return false;
    for (let c: OrgNode | undefined = n; c; c = c.parentId ? view.nodes.get(c.parentId) : undefined) {
      if (c.id === node.id) return false;
    }
    return true;
  });

  const assigned = new Set(node.fillers.map((f) => f.personId));
  const unassigned = view.people.filter((p) => !assigned.has(p.id));
  const personName = new Map(view.people.map((p) => [p.id, p.name]));

  return (
    <fieldset className="inspector" disabled={readOnly}>
      <div className="crumbs">
        {path(view, node).map((n, i, all) => (
          <span key={n.id}>
            {i < all.length - 1 ? (
              <button className="link" onClick={() => onSelect(n.id)}>
                {n.name}
              </button>
            ) : (
              <strong>{isCircle ? vocab.circle : vocab.role}</strong>
            )}
            {i < all.length - 1 && " / "}
          </span>
        ))}
      </div>

      <label className="field">
        <span className="label">Name</span>
        <TextField className="title-input" value={node.name} onCommit={(v) => v && org.rename(node.id, v)} />
      </label>

      {!isRoot && (
        <div className="field-row">
          <label className="field">
            <span className="label">Type</span>
            <select
              value={node.kind === "normal" ? node.type : node.kind}
              onChange={(e) => {
                const v = e.target.value;
                attempt(() =>
                  org.batch(`Changed type of “${node.name}”`, () => {
                  if (v === "circle" || v === "role") {
                    if (node.kind !== "normal") org.setKind(node.id, "normal");
                    org.setType(node.id, v);
                  } else {
                    org.setType(node.id, "role");
                    org.setKind(node.id, v as RoleKind);
                  }
                  }),
                );
              }}
            >
              <option value="role">{vocab.role}</option>
              <option value="circle">{vocab.circle}</option>
              {CORE_ROLES.map((s) => (
                <option key={s.kind} value={s.kind}>
                  Core role: {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Part of</span>
            <select
              value=""
              onChange={(e) => e.target.value && attempt(() => org.move(node.id, e.target.value as TreeID))}
            >
              <option value="">{parent?.name ?? "—"}</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  Move to {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      <label className="field">
        <span className="label">{vocab.purpose}</span>
        <TextField
          multiline
          value={node.purpose}
          placeholder={`Why does this ${(isCircle ? vocab.circle : vocab.role).toLowerCase()} exist?`}
          onCommit={(v) => org.setPurpose(node.id, v)}
        />
      </label>

      {list("accountabilities", "Add an ongoing activity, e.g. “Paying invoices”")}
      {list("domains", "Add something it controls exclusively")}
      {(isCircle || node.policies.length > 0) && list("policies", "Add a rule others must follow")}

      {!isCircle && (
        <div className="fillers">
          <span className="label">People</span>
          <ul>
            {node.fillers.map((f) => (
              <li key={f.personId}>
                <span className="person">{personName.get(f.personId) ?? "?"}</span>
                <TextField
                  value={f.focus}
                  placeholder={vocab.focus}
                  aria-label={`${vocab.focus} of ${personName.get(f.personId)}`}
                  onCommit={(v) => org.setFocus(node.id, f.personId, v)}
                />
                <button className="ghost icon" onClick={() => org.unassign(node.id, f.personId)} title="Unassign">
                  ×
                </button>
              </li>
            ))}
          </ul>
          <AssignPerson
            options={unassigned}
            onAssign={(id) => org.assign(node.id, id)}
            onCreate={(name) => org.batch(`Added ${name} and assigned to “${node.name}”`, () => org.assign(node.id, org.addPerson(name)))}
          />
        </div>
      )}

      {!readOnly && (
        <div className="actions">
          {isCircle && (
            <>
              <button onClick={() => onSelect(org.addNode(node.id, "role", `New ${vocab.role.toLowerCase()}`))}>+ {vocab.role}</button>
              <button onClick={() => onSelect(org.addNode(node.id, "circle", `New ${vocab.circle.toLowerCase()}`))}>
                + {vocab.circle}
              </button>
              {CORE_ROLES.some((s) => !node.children.some((c) => c.kind === s.kind)) && (
                <button onClick={() => org.addCoreRoles(node.id)} title={CORE_ROLES.map((s) => s.name).join(", ")}>
                  + Core roles
                </button>
              )}
            </>
          )}
          {!isRoot && (
            <button
              className="danger"
              onClick={() => {
                const nested = node.children.length ? ` and everything inside it` : "";
                if (confirm(`Remove “${node.name}”${nested}? You can undo this.`)) {
                  org.remove(node.id);
                  onSelect(node.parentId);
                }
              }}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </fieldset>
  );
}

function AssignPerson({
  options,
  onAssign,
  onCreate,
}: {
  options: { id: string; name: string }[];
  onAssign: (id: string) => void;
  onCreate: (name: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const name = draft.trim();
    if (!name) return;
    const match = options.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (match) onAssign(match.id);
    else onCreate(name);
    setDraft("");
  };
  return (
    <div className="assign">
      <input
        list="people-options"
        value={draft}
        placeholder="Assign a person…"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      <datalist id="people-options">
        {options.map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      <button onClick={submit} disabled={!draft.trim()}>
        Assign
      </button>
    </div>
  );
}

function path(view: OrgView, node: OrgNode): OrgNode[] {
  const out: OrgNode[] = [];
  for (let n: OrgNode | undefined = node; n; n = n.parentId ? view.nodes.get(n.parentId) : undefined) out.unshift(n);
  return out;
}
