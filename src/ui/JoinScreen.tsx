// Shown after opening a share link for an organisation this browser does not
// have yet, until someone who has it open is reached.

import { useEffect, useState } from "react";
import type { SyncSession } from "../sync/session";
import { useSessionState } from "./hooks";

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
        <p className="kicker">Joining a live session</p>
      </header>
      <section className="sheet">
        <h2 className="label">{connected ? "Connected — receiving the organisation" : "Looking for the others"}</h2>
        <p>
          {connected
            ? `Connected to ${state.peers.map((p) => p.name || "someone").join(", ")}. Loading…`
            : "Waiting for someone who has this organisation open. Ask them to keep orgmap open in their browser."}
        </p>
        {state.error && <p className="error">{state.error}</p>}
        {slow && !connected && (
          <div className="muted">
            <p>Still nothing? Some networks (often company Wi-Fi or VPNs) block direct connections between browsers.</p>
            <ul>
              <li>Try another network, e.g. a phone hotspot.</li>
              <li>Ask for the organisation as an .orgmap file instead and open it from the start page.</li>
              <li>An administrator can configure a TURN relay under Share → Network settings.</li>
            </ul>
          </div>
        )}
        <div className="row">
          <button onClick={onCancel}>Cancel</button>
        </div>
      </section>
    </div>
  );
}
