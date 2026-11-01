// The change log: every edit with author and time. Selecting an entry
// previews the organisation as it was right after that change.

import { useMemo } from "react";
import type { HistoryEntry, OrgDoc, OrgView } from "../model/org";
import { formatDate, formatTime, t, tp, useLang } from "../i18n";
import { formatLog } from "../i18n/model";

interface Props {
  org: OrgDoc;
  live: OrgView;
  preview: HistoryEntry | null;
  onPreview: (entry: HistoryEntry | null) => void;
}

export function HistoryPanel({ org, live, preview, onPreview }: Props) {
  // `live` changes on every edit, which is when the history changes too.
  const entries = useMemo(() => org.history(), [org, live]);
  const lang = useLang();

  const days = useMemo(() => {
    const groups: { day: string; items: HistoryEntry[] }[] = [];
    for (const e of entries) {
      const day = formatDate(e.time, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
      groups.at(-1)!.items.push(e);
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, lang]);

  return (
    <div className="history">
      <p className="muted hint">{tp("history.hint", entries.length)}</p>
      {days.map((g) => (
        <section key={g.day}>
          <h3 className="label">{g.day}</h3>
          <ol>
            {g.items.map((e) => {
              const latest = e === entries[0];
              const on = preview?.key === e.key || (!preview && latest);
              return (
                <li key={e.key} className={on ? "on" : ""}>
                  <button className="entry" onClick={() => onPreview(latest ? null : e)}>
                    <span className="time">{formatTime(e.time)}</span>
                    <span className="msg">{formatLog(e.message)}</span>
                    <span className="who">
                      {e.author || t("history.unknown")}
                      {latest ? ` · ${t("history.current")}` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
