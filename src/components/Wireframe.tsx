"use client";

import {
  blockDef,
  CAPTION_LINE_H,
  CAPTION_SIZE,
  HEADLINE_LINE_H,
  HEADLINE_MAX_LINES,
  HEADLINE_SIZE,
  NO_CAPTION,
  SELF_TITLED,
} from "@/lib/blocks";
import type { WireBlock } from "@/lib/types";

// Warm paper palette — matches globals.css
const FILL = "#e8e0d0";      // bar / placeholder
const FILL_DEEP = "#d8d2c4"; // deeper placeholder / header
const STROKE = "#c2bbaa";    // borders
const INK_SOFT = "#9aa0ad"; // icon tint

function Bar({ w, h = 6 }: { w: string | number; h?: number }) {
  return <div style={{ width: w, height: h, background: FILL }} className="rounded-[3px]" />;
}

/** A page's real headline, set in type inside the wireframe. */
function Headline({ text, lines = HEADLINE_MAX_LINES }: { text: string; lines?: number }) {
  return (
    <div
      className="font-semibold text-ink break-words w-full"
      style={{
        fontSize: HEADLINE_SIZE,
        lineHeight: `${HEADLINE_LINE_H}px`,
        display: "-webkit-box",
        WebkitLineClamp: lines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {text}
    </div>
  );
}

/** Lo-fi wireframe block inside a sitemap card.
 *  Every block renders as a wireframe — a label never replaces the drawing.
 *  A page's own headline is typeset inside the heading block; a section's real
 *  name rides above its wireframe as a caption. */
export function WireframeBlock({ block }: { block: WireBlock }) {
  const def = blockDef(block.type);
  const label = block.label?.trim() || undefined;
  const captioned = label !== undefined && !SELF_TITLED.has(block.type) && !NO_CAPTION.has(block.type);

  const inner = (() => {
    switch (block.type) {
      case "navbar":
        return (
          <div className="flex items-center justify-between px-1 py-[2px]">
            <div className="flex items-center gap-1.5">
              <div className="w-[18px] h-[9px] rounded-[3px] bg-ink" style={{ background: "#21252c" }} />
              <Bar w={22} h={5} />
            </div>
            <div className="flex gap-1 items-center">
              <Bar w={14} h={4} />
              <Bar w={14} h={4} />
              <Bar w={20} h={4} />
              <div className="w-[14px] h-[6px] rounded-full ml-0.5" style={{ background: FILL_DEEP }} />
            </div>
          </div>
        );
      case "breadcrumb":
        return (
          <div className="flex gap-1 px-1 py-[2px] items-center opacity-80">
            <Bar w={12} h={4} />
            <span className="text-[7px] leading-none" style={{ color: STROKE }}>
              /
            </span>
            <Bar w={18} h={4} />
            <span className="text-[7px] leading-none" style={{ color: STROKE }}>
              /
            </span>
            <Bar w={14} h={4} />
          </div>
        );
      case "tabs":
        return (
          <div className="flex gap-1.5 border-b pl-1" style={{ borderColor: STROKE }}>
            <div
              className="w-9 h-2.5 rounded-t-[4px] bg-card -mb-px border border-b-0"
              style={{ borderColor: STROKE }}
            />
            <div className="w-9 h-2.5 rounded-t-[4px]" style={{ background: FILL }} />
            <div className="w-9 h-2.5 rounded-t-[4px]" style={{ background: FILL }} />
          </div>
        );
      case "accordion":
        return (
          <div className="space-y-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-[4px] px-1.5 py-[4px] border"
                style={{
                  background: i === 0 ? "var(--card)" : FILL,
                  borderColor: STROKE,
                  opacity: i === 0 ? 1 : 0.9,
                }}
              >
                <Bar w="58%" h={5} />
                <span
                  className="w-3 h-3 rounded-full flex items-center justify-center text-[7px] leading-none shrink-0"
                  style={{
                    background: i === 0 ? "#0f5d63" : "#fff",
                    color: i === 0 ? "#fff" : STROKE,
                    border: `1px solid ${STROKE}`,
                  }}
                >
                  {i === 0 ? "−" : "+"}
                </span>
              </div>
            ))}
          </div>
        );
      case "footer":
        return (
          <div className="rounded-[4px] px-2 py-1.5 flex items-center gap-2 border" style={{ background: FILL, borderColor: STROKE }}>
            <div className="w-3 h-3 rounded-[3px] bg-white/70 border" style={{ borderColor: "#fff" }} />
            <Bar w={16} h={5} />
            <div className="ml-auto flex gap-1">
              <Bar w={10} h={4} />
              <Bar w={10} h={4} />
              <Bar w={10} h={4} />
            </div>
          </div>
        );
      case "heading":
        return (
          <div className="px-1 pt-1">
            {label ? (
              <Headline text={label} />
            ) : (
              <div className="rounded-[3px] w-[72%] h-[10px]" style={{ background: "#21252c", opacity: 0.85 }} />
            )}
            <div className="mt-1.5 w-[48%] h-[4px] rounded-[3px] opacity-60" style={{ background: FILL_DEEP }} />
          </div>
        );
      case "text":
        return (
          <div className="space-y-[4px] px-1 py-0.5">
            <Bar w="100%" h={5} />
            <Bar w="96%" h={5} />
            <Bar w="92%" h={5} />
            <Bar w="68%" h={5} />
          </div>
        );
      case "quote":
        return (
          <div className="px-2 flex gap-2 items-start py-1">
            <span style={{ color: FILL_DEEP }} className="font-display text-xl leading-none select-none">
              “
            </span>
            <div className="flex-1 space-y-[4px] pt-1">
              <Bar w="92%" h={4} />
              <Bar w="78%" h={4} />
              <Bar w="64%" h={4} />
            </div>
          </div>
        );
      case "list":
        return (
          <div className="space-y-[5px] px-1 py-0.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: FILL_DEEP }} />
                <Bar w={`${88 - i * 12}%`} h={4} />
              </div>
            ))}
          </div>
        );
      case "table":
        return (
          <div className="rounded-[4px] overflow-hidden border bg-card" style={{ borderColor: STROKE }}>
            <div className="h-[12px] flex items-center px-1.5 gap-1" style={{ background: FILL_DEEP }}>
              <Bar w="28%" h={4} />
              <Bar w="22%" h={4} />
              <Bar w="18%" h={4} />
            </div>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center gap-2 h-[12px] px-1.5 border-b last:border-0"
                style={{ borderColor: STROKE, background: i % 2 ? "var(--card)" : "rgba(232,224,208,0.35)" }}
              >
                <Bar w="28%" h={4} />
                <Bar w="22%" h={4} />
                <Bar w="18%" h={4} />
              </div>
            ))}
          </div>
        );
      case "image":
        return (
          <div
            className="h-full mx-1 rounded-[4px] flex flex-col items-center justify-center border gap-1"
            style={{ background: FILL, borderColor: STROKE }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0">
              <rect x="1" y="1" width="14" height="14" rx="2" fill="#fff" opacity="0.7" />
              <circle cx="5.5" cy="5.5" r="1.5" fill={INK_SOFT} opacity="0.9" />
              <path d="M1.5 11.5 L6 7 L9 10 L11 8.5 L14.5 11.5 V13.5 H1.5 Z" fill={INK_SOFT} opacity="0.55" />
            </svg>
            <Bar w="42%" h={3} />
          </div>
        );
      case "gallery":
        return (
          <div className="grid grid-cols-3 gap-[4px] px-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[22px] rounded-[3px] border" style={{ background: i % 2 ? FILL : FILL_DEEP, borderColor: STROKE, opacity: i < 3 ? 1 : 0.9 }} />
            ))}
          </div>
        );
      case "video":
        return (
          <div
            className="h-full mx-1 rounded-[4px] flex items-center justify-center relative overflow-hidden border"
            style={{ background: FILL, borderColor: STROKE }}
          >
            <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center shadow-sm border border-white">
              <div
                className="w-0 h-0 ml-[1.5px]"
                style={{
                  borderTop: "4px solid transparent",
                  borderBottom: "4px solid transparent",
                  borderLeft: "7px solid #0f5d63",
                }}
              />
            </div>
          </div>
        );
      case "map":
        return (
          <div
            className="h-full mx-1 rounded-[4px] relative overflow-hidden border"
            style={{
              background: `repeating-linear-gradient(45deg, ${FILL} 0 7px, ${FILL_DEEP} 7px 14px)`,
              borderColor: STROKE,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-card border-2 shadow-sm flex items-center justify-center" style={{ borderColor: "#e4572e" }}>
                <div className="w-1 h-1 rounded-full bg-[#e4572e]" />
              </div>
            </div>
          </div>
        );
      case "logos":
        return (
          <div className="flex items-center justify-between px-2 py-1 gap-1.5">
            {[18, 22, 16, 20, 14].map((w, i) => (
              <div
                key={i}
                className="h-[7px] rounded-[3px] opacity-90"
                style={{ width: `${w}%`, background: i === 1 ? "#21252c" : FILL_DEEP, opacity: i === 1 ? 0.75 : 0.9 }}
              />
            ))}
          </div>
        );
      case "hero":
        return (
          <div className="h-full flex flex-col items-center justify-center gap-1.5 px-3 text-center py-1">
            {label ? <Headline text={label} /> : <div className="w-[74%] h-[11px] rounded-[3px]" style={{ background: "#21252c", opacity: 0.9 }} />}
            <Bar w="56%" h={4} />
            <div className="mt-1 flex gap-1.5">
              <div className="w-10 h-[10px] rounded-full" style={{ background: "#0f5d63" }} />
              <div className="w-10 h-[10px] rounded-full border" style={{ background: "var(--card)", borderColor: STROKE }} />
            </div>
          </div>
        );
      case "hero-split":
        return (
          <div className="h-full flex items-center gap-2 px-2 py-1">
            <div className="flex-1 space-y-1.5">
              {label ? <Headline text={label} /> : <div className="w-[88%] h-[10px] rounded-[3px]" style={{ background: "#21252c", opacity: 0.88 }} />}
              <Bar w="72%" h={4} />
              <div className="pt-1 flex gap-1.5">
                <div className="w-8 h-[10px] rounded-full" style={{ background: "#0f5d63" }} />
                <div className="w-8 h-[10px] rounded-full border" style={{ background: "var(--card)", borderColor: STROKE }} />
              </div>
            </div>
            <div className="w-[38%] self-stretch rounded-[4px] border" style={{ background: FILL, borderColor: STROKE }} />
          </div>
        );
      case "cards":
        return (
          <div className="grid grid-cols-3 gap-[4px] px-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[4px] border bg-card p-1 space-y-1" style={{ borderColor: STROKE }}>
                <div className="h-[14px] rounded-[3px] border" style={{ background: FILL, borderColor: STROKE }} />
                <Bar w="85%" h={3} />
                <Bar w="62%" h={3} />
              </div>
            ))}
          </div>
        );
      case "stats":
        return (
          <div className="grid grid-cols-4 gap-2 px-1 py-0.5">
            {[86, 74, 91, 68].map((n, i) => (
              <div key={i} className="space-y-1">
                <div className="h-[10px] rounded-[3px] w-[68%]" style={{ background: i === 1 ? "#0f5d63" : "#21252c", opacity: i === 1 ? 1 : 0.82 }} />
                <Bar w="78%" h={3} />
              </div>
            ))}
          </div>
        );
      case "pricing":
        return (
          <div className="grid grid-cols-3 gap-1.5 px-1">
            {[false, true, false].map((hot, i) => (
              <div
                key={i}
                className="rounded-[4px] border p-1.5 space-y-1"
                style={{
                  borderColor: hot ? "#0f5d63" : STROKE,
                  background: hot ? "#e3efee" : "var(--card)",
                  boxShadow: hot ? "0 1px 6px rgba(15,93,99,0.12)" : undefined,
                }}
              >
                <Bar w="44%" h={4} />
                <div className="w-[56%] h-[9px] rounded-[3px]" style={{ background: hot ? "#0f5d63" : "#21252c", opacity: hot ? 1 : 0.85 }} />
                <div className="pt-0.5 space-y-1">
                  <Bar w="92%" h={2.5} />
                  <Bar w="84%" h={2.5} />
                  <Bar w="88%" h={2.5} />
                </div>
              </div>
            ))}
          </div>
        );
      case "form":
        return (
          <div className="space-y-1.5 px-2 py-0.5">
            <div className="h-[10px] rounded-[4px] border bg-card flex items-center px-1.5" style={{ borderColor: STROKE }}>
              <Bar w="36%" h={3} />
            </div>
            <div className="h-[10px] rounded-[4px] border bg-card" style={{ borderColor: STROKE }} />
            <div className="h-[16px] rounded-[4px] border bg-card" style={{ borderColor: STROKE }} />
            <div className="w-12 h-[10px] rounded-full mt-0.5" style={{ background: "#0f5d63" }} />
          </div>
        );
      case "cta":
        return (
          <div className="h-full mx-1 rounded-[5px] flex items-center justify-between px-3 border" style={{ background: "var(--paper-deep)", borderColor: STROKE }}>
            <div className="space-y-1">
              <div className="w-16 h-[6px] rounded-[3px]" style={{ background: "#21252c", opacity: 0.85 }} />
              <Bar w={28} h={3} />
            </div>
            <div className="w-10 h-[10px] rounded-full shadow-sm" style={{ background: "#0f5d63" }} />
          </div>
        );
      case "divider":
        return <div className="mx-2 my-0.5" style={{ height: 1, background: STROKE, opacity: 0.8 }} />;
      case "spacer":
        return <div className="h-[6px] flex items-center justify-center"><div className="w-6 h-[2px] rounded-full opacity-40" style={{ background: STROKE }} /></div>;
      default:
        return <Bar w="100%" />;
    }
  })();

  if (!captioned) return <div style={{ minHeight: def.h }}>{inner}</div>;

  // real section name above its wireframe — the way an annotated wireframe reads
  return (
    <div>
      <div
        className="px-1 truncate font-medium"
        style={{ fontSize: CAPTION_SIZE, lineHeight: `${CAPTION_LINE_H}px`, color: "#6c7180" }}
        title={label}
      >
        {label}
      </div>
      <div style={{ minHeight: def.h }}>{inner}</div>
    </div>
  );
}
