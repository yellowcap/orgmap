// The organisation drawn as a plan: nested circles laid out with d3 circle
// packing, hairline strokes and annotation-style labels. Clicking a circle
// zooms into it; clicking empty space zooms back out.

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, pack, type HierarchyCircularNode } from "d3-hierarchy";
import type { TreeID } from "loro-crdt";
import type { OrgNode, OrgView } from "../model/org";
import { coreRoleName } from "../model/vocabulary";
import type { PeerMarks } from "./Editor";

const SIZE = 1000;

// Kept inside the <svg> so exported plans look the same as on screen.
const PLAN_CSS = `
.plan text { font-family: "Roboto Mono", ui-monospace, monospace; fill: #111; pointer-events: none; }
.plan .n { fill: transparent; stroke: #111; vector-effect: non-scaling-stroke; cursor: pointer; }
.plan .n:hover { stroke: #DF6236; }
.plan .circle { stroke-width: 1.1; }
.plan .circle.d0 { stroke-width: 1.8; }
.plan .circle.d1 { stroke-width: 1.4; }
.plan .circle.empty { stroke-dasharray: 6 3; }
.plan .role { stroke-width: 0.6; stroke: #333; fill: #fff; }
.plan .role.special { stroke-dasharray: 2 2.5; }
.plan .hl { fill: rgba(223, 98, 54, 0.14); }
.plan .sel { stroke: #DF6236; stroke-width: 2; }
.plan .clabel { text-transform: uppercase; font-weight: 400; letter-spacing: 0.18em; }
.plan .rlabel { font-weight: 400; }
.plan .meta { fill: #888; font-weight: 300; }
.plan .peer { fill: none; stroke-width: 1.5; stroke-dasharray: 1 3; stroke-linecap: round; vector-effect: non-scaling-stroke; pointer-events: none; }
.plan .peer-name { font-weight: 500; }
.plan .kind { fill: #888; font-style: italic; font-weight: 300; }
`;

type PackNode = HierarchyCircularNode<OrgNode>;

interface Props {
  view: OrgView;
  selectedId: TreeID | null;
  focusId: TreeID | null;
  highlightPersonId: string | null;
  peerMarks?: PeerMarks;
  onSelect: (id: TreeID | null) => void;
  onFocus: (id: TreeID | null) => void;
}

export const PlanView = forwardRef<SVGSVGElement, Props>(function PlanView(
  { view, selectedId, focusId, highlightPersonId, peerMarks, onSelect, onFocus },
  ref,
) {
  const layout = useMemo(() => {
    if (!view.root) return null;
    const h = hierarchy<OrgNode>(view.root, (n) => (n.type === "circle" && n.children.length ? n.children : undefined));
    h.sum((n) => (n.type === "circle" ? (n.children.length ? 0 : 3) : 1));
    return pack<OrgNode>()
      .size([SIZE, SIZE])
      .padding((d) => (d.depth === 0 ? 56 : 24))(h);
  }, [view.root]);

  const byId = useMemo(() => {
    const m = new Map<TreeID, PackNode>();
    layout?.each((d) => m.set(d.data.id, d));
    return m;
  }, [layout]);

  const people = useMemo(() => new Map(view.people.map((p) => [p.id, p.name])), [view.people]);

  // Zoom target: the focused circle (or the root).
  const target = (focusId && byId.get(focusId)) || layout;
  const camera = useCamera(target ? [target.x, target.y, target.r * 2.1] : [SIZE / 2, SIZE / 2, SIZE]);
  const [cx, cy, w] = camera;

  // Screen pixels per user unit, for label sizing and culling.
  const box = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState(600);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setPx(Math.min(e.contentRect.width, e.contentRect.height) || 600));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const k = px / w;

  if (!layout) return <div className="plan-box" ref={box} />;

  const nodes = layout.descendants();
  const clabel = 10 / k; // circle label size in user units (10px on screen)
  const rlabel = 11 / k;

  const clickBackground = () => {
    const parent = target?.parent;
    onFocus(parent ? parent.data.id : null);
  };

  return (
    <div className="plan-box" ref={box}>
      <svg
        ref={ref}
        className="plan"
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`${cx - w / 2} ${cy - w / 2} ${w} ${w}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={clickBackground}
        role="img"
        aria-label={`Plan of ${view.root?.name}`}
      >
        <style>{PLAN_CSS}</style>
        <defs>
          {nodes
            .filter((d) => d.data.type === "circle")
            .map((d) => {
              const r = Math.max(d.r - clabel * 1.6, d.r * 0.5);
              return (
                <path
                  key={d.data.id}
                  id={`arc-${d.data.id}`}
                  d={`M ${d.x - r} ${d.y} A ${r} ${r} 0 0 1 ${d.x + r} ${d.y}`}
                />
              );
            })}
        </defs>

        {nodes.map((d) => {
          const n = d.data;
          const isCircle = n.type === "circle";
          const hl = highlightPersonId && n.fillers.some((f) => f.personId === highlightPersonId);
          const cls = [
            "n",
            isCircle ? "circle" : "role",
            `d${Math.min(d.depth, 2)}`,
            isCircle && !n.children.length ? "empty" : "",
            n.kind !== "normal" ? "special" : "",
            hl ? "hl" : "",
            selectedId === n.id ? "sel" : "",
          ].join(" ");
          return (
            <circle
              key={n.id}
              className={cls}
              cx={d.x}
              cy={d.y}
              r={d.r}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(n.id);
                if (isCircle && n.children.length) onFocus(n.id);
              }}
            >
              <title>{n.name}</title>
            </circle>
          );
        })}

        {peerMarks &&
          nodes.flatMap((d) =>
            (peerMarks.get(d.data.id) ?? []).map((p, i) => (
              <g key={`p-${d.data.id}-${i}`}>
                <circle className="peer" cx={d.x} cy={d.y} r={d.r + (4 + i * 4) / k} stroke={p.colour} />
                <text
                  className="peer-name"
                  x={d.x}
                  y={d.y + d.r + (16 + i * 11) / k}
                  fontSize={9 / k}
                  textAnchor="middle"
                  style={{ fill: p.colour }}
                >
                  {p.name}
                </text>
              </g>
            )),
          )}

        {nodes.map((d) => {
          const n = d.data;
          const screenR = d.r * k;
          if (n.type === "circle" && n.children.length) {
            if (screenR < 40) return null;
            return (
              <text key={`l-${n.id}`} className="clabel" fontSize={clabel}>
                <textPath href={`#arc-${n.id}`} startOffset="50%" textAnchor="middle">
                  {n.name}
                </textPath>
              </text>
            );
          }
          if (screenR < 16) return null;
          return (
            <RoleLabel
              key={`l-${n.id}`}
              d={d}
              k={k}
              size={rlabel}
              kind={coreRoleName(n.kind)}
              people={n.fillers.map((f) => people.get(f.personId) ?? "?")}
            />
          );
        })}
      </svg>
    </div>
  );
});

