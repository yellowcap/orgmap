import { useEffect, useState } from "react";
import { OrgDoc } from "../model/org";
import { fromJSON } from "../model/export";
import { deleteOrg, listOrgs, type OrgSummary } from "../model/storage";
import { exampleOrg } from "../model/templates";
import { formatDateTime, getLang, t } from "../i18n";
import { errorMessage } from "../i18n/model";
import { LanguagePicker } from "./LanguagePicker";
import { importFile, persist } from "./io";
import { pickFile } from "./files";
import { TextField } from "./fields";

interface Props {
  author: string;
  onAuthorChange: (name: string) => void;
  onOpen: (org: OrgDoc) => void;
}

export function Library({ author, onAuthorChange, onOpen }: Props) {
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const refresh = () => listOrgs().then(setOrgs, (e) => setError(String(e)));
  useEffect(() => {
    refresh();
  }, []);

  const who = author || t("common.anonymous");

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const org = OrgDoc.create({ name: name.trim(), author: who });
    await persist(org);
    onOpen(org);
  };

  const example = async () => {
    const org = fromJSON(exampleOrg(getLang()), who);
    await persist(org);
    onOpen(org);
  };

  const importOne = async () => {
    setError("");
    const file = await pickFile(".orgmap,.json");
    if (!file) return;
    try {
      const { org } = await importFile(file, who);
      onOpen(org);
    } catch (err) {
      setError(t("lib.openError", { file: file.name, error: errorMessage(err) }));
    }
  };

  const remove = async (o: OrgSummary) => {
    if (!confirm(t("lib.deleteConfirm", { name: o.name }))) return;
    await deleteOrg(o.id);
    refresh();
  };

  return (
    <div className="library">
      <header className="library-head">
        <div className="library-top">
          <h1 className="wordmark">orgmap</h1>
          <LanguagePicker />
        </div>
        <p className="kicker">{t("lib.kicker")}</p>
        <p className="lede">{t("lib.lede")}</p>
      </header>

      <section className="sheet">
        <h2 className="label">{t("lib.you")}</h2>
        <label className="field">
          <span className="label">{t("lib.yourName")}</span>
          <TextField value={author} placeholder={t("lib.yourNamePlaceholder")} onCommit={onAuthorChange} />
        </label>
      </section>

      <section className="sheet">
        <h2 className="label">{t("lib.new")}</h2>
        <form className="new-org" onSubmit={create}>
          <label className="field">
            <span className="label">{t("common.name")}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("lib.orgNamePlaceholder")} />
          </label>
          <div className="row">
            <button type="submit" className="primary" disabled={!name.trim()}>
              {t("lib.create")}
            </button>
            <button type="button" onClick={example}>
              {t("lib.example")}
            </button>
            <button type="button" onClick={importOne}>
              {t("lib.open")}
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      </section>

      <section className="sheet">
        <h2 className="label">{t("lib.stored")}</h2>
        {orgs.length === 0 ? (
          <p className="muted">{t("lib.empty")}</p>
        ) : (
          <ul className="org-list">
            {orgs.map((o) => (
              <li key={o.id}>
                <button
                  className="link"
                  onClick={() => (location.hash = `#/org/${encodeURIComponent(o.id)}`)}
                >
                  {o.name || t("common.untitled")}
                </button>
                <span className="muted">{formatDateTime(o.updatedAt)}</span>
                <button className="ghost" onClick={() => remove(o)} title={t("lib.deleteTitle")}>
                  {t("lib.delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
