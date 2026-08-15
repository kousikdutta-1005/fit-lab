import type { GlyphName } from "../components/controls"
import type { DataStage } from "../lib/flow"

/** One node in the three-node progress indicator. */
export type StageNode = { id: DataStage; label: string; glyph: GlyphName; done: boolean }
