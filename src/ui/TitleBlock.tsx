// The plan's title block, like the "Plankopf" on an architectural drawing.

import { useMemo } from "react";
import type { HistoryEntry, OrgDoc, OrgView } from "../model/org";
import { VOCAB } from "../model/vocabulary";

interface Props {
  org: OrgDoc;
  view: OrgView;
  live: OrgView;
  focusName?: string;
  preview: HistoryEntry | null;
}

export function TitleBlock({ org, view, live, focusName, preview }: Props) {
  const history = useMemo(() => org.history(), [org, live]);
  const shown = preview ?? history[0];
  const revision = preview ? history.length - history.findIndex((e) => e.key === preview.key) : history.length;
  const roles = [...view.nodes.values()].filter((n) => n.type === "role").length;
  const circles = [...view.nodes.values()].filter((n) => n.type === "circle").length;
  const v = VOCAB;

  return (
    <div className="title-block">
      <div className="tb-cell tb-wide">
        <span className="label">Organisation</span>
        <strong>{view.root?.name}</strong>
      </div>
      <div className="tb-cell tb-wide">
        <span className="label">Plan</span>
        <span>{focusName ? `Detail — ${focusName}` : "Overall structure"}</span>
      </div>
      <div className="tb-cell">
        <span className="label">{v.circles}</span>
        <span>{circles}</span>
      </div>
      <div className="tb-cell">
        <span className="label">{v.roles}</span>
        <span>{roles}</span>
      </div>
      <div className="tb-cell">
        <span className="label">People</span>
        <span>{view.people.length}</span>
      </div>
      <div className="tb-cell">
        <span className="label">Revision</span>
        <span>
          {revision}
          {preview ? " (preview)" : ""}
        </span>
      </div>
      <div className="tb-cell">
        <span className="label">Date</span>
        <span>{shown ? new Date(shown.time).toLocaleDateString() : "—"}</span>
      </div>
      <div className="tb-cell tb-wide">
        <span className="label">Last edit by</span>
        <span>{shown?.author || "—"}</span>
      </div>
    </div>
  );
}
