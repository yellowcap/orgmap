# orgmap — plan

A local-first tool for teams to model how they organise themselves: teams,
roles, responsibilities, areas of authority and who fills which role. It is
meant for the first weeks of a transition to self-organisation, typically
guided by a coach.

## Why this exists

- Existing tools (GlassFrog, Peerdom, Nestr, Talkspirit/Holaspirit, Rolebase,
  Fractale) target organisations that already run a formal governance process.
  None serves the exploratory phase where a team first sketches its structure.
- All of them need accounts and a server, most charge per seat, and none works
  offline. Restructuring data is sensitive.
- Coaches end up with structures in several places that drift apart:
  whiteboards, spreadsheets, Kumu/Miro, then retyped into a governance tool.

orgmap is free, runs in the browser, stores everything locally and hands the
result over as a file.

## Principles

1. **Local-first.** The organisation lives in the browser (IndexedDB). No
   account, no server needed. Files are the way to share and keep work.
2. **Every edit is attributed and reversible.** Each change is one entry in the
   change log with author and time; it can be undone, previewed and restored.
3. **Don't close the peer-to-peer door.** The data model is a CRDT from day
   one, so sync is a transport added later, not a rewrite.
4. **Plain language.** One neutral vocabulary (team, role, purpose,
   responsibilities, areas of authority, agreements) and two core roles (Lead,
   Representative), so no method's terms need to be learned first.
5. **Hand-off, not lock-in.** Exports are documented and readable, so a team can
   take its map to a commercial tool of its choice.

## Roadmap

| Milestone | Scope | Status |
|---|---|---|
| **M1 Modelling** | Teams and roles; purpose, responsibilities, areas of authority, agreements; people and assignments with focus; core roles; circle-packing plan view and outline; change log with undo/redo, preview and restore; local persistence; `.orgmap`/JSON/CSV/SVG export, print; import and merge of files | **First version done** |
| **M2 Peer-to-peer** | Live sync of the same document between browsers. Share link with the key in the URL fragment; encrypted direct connections (WebRTC via Trystero, public Nostr relays for signalling); presence (who is here, what they have selected); optional TURN settings for strict networks | **First version done** |
| **M3 Workshop flow** | Guided steps for a coach-led session (e.g. tension harvest → activity cards → clustering → roles → consent check). **Designed with coaches first**; not started on purpose | After coach input |
| Later | Fallback relay for networks that block WebRTC, hand-off adapters for specific tools (GlassFrog, Peerdom, Nestr), more templates, PWA install | Open |

## Architecture (M1)

