"use client"

import { Pause, Play, Volume2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface MessageReadAloudV2Labels {
  readAloud: string
  stop: string
  pause: string
  play: string
}

export interface MessageReadAloudV2Props {
  mode: "idle" | "playing" | "paused"
  labels: MessageReadAloudV2Labels
  /** 0–1 for the progress fill. */
  progress: number
  /** Countdown clock text, e.g. 00:32 */
  remainingClock: string
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  hidden?: boolean
}

function WaveSpeaker({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center text-primary",
        active && "motion-safe:animate-pulse"
      )}
      aria-hidden
    >
      <Volume2 className="h-[18px] w-[18px]" strokeWidth={2} />
    </span>
  )
}

export function MessageReadAloudV2({
  mode,
  labels,
  progress,
  remainingClock,
  onStart,
  onPause,
  onResume,
  onStop,
  hidden = false,
}: MessageReadAloudV2Props) {
  if (hidden) return null

  const p = Math.min(1, Math.max(0, progress))
  const isPlaying = mode === "playing"

  if (mode === "idle") {
    return (
      <div className="flex w-full min-w-0 justify-start">
        <Button
          type="button"
          variant="primaryMuted"
          onClick={onStart}
          className="h-9 gap-2 rounded-[14px] px-3"
        >
          <Volume2 className="h-4 w-4 shrink-0" aria-hidden />
          {labels.readAloud}
        </Button>
      </div>
    )
  }

  const ariaLabel = isPlaying ? labels.pause : labels.play

  const renderStopButton = () => (
    <button
      type="button"
      onClick={onStop}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[14px] border border-destructive/35 bg-destructive/15 px-2.5 text-sm font-medium text-destructive",
        "transition-colors hover:bg-destructive/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
      )}
    >
      <X className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
      {labels.stop}
    </button>
  )

  const renderPlayPauseButton = () =>
    isPlaying ? (
      <Button
        type="button"
        variant="primaryMuted"
        onClick={onPause}
        className="h-9 shrink-0 gap-1.5 rounded-[14px] px-2.5"
      >
        <Pause className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
        {labels.pause}
      </Button>
    ) : (
      <Button
        type="button"
        variant="primaryMuted"
        onClick={onResume}
        className="h-9 shrink-0 gap-1.5 rounded-[14px] px-2.5"
      >
        <Play className="h-4 w-4 shrink-0 pl-0.5" strokeWidth={2.25} aria-hidden />
        {labels.play}
      </Button>
    )

  const renderProgressSection = () => (
    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-none">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p * 100)}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
          style={{ width: `${p * 100}%` }}
        />
      </div>
    </div>
  )

  const renderTimer = () => (
    <span
      className="shrink-0 tabular-nums text-xs font-medium text-muted-foreground sm:text-sm"
      aria-live="polite"
    >
      {remainingClock}
    </span>
  )

  return (
    <>
      <div
        className="flex w-full min-w-0 flex-col gap-2 md:hidden"
        role="group"
        aria-label={ariaLabel}
      >
        <div className="flex w-full flex-nowrap items-center justify-between gap-2">
          {renderStopButton()}
          {renderPlayPauseButton()}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <WaveSpeaker active={isPlaying} />
          {renderProgressSection()}
          {renderTimer()}
        </div>
      </div>

      <div
        className="hidden w-full min-w-0 items-center gap-2.5 md:flex"
        role="group"
        aria-label={ariaLabel}
      >
        {renderStopButton()}
        <WaveSpeaker active={isPlaying} />
        {renderProgressSection()}
        {renderTimer()}
        {renderPlayPauseButton()}
      </div>
    </>
  )
}
