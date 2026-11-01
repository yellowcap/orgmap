import { useEffect, useMemo, useRef, useState } from "react";
import type { TreeID } from "loro-crdt";
import type { HistoryEntry, OrgDoc, OrgView } from "../model/org";
import { formatDateTime, t } from "../i18n";
import { errorMessage, formatLog } from "../i18n/model";
import { LanguagePicker } from "./LanguagePicker";
import { fileBaseName, toCSV, toJSON } from "../model/export";
import { download, pickFile } from "./files";
import { useOrgView } from "./hooks";
import { autosave, importFile } from "./io";
import { TextField } from "./fields";
import { PlanView } from "./PlanView";
import { Outline } from "./Outline";
import { Inspector } from "./Inspector";
import { PeoplePanel } from "./PeoplePanel";
import { HistoryPanel } from "./HistoryPanel";
import { TitleBlock } from "./TitleBlock";
import { LivePanel } from "./LivePanel";
import { useSessionState } from "./hooks";
import type { SyncSession } from "../sync/session";

/** Who else has a node selected, for markers on the plan and in the outline. */
export type PeerMarks = Map<TreeID, { name: string; colour: string }[]>;

type Tab = "details" | "people" | "log";

interface Props {
  org: OrgDoc;
  author: string;
  onAuthorChange: (name: string) => void;
  onClose: () => void;
  session: SyncSession | null;
  isLive: boolean;
  onGoLive: () => void;
  onStopLive: () => void;
  onNewLink: () => void;
}

