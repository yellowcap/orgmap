// The plan's title block, like the "Plankopf" on an architectural drawing.

import { useMemo } from "react";
import type { HistoryEntry, OrgDoc, OrgView } from "../model/org";
import { formatDate, t } from "../i18n";

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

  return (
    <div className="title-block">
      <div className="tb-cell tb-wide">
        <span className="label">{t("tb.organisation")}</span>
        <strong>{view.root?.name}</strong>
      </div>
      <div className="tb-cell tb-wide">
        <span className="label">{t("tb.plan")}</span>
        <span>{focusName ? t("tb.detail", { name: focusName }) : t("tb.overall")}</span>
      </div>
      <div className="tb-cell">
        <span className="label">{t("vocab.circles")}</span>
        <span>{circles}</span>
      </div>
      <div className="tb-cell">
        <span className="label">{t("vocab.roles")}</span>
        <span>{roles}</span>
      </div>
      <div className="tb-cell">
        <span className="label">{t("tb.people")}</span>
        <span>{view.people.length}</span>
      </div>
      <div className="tb-cell">
        <span className="label">{t("tb.revision")}</span>
        <span>
          {revision}
          {preview ? ` ${t("tb.preview")}` : ""}
        </span>
      </div>
      <div className="tb-cell">
        <span className="label">{t("tb.date")}</span>
        <span>{shown ? formatDate(shown.time) : "—"}</span>
      </div>
      <div className="tb-cell tb-wide">
        <span className="label">{t("tb.lastEdit")}</span>
        <span>{shown?.author || "—"}</span>
      </div>
    </div>
  );
}