- **Stack:** Vite, React, TypeScript, [Loro](https://loro.dev) (`loro-crdt`) for
  the document, `d3-hierarchy` for the circle packing. Static site, no backend.
- **One Loro document per organisation**, containing:
  - `meta` (map): id, createdAt, schemaVersion
  - `structure` (movable tree): one node per circle or role; node data holds
    `type`, `kind` (normal or a core role), `name`, `purpose`, lists `acc`,
    `dom`, `pol`, and `fillers` (personId → focus)
  - `people` (map): personId → { name, createdAt }
- **Mutations** live in `src/model/org.ts` (`OrgDoc`). Each one commits exactly
  one Loro change whose message is `{"a": author, "k": key, "v": values}`: a
  translation key plus values, not a sentence, so the log reads in each viewer's
  language even when people in a live session use different ones (entries from
  earlier versions, stored as English text, are shown as written). The UI never
  writes to Loro directly.
- **Change log** = Loro's own change history. Undo/redo uses Loro's
  `UndoManager` (local changes only, as is correct for P2P). Preview uses
  `forkAt`, restore uses `revertTo`, which writes a new change on top: history
  is never rewritten.
- **Files:** `.orgmap` is a Loro snapshot including the full history. Opening an
  `.orgmap` of an organisation that is already in the browser merges the two,
  so copies edited separately combine without conflicts.

## Architecture (M2, live sync)

- **Transport:** [Trystero](https://github.com/dmotz/trystero) with its Nostr
  strategy. Public Nostr relays are only used to find peers (signalling, encrypted
  with the room key); document data then flows browser to browser over WebRTC
  data channels (DTLS). Nothing is stored on a server.
- **Share link:** `#/join/<orgId>/<key>`. The key is a random 128-bit value in
  the URL fragment, so it never reaches the web server. The room id is derived
  from the key (SHA-256), the key is also Trystero's password. On opening, the
  app stores the key and replaces the address with `#/org/<orgId>`.
- **Keys stay out of the document.** The room key and the "live" flag are kept
  per organisation in `localStorage`, not in the Loro document, so passing an
  `.orgmap` file around never grants access to a live session. "New link"
  rotates the key; old links stop connecting, people keep what they have.
- **Protocol** (`src/sync/session.ts`, transport-agnostic, unit-tested with an
  in-memory hub): on connect both sides send `hello` (org id + Loro version
  vector) and answer with the updates the other is missing; afterwards every
  local commit is broadcast as a Loro update. Peers with a different org id are
  ignored. Loro merges in any order, so reconnects after offline edits converge.
  `presence` carries name and selection for the markers on the plan.
- **Joining:** a browser without the organisation starts from a blank document
  and shows a waiting screen until the first sync arrives, then saves it.
- **Saving:** every change, local or remote, is written to IndexedDB at once
  (coalesced), and again when the page is hidden.

### Rules that keep peer-to-peer possible

- All shared state lives in the Loro document; React state only holds per-viewer
  things (selection, zoom, highlighted person, open tab).
- Mutations are named functions with commit messages; no ad-hoc writes.
- IDs are generated in the browser (Loro tree IDs, random UUIDs for people).
- **Nothing outside a tree node references a tree node id.** Loro cannot revive
  a deleted tree node, so undoing a removal or restoring a version recreates
  nodes (with all their content) under new ids. Assignments therefore live
  inside the role node and reference stable person ids.
- Attribution is stored in each change, so it survives merges and restores.
  It is self-declared; signing edits is a later concern.

### Known limits

- Live sync only works while at least one person who has the organisation is
  online. Networks that block WebRTC need a TURN server (Share → Network
  settings) or files instead. Public Nostr relays come and go; Trystero uses
  several, so single failures are harmless.
- Anyone with the link can edit, and author names are self-declared. Fine for a
  workshop room; not an access-control system.
- Text fields are last-writer-wins strings. Two people editing the same purpose
  at the same moment keep only one version (the log shows both). Switch to
  `LoroText` if live co-editing of long text becomes a need.
- Loro's WebAssembly is ~1.2 MB gzipped; acceptable for a tool used in sessions.

## Languages

English, German, French and Italian. `src/i18n/` holds one dictionary per
language (no library); the other languages are type-checked against English
and a test checks that every message has the same placeholders. The browser's
preferred languages pick one on the first visit, English if none matches; the
language menu overrides it per browser. Data the user creates (names, the
example organisation, core roles once added) stays in the language it was
written in. CSV headers and the JSON `vocabulary` follow the interface
language; JSON keys do not.

## Visual direction

Quiet, editorial, in the manner of architectural plan drawings:

- White paper, black hairlines, greys (#888, #bbb, #dadada), one terracotta
  accent `#DF6236` for selection and focus.
- Josefin Sans for display, Roboto Mono (light) for everything else; labels in
  uppercase with wide tracking. Fonts are bundled so the app works offline.
- The plan has a drafting grid, line weights by depth, dashed lines for core
  roles and empty circles, a legend, and a title block ("Plankopf") with
  organisation, revision, date and last editor. Printing produces the plan with
  its title block on A4 landscape.

## Open questions

- Which hand-off formats matter most to coaches and teams (GlassFrog CSV?
  Peerdom import?) — needs confirmation with real exports.
- Is a fallback relay needed for corporate networks (TURN settings exist; a
  hosted relay, e.g. a Cloudflare Durable Object, would also store nothing but
  forward updates), and should it be hosted or self-hostable only?
- Workshop flow (M3): which steps, in which order — to be worked
  out with coaches.
