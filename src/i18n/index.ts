// Interface language. The browser's preferred languages pick one of ours on the
// first visit (English if none match); a choice made in the app is remembered
// per browser. Messages are plain strings with {placeholders}.

import { useSyncExternalStore } from "react";
import { en } from "./en";
import { de } from "./de";
import { fr } from "./fr";
import { it } from "./it";

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
export type Lang = "en" | "de" | "fr" | "it";

export const LANGUAGES: { id: Lang; name: string }[] = [
  { id: "en", name: "English" },
  { id: "de", name: "Deutsch" },
  { id: "fr", name: "Français" },
  { id: "it", name: "Italiano" },
];

const MESSAGES: Record<Lang, Messages> = { en, de, fr, it };
const STORAGE_KEY = "orgmap.lang";

function isLang(v: unknown): v is Lang {
  return typeof v === "string" && v in MESSAGES;
}

/** First supported language among the given preferences (e.g. navigator.languages), else English. */
export function detectLang(preferences: readonly string[]): Lang {
  for (const p of preferences) {
    const base = p.toLowerCase().split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    // No storage (private mode, tests): fall through to detection.
  }
  const nav = globalThis.navigator;
  return detectLang(nav?.languages?.length ? nav.languages : nav?.language ? [nav.language] : []);
}

let current: Lang = initialLang();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang, remember = true) {
  if (remember) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Not remembered; still switches for this visit.
    }
  }
  if (lang === current) return;
  current = lang;
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

/** Re-renders the calling component when the language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getLang,
  );
}

export type Values = Record<string, string | number>;

export function t(key: MessageKey, values?: Values): string {
  const text = MESSAGES[current][key] ?? en[key] ?? key;
  return values ? text.replace(/\{(\w+)\}/g, (m, name) => (name in values ? String(values[name]) : m)) : text;
}

/** Plural form: looks up `${base}.one` / `${base}.other` by the language's rules for `n`. */
export function tp(base: string, n: number, values?: Values): string {
  const form = new Intl.PluralRules(current).select(n);
  const key = (`${base}.${form}` in en ? `${base}.${form}` : `${base}.other`) as MessageKey;
  return t(key, { n, ...values });
}

export function formatDate(ms: number, options?: Intl.DateTimeFormatOptions): string {
  return new Date(ms).toLocaleDateString(current, options);
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(current);
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(current, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

if (typeof document !== "undefined") document.documentElement.lang = current;
