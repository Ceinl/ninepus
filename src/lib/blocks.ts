import type { BlockType, NodeColor, WireBlock } from "./types";

export const COLOR_HEX: Record<NodeColor, string> = {
  slate: "#64748b",
  blue: "#2e6fe8",
  green: "#199473",
  amber: "#d98e04",
  red: "#d64545",
  violet: "#7a55e6",
  teal: "#0fa3a3",
  pink: "#db5a9b",
};

export type BlockGroup = "structure" | "content" | "media" | "conversion" | "layout";

export interface BlockDef {
  type: BlockType;
  label: string;
  group: BlockGroup;
  /** Rendered height in px. MUST equal what Wireframe.tsx actually draws —
   *  the canvas sizes cards from this and anything taller gets clipped. */
  h: number;
}

export const BLOCK_DEFS: BlockDef[] = [
  { type: "navbar", label: "Nav bar", group: "structure", h: 14 },
  { type: "breadcrumb", label: "Breadcrumb", group: "structure", h: 11 },
  { type: "tabs", label: "Tabs", group: "structure", h: 16 },
  { type: "accordion", label: "Accordion / FAQ", group: "structure", h: 74 },
  { type: "footer", label: "Footer", group: "structure", h: 26 },
  { type: "heading", label: "Heading", group: "content", h: 24 },
  { type: "text", label: "Text block", group: "content", h: 36 },
  { type: "quote", label: "Quote", group: "content", h: 32 },
  { type: "list", label: "List / feed", group: "content", h: 30 },
  { type: "table", label: "Table", group: "content", h: 52 },
  { type: "image", label: "Image", group: "media", h: 42 },
  { type: "gallery", label: "Gallery grid", group: "media", h: 48 },
  { type: "video", label: "Video embed", group: "media", h: 42 },
  { type: "map", label: "Map", group: "media", h: 40 },
  { type: "logos", label: "Logo cloud", group: "media", h: 18 },
  { type: "hero", label: "Hero (centered)", group: "layout", h: 58 },
  { type: "hero-split", label: "Hero (split)", group: "layout", h: 58 },
  { type: "cards", label: "Card grid", group: "layout", h: 48 },
  { type: "stats", label: "Stats row", group: "layout", h: 28 },
  { type: "cta", label: "CTA banner", group: "conversion", h: 22 },
  { type: "form", label: "Form", group: "conversion", h: 70 },
  { type: "pricing", label: "Pricing table", group: "conversion", h: 56 },
  { type: "divider", label: "Divider", group: "layout", h: 6 },
  { type: "spacer", label: "Spacer", group: "layout", h: 8 },
];

const DEF_BY_TYPE = new Map(BLOCK_DEFS.map((d) => [d.type, d]));

export function blockDef(type: BlockType): BlockDef {
  return DEF_BY_TYPE.get(type) ?? { type, label: type, group: "content", h: 24 };
}

export const CARD_PAD_X = 10;

/* Card geometry mirrored from the markup in SitemapCanvas.tsx and Wireframe.tsx.
 * These MUST match the CSS: the canvas gives each card a fixed pixel height and
 * clips the overflow, so any underestimate silently cuts blocks off the bottom. */
const CARD_TITLE_H = 28;      // header row, explicit height:28
const CARD_BORDER = 2;        // 1px border, border-box
const CARD_PAD_Y = 18;        // body pt-2 (8) + pb-2.5 (10)
const CARD_GAP = 6;           // body space-y-1.5

/* A page's own headline is typeset inside the heading block. */
export const HEADLINE_SIZE = "10.5px";
export const HEADLINE_LINE_H = 13;
export const HEADLINE_MAX_LINES = 3;
const HEADING_PAD_TOP = 4;      // pt-1
const HEADING_SUB_H = 10;       // mt-1.5 (6) + 4px subtitle bar

/* Every other labelled block keeps its wireframe and gets a caption row above it. */
export const CAPTION_SIZE = "9.5px";
export const CAPTION_LINE_H = 12;
const CAPTION_GAP = 1;

/** Blocks whose drawing is too small or too structural to caption. */
export const NO_CAPTION = new Set<BlockType>(["divider", "spacer"]);
/** Blocks that typeset their own label as a headline instead of taking a caption row. */
export const SELF_TITLED = new Set<BlockType>(["heading", "hero", "hero-split"]);
/** py-1 + gap-1.5 + subtitle bar + gap + mt-1 + button row, around the headline. */
const HERO_CHROME = 38;

const LABEL_CHARS_PER_LINE = 30;

/** Height for a single block — the wireframe drawing, plus any real text in it. */
export function blockHeight(b: WireBlock): number {
  const def = blockDef(b.type);
  const label = b.label?.trim();
  if (!label) return def.h;

  const lines = Math.min(
    HEADLINE_MAX_LINES,
    Math.max(1, Math.ceil(label.length / LABEL_CHARS_PER_LINE)),
  );
  if (b.type === "heading") {
    return Math.max(def.h, HEADING_PAD_TOP + lines * HEADLINE_LINE_H + HEADING_SUB_H);
  }
  if (b.type === "hero" || b.type === "hero-split") {
    return Math.max(def.h, HERO_CHROME + lines * HEADLINE_LINE_H);
  }
  if (NO_CAPTION.has(b.type)) return def.h;
  return def.h + CAPTION_LINE_H + CAPTION_GAP;
}

/** Exact rendered height of a page card — used by both renderer and canvas layout. */
export function cardHeight(page: { wireframes: WireBlock[] }): number {
  const inner = page.wireframes.reduce(
    (sum, b, i) => sum + blockHeight(b) + (i > 0 ? CARD_GAP : 0),
    0,
  );
  return CARD_BORDER + CARD_TITLE_H + CARD_PAD_Y + Math.max(inner, 6);
}
