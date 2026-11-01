// "Share" menu: start or stop live editing, copy the link, see who is here.

import { useState } from "react";
import type { SyncSession } from "../sync/session";
import { roomKey, shareLink, turnSettings, type TurnSettings } from "../sync/link";
import { useSessionState } from "./hooks";

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

  const summary = !isLive ? "Share" : !session ? "Live · connecting" : others ? `Live · ${others + 1} here` : "Live · waiting";

  return (
    <details className="menu live">
      <summary className={isLive ? "on" : ""}>
        {isLive && <span className={`pulse ${others ? "ok" : ""}`} aria-hidden="true" />}
        {summary}
      </summary>
      <div className="menu-body live-body">
        {!isLive ? (
          <>
            <span className="label">Edit together, live</span>
            <p className="muted small">
              Everyone with the link can view and edit this organisation at the same time. Changes go directly between
              browsers; nothing is stored on a server. It works while at least one person with the organisation has it open.
            </p>
            <button className="primary" onClick={onGoLive}>
              Start live session
            </button>
          </>
        ) : (
          <>
            <span className="label">Link — anyone with it can edit</span>
            <div className="assign">
              <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Share link" />
              <button onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            </div>

            <span className="label">Here now</span>
            <ul className="peers">
              <li>
                <span className="peer-dot" style={{ background: "var(--accent)" }} />
                {author || "You"} <span className="muted">(you)</span>
              </li>
              {state.peers.map((p) => (
                <li key={p.id}>
                  <span className="peer-dot" style={{ background: p.colour }} />
                  {p.name || "Joining…"}
                  {!p.synced && <span className="muted"> · syncing</span>}
                </li>
              ))}
            </ul>
            {!others && <p className="muted small">Waiting for others. Send them the link.</p>}
            {state.error && <p className="error">{state.error}</p>}

            <div className="row">
              <button onClick={onStopLive}>Stop</button>
              <button
                onClick={() => {
                  if (confirm("Create a new link? People with the old link can no longer connect (they keep what they already have).")) onNewLink();
                }}
              >
                New link
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
      <summary className="label">Network settings</summary>
      <p className="muted small">
        On networks that block direct connections, a TURN relay helps. It applies to this browser on the next
        connection.
      </p>
      {field("urls", "turns:turn.example.org:443")}
      {field("username", "Username")}
      {field("credential", "Password", "password")}
      <div className="row">
        <button
          onClick={() => {
            turnSettings.set(turn.urls.trim() ? turn : null);
            setSaved(true);
          }}
        >
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </details>
  );
}
