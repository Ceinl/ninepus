"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BLOCK_DEFS, blockDef, COLOR_HEX } from "@/lib/blocks";
import type { BlockType, BoardNode, NodeColor, PageType } from "@/lib/types";
import { SitemapCanvas } from "@/components/SitemapCanvas";
import { WireframeBlock } from "@/components/Wireframe";
import { ThemeToggle } from "@/components/ThemeToggle";

const GROUP_LABELS: Record<string, string> = {
  structure: "structure",
  layout: "layout",
  content: "content",
  media: "media",
  conversion: "conversion",
};

const COLORS = Object.keys(COLOR_HEX) as NodeColor[];
const PAGE_TYPES: Array<{ value: PageType; label: string }> = [
  { value: "page", label: "page" },
  { value: "template", label: "template" },
  { value: "redirect", label: "redirect" },
  { value: "external", label: "external link" },
];

interface Props {
  id: string;
  nodes: BoardNode[];
}

/* ------------------------------------------------------------- helpers ---- */

let seq = 0;
const freshId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(seq++).toString(36)}`;

/** All ids in the subtree rooted at `rootId` (inclusive). */
function subtreeIds(pages: BoardNode[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const p of pages) {
      if (p.parentId && ids.has(p.parentId) && !ids.has(p.id)) {
        ids.add(p.id);
        changed = true;
      }
    }
  }
  return ids;
}

/** Depth-first order: every parent directly followed by its children in
 *  sibling order — matches what normalizeNodes expects so sibling order
 *  survives a save. */
function dfsOrder(pages: BoardNode[]): BoardNode[] {
  const known = new Set(pages.map((p) => p.id));
  const childrenOf = new Map<string | null, BoardNode[]>();
  for (const p of pages) {
    const key = p.parentId && known.has(p.parentId) ? p.parentId : null;
    const list = childrenOf.get(key) ?? [];
    list.push(p);
    childrenOf.set(key, list);
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
  const out: BoardNode[] = [];
  const walk = (parent: string | null) => {
    for (const child of childrenOf.get(parent) ?? []) {
      out.push(child);
      walk(child.id);
    }
  };
  walk(null);
  return out;
}

function cloneSubtree(pages: BoardNode[], rootId: string): BoardNode[] {
  const ids = subtreeIds(pages, rootId);
  const idMap = new Map<string, string>();
  for (const p of pages) if (ids.has(p.id)) idMap.set(p.id, freshId(p.id));
  const root = pages.find((p) => p.id === rootId)!;
  return pages
    .filter((p) => ids.has(p.id))
    .map((p) => ({
      ...p,
      id: idMap.get(p.id)!,
      parentId: p.parentId && idMap.has(p.parentId) ? idMap.get(p.parentId)! : null,
      sortOrder: p.id === rootId ? root.sortOrder + 0.5 : p.sortOrder,
      wireframes: p.wireframes.map((b) => ({ ...b, id: freshId("b") })),
    }));
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
  const [searchQuery, setSearchQuery] = useState("");

  /* ------------------------------------------------------- undo/redo ---- */

  const pagesRef = useRef(pages);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  const past = useRef<BoardNode[][]>([]);
  const future = useRef<BoardNode[][]>([]);
  const lastSig = useRef<{ sig: string; t: number }>({ sig: "", t: 0 });
  const [hist, setHist] = useState({ u: 0, r: 0 });

  /** Apply a mutation and record the previous state for undo.
   *  Pass a stable `sig` while typing into one field so a burst of keystrokes
   *  collapses into a single undo step. */
  const commit = useCallback((fn: (prev: BoardNode[]) => BoardNode[], sig?: string) => {
    const prev = pagesRef.current;
    const next = fn(prev);
    if (next === prev) return;
    const now = Date.now();
    const coalesce = !!sig && lastSig.current.sig === sig && now - lastSig.current.t < 900;
    if (!coalesce) past.current = [...past.current.slice(-99), prev];
    future.current = [];
    lastSig.current = { sig: sig ?? "", t: now };
    pagesRef.current = next;
    setPages(next);
    setHist({ u: past.current.length, r: future.current.length });
  }, []);

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    const prev = pagesRef.current;
    const restored = past.current[past.current.length - 1];
    past.current = past.current.slice(0, -1);
    future.current = [prev, ...future.current];
    lastSig.current = { sig: "", t: 0 };
    pagesRef.current = restored;
    setPages(restored);
    setHist({ u: past.current.length, r: future.current.length });
  }, []);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    const prev = pagesRef.current;
    const [next, ...rest] = future.current;
    future.current = rest;
    past.current = [...past.current, prev];
    lastSig.current = { sig: "", t: 0 };
    pagesRef.current = next;
    setPages(next);
    setHist({ u: past.current.length, r: future.current.length });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  /* ------------------------------------------------------- mutations ---- */

  const updateNode = useCallback(
    (nodeId: string, patch: Partial<BoardNode>, sig?: string) => {
      commit(
        (prev) => prev.map((p) => (p.id === nodeId ? { ...p, ...patch } : p)),
        sig ? `${nodeId}:${sig}` : undefined,
      );
    },
    [commit],
  );

  const mutateBlocks = useCallback(
    (nodeId: string, fn: (blocks: BoardNode["wireframes"]) => BoardNode["wireframes"]) => {
      commit(
        (prev) =>
          prev.map((p) => (p.id === nodeId ? { ...p, wireframes: fn([...p.wireframes]) } : p)),
        `${nodeId}:blocks`,
      );
    },
    [commit],
  );

  const addChild = useCallback(
    (parentId: string | null): string => {
      const siblings = pagesRef.current.filter((p) => (p.parentId ?? null) === parentId);
      const nextOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.sortOrder)) + 1 : 0;
      const node: BoardNode = {
        id: freshId("page"),
        parentId,
        title: "New page",
        color: "slate",
        notes: "",
        sortOrder: nextOrder,
        wireframes: [
          { id: freshId("b"), type: "navbar" },
          { id: freshId("b"), type: "heading", label: "New page" },
          { id: freshId("b"), type: "footer" },
        ],
      };
      commit((prev) => [...prev, node]);
      setSelectedId(node.id);
      return node.id;
    },
    [commit],
  );

  const addSibling = useCallback(
    (afterId: string): string => {
      const after = pagesRef.current.find((p) => p.id === afterId);
      if (!after) return addChild(afterId);
      const node: BoardNode = {
        id: freshId("page"),
        parentId: after.parentId,
        title: "New page",
        color: "slate",
        notes: "",
        sortOrder: after.sortOrder + 0.5,
        wireframes: [{ id: freshId("b"), type: "navbar" }],
      };
      commit((prev) => {
        const i = prev.findIndex((p) => p.id === afterId);
        return [...prev.slice(0, i + 1), node, ...prev.slice(i + 1)];
      });
      setSelectedId(node.id);
      return node.id;
    },
    [addChild, commit],
  );

  const renameNode = useCallback(
    (nodeId: string, title: string) => updateNode(nodeId, { title }),
    [updateNode],
  );

  const deletePage = useCallback(
    (targetId: string) => {
      const doomed = subtreeIds(pagesRef.current, targetId);
      commit((prev) => prev.filter((p) => !doomed.has(p.id)));
      setSelectedId((cur) => (cur && doomed.has(cur) ? null : cur));
    },
    [commit],
  );

  const duplicatePage = useCallback(
    (targetId: string) => {
      let firstCloneId: string | null = null;
      commit((prev) => {
        const clones = cloneSubtree(prev, targetId);
        firstCloneId = clones[0]?.id ?? null;
        const ids = subtreeIds(prev, targetId);
        let lastIndex = 0;
        prev.forEach((p, i) => {
          if (ids.has(p.id)) lastIndex = i;
        });
        return [...prev.slice(0, lastIndex + 1), ...clones, ...prev.slice(lastIndex + 1)];
      });
      if (firstCloneId) setSelectedId(firstCloneId);
    },
    [commit],
  );

  const movePage = useCallback(
    (targetId: string, parentId: string | null, index?: number) => {
      commit((prev) => {
        const moving = prev.find((p) => p.id === targetId);
        if (!moving) return prev;
        if (parentId && subtreeIds(prev, targetId).has(parentId)) return prev; // no cycles

        const others = prev.filter((p) => p.id !== targetId);
        const siblings = others
          .filter((p) => (p.parentId ?? null) === parentId)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        // pick a fractional sortOrder that lands the card at `index`
        let order: number;
        if (siblings.length === 0) order = 0;
        else if (index === undefined || index >= siblings.length)
          order = siblings[siblings.length - 1].sortOrder + 1;
        else if (index <= 0) order = siblings[0].sortOrder - 1;
        else order = (siblings[index - 1].sortOrder + siblings[index].sortOrder) / 2;

        return [...others, { ...moving, parentId, sortOrder: order }];
      });
      setSelectedId(targetId);
    },
    [commit],
  );

  const dirty = useMemo(() => JSON.stringify(pages) !== baseline, [pages, baseline]);
  const selected = pages.find((p) => p.id === selectedId) ?? null;

  const highlightIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return new Set(
      pages
        .filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.notes.toLowerCase().includes(q) ||
            (p.slug?.toLowerCase().includes(q) ?? false) ||
            (p.seo?.title?.toLowerCase().includes(q) ?? false) ||
            (p.tags?.some((t) => t.toLowerCase().includes(q)) ?? false),
        )
        .map((p) => p.id),
    );
  }, [pages, searchQuery]);

  /* ------------------------------------------------------------ save ---- */

  const doPut = useCallback(
    async (manageKey: string, current: BoardNode[]) => {
      const body = {
        nodes: dfsOrder(current).map((n) => ({
          id: n.id,
          parent: n.parentId ?? null,
          title: n.title,
          color: n.color,
          ...(n.notes ? { notes: n.notes } : {}),
          ...(n.slug ? { slug: n.slug } : {}),
          ...(n.pageType && n.pageType !== "page" ? { pageType: n.pageType } : {}),
          ...(n.seo && (n.seo.title || n.seo.description) ? { seo: n.seo } : {}),
          ...(n.tags && n.tags.length > 0 ? { tags: n.tags } : {}),
          blocks: n.wireframes.map((b) => (b.label ? { type: b.type, label: b.label } : b.type)),
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
        past.current = [];
        future.current = [];
        setHist({ u: past.current.length, r: future.current.length });
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
    const restored = JSON.parse(baseline) as BoardNode[];
    pagesRef.current = restored;
    setPages(restored);
    past.current = [];
    future.current = [];
    setHist({ u: past.current.length, r: future.current.length });
    setError(null);
    setPaletteOpen(false);
  };

  /* ----------------------------------------------------------- view ---- */

  return (
    <div className="relative flex-1">
      <SitemapCanvas
        pages={pages}
        readonly={!editing}
        selectedId={selectedId}
        hoveredBlock={hoveredBlock}
        onSelect={setSelectedId}
        onMove={movePage}
        onAddChild={addChild}
        onAddSibling={addSibling}
        onRename={renameNode}
        onDeletePage={deletePage}
        onDuplicatePage={duplicatePage}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        highlightIds={highlightIds}
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
          onPatch={(patch, sig) => updateNode(selected.id, patch, sig)}
          onAddBlock={(type, label) => {
            mutateBlocks(selected.id, (bs) => [
              ...bs,
              { id: freshId("b"), type, ...(label ? { label } : {}) },
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
          onRemoveBlock={(i) => mutateBlocks(selected.id, (bs) => bs.filter((_, k) => k !== i))}
          onAddChild={() => addChild(selected.id)}
          onDelete={() => deleteSelected()}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 rounded-full border border-line-strong bg-card px-1.5 py-1 shadow-sm max-w-[92%]">
        <ThemeToggle />

        {!editing && (
          <button
            className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors hover:bg-paper-deep`}
            onClick={() => {
              setEditing(true);
              setError(null);
              setKeyPrompt(false);
            }}
          >
            ✎ edit
          </button>
        )}

        {editing && (
          <>
            <button
              title="Undo (⌘Z)"
              disabled={hist.u === 0 || busy}
              onClick={undo}
              className="w-7 h-7 rounded-full text-[13px] leading-none disabled:opacity-25 hover:bg-paper-deep"
            >
              ↶
            </button>
            <button
              title="Redo (⇧⌘Z)"
              disabled={hist.r === 0 || busy}
              onClick={redo}
              className="w-7 h-7 rounded-full text-[13px] leading-none disabled:opacity-25 hover:bg-paper-deep"
            >
              ↷
            </button>

            {dirty && !keyPrompt && (
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

            {!dirty && !keyPrompt && (
              <>
                <span className="microlabel px-2">{busy ? "saving…" : "in sync"}</span>
                <button
                  className="rounded-full px-3 py-1 text-[12px] font-semibold transition-colors hover:bg-paper-deep"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                    setKeyPrompt(false);
                  }}
                >
                  done
                </button>
              </>
            )}
          </>
        )}

        {error && <span className="microlabel text-signal px-2 truncate max-w-[220px]">{error}</span>}
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

  function deleteSelected() {
    if (!selectedId) return;
    deletePage(selectedId);
    setSelectedId(null);
  }
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
  onPatch: (patch: Partial<BoardNode>, sig?: string) => void;
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

  const fieldCls =
    "w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-[12px] focus:outline-none focus:border-accent";

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
          onChange={(e) => onPatch({ title: e.target.value }, "title")}
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

        {/* page metadata */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="microlabel block mb-1">slug</span>
            <input
              value={node.slug ?? ""}
              placeholder="pricing/pro"
              onChange={(e) => onPatch({ slug: e.target.value.trim() || undefined }, "slug")}
              className={`${fieldCls} font-mono`}
            />
          </label>
          <label className="block">
            <span className="microlabel block mb-1">type</span>
            <select
              value={node.pageType ?? "page"}
              onChange={(e) => onPatch({ pageType: e.target.value === "page" ? undefined : (e.target.value as PageType) })}
              className={fieldCls}
            >
              {PAGE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>

        <details className="rounded-lg border border-line bg-paper/50 px-2 py-1.5">
          <summary className="microlabel cursor-pointer select-none">seo meta</summary>
          <div className="mt-2 space-y-2">
            <input
              value={node.seo?.title ?? ""}
              placeholder="<title> — 60 chars"
              maxLength={120}
              onChange={(e) =>
                onPatch({ seo: { ...node.seo, title: e.target.value || undefined } }, "seo.title")
              }
              className={fieldCls}
            />
            <textarea
              value={node.seo?.description ?? ""}
              rows={2}
              maxLength={320}
              placeholder="meta description…"
              onChange={(e) =>
                onPatch({ seo: { ...node.seo, description: e.target.value || undefined } }, "seo.description")
              }
              className={`${fieldCls} resize-none`}
            />
          </div>
        </details>

        <label className="block">
          <span className="microlabel block mb-1">tags · comma separated</span>
          <input
            value={node.tags?.join(", ") ?? ""}
            placeholder="auth, checkout"
            onChange={(e) => {
              const tags = e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
                .slice(0, 8);
              onPatch({ tags: tags.length > 0 ? tags : undefined }, "tags");
            }}
            className={fieldCls}
          />
        </label>

        <textarea
          value={node.notes}
          rows={2}
          placeholder="notes…"
          onChange={(e) => onPatch({ notes: e.target.value }, "notes")}
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
                    onPatch(
                      {
                        wireframes: node.wireframes.map((x, k) =>
                          k === i ? { ...x, label: e.target.value || undefined } : x,
                        ),
                      },
                      "blocks",
                    )
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
