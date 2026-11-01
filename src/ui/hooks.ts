import { useState, useSyncExternalStore } from "react";
import type { OrgDoc, OrgView } from "../model/org";
import type { SyncSession } from "../sync/session";

/** Re-renders whenever the document changes (local edits, undo, merges). */
export function useOrgView(org: OrgDoc): OrgView {
  return useSyncExternalStore(
    (cb) => org.subscribe(cb),
    () => org.view(),
  );
}

const AUTHOR_KEY = "orgmap.author";

export function useAuthor(): [string, (name: string) => void] {
  const [author, setAuthor] = useState(() => {
    try {
      return localStorage.getItem(AUTHOR_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const update = (name: string) => {
    setAuthor(name);
    try {
      localStorage.setItem(AUTHOR_KEY, name);
    } catch {
      // Storage unavailable (private mode); the name lives for this session only.
    }
  };
  return [author, update];
}

const NO_SESSION = { status: "closed" as const, peers: [], error: null };

/** Live session state (peers, status); a closed state when not sharing. */
export function useSessionState(session: SyncSession | null): SyncSession["state"] {
  return useSyncExternalStore(
    (cb) => session?.subscribe(cb) ?? (() => {}),
    () => session?.state ?? NO_SESSION,
  );
}
