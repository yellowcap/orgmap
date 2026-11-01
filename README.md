# orgmap

Map how a team organises itself — circles, roles, accountabilities, domains and
who fills which role — in a browser, with nothing leaving the device unless you
export it.

Built for teams exploring self-organisation (Holacracy-style, Sociocracy,
Sociocracy 3.0 or plain language), typically with a coach. See [PLAN.md](PLAN.md)
for goals, roadmap and architecture.

## Features (M1)

- Circles and roles with purpose, accountabilities, domains and policies
- Vocabulary presets with their core roles (e.g. Circle Lead, Leader/Delegate)
- People and role assignments with a focus
- Plan view: zoomable circle packing styled as an architectural drawing, with
  legend and title block; outline with drag-and-drop
- Change log: every edit with author and time; undo/redo, preview any earlier
  version, restore it
- Stored locally in the browser (IndexedDB), works offline
- Files:
  - `.orgmap` — complete, including history; reopen it any time, or merge a
    copy someone else edited
  - JSON (`orgmap/v1`) — readable structure for other tools; can also be opened
    to start a new organisation
  - CSV — one row per circle or role, for spreadsheets and imports
  - SVG and print/PDF of the plan

## Development

Requires Node 20+.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # data-layer tests (vitest)
npm run build      # static site in dist/
```

The build is a static site with relative paths; it can be served from any
static host. Pushes to `main` deploy to GitHub Pages via
`.github/workflows/pages.yml`: https://yellowcap.github.io/orgmap/

## License

MIT, see [LICENSE](LICENSE).

Bundled third-party work:

- Fonts [Josefin Sans](https://github.com/ThomasJockin/JosefinSansFont-master)
  and [Roboto Mono](https://github.com/googlefonts/robotomono), SIL Open Font
  License 1.1; the licence texts ship with the site in `public/licenses/`.
- [Loro](https://github.com/loro-dev/loro) (MIT), [d3-hierarchy](https://github.com/d3/d3-hierarchy)
  (ISC), [React](https://github.com/facebook/react) (MIT).

"Holacracy" is a registered trademark of HolacracyOne, LLC. orgmap is not
affiliated with or endorsed by HolacracyOne; the "Holacracy-style" preset only
describes compatible vocabulary.

## Layout

```
src/model/   data layer, no UI
  org.ts       OrgDoc: the Loro document, all mutations, history
  presets.ts   vocabularies and core roles per paradigm
  export.ts    JSON/CSV export, JSON import
  storage.ts   IndexedDB persistence
  templates.ts example organisation
src/ui/      React components
  PlanView.tsx circle-packing plan
  Editor.tsx   main screen
```
