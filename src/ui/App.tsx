import { useCallback, useEffect, useState } from "react";
import { OrgDoc } from "../model/org";
import { loadOrg } from "../model/storage";
import { useAuthor } from "./hooks";
import { Library } from "./Library";
import { Editor } from "./Editor";

function currentHashId(): string | null {
  const m = location.hash.match(/^#\/org\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function App() {
  const [author, setAuthor] = useAuthor();
  const [org, setOrg] = useState<OrgDoc | null>(null);
  const [hashId, setHashId] = useState(currentHashId);

  useEffect(() => {
    const onHash = () => setHashId(currentHashId());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (!hashId) return setOrg(null);
    if (org?.id === hashId) return;
    let cancelled = false;
    loadOrg(hashId).then((stored) => {
      if (cancelled) return;
      if (!stored) return void (location.hash = "");
      setOrg(OrgDoc.fromBytes(stored.bytes, author || "Anonymous"));
    });
    return () => {
      cancelled = true;
    };
    // `author` is applied below without reopening the document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hashId, org?.id]);

  useEffect(() => {
    if (org) org.author = author || "Anonymous";
  }, [org, author]);

  const open = useCallback((next: OrgDoc) => {
    setOrg(next);
    location.hash = `#/org/${encodeURIComponent(next.id)}`;
  }, []);

  if (org && hashId === org.id) {
    return <Editor org={org} author={author} onAuthorChange={setAuthor} onClose={() => (location.hash = "")} />;
  }
  return <Library author={author} onAuthorChange={setAuthor} onOpen={open} />;
}
