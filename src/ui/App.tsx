import { useCallback, useEffect, useState } from "react";
import { OrgDoc } from "../model/org";
import { loadOrg } from "../model/storage";
import { SyncSession } from "../sync/session";
import { connectTrystero } from "../sync/trystero";
import { generateKey, liveFlag, parseJoinHash, roomKey } from "../sync/link";
import { useAuthor } from "./hooks";
import { t, useLang } from "../i18n";
import { persist } from "./io";
import { Library } from "./Library";
import { Editor } from "./Editor";
import { JoinScreen } from "./JoinScreen";

type Route = { kind: "library" } | { kind: "org"; id: string } | { kind: "join"; orgId: string; key: string };

function currentRoute(): Route {
  const join = parseJoinHash(location.hash);
  if (join) return { kind: "join", ...join };
  const m = location.hash.match(/^#\/org\/(.+)$/);
  return m ? { kind: "org", id: decodeURIComponent(m[1]) } : { kind: "library" };
}

const orgHash = (id: string) => `#/org/${encodeURIComponent(id)}`;

export function App() {
  const [author, setAuthor] = useAuthor();
  const [route, setRoute] = useState(currentRoute);
  const [org, setOrg] = useState<OrgDoc | null>(null);
  // Id of the organisation a blank document is waiting to receive from peers.
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [session, setSession] = useState<SyncSession | null>(null);
  // Bumped to reconnect after going live, stopping or rotating the link.
  const [liveTick, setLiveTick] = useState(0);
  // Re-render everything when the interface language changes.
  useLang();
  const who = author || t("common.anonymous");

  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // A join link stores the room key, then continues as a normal org route
  // (replacing the URL so the key does not linger in the address bar).
  useEffect(() => {
    if (route.kind !== "join") return;
    const { orgId, key } = route;
    roomKey.set(orgId, key);
    liveFlag.set(orgId, true);
    loadOrg(orgId).then((stored) => {
      if (stored) {
        setOrg(OrgDoc.fromBytes(stored.bytes, who));
      } else {
        setOrg(OrgDoc.blank(who));
        setJoiningId(orgId);
      }
      setLiveTick((t) => t + 1);
      location.replace(orgHash(orgId));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  useEffect(() => {
    if (route.kind === "library") {
      setOrg(null);
      setJoiningId(null);
      return;
    }
    if (route.kind !== "org" || org?.id === route.id || joiningId === route.id) return;
    let cancelled = false;
    loadOrg(route.id).then((stored) => {
      if (cancelled) return;
      if (!stored) return void (location.hash = "");
      setOrg(OrgDoc.fromBytes(stored.bytes, who));
    });
    return () => {
      cancelled = true;
    };
    // `author` is applied below without reopening the document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, org?.id, joiningId]);

  useEffect(() => {
    if (org) org.author = who;
    session?.setName(who);
  }, [org, session, who]);

  // Live session: connect when this browser holds a key and sharing is on.
  const orgId = org?.ready ? org.id : joiningId;
  useEffect(() => {
    if (!org || !orgId) return;
    const key = roomKey.get(orgId);
    if (!key || !liveFlag.get(orgId)) return;
    let active: SyncSession | null = null;
    let cancelled = false;
    connectTrystero(key).then((transport) => {
      if (cancelled) return transport.leave();
      active = new SyncSession(org, transport, who);
      setSession(active);
    });
    return () => {
      cancelled = true;
      active?.leave();
      setSession(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, orgId, liveTick]);

  // A blank document becomes a normal one once the first sync arrives.
  useEffect(() => {
    if (!org || !joiningId) return;
    const check = () => {
      if (!org.ready) return;
      if (org.id !== joiningId) return;
      void persist(org);
      setJoiningId(null);
    };
    check();
    return org.subscribe(check);
  }, [org, joiningId]);

  const open = useCallback((next: OrgDoc) => {
    setOrg(next);
    location.hash = orgHash(next.id);
  }, []);

  const live = {
    goLive: () => {
      if (!org) return;
      if (!roomKey.get(org.id)) roomKey.set(org.id, generateKey());
      liveFlag.set(org.id, true);
      setLiveTick((t) => t + 1);
    },
    stop: () => {
      if (!org) return;
      liveFlag.set(org.id, false);
      setLiveTick((t) => t + 1);
    },
    newLink: () => {
      if (!org) return;
      roomKey.set(org.id, generateKey());
      setLiveTick((t) => t + 1);
    },
  };

  const close = () => (location.hash = "");

  if (route.kind === "org" && org && joiningId === route.id && !org.ready) {
    return <JoinScreen session={session} onCancel={close} />;
  }
  if (route.kind === "org" && org && org.id === route.id) {
    return (
      <Editor
        org={org}
        author={author}
        onAuthorChange={setAuthor}
        onClose={close}
        session={session}
        isLive={liveFlag.get(org.id)}
        onGoLive={live.goLive}
        onStopLive={live.stop}
        onNewLink={live.newLink}
      />
    );
  }
  if (route.kind === "join") return null;
  return <Library author={author} onAuthorChange={setAuthor} onOpen={open} />;
}
