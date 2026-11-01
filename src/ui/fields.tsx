import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";

interface TextFieldProps {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}

/**
 * A text input that commits on blur or Enter (Escape reverts), so each edit
 * becomes one change-log entry instead of one per keystroke.
 */
export function TextField({ value, onCommit, placeholder, multiline, className, autoFocus, disabled, ...rest }: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  const commit = () => {
    const next = draft.trim();
    if (next !== value) onCommit(next);
    else setDraft(value);
  };

  const common = {
    value: draft,
    placeholder,
    className,
    autoFocus,
    disabled,
    "aria-label": rest["aria-label"],
    onFocus: () => (focused.current = true),
    onBlur: () => {
      focused.current = false;
      commit();
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        setDraft(value);
        (e.target as HTMLElement).blur();
      } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        (e.target as HTMLElement).blur();
      }
    },
  };

  if (multiline) {
    return <textarea rows={Math.max(2, draft.split("\n").length)} {...common} />;
  }
  return <input {...common} />;
}

interface ListEditorProps {
  label: string;
  items: string[];
  placeholder: string;
  onAdd: (text: string) => void;
  onUpdate: (index: number, text: string) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
}

/** Ordered list of short statements, e.g. accountabilities or domains. */
export function ListEditor({ label, items, placeholder, onAdd, onUpdate, onRemove, onMove }: ListEditorProps) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t) onAdd(t);
    setDraft("");
  };
  return (
    <div className="list-editor">
      <span className="label">{label}</span>
      <ol>
        {items.map((item, i) => (
          <li key={`${i}-${item}`}>
            <TextField
              value={item}
              aria-label={`${label} ${i + 1}`}
              onCommit={(t) => (t ? onUpdate(i, t) : onRemove(i))}
            />
            <span className="item-actions">
              <button className="ghost icon" disabled={i === 0} onClick={() => onMove(i, i - 1)} title={t("list.moveUp")}>
                ↑
              </button>
              <button className="ghost icon" onClick={() => onRemove(i)} title={t("common.remove")}>
                ×
              </button>
            </span>
          </li>
        ))}
      </ol>
      <input
        className="add-item"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
      />
    </div>
  );
}
