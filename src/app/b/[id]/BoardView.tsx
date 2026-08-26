"use client";

import { useCallback, useMemo, useState } from "react";
import { BLOCK_DEFS, blockDef, COLOR_HEX } from "@/lib/blocks";
import type { BlockType, BoardNode, NodeColor } from "@/lib/types";
import { SitemapCanvas } from "@/components/SitemapCanvas";
import { WireframeBlock } from "@/components/Wireframe";

const GROUP_LABELS: Record<string, string> = {
  structure: "structure",
  layout: "layout",
  content: "content",
  media: "media",
  conversion: "conversion",
};

const COLORS = Object.keys(COLOR_HEX) as NodeColor[];

interface Props {
  id: string;
  nodes: BoardNode[];
}

export function BoardView({ id, nodes: initial }: Props) {
  const [pages, setPages] = useState<BoardNode[]>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredBlock, setHoveredBlock] = useState<{ nodeId: string; index: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [keyPrompt, setKeyPrompt] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(pages) !== baseline, [pages, baseline]);
  const selected = pages.find((p) => p.id === selectedId) ?? null;

  /* ------------------------------------------------------- mutations ---- */

  const updateNode = useCallback((nodeId: string, patch: Partial<BoardNode>) => {
    setPages((prev) => prev.map((p) => (p.id === nodeId ? { ...p, ...patch } : p)));
  }, []);

  const mutateBlocks = useCallback(
    (nodeId: string, fn: (blocks: BoardNode["wireframes"]) => BoardNode["wireframes"]) => {
      setPages((prev) =>
        prev.map((p) =>
          p.id === nodeId ? { ...p, wireframes: fn([...p.wireframes]) } : p,
        ),
      );
    },
    [],
  );

  const addChild = useCallback(() => {
    const parent = selected;
    let n = 0;
    let id = `page-${Date.now().toString(36)}${n}`;
    while (pages.some((p) => p.id === id)) id = `page-${Date.now().toString(36)}${++n}`;
    const node: BoardNode = {
      id,
      parentId: parent?.id ?? null,
      title: "New page",
      color: "slate",
      notes: "",
      sortOrder: 9999,
      wireframes: [
        { id: "b0", type: "navbar" },
        { id: "b1", type: "heading", label: "New page" },
        { id: "b2", type: "footer" },
      ],
    };
    setPages((prev) => [...prev, node]);
    setSelectedId(id);
  }, [pages, selected]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setPages((prev) => {
      const doomed = new Set<string>([selectedId]);
      for (let changed = true; changed; ) {
        changed = false;
        for (const p of prev) {
          if (p.parentId && doomed.has(p.parentId) && !doomed.has(p.id)) {
            doomed.add(p.id);
            changed = true;
          }
        }
      }
      return prev.filter((p) => !doomed.has(p.id));
    });
    setSelectedId(null);
  }, [selectedId]);

  /* ------------------------------------------------------------ save ---- */

  const doPut = useCallback(
    async (manageKey: string, current: BoardNode[]) => {
      const body = {
        nodes: current.map((n) => ({
          id: n.id,
          parent: n.parentId ?? null,
          title: n.title,
          color: n.color,
          ...(n.notes ? { notes: n.notes } : {}),
          blocks: n.wireframes.map((b) =>
            b.label ? { type: b.type, label: b.label } : b.type,
          ),
        })),
      };
      const res = await fetch(`/api/boards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Manage-Key": manageKey },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? res.statusText);
      }
    },
    [id],
  );

  const saveWith = useCallback(
    async (manageKey: string | null) => {
      if (!manageKey) {
        setKeyPrompt(true);
        setError(null);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await doPut(manageKey, pages);
        setBaseline(JSON.stringify(pages));
        try {
          localStorage.setItem(`np_key_${id}`, manageKey);
        } catch { /* private mode */ }
      } catch (e) {
        if (manageKey === key) setKey(null); // force re-prompt on bad key
        setError(e instanceof Error ? e.message : "Save failed");
        setKeyPrompt(true);
      } finally {
        setBusy(false);
        setKeyDraft("");
      }
    },
    [doPut, id, key, pages],
  );

  const submitKey = () => {
    const k = keyDraft.trim();
    if (!k) return;
    void saveWith(k);
  };

  const discard = () => {
    setPages(JSON.parse(baseline) as BoardNode[]);
    setError(null);
    setPaletteOpen(false);
  };

  /* ----------------------------------------------------------- view ---- */

  return (
    <div className="relative flex-1">
      <SitemapCanvas
        pages={pages}
        readonly
        selectedId={selectedId}
        hoveredBlock={hoveredBlock}
        onSelect={setSelectedId}
      />

      {/* inspector */}
      {selected && editing && (
        <InspectorPanel
          node={selected}
          paletteOpen={paletteOpen}
          onTogglePalette={() => setPaletteOpen((v) => !v)}
          onHoverBlock={(index) =>
            setHoveredBlock(index === null ? null : { nodeId: selected.id, index })
          }
          onPatch={(patch) => updateNode(selected.id, patch)}
          onAddBlock={(type, label) => {
            mutateBlocks(selected.id, (bs) => [
              ...bs,
              { id: `b${Date.now().toString(36)}${bs.length}`, type, ...(label ? { label } : {}) },
            ]);
          }}
          onMoveBlock={(i, dir) =>
            mutateBlocks(selected.id, (bs) => {
              const j = i + dir;
              if (j < 0 || j >= bs.length) return bs;
              [bs[i], bs[j]] = [bs[j], bs[i]];
              return bs;
            })
          }
          onRemoveBlock={(i) =>
            mutateBlocks(selected.id, (bs) => bs.filter((_, k) => k !== i))
          }
          onAddChild={addChild}
          onDelete={deleteSelected}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full border border-line-strong bg-card px-1.5 py-1 shadow-sm max-w-[92%]">
        <button
          className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
            editing ? "bg-accent text-white" : "hover:bg-paper-deep"
          }`}
          onClick={() => {
            setEditing((v) => !v);
            setError(null);
            setKeyPrompt(false);
          }}
        >
          ✎ {editing ? "editing" : "edit"}
        </button>

        {editing && dirty && !keyPrompt && (
          <>
            <span className="microlabel px-1">unsaved</span>
            <button
              disabled={busy}
              className="rounded-full bg-ink text-paper-deep px-3 py-1 text-[12px] font-semibold disabled:opacity-50 hover:bg-black"
              onClick={() => void saveWith(key)}
            >
              {busy ? "saving…" : "save"}
            </button>
            <button className="microlabel px-2 py-1 hover:bg-paper-deep rounded-full" onClick={discard}>
              discard
            </button>
          </>
        )}

        {editing && !dirty && !keyPrompt && (
          <span className="microlabel px-2">{busy ? "saving…" : "in sync with server"}</span>
        )}

        {error && <span className="microlabel text-signal px-2 truncate max-w-[220px]">{error}</span>}

        {!editing && dirty && (
          <button className="microlabel px-2 py-1 hover:bg-paper-deep rounded-full" onClick={discard}>
            revert changes
          </button>
        )}
      </div>

      {/* manage key prompt */}
      {keyPrompt && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/30 backdrop-blur-[2px]" onClick={() => setKeyPrompt(false)}>
          <div className="w-[340px] rounded-xl border border-line-strong bg-card p-4 shadow-lg space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-[14px]">Manage key required</div>
            <p className="text-[12px] leading-relaxed text-ink-soft">
              Editing writes through the API — paste the <code>nb_…</code> key you got when the board
              was created. It stays in this browser.
            </p>
            <input
              autoFocus
              type="password"
              value={keyDraft}
              placeholder="nb_…"
              onChange={(e) => setKeyDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitKey()}
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[12px] focus:outline-none focus:border-accent"
            />
            {error && <div className="text-signal text-[11.5px]">{error}</div>}
            <div className="flex justify-end gap-2">
              <button className="microlabel rounded-full px-3 py-1.5 hover:bg-paper-deep" onClick={() => setKeyPrompt(false)}>
                cancel
              </button>
              <button
                disabled={!keyDraft.trim() || busy}
                className="rounded-full bg-accent text-white px-4 py-1.5 text-[12px] font-semibold disabled:opacity-50"
                onClick={submitKey}
              >
                save board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- inspector ---- */

function InspectorPanel({
  node,
  paletteOpen,
  onTogglePalette,
  onHoverBlock,
  onPatch,
  onAddBlock,
  onMoveBlock,
  onRemoveBlock,
  onAddChild,
  onDelete,
  onClose,
}: {
  node: BoardNode;
  paletteOpen: boolean;
  onTogglePalette: () => void;
  onHoverBlock: (index: number | null) => void;
  onPatch: (patch: Partial<BoardNode>) => void;
  onAddBlock: (type: BlockType, label?: string) => void;
  onMoveBlock: (index: number, dir: -1 | 1) => void;
  onRemoveBlock: (index: number) => void;
  onAddChild: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, BlockType[]>();
    for (const d of BLOCK_DEFS) {
      const list = map.get(d.group) ?? [];
      list.push(d.type);
      map.set(d.group, list);
    }
    return [...map.entries()];
  }, []);

  return (
    <aside className="absolute top-3 right-3 bottom-16 w-[400px] max-w-[92vw] z-20 flex flex-col rounded-xl border border-line-strong bg-card shadow-[0_8px_28px_rgba(33,37,44,0.14)] overflow-hidden">
      <header className="flex items-center gap-2 px-3 py-2 border-b border-line shrink-0">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLOR_HEX[node.color] }} />
        <span className="text-[12.5px] font-semibold truncate flex-1">{node.title}</span>
        <button className="w-5 h-5 rounded-full hover:bg-paper-deep text-[11px]" onClick={onClose}>✕</button>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-3">
        <input
          value={node.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-[13px] font-semibold focus:outline-none focus:border-accent"
        />

        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              title={c}
              onClick={() => onPatch({ color: c })}
              className={`w-5 h-5 rounded-full transition-transform ${node.color === c ? "ring-2 ring-offset-1 ring-ink scale-110" : "hover:scale-110"}`}
              style={{ background: COLOR_HEX[c] }}
            />
          ))}
        </div>

        <textarea
          value={node.notes}
          rows={2}
          placeholder="notes…"
          onChange={(e) => onPatch({ notes: e.target.value })}
          className="w-full resize-none rounded-lg border border-line bg-paper px-2 py-1.5 text-[12px] focus:outline-none focus:border-accent"
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="microlabel">blocks · {node.wireframes.length}</span>
            <button
              className={`microlabel rounded-full px-2 py-0.5 border transition-colors ${
                paletteOpen ? "border-accent text-accent" : "border-line hover:border-ink"
              }`}
              onClick={onTogglePalette}
            >
              + add
            </button>
          </div>

          {paletteOpen && (
            <div className="mb-2 rounded-lg border border-line bg-paper p-2 space-y-2">
              {groups.map(([group, types]) => (
                <div key={group}>
                  <div className="microlabel mb-1 opacity-70">{GROUP_LABELS[group] ?? group}</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {types.map((t) => {
                      const h = blockDef(t).h;
                      const scale = Math.min(1, 46 / h);
                      return (
                        <button
                          key={t}
                          title={blockDef(t).label}
                          onClick={() => onAddBlock(t)}
                          className="group/pal rounded-lg border border-line bg-card hover:border-accent hover:shadow-[0_2px_10px_rgba(15,93,99,0.15)] transition-all overflow-hidden"
                        >
                          <div className="h-[52px] flex items-center justify-center overflow-hidden px-1.5 pt-1 group-hover/pal:bg-accent/5">
                            <div style={{ transform: `scale(${scale})`, width: "100%" }}>
                              <WireframeBlock block={{ id: `pal-${t}`, type: t }} />
                            </div>
                          </div>
                          <div className="microlabel text-center py-1 border-t border-line group-hover/pal:text-accent">
                            {blockDef(t).label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <ul className="space-y-1">
            {node.wireframes.map((b, i) => (
              <li
                key={`${b.id}-${i}`}
                className="rounded-lg border border-line bg-card px-2 py-1.5 transition-colors hover:border-accent"
                onMouseEnter={() => onHoverBlock(i)}
                onMouseLeave={() => onHoverBlock(null)}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10.5px] font-semibold flex-1 truncate">{blockDef(b.type).label}</span>
                  <button title="move up" disabled={i === 0} className="w-4 h-4 text-[10px] rounded disabled:opacity-25 hover:bg-paper-deep" onClick={() => onMoveBlock(i, -1)}>↑</button>
                  <button title="move down" disabled={i === node.wireframes.length - 1} className="w-4 h-4 text-[10px] rounded disabled:opacity-25 hover:bg-paper-deep" onClick={() => onMoveBlock(i, 1)}>↓</button>
                  <button title="remove" className="w-4 h-4 text-[10px] rounded hover:bg-signal hover:text-white" onClick={() => onRemoveBlock(i)}>✕</button>
                </div>
                <input
                  value={b.label ?? ""}
                  placeholder="caption…"
                  onChange={(e) =>
                    onPatch({
                      wireframes: node.wireframes.map((x, k) =>
                        k === i ? { ...x, label: e.target.value || undefined } : x,
                      ),
                    })
                  }
                  className="mt-1 w-full rounded border border-line bg-paper px-1.5 py-0.5 text-[11px] placeholder:text-ink-soft/50 focus:outline-none focus:border-accent"
                />
                <div className="mt-1.5 pointer-events-none opacity-90 overflow-hidden rounded" style={{ maxHeight: 46 }}>
                  <WireframeBlock block={b} />
                </div>
              </li>
            ))}
            {node.wireframes.length === 0 && (
              <li className="microlabel text-center py-3 border border-dashed border-line rounded-lg">no blocks — add some</li>
            )}
          </ul>
        </div>
      </div>

      <footer className="shrink-0 border-t border-line px-3 py-2 flex gap-1.5">
        <button className="flex-1 microlabel rounded-full border border-line py-1.5 hover:border-accent hover:text-accent" onClick={onAddChild}>
          + child page
        </button>
        <button
          className="microlabel rounded-full border border-line px-3 py-1.5 hover:border-signal hover:text-signal"
          onClick={() => {
            if (confirm(`Delete “${node.title}” and its whole subtree?`)) onDelete();
          }}
        >
          delete
        </button>
      </footer>
    </aside>
  );
}
