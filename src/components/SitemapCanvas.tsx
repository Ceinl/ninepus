"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cardHeight, COLOR_HEX } from "@/lib/blocks";
import type { BoardNode } from "@/lib/types";
import { WireframeBlock } from "./Wireframe";

export const NODE_W = 244;
const H_GAP = 18;
const V_GAP = 56;
const ROOT_GAP = 48;

interface Pos { x: number; y: number }
interface Bounds { minX: number; minY: number; maxX: number; maxY: number; w: number; h: number }

function computeLayout(pages: BoardNode[]) {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const childrenOf = new Map<string | null, BoardNode[]>();
  for (const p of pages) {
    const key = p.parentId && byId.has(p.parentId) ? p.parentId : null;
    const list = childrenOf.get(key) ?? [];
    list.push(p);
    childrenOf.set(key, list);
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

  const height = new Map(pages.map((p) => [p.id, cardHeight(p)]));
  const subW = new Map<string, number>();
  const widthOf = (id: string): number => {
    if (subW.has(id)) return subW.get(id)!;
    const kids = childrenOf.get(id) ?? [];
    let w = NODE_W;
    if (kids.length > 0) {
      const total = kids.reduce((s, k) => s + widthOf(k.id), 0) + H_GAP * (kids.length - 1);
      w = Math.max(NODE_W, total);
    }
    subW.set(id, w);
    return w;
  };
  for (const p of pages) widthOf(p.id);

  const pos = new Map<string, Pos>();
  const edges: Array<{ from: string; to: string }> = [];
  let cursorX = 0;

  const place = (id: string, left: number, y: number) => {
    const kids = childrenOf.get(id) ?? [];
    if (kids.length === 0) {
      pos.set(id, { x: left, y });
    } else {
      let childLeft = left;
      const firstLeft = childLeft;
      let lastRight = left;
      for (const k of kids) {
        place(k.id, childLeft, y + height.get(id)! + V_GAP);
        edges.push({ from: id, to: k.id });
        lastRight = childLeft + subW.get(k.id)!;
        childLeft += subW.get(k.id)! + H_GAP;
      }
      const span = lastRight - firstLeft;
      pos.set(id, { x: firstLeft + span / 2 - NODE_W / 2, y });
    }
  };

  for (const root of childrenOf.get(null) ?? []) {
    place(root.id, cursorX, 0);
    cursorX += subW.get(root.id)! + ROOT_GAP;
  }

  const bounds: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };
  if (pages.length > 0) {
    bounds.minX = Math.min(...[...pos.values()].map((p) => p.x));
    bounds.minY = Math.min(...[...pos.values()].map((p) => p.y));
    bounds.maxX = Math.max(...[...pos.values()].map((p) => p.x + NODE_W));
    bounds.maxY = Math.max(...pages.map((p) => (pos.get(p.id)?.y ?? 0) + height.get(p.id)!));
    bounds.w = bounds.maxX - bounds.minX;
    bounds.h = bounds.maxY - bounds.minY;
  }
  return { pos, size: height, edges, bounds, childrenOf };
}

const isDescendant = (pages: BoardNode[], ancestorId: string, candidateId: string): boolean => {
  const byId = new Map(pages.map((p) => [p.id, p]));
  let cur = byId.get(candidateId);
  while (cur?.parentId) {
    if (cur.parentId === ancestorId) return true;
    cur = byId.get(cur.parentId);
  }
  return false;
};

export interface SitemapCanvasProps {
  pages: BoardNode[];
  readonly?: boolean;
  selectedId?: string | null;
  /** Block currently hovered in the inspector — ringed on the card. */
  hoveredBlock?: { nodeId: string; index: number } | null;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, parentId: string | null, index?: number) => void;
  onAddChild?: (parentId: string | null) => void;
  onDeletePage?: (id: string) => void;
  onDuplicatePage?: (id: string) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  highlightIds?: Set<string> | null;
}

