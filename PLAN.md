# orgmap — plan

A local-first tool for teams to model how they organise themselves: circles,
roles, accountabilities, domains and who fills which role. It is meant for the
first weeks of a transition to self-organisation (Holacracy, Sociocracy,
Sociocracy 3.0 or a home-grown variant), typically guided by a coach.

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
4. **Paradigm-aware, not paradigm-bound.** Presets change vocabulary and core
   roles; the model underneath is the same.
5. **Hand-off, not lock-in.** Exports are documented and readable, so a team can
   take its map to a commercial tool of its choice.

## Roadmap

| Milestone | Scope | Status |
|---|---|---|
| **M1 Modelling** | Circles and roles; purpose, accountabilities, domains, policies; people and assignments with focus; presets; circle-packing plan view and outline; change log with undo/redo, preview and restore; local persistence; `.orgmap`/JSON/CSV/SVG export, print; import and merge of files | **First version done** |
| **M2 Peer-to-peer** | Live sync of the same document between browsers. Room link with the key in the URL fragment; end-to-end encrypted updates; Trystero (WebRTC over public signalling) first, optional tiny relay as fallback for corporate networks; presence (who is here, what they have selected) | Next |
| **M3 Workshop flow** | Guided steps for a coach-led session (e.g. tension harvest → activity cards → clustering → roles → consent check). **Designed with coaches first**; not started on purpose | After coach input |
| Later | Hand-off adapters for specific tools (GlassFrog, Peerdom, Nestr), templates per paradigm, translations (DE/FR), PWA install | Open |

## Architecture (M1)

- **Stack:** Vite, React, TypeScript, [Loro](https://loro.dev) (`loro-crdt`) for
  the document, `d3-hierarchy` for the circle packing. Static site, no backend.
- **One Loro document per organisation**, containing:
  - `meta` (map): id, preset, createdAt, schemaVersion
  - `structure` (movable tree): one node per circle or role; node data holds
    `type`, `kind` (normal or a core role), `name`, `purpose`, lists `acc`,
    `dom`, `pol`, and `fillers` (personId → focus)
  - `people` (map): personId → { name, createdAt }
- **Mutations** live in `src/model/org.ts` (`OrgDoc`). Each one commits exactly
  one Loro change whose message is `{"a": author, "m": message}`. The UI never
  writes to Loro directly.
- **Change log** = Loro's own change history. Undo/redo uses Loro's
  `UndoManager` (local changes only, as is correct for P2P). Preview uses
  `forkAt`, restore uses `revertTo`, which writes a new change on top: history
  is never rewritten.
- **Files:** `.orgmap` is a Loro snapshot including the full history. Opening an
  `.orgmap` of an organisation that is already in the browser merges the two,
  so copies edited separately combine without conflicts.

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

- Text fields are last-writer-wins strings. Two people editing the same purpose
  at the same moment keep only one version (the log shows both). Switch to
  `LoroText` if live co-editing of long text becomes a need.
- Loro's WebAssembly is ~1.2 MB gzipped; acceptable for a tool used in sessions.
- Holacracy-style is a vocabulary preset; "Holacracy" is a trademark of
  HolacracyOne, so the product does not use it as a name. Constitution and S3
  texts are CC BY-SA 4.0 and are not bundled.

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
- Should the M2 fallback relay be hosted (Cloudflare Durable Object) or
  self-hostable only?
- Workshop flow (M3): which steps, in which order, per paradigm — to be worked
  out with coaches.