export function Editor({ org, author, onAuthorChange, onClose, session, isLive, onGoLive, onStopLive, onNewLink }: Props) {
  const live = useOrgView(org);
  const sessionState = useSessionState(session);
  const [selectedId, setSelectedId] = useState<TreeID | null>(null);
  const [focusId, setFocusId] = useState<TreeID | null>(null);
  const [tab, setTab] = useState<Tab>("details");
  const [highlightPersonId, setHighlightPersonId] = useState<string | null>(null);
  const [preview, setPreview] = useState<HistoryEntry | null>(null);
  const [notice, setNotice] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);

  // While previewing an old version, everything renders read-only from it.
  const previewView = useMemo(() => (preview ? org.viewAt(preview) : null), [org, preview]);
  const view: OrgView = previewView ?? live;
  const readOnly = !!preview;

  // Save locally after each change (also covers changes from peers).
  useEffect(() => autosave(org), [org]);

  // Drop selection/focus that no longer exists (removed, undone, restored).
  useEffect(() => {
    if (selectedId && !view.nodes.has(selectedId)) setSelectedId(null);
    if (focusId && !view.nodes.has(focusId)) setFocusId(null);
  }, [view, selectedId, focusId]);

  useEffect(() => session?.setSelection(selectedId), [session, selectedId]);

  const peerMarks: PeerMarks = useMemo(() => {
    const m: PeerMarks = new Map();
    for (const p of sessionState.peers) {
      if (!p.selectedId) continue;
      m.set(p.selectedId, [...(m.get(p.selectedId) ?? []), { name: p.name || "…", colour: p.colour }]);
    }
    return m;
  }, [sessionState.peers]);

  // Keyboard undo/redo, unless typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select") || readOnly) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) org.canRedo && org.redo();
        else org.canUndo && org.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        org.canRedo && org.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [org, readOnly]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 4000);
  };

  const select = (id: TreeID | null) => {
    setSelectedId(id);
    if (id) setTab("details");
  };

  const exportAs = (kind: "orgmap" | "json" | "csv" | "svg") => {
    const base = fileBaseName(view);
    if (kind === "orgmap") download(`${base}.orgmap`, org.exportBytes() as BlobPart, "application/octet-stream");
    if (kind === "json") download(`${base}.json`, JSON.stringify(toJSON(view), null, 2), "application/json");
    if (kind === "csv") download(`${base}.csv`, "﻿" + toCSV(view), "text/csv");
    if (kind === "svg" && svgRef.current) {
      download(`${base}-plan.svg`, new XMLSerializer().serializeToString(svgRef.current), "image/svg+xml");
    }
  };

  const importMerge = async () => {
    const file = await pickFile(".orgmap,.json");
    if (!file) return;
    try {
      const { org: result, merged } = await importFile(file, author || t("common.anonymous"));
      if (merged && result.id === org.id) {
        org.merge(result.exportBytes());
        flash(t("editor.merged", { file: file.name }));
      } else {
        flash(t(merged ? "editor.mergedOther" : "editor.openedNew", { file: file.name }));
        location.hash = `#/org/${encodeURIComponent(result.id)}`;
      }
    } catch (err) {
      flash(t("lib.openError", { file: file.name, error: errorMessage(err) }));
    }
  };

  const selected = selectedId ? view.nodes.get(selectedId) ?? null : null;
  const focusName = focusId ? view.nodes.get(focusId)?.name : undefined;

  return (
    <div className="editor">
      <header className="topbar">
        <button className="wordmark small link" onClick={onClose} title={t("editor.back")}>
          orgmap
        </button>
        <span className="org-name">{live.root?.name}</span>
        <div className="topbar-actions">
          <button
            disabled={readOnly || !org.canUndo}
            onClick={() => org.undo()}
            title={org.canUndo ? t("editor.undoTitle", { what: formatLog(org.undoLabel) }) : t("editor.nothingToUndo")}
          >
            {t("editor.undo")}
          </button>
          <button
            disabled={readOnly || !org.canRedo}
            onClick={() => org.redo()}
            title={org.canRedo ? t("editor.redoTitle", { what: formatLog(org.redoLabel) }) : t("editor.nothingToRedo")}
          >
            {t("editor.redo")}
          </button>
          <span className="sep" />
          <details className="menu">
            <summary>{t("file.menu")}</summary>
            <div className="menu-body" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).removeAttribute("open")}>
              <span className="label">{t("file.takeHome")}</span>
              <button onClick={() => exportAs("orgmap")}>{t("file.saveOrgmap")}</button>
              <span className="label">{t("file.handOver")}</span>
              <button onClick={() => exportAs("json")}>{t("file.json")}</button>
              <button onClick={() => exportAs("csv")}>{t("file.csv")}</button>
              <button onClick={() => exportAs("svg")}>{t("file.svg")}</button>
              <button onClick={() => window.print()}>{t("file.print")}</button>
              <span className="label">{t("file.bringIn")}</span>
              <button onClick={importMerge}>{t("file.openMerge")}</button>
            </div>
          </details>
          <span className="sep" />
          <LivePanel
            orgId={org.id}
            author={author}
            session={session}
            isLive={isLive}
            onGoLive={onGoLive}
            onStopLive={onStopLive}
            onNewLink={onNewLink}
          />
          <span className="sep" />
          <label className="inline author">
            <span className="label">{t("editor.you")}</span>
            <TextField value={author} placeholder={t("editor.yourName")} onCommit={onAuthorChange} aria-label={t("editor.yourName")} />
          </label>
          <LanguagePicker />
        </div>
      </header>

      {preview && (
        <div className="preview-bar">
          <span>
            {t(preview.author ? "preview.viewingBy" : "preview.viewing", {
              what: formatLog(preview.message),
              time: formatDateTime(preview.time),
              author: preview.author,
            })}
          </span>
          <button
            className="primary"
            onClick={() => {
              org.restore(preview);
              setPreview(null);
              flash(t("preview.restored"));
            }}
          >
            {t("preview.restore")}
          </button>
          <button onClick={() => setPreview(null)}>{t("preview.back")}</button>
        </div>
      )}

      <main className="workspace">
        <aside className="pane outline-pane">
          <Outline
            view={view}
            org={org}
            readOnly={readOnly}
            selectedId={selectedId}
            peerMarks={peerMarks}
            onSelect={(id) => {
              select(id);
              const n = view.nodes.get(id);
              const circle = n?.type === "circle" && n.children.length ? n : n?.parentId ? view.nodes.get(n.parentId) : null;
              setFocusId(circle?.parentId ? circle.id : null);
            }}
          />
        </aside>

        <section className="plan-pane">
          <PlanView
            ref={svgRef}
            view={view}
            selectedId={selectedId}
            focusId={focusId}
            highlightPersonId={highlightPersonId}
            peerMarks={peerMarks}
            onSelect={select}
            onFocus={setFocusId}
          />
          {focusId && (
            <button className="zoom-out" onClick={() => setFocusId(null)}>
              {t("editor.wholeOrg")}
            </button>
          )}
          <Legend />
          <TitleBlock view={view} live={live} org={org} focusName={focusName} preview={preview} />
        </section>

        <aside className="pane side-pane">
          <nav className="tabs" role="tablist">
            {(["details", "people", "log"] as Tab[]).map((id) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
                {id === "details" ? t("tab.details") : id === "people" ? t("tab.people", { n: view.people.length }) : t("tab.log")}
              </button>
            ))}
          </nav>
          <div className="tab-body">
            {tab === "details" &&
              (selected ? (
                <Inspector key={selected.id} org={org} view={view} node={selected} readOnly={readOnly} onSelect={select} />
              ) : (
                <p className="muted hint">{t("editor.selectHint")}</p>
              ))}
            {tab === "people" && (
              <PeoplePanel
                org={org}
                view={view}
                readOnly={readOnly}
                highlightPersonId={highlightPersonId}
                onHighlight={setHighlightPersonId}
                onSelectRole={select}
              />
            )}
            {tab === "log" && <HistoryPanel org={org} live={live} preview={preview} onPreview={setPreview} />}
          </div>
        </aside>
      </main>

      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="legend" aria-hidden="true">
      <span className="label">{t("legend.title")}</span>
      <svg width="34" height="10">
        <line x1="0" y1="5" x2="34" y2="5" stroke="#111" strokeWidth="1.4" />
      </svg>
      <span>{t("vocab.circle")}</span>
      <svg width="34" height="10">
        <line x1="0" y1="5" x2="34" y2="5" stroke="#333" strokeWidth="0.8" />
      </svg>
      <span>{t("vocab.role")}</span>
      <svg width="34" height="10">
        <line x1="0" y1="5" x2="34" y2="5" stroke="#333" strokeWidth="0.8" strokeDasharray="2 2.5" />
      </svg>
      <span>{t("legend.coreRole")}</span>
      <svg width="34" height="10">
        <line x1="0" y1="5" x2="34" y2="5" stroke="#111" strokeWidth="1.1" strokeDasharray="6 3" />
      </svg>
      <span>{t("legend.emptyCircle")}</span>
    </div>
  );
}