function RoleLabel({ d, k, size, kind, people }: { d: PackNode; k: number; size: number; kind?: string; people: string[] }) {
  const n = d.data;
  const isCircle = n.type === "circle";
  // Monospace: one character is ~0.6em wide. Shrink (down to 8px on screen)
  // so the longest word fits, then wrap and truncate what still does not.
  const longest = Math.max(...n.name.split(/\s+/).map((w) => w.length), 1);
  size = Math.max(Math.min(size, (d.r * 1.7) / (longest * 0.62)), Math.min(size, 8 / k));
  const maxChars = Math.max(4, Math.floor((d.r * 1.7) / (size * 0.62)));
  const lines = wrap(isCircle ? n.name.toUpperCase() : n.name, maxChars, 3);
  const showMeta = d.r * k > 34;
  const meta = people.length ? initials(people) : "";
  const lineH = size * 1.25;
  const extra = (showMeta && kind ? 1 : 0) + (showMeta && meta ? 1 : 0);
  const top = d.y - ((lines.length + extra) * lineH) / 2 + size * 0.85;
  let row = 0;
  return (
    <g>
      {showMeta && kind && (
        <text className="kind" x={d.x} y={top + lineH * row++} fontSize={size * 0.8} textAnchor="middle">
          {kind === n.name ? "core role" : kind}
        </text>
      )}
      {lines.map((l, i) => (
        <text
          key={i}
          className={isCircle ? "clabel" : "rlabel"}
          x={d.x}
          y={top + lineH * row++}
          fontSize={isCircle ? size * 0.9 : size}
          textAnchor="middle"
        >
          {l}
        </text>
      ))}
      {showMeta && meta && (
        <text className="meta" x={d.x} y={top + lineH * row++} fontSize={size * 0.8} textAnchor="middle">
          {meta}
        </text>
      )}
    </g>
  );
}

function wrap(text: string, max: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line) line = word;
    else if ((line + " " + word).length <= max) line += " " + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  const out = lines.slice(0, maxLines).map((l) => (l.length > max ? l.slice(0, max - 1) + "…" : l));
  if (lines.length > maxLines) out[maxLines - 1] = out[maxLines - 1].slice(0, max - 1) + "…";
  return out.length ? out : ["—"];
}

function initials(names: string[]): string {
  const short = names.map((n) =>
    n
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0]?.toUpperCase())
      .join("")
      .slice(0, 3),
  );
  return short.length > 4 ? `${short.slice(0, 4).join(" ")} +${short.length - 4}` : short.join(" ");
}

/** Eases the camera [x, y, width] towards the target. */
function useCamera(target: [number, number, number]): [number, number, number] {
  const [cam, setCam] = useState(target);
  const camRef = useRef(cam);
  camRef.current = cam;
  const [tx, ty, tw] = target;
  useEffect(() => {
    const from = camRef.current;
    if (from[0] === tx && from[1] === ty && from[2] === tw) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return setCam([tx, ty, tw]);
    const start = performance.now();
    const dur = 550;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      // Interpolate width geometrically so zooming feels even.
      const wv = from[2] * Math.pow(tw / from[2], e);
      setCam([from[0] + (tx - from[0]) * e, from[1] + (ty - from[1]) * e, wv]);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [tx, ty, tw]);
  return cam;
}
