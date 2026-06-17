// GENERATED — DO NOT EDIT.
// Source of truth: packages/shared/src/liveActivity/schema.json
// Regenerate: pnpm gen:live-activity-types
//
// Mirrors apps/mobile/ios/VesperLiveActivity/ActivityModels.swift. Intentionally
// NOT exported from packages/shared/src/index.ts (no app imports this yet — that
// is chat 079's job, which must also solve the apps/mobile moduleResolution:'node'
// + @vesper/shared exports-map resolution gap; see CHAT_077_RESOLUTION_RECORD.md).

export interface VesperBlockAttributes {
  /** Static attribute — the block UUID this activity tracks. */
  blockId: string;
}

export interface VesperLiveActivityContentState {
  /** Block UUID (matches the static attribute). */
  blockId: string;
  /** Module slug, e.g. "fitness". Plain string — NOT coupled to BlockTypeSchema. */
  blockType: string;
  /** Block title shown in the expanded view. */
  title: string;
  /** 2-char module abbreviation, e.g. "GY". */
  abbreviation: string;
  /** ISO8601 block end; parsed on-device to render the countdown. */
  endTime: string;
  /** Server hint; the device recomputes from endTime each minute. */
  minutesRemaining: number;
  /** Nullable — title of the next block, when pre-armed. */
  nextBlockTitle: string | null;
  /** Nullable — ISO8601 start of the next block, when pre-armed. */
  nextBlockStart: string | null;
}
