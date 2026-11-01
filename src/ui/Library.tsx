import { useEffect, useState } from "react";
import { OrgDoc } from "../model/org";
import { fromJSON } from "../model/export";
import { PRESETS, PRESET_IDS, type PresetId } from "../model/presets";
import { deleteOrg, listOrgs, type OrgSummary } from "../model/storage";
import { EXAMPLE_ORG } from "../model/templates";
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
  const [preset, setPreset] = useState<PresetId>("holacracy");
  const [error, setError] = useState("");

  const refresh = () => listOrgs().then(setOrgs, (e) => setError(String(e)));
  useEffect(() => {
    refresh();
  }, []);

  const who = author || "Anonymous";

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const org = OrgDoc.create({ name: name.trim(), preset, author: who });
    await persist(org);
    onOpen(org);
  };

  const example = async () => {
    const org = fromJSON(EXAMPLE_ORG, who);
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
      setError(`Could not open ${file.name}: ${(err as Error).message}`);
    }
  };

  const remove = async (o: OrgSummary) => {
    if (!confirm(`Delete “${o.name}” from this browser? Exported files are not affected.`)) return;
    await deleteOrg(o.id);
    refresh();
  };

  return (
    <div className="library">
      <header className="library-head">
        <h1 className="wordmark">orgmap</h1>
        <p className="kicker">Circles · Roles · Structure</p>
        <p className="lede">
          Map how your team organises itself. Everything stays in this browser; take it with you as a file.
        </p>
      </header>

      <section className="sheet">
        <h2 className="label">01 — You</h2>
        <label className="field">
          <span className="label">Your name, shown in the change log</span>
          <TextField value={author} placeholder="e.g. Andrea" onCommit={onAuthorChange} />
        </label>
      </section>

      <section className="sheet">
        <h2 className="label">02 — New organisation</h2>
        <form className="new-org" onSubmit={create}>
          <label className="field">
            <span className="label">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Team Alpha" />
          </label>
          <fieldset className="presets">
            <legend className="label">Vocabulary</legend>
            {PRESET_IDS.map((id) => (
              <label key={id} className={`preset ${preset === id ? "on" : ""}`}>
                <input type="radio" name="preset" checked={preset === id} onChange={() => setPreset(id)} />
                <strong>{PRESETS[id].label}</strong>
                <span>{PRESETS[id].description}</span>
              </label>
            ))}
          </fieldset>
          <div className="row">
            <button type="submit" className="primary" disabled={!name.trim()}>
              Create
            </button>
            <button type="button" onClick={example}>
              Start from an example
            </button>
            <button type="button" onClick={importOne}>
              Open a file…
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      </section>

      <section className="sheet">
        <h2 className="label">03 — In this browser</h2>
        {orgs.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <ul className="org-list">
            {orgs.map((o) => (
              <li key={o.id}>
                <button
                  className="link"
                  onClick={() => (location.hash = `#/org/${encodeURIComponent(o.id)}`)}
                >
                  {o.name || "Untitled"}
                </button>
                <span className="muted">{new Date(o.updatedAt).toLocaleString()}</span>
                <button className="ghost" onClick={() => remove(o)} title="Delete from this browser">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
