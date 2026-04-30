export type SourcesPlacement =
  | "inline"
  | "below"
  | "separate_message"
  | "combined_in_main"

export type SourceVariantId = "v1" | "v2" | "v3" | "v4"

export interface SourceVariant {
  id: SourceVariantId
  /** English labels for prototype controls (always shown in English). */
  label: string
  sourcesPlacement: SourcesPlacement
}

export const SOURCE_VARIANTS: readonly SourceVariant[] = [
  { id: "v1", label: "V1 — sources in the bubble", sourcesPlacement: "inline" },
  { id: "v2", label: "V2 — sources below the bubble", sourcesPlacement: "below" },
  {
    id: "v3",
    label: "V3 — sources in a separate message",
    sourcesPlacement: "separate_message",
  },
  {
    id: "v4",
    label: "V4 — sources and follow-up in the main message",
    sourcesPlacement: "combined_in_main",
  },
] as const

export const DEFAULT_SOURCE_VARIANT: SourceVariantId = "v4"

/** Demo timing (single fixed “progressive” loading behavior; formerly V2 Progressive). */
export const DEMO_THINKING_DURATION_MS = 3000
export const DEMO_ASSISTANT_STAGGER_MS = 1000

export type PrimaryColorId = "purple" | "green" | "yellow"

export interface PrimaryColorOption {
  id: PrimaryColorId
  label: string
}

export const PRIMARY_COLORS: readonly PrimaryColorOption[] = [
  { id: "purple", label: "Purple" },
  { id: "green", label: "Green" },
  { id: "yellow", label: "Yellow" },
] as const

export const DEFAULT_PRIMARY_COLOR: PrimaryColorId = "purple"

export type AudioVariantId =
  | "v1_icon_floating_action_modal"
  | "v2_full_screen_reader"
  | "v3_full_screen_audio"
  | "v4_full_screen_audio"

export interface AudioVariantOption {
  id: AudioVariantId
  label: string
}

export const AUDIO_VARIANTS: readonly AudioVariantOption[] = [
  {
    id: "v1_icon_floating_action_modal",
    label: "V1 — icon and floating action modal",
  },
  {
    id: "v2_full_screen_reader",
    label: "V2 — full screen reader",
  },
  {
    id: "v3_full_screen_audio",
    label: "V3 — full screen audio",
  },
  {
    id: "v4_full_screen_audio",
    label: "V4 — full screen audio",
  },
] as const

export const DEFAULT_AUDIO_VARIANT: AudioVariantId = "v4_full_screen_audio"

/** V3/V4 share the full-screen audio + focus layout behaviour. */
export function isFullScreenAudioVariant(id: AudioVariantId): boolean {
  return id === "v3_full_screen_audio" || id === "v4_full_screen_audio"
}

/** Read-aloud controls in the V2 footer style (composer strip or full-screen audio). */
export function usesV2StyleReadAloudFooter(id: AudioVariantId): boolean {
  return id === "v2_full_screen_reader" || isFullScreenAudioVariant(id)
}

const sourceById = Object.fromEntries(
  SOURCE_VARIANTS.map((v) => [v.id, v])
) as Record<SourceVariantId, SourceVariant>

export function getSourceVariant(id: SourceVariantId): SourceVariant {
  return sourceById[id]
}

/** Stable id for the scripted “services” suggestion chip (not locale-specific). */
export const SERVICES_SUGGESTION_ID = "services"

/** Delay between progressive text chunks (lines). */
export const PROGRESSIVE_CHUNK_MS = 110
