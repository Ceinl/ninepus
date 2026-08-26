export type BlockType =
  | "navbar"
  | "breadcrumb"
  | "tabs"
  | "hero"
  | "hero-split"
  | "heading"
  | "text"
  | "quote"
  | "list"
  | "table"
  | "code"
  | "chips"
  | "timeline"
  | "image"
  | "gallery"
  | "video"
  | "map"
  | "logos"
  | "cards"
  | "stats"
  | "sidebar-split"
  | "pricing"
  | "form"
  | "cta"
  | "accordion"
  | "footer"
  | "divider"
  | "spacer";

/** How this node behaves in the real site. */
export type PageType = "page" | "template" | "redirect" | "external";

export interface WireBlock {
  id: string;
  type: BlockType;
  label?: string;
}

export type NodeColor =
  | "slate"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "violet"
  | "teal"
  | "pink";

/** SEO metadata for the page in the real site. */
export interface SeoMeta {
  title?: string;
  description?: string;
}

/** One card on the board — a page with its wireframe blocks. */
export interface BoardNode {
  id: string;
  parentId: string | null;
  title: string;
  color: NodeColor;
  notes: string;
  sortOrder: number;
  wireframes: WireBlock[];
  slug?: string;
  pageType?: PageType;
  seo?: SeoMeta;
  tags?: string[];
}

/** What the API returns for a board — never includes the manage key. */
export interface BoardDTO {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
}

/** What an agent pushes: nodes keyed by their own ids, parents referenced by id. */
export interface NodeInput {
  id?: string;
  parent?: string | null;
  title?: string;
  color?: NodeColor;
  notes?: string;
  slug?: string;
  pageType?: PageType;
  seo?: SeoMeta;
  tags?: string[];
  blocks?: Array<BlockType | { type: BlockType; label?: string }>;
}