export function SitemapCanvas({ pages, readonly = false, selectedId, hoveredBlock, onSelect, onMove, onAddChild, onDeletePage, onDuplicatePage, searchQuery, onSearchChange, highlightIds }: SitemapCanvasProps) {
  const layout = useMemo(() => computeLayout(pages), [pages]);
  const [view, setView] = useState<Pos & { k: number }>({ x: 60, y: 60, k: 1 });
  const [panning, setPanning] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | "root" | null>(null);
  const [, setResizeTick] = useState(0);
  const dragId = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const didFit = useRef(false);

  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el || layout.bounds.w === 0 || el.clientWidth < 80 || el.clientHeight < 80) return;
    const raw = Math.min((el.clientWidth - 80) / layout.bounds.w, (el.clientHeight - 80) / layout.bounds.h, 1.15);
    const k = Math.max(0.25, Math.min(raw, 2.2));
    if (!Number.isFinite(k)) return;
    setView({
      k,
      x: (el.clientWidth - layout.bounds.w * k) / 2 - layout.bounds.minX * k,
      y: (el.clientHeight - layout.bounds.h * k) / 2 - layout.bounds.minY * k,
    });
  }, [layout]);

  useEffect(() => {
    if (!didFit.current && pages.length > 0) {
      didFit.current = true;
      fit();
    }
    if (pages.length === 0) didFit.current = false;
  }, [pages.length, fit]);

  // wheel: pan naturally, ctrl/⌘+wheel zoom at cursor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        setView((v) => {
          const k2 = Math.min(2.2, Math.max(0.25, v.k * (1 - e.deltaY * 0.002)));
          const s = k2 / v.k;
          return { k: k2, x: mx - (mx - v.x) * s, y: my - (my - v.y) * s };
        });
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // re-render on resize so the minimap viewport rect tracks the real container
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setResizeTick((n) => n + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ↑/↓ reorder the selected card among its siblings (matches the help overlay)
  useEffect(() => {
    if (readonly || !selectedId || !onMove) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const page = pages.find((p) => p.id === selectedId);
      if (!page) return;
      const sibs = layout.childrenOf.get(page.parentId) ?? [];
      const i = sibs.findIndex((p) => p.id === page.id);
      const j = i + (e.key === "ArrowUp" ? -1 : 1);
      if (i < 0 || j < 0 || j >= sibs.length) return;
      e.preventDefault();
      onMove(page.id, page.parentId, j);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readonly, selectedId, onMove, pages, layout]);

  const startPan = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const startX = e.clientX - view.x;
    const startY = e.clientY - view.y;
    setPanning(true);
    const move = (ev: MouseEvent) =>
      setView((v) => ({ ...v, x: ev.clientX - startX, y: ev.clientY - startY }));
    const up = () => {
      setPanning(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  /** Ordered sibling list *including* `page` itself — indices here match the
   *  `index` the move API expects. */
  const siblingsOf = (page: BoardNode): BoardNode[] => layout.childrenOf.get(page.parentId) ?? [];
  const rankOf = (page: BoardNode): number => siblingsOf(page).findIndex((p) => p.id === page.id);

  const doMove = (id: string, parentId: string | null, index?: number) => {
    if (readonly || !onMove) return;
    if (parentId && isDescendant(pages, id, parentId)) return;
    onMove(id, parentId, index);
  };

  const reorder = (page: BoardNode, dir: -1 | 1) => {
    const i = rankOf(page);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= siblingsOf(page).length) return;
    doMove(page.id, page.parentId, j);
  };

  const promote = (page: BoardNode) => {
    if (!page.parentId) return;
    const parent = pages.find((p) => p.id === page.parentId);
    if (!parent) return;
    // land directly after the former parent, not at the end of its sibling list
    const idx = rankOf(parent);
    doMove(page.id, parent.parentId, idx < 0 ? undefined : idx + 1);
  };
  const demote = (page: BoardNode) => {
    const sibs = siblingsOf(page);
    const i = sibs.findIndex((p) => p.id === page.id);
    if (i <= 0) return;
    doMove(page.id, sibs[i - 1].id);
  };

  const zoomBtn = (dir: 1 | -1) =>
    setView((v) => {
      const el = containerRef.current;
      const cx = (el?.clientWidth ?? 800) / 2;
      const cy = (el?.clientHeight ?? 600) / 2;
      const k2 = Math.min(2.2, Math.max(0.25, dir === 1 ? v.k * 1.2 : v.k / 1.2));
      const s = k2 / v.k;
      return { k: k2, x: cx - (cx - v.x) * s, y: cy - (cy - v.y) * s };
    });

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden dotgrid ${panning ? "cursor-grabbing" : "cursor-grab"}`}
      onMouseDown={startPan}
      onClick={() => onSelect?.(null)}
      onDragOver={(e) => {
        if (dropTarget === null) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dragId.current && !readonly) doMove(dragId.current, null);
        dragId.current = null;
        setDropTarget(null);
      }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: layout.bounds.w + NODE_W * 2, height: layout.bounds.h + 400 }}
      >
        <svg className="absolute inset-0 overflow-visible pointer-events-none" width="100%" height="100%">
          {layout.edges.map(({ from, to }) => {
            const a = layout.pos.get(from)!;
            const b = layout.pos.get(to)!;
            const px = a.x + NODE_W / 2;
            const py = a.y + layout.size.get(from)!;
            const cx = b.x + NODE_W / 2;
            const cy = b.y;
            const my = py + (cy - py) / 2;
            return (
              <path
                key={`${from}-${to}`}
                d={`M ${px} ${py} C ${px} ${my}, ${cx} ${my}, ${cx} ${cy}`}
                fill="none"
                stroke="#c2bbaa"
                strokeWidth={1.5}
              />
            );
          })}
        </svg>

        {pages.map((page) => {
          const p = layout.pos.get(page.id);
          if (!p) return null;
          const selected = selectedId === page.id;
          const color = COLOR_HEX[page.color] ?? COLOR_HEX.slate;
          const siblingCount = siblingsOf(page).length;
          const rank = rankOf(page);
          const canDemote = rank > 0;
          const isHi = highlightIds?.has(page.id) ?? false;
          const isDimmed = highlightIds && highlightIds.size > 0 && !isHi && !selected;
          return (
            <div
              key={page.id}
              className={`group absolute rounded-[9px] border bg-card select-none transition-all ${
                selected ? "border-accent shadow-[0_6px_20px_rgba(15,93,99,0.14),0_2px_8px_rgba(33,37,44,0.08)]" : isHi ? "border-accent/60 shadow-[0_4px_14px_rgba(15,93,99,0.12)]" : "border-line hover:border-line-strong hover:shadow-[0_4px_12px_rgba(33,37,44,0.07)]"
              } ${isDimmed ? "opacity-35 grayscale-[0.2]" : ""}`}
              style={{
                left: p.x,
                top: p.y,
                width: NODE_W,
                // minHeight, not height: the layout still positions by cardHeight(), but a
                // block that paints a few px taller grows the card instead of being clipped
                minHeight: layout.size.get(page.id),
                outline: dropTarget === page.id ? `2px dashed ${color}` : isHi ? `2px solid ${color}` : undefined,
                outlineOffset: 3,
              }}
              draggable={!readonly}
              onDragStart={(e) => {
                dragId.current = page.id;
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => { dragId.current = null; setDropTarget(null); }}
              onDragOver={(e) => {
                if (dragId.current && dragId.current !== page.id && !isDescendant(pages, page.id, dragId.current)) {
                  e.preventDefault();
                  e.stopPropagation();
                  setDropTarget(page.id);
                }
              }}
              onDragLeave={() => setDropTarget((t) => (t === page.id ? null : t))}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragId.current && !readonly) doMove(dragId.current, page.id);
                dragId.current = null;
                setDropTarget(null);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(page.id);
              }}
            >
              <div className="overflow-hidden rounded-[9px] min-h-full flex flex-col">
                {/* browser chrome header */}
                <div className="flex items-center justify-between px-2.5 bg-card border-b border-line shrink-0" style={{ height: 28 }}>
                  <span className="flex items-center gap-[3px] shrink-0">
                    <span className="w-[6px] h-[6px] rounded-full bg-line" />
                    <span className="w-[6px] h-[6px] rounded-full bg-line" />
                    <span className="w-[6px] h-[6px] rounded-full bg-line" />
                  </span>
                  <span className="text-[12.5px] font-semibold leading-none truncate text-ink flex-1 text-center px-2">{page.title}</span>
                  <span className="w-[14px] h-[14px] rounded-full border border-line flex items-center justify-center text-[9px] leading-none text-ink-soft shrink-0">−</span>
                </div>

                <div className="px-2 pt-2 pb-2.5 space-y-1.5 flex-1 overflow-hidden">
                  {page.wireframes.map((b, bi) => {
                    const hovered = hoveredBlock?.nodeId === page.id && hoveredBlock.index === bi;
                    return (
                      <div
                        key={b.id}
                        className={`rounded-[4px] transition-all duration-100 ${hovered ? "outline-2 outline-accent outline-dashed outline-offset-2 bg-accent/5 -m-0.5 p-0.5" : ""}`}
                      >
                        <WireframeBlock block={b} />
                      </div>
                    );
                  })}
                  {page.wireframes.length === 0 && (
                    <div className="microlabel py-3 text-center opacity-60 border border-dashed border-line rounded-[6px] bg-paper/50">no blocks</div>
                  )}
                </div>
              </div>

              {!readonly && (
                <>
                  <button
                    title="Add child page"
                    className="absolute left-1/2 -translate-x-1/2 -bottom-[13px] z-10 w-[26px] h-[26px] rounded-full border border-line-strong bg-card text-ink hidden group-hover:flex items-center justify-center hover:bg-accent hover:text-white hover:border-accent transition-colors shadow-sm text-[15px] leading-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddChild?.(page.id);
                    }}
                  >
                    +
                  </button>

                  {selected && (
                    <div
                      className="absolute -top-[34px] left-1/2 -translate-x-1/2 flex items-center gap-[2px] rounded-full border border-line-strong bg-card px-1 py-[2px] shadow-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {[
                        { t: "Move up (↑)", d: "↑", fn: () => reorder(page, -1), dis: rank <= 0 },
                        { t: "Move down (↓)", d: "↓", fn: () => reorder(page, 1), dis: rank < 0 || rank >= siblingCount - 1 },
                        { t: "Promote (outdent)", d: "⇤", fn: () => promote(page), dis: !page.parentId },
                        { t: "Demote under previous sibling", d: "⇥", fn: () => demote(page), dis: !canDemote },
                        { t: "Duplicate page + subtree (d)", d: "⧉", fn: () => onDuplicatePage?.(page.id), dis: false },
                        { t: "Delete page + subtree (⌫)", d: "✕", fn: () => onDeletePage?.(page.id), dis: false, danger: true },
                      ].map((btn) => (
                        <button
                          key={btn.t}
                          title={btn.t}
                          disabled={btn.dis}
                          className={`min-w-[22px] h-[22px] rounded-full text-[11px] leading-none px-[3px] disabled:opacity-25 ${
                            btn.danger ? "hover:bg-signal hover:text-white" : "hover:bg-paper-deep"
                          }`}
                          onClick={() => btn.fn()}
                        >
                          {btn.d}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* breadcrumbs for selected page */}
      {selectedId && (() => {
        const byId = new Map(pages.map((p) => [p.id, p]));
        const path: typeof pages = [];
        let cur = byId.get(selectedId);
        while (cur) { path.unshift(cur); const pid = cur.parentId; cur = pid ? (byId.get(pid) ?? undefined) : undefined; }
        if (path.length <= 1) return null;
        return (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-line-strong bg-card/90 backdrop-blur px-2 py-1 shadow-sm max-w-[56%] overflow-hidden">
            {path.map((node, i) => (
              <span key={node.id} className="flex items-center gap-1 min-w-0">
                {i > 0 && <span className="text-line-strong text-[10px]">/</span>}
                <button
                  onClick={(e) => { e.stopPropagation(); onSelect?.(node.id); }}
                  className={`truncate text-[11.5px] leading-none px-1 py-0.5 rounded ${i === path.length - 1 ? "font-semibold bg-paper-deep" : "hover:bg-paper-deep text-ink-soft hover:text-ink"}`}
                  title={node.title}
                >
                  {node.title}
                </button>
              </span>
            ))}
          </div>
        );
      })()}

      {/* search */}
      {onSearchChange && (
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="relative">
            <input
              value={searchQuery ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              placeholder="Filter pages…  (/)"
              className="w-44 bg-card border border-line rounded-full pl-7 pr-3 py-1.5 text-[12.5px] shadow-sm placeholder:text-ink-soft/60 focus:outline-none focus:border-accent"
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft text-[12px] pointer-events-none">⌕</span>
            {searchQuery && (
              <button
                onClick={(e) => { e.stopPropagation(); onSearchChange(""); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-paper-deep text-[10px] leading-none flex items-center justify-center hover:bg-line"
              >
                ✕
              </button>
            )}
          </div>
          {highlightIds && highlightIds.size > 0 && (
            <span className="microlabel bg-card border border-line rounded-full px-2 py-1 shadow-sm">{highlightIds.size} match{highlightIds.size === 1 ? "" : "es"}</span>
          )}
          {searchQuery && highlightIds && highlightIds.size === 0 && (
            <span className="microlabel bg-signal text-white rounded-full px-2 py-1">no match</span>
          )}
        </div>
      )}

      {/* minimap */}
      {pages.length > 2 && layout.bounds.w > 0 && (
        <div className="absolute bottom-4 left-4 w-[140px] h-[90px] rounded-lg border border-line-strong bg-card/90 backdrop-blur shadow-sm overflow-hidden hidden lg:block">
          <div className="absolute inset-[6px]">
            <svg viewBox={`${layout.bounds.minX} ${layout.bounds.minY} ${layout.bounds.w} ${layout.bounds.h}`} className="w-full h-full">
              {layout.edges.map(({ from, to }) => {
                const a = layout.pos.get(from)!;
                const b = layout.pos.get(to)!;
                const px = a.x + NODE_W / 2;
                const py = a.y + layout.size.get(from)!;
                const cx = b.x + NODE_W / 2;
                const cy = b.y;
                const my = py + (cy - py) / 2;
                return <path key={`${from}-${to}`} d={`M ${px} ${py} C ${px} ${my}, ${cx} ${my}, ${cx} ${cy}`} fill="none" stroke="#c2bbaa" strokeWidth={2} vectorEffect="non-scaling-stroke" />;
              })}
              {pages.map((page) => {
                const p = layout.pos.get(page.id);
                if (!p) return null;
                const isSel = page.id === selectedId;
                const isHi = highlightIds ? highlightIds.has(page.id) : false;
                const col = COLOR_HEX[page.color] ?? COLOR_HEX.slate;
                return (
                  <rect
                    key={page.id}
                    x={p.x}
                    y={p.y}
                    width={NODE_W}
                    height={layout.size.get(page.id)!}
                    rx={6}
                    fill={isSel ? "#fffdf8" : isHi ? col : "#fffdf8"}
                    fillOpacity={isHi ? 0.25 : 1}
                    stroke={isSel ? "#21252c" : isHi ? col : "#e4dfd2"}
                    strokeWidth={isSel || isHi ? 4 : 1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
              {/* viewport rect */}
              {/* eslint-disable-next-line react-hooks/refs -- reading container size for minimap viewport is render-safe */}
              {(() => {
                const el = containerRef.current;
                if (!el) return null;
                const vw = el.clientWidth / view.k;
                const vh = el.clientHeight / view.k;
                const vx = ( -view.x) / view.k;
                const vy = ( -view.y) / view.k;
                return <rect x={vx} y={vy} width={vw} height={vh} fill="none" stroke="#0f5d63" strokeWidth={3} rx={8} opacity={0.45} vectorEffect="non-scaling-stroke" />;
              })()}
            </svg>
          </div>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 microlabel bg-card border border-line rounded-full px-1.5 py-0 text-[9px] leading-none">{pages.length} pages</div>
        </div>
      )}

      {/* zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-full border border-line-strong bg-card px-1.5 py-1 shadow-sm">
        <button className="w-6 h-6 rounded-full hover:bg-paper-deep text-sm" onClick={(e) => { e.stopPropagation(); zoomBtn(-1); }}>−</button>
        <span className="microlabel w-9 text-center">{Math.round(view.k * 100)}%</span>
        <button className="w-6 h-6 rounded-full hover:bg-paper-deep text-sm" onClick={(e) => { e.stopPropagation(); zoomBtn(1); }}>+</button>
        <button className="microlabel ml-1 rounded-full px-2 py-1 hover:bg-paper-deep" onClick={(e) => { e.stopPropagation(); fit(); }}>fit</button>
      </div>

      {/* hints */}
      <div className="absolute top-3 right-3 hidden md:flex items-center gap-1.5">
        <span className="microlabel bg-card/80 backdrop-blur border border-line rounded-full px-2 py-1">drag to pan · scroll to pan · ⌘+wheel to zoom</span>
      </div>

      {!readonly && pages.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center rise">
            <div className="font-display italic text-xl text-ink-soft">an empty blueprint</div>
            <div className="microlabel mt-2">generate · import url · add a root page · or press ⌘K</div>
          </div>
        </div>
      )}
    </div>
  );
}
