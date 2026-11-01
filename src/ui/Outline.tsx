// Structure as an indented list. Drag a row onto a circle to move it there.

import { useState } from "react";
import type { TreeID } from "loro-crdt";
import type { OrgDoc, OrgNode, OrgView } from "../model/org";
import type { PeerMarks } from "./Editor";
import { t } from "../i18n";
import { errorMessage } from "../i18n/model";

interface Props {
  org: OrgDoc;
  view: OrgView;
  readOnly: boolean;
  selectedId: TreeID | null;
  peerMarks: PeerMarks;
  onSelect: (id: TreeID) => void;
}

export function Outline({ org, view, readOnly, selectedId, peerMarks, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState<Set<TreeID>>(new Set());
  const [dragId, setDragId] = useState<TreeID | null>(null);
  const [dropId, setDropId] = useState<TreeID | null>(null);
  const [error, setError] = useState("");

  if (!view.root) return null;

  // New items go into the selected circle, the selected role's circle, or the root.
  const sel = selectedId ? view.nodes.get(selectedId) : null;
  const target = sel ? (sel.type === "circle" ? sel : view.nodes.get(sel.parentId!)!) : view.root;

  const add = (type: "circle" | "role") => {
    const name = t(type === "circle" ? "vocab.newCircle" : "vocab.newRole");
    onSelect(org.addNode(target.id, type, name));
  };

  const drop = (onto: OrgNode) => {
    setDropId(null);
    if (!dragId || dragId === onto.id) return;
    try {
      org.move(dragId, onto.id);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const toggle = (id: TreeID) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
  };

  const row = (n: OrgNode, depth: number) => {
    const isCircle = n.type === "circle";
    const open = !collapsed.has(n.id);
    const special = n.kind !== "normal";
    return (
      <li key={n.id}>
        <div
          className={`row-item ${selectedId === n.id ? "on" : ""} ${dropId === n.id ? "drop" : ""}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          draggable={!readOnly && depth > 0}
          onDragStart={(e) => {
            setDragId(n.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => {
            setDragId(null);
            setDropId(null);
          }}
          onDragOver={(e) => {
            if (!dragId || readOnly) return;
            e.preventDefault();
            setDropId(n.id);
          }}
          onDragLeave={() => setDropId((d) => (d === n.id ? null : d))}
          onDrop={(e) => {
            e.preventDefault();
            drop(n);
          }}
          onClick={() => onSelect(n.id)}
        >
          {isCircle && n.children.length ? (
            <button
              className="ghost caret"
              onClick={(e) => {
                e.stopPropagation();
                toggle(n.id);
              }}
              aria-label={t(open ? "outline.collapse" : "outline.expand")}
            >
              {open ? "▾" : "▸"}
            </button>
          ) : (
            <span className="caret" />
          )}
          <span className={`glyph ${isCircle ? "g-circle" : special ? "g-special" : "g-role"}`} aria-hidden="true" />
          <span className={`name ${isCircle ? "upper" : ""}`}>{n.name || t("common.untitled")}</span>
          {peerMarks.get(n.id)?.map((p, i) => (
            <span key={i} className="peer-tag" style={{ background: p.colour }} title={t("peer.here", { name: p.name })}>
              {p.name.slice(0, 1).toUpperCase()}
            </span>
          ))}
          {n.fillers.length > 0 && <span className="count">{n.fillers.length}</span>}
        </div>
        {isCircle && open && n.children.length > 0 && <ul>{n.children.map((c) => row(c, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <div className="outline">
      <div className="pane-head">
        <span className="label">{t("outline.title")}</span>
        {!readOnly && (
          <span className="row">
            <button className="ghost" onClick={() => add("role")} title={t("outline.addTo", { name: target.name })}>
              + {t("vocab.role")}
            </button>
            <button className="ghost" onClick={() => add("circle")} title={t("outline.addTo", { name: target.name })}>
              + {t("vocab.circle")}
            </button>
          </span>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <ul className="tree">{row(view.root, 0)}</ul>
    </div>
  );
}
