// "Share" menu: start or stop live editing, copy the link, see who is here.

import { useState } from "react";
import type { SyncSession } from "../sync/session";
import { roomKey, shareLink, turnSettings, type TurnSettings } from "../sync/link";
import { useSessionState } from "./hooks";
import { t } from "../i18n";

interface Props {
  orgId: string;
  author: string;
  session: SyncSession | null;
  isLive: boolean;
  onGoLive: () => void;
  onStopLive: () => void;
  onNewLink: () => void;
}

export function LivePanel({ orgId, author, session, isLive, onGoLive, onStopLive, onNewLink }: Props) {
  const state = useSessionState(session);
  const [copied, setCopied] = useState(false);
  const key = roomKey.get(orgId);
  const link = key ? shareLink(orgId, key) : "";
  const others = state.peers.length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the link is selectable in the field.
    }
  };

  const summary = !isLive
    ? t("live.share")
    : !session
      ? t("live.connecting")
      : others
        ? t("live.here", { n: others + 1 })
        : t("live.waiting");

  return (
    <details className="menu live">
      <summary className={isLive ? "on" : ""}>
        {isLive && <span className={`pulse ${others ? "ok" : ""}`} aria-hidden="true" />}
        {summary}
      </summary>
      <div className="menu-body live-body">
        {!isLive ? (
          <>
            <span className="label">{t("live.introTitle")}</span>
            <p className="muted small">{t("live.intro")}</p>
            <button className="primary" onClick={onGoLive}>
              {t("live.start")}
            </button>
          </>
        ) : (
          <>
            <span className="label">{t("live.linkLabel")}</span>
            <div className="assign">
              <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label={t("live.linkAria")} />
              <button onClick={copy}>{t(copied ? "live.copied" : "live.copy")}</button>
            </div>

            <span className="label">{t("live.hereNow")}</span>
            <ul className="peers">
              <li>
                <span className="peer-dot" style={{ background: "var(--accent)" }} />
                {author || t("live.you")} <span className="muted">{t("live.youSuffix")}</span>
              </li>
              {state.peers.map((p) => (
                <li key={p.id}>
                  <span className="peer-dot" style={{ background: p.colour }} />
                  {p.name || t("live.joining")}
                  {!p.synced && <span className="muted"> · {t("live.syncing")}</span>}
                </li>
              ))}
            </ul>
            {!others && <p className="muted small">{t("live.waitingHint")}</p>}
            {state.error && <p className="error">{t(`live.${state.error}`)}</p>}

            <div className="row">
              <button onClick={onStopLive}>{t("live.stop")}</button>
              <button
                onClick={() => {
                  if (confirm(t("live.newLinkConfirm"))) onNewLink();
                }}
              >
                {t("live.newLink")}
              </button>
            </div>
          </>
        )}
        <NetworkSettings />
      </div>
    </details>
  );
}

function NetworkSettings() {
  const [turn, setTurn] = useState<TurnSettings>(() => turnSettings.get() ?? { urls: "", username: "", credential: "" });
  const [saved, setSaved] = useState(false);
  const field = (k: keyof TurnSettings, placeholder: string, type = "text") => (
    <input
      type={type}
      value={turn[k]}
      placeholder={placeholder}
      onChange={(e) => {
        setTurn({ ...turn, [k]: e.target.value });
        setSaved(false);
      }}
    />
  );
  return (
    <details className="network">
      <summary className="label">{t("net.title")}</summary>
      <p className="muted small">{t("net.hint")}</p>
      {field("urls", "turns:turn.example.org:443")}
      {field("username", t("net.username"))}
      {field("credential", t("net.password"), "password")}
      <div className="row">
        <button
          onClick={() => {
            turnSettings.set(turn.urls.trim() ? turn : null);
            setSaved(true);
          }}
        >
          {t(saved ? "net.saved" : "net.save")}
        </button>
      </div>
    </details>
  );
}
