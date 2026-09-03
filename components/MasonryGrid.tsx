"use client";

import { ModelCard } from "@/components/ModelCard";
import { useColumnCount } from "@/hooks/useColumnCount";
import type { Database } from "@/lib/supabase/types";

type ModelRow = Database["public"]["Tables"]["models"]["Row"];

export interface MasonryGridProps {
  models: ModelRow[];
  onRetry: (model: ModelRow) => void;
  onDelete: (model: ModelRow) => void;
  /** Passed straight through to every ModelCard — see that file's own comment. */
  interactive3d?: boolean;
}

// CLAUDE.md rule 40 — the one grid layout every screen reuses (dashboard
// feed, library).
//
// 2026-09-03: was a true masonry (greedy shortest-column packing by each
// card's own estimated height, since a photo/render's aspect ratio varied
// per card). Product decision: every card is now a fixed size
// (ModelCard.tsx's MODEL_CARD_ASPECT_RATIO, object-contain so nothing gets
// cropped) — with every card identical, a plain CSS grid places them
// correctly by construction, in the SAME order `models` is already passed
// in (newest-first), no separate column-balancing pass needed at all.
// columnCount is still a live value (useColumnCount, 2/3/4 by breakpoint),
// just handed straight to `grid-template-columns` instead of driving a
// manual assignment.
export function MasonryGrid({ models, onRetry, onDelete, interactive3d = false }: MasonryGridProps) {
  const columnCount = useColumnCount();

  return (
    <div
      className="grid gap-2 px-2 lg:gap-4 lg:px-6"
      style={{
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
        // --color-feed-glow (styles/themes.css) — a warm ambient backdrop
        // behind the grid, matched to a specific reference screenshot
        // (2026-09-03). Each ModelCard is itself flat bg-bg (near-black,
        // matching that same reference's actual card interiors), so this
        // shows only in the gaps between cards and their rounded corners —
        // that's deliberate, not a fallback: it's the page background the
        // reference's warmth actually comes from, not a per-card effect.
        background: "radial-gradient(circle at 50% 40%, var(--color-feed-glow), var(--color-bg) 70%)",
      }}
    >
      {models.map((model) => (
        <ModelCard
          key={model.id}
          initialModel={model}
          onRetry={onRetry}
          onDelete={onDelete}
          interactive3d={interactive3d}
        />
      ))}
    </div>
  );
}
