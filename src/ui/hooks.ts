import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { OrgDoc, OrgView } from "../model/org";

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

/** Calls `fn` at most once per `ms` after the last change of `value`. */
export function useDebouncedEffect(fn: () => void, deps: unknown[], ms: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    const t = setTimeout(() => fnRef.current(), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
