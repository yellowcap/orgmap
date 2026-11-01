import { LANGUAGES, setLang, t, useLang, type Lang } from "../i18n";

export function LanguagePicker() {
  const lang = useLang();
  return (
    <select className="lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t("common.language")}>
      {LANGUAGES.map((l) => (
        <option key={l.id} value={l.id}>
          {l.id.toUpperCase()} · {l.name}
        </option>
      ))}
    </select>
  );
}
