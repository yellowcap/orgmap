// Shown after opening a share link for an organisation this browser does not
// have yet, until someone who has it open is reached.

import { useEffect, useState } from "react";
import type { SyncSession } from "../sync/session";
import { useSessionState } from "./hooks";
import { t } from "../i18n";

const SLOW_AFTER_MS = 20_000;

export function JoinScreen({ session, onCancel }: { session: SyncSession | null; onCancel: () => void }) {
  const state = useSessionState(session);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  const connected = state.peers.length > 0;

  return (
    <div className="library">
      <header className="library-head">
        <h1 className="wordmark">orgmap</h1>
        <p className="kicker">{t("join.kicker")}</p>
      </header>
      <section className="sheet">
        <h2 className="label">{t(connected ? "join.connected" : "join.looking")}</h2>
        <p>
          {connected
            ? t("join.connectedTo", { names: state.peers.map((p) => p.name || t("join.someone")).join(", ") })
            : t("join.waiting")}
        </p>
        {state.error && <p className="error">{t(`live.${state.error}`)}</p>}
        {slow && !connected && (
          <div className="muted">
            <p>{t("join.slow")}</p>
            <ul>
              <li>{t("join.tipNetwork")}</li>
              <li>{t("join.tipFile")}</li>
              <li>{t("join.tipTurn")}</li>
            </ul>
          </div>
        )}
        <div className="row">
          <button onClick={onCancel}>{t("common.cancel")}</button>
        </div>
      </section>
    </div>
  );
}
