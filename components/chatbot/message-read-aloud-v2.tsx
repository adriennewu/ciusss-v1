"use client"

import { Pause, Play, Volume2, X } from "lucide-react"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatRemainingClock } from "./read-aloud-copy"

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
  /** Heuristic total duration (ms) for scrub-time timer preview; same source as parent progress. */
  estimatedDurationMs: number
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onSeekCommit?: (fraction: number) => void
  hidden?: boolean
}

function fractionFromClientX(bar: HTMLElement, clientX: number): number {
  const rect = bar.getBoundingClientRect()
  if (rect.width <= 0) return 0
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
}

export function MessageReadAloudV2({
  mode,
  labels,
  progress,
  remainingClock,
  estimatedDurationMs,
  onStart,
  onPause,
  onResume,
  onStop,
  onSeekCommit,
  hidden = false,
}: MessageReadAloudV2Props) {
  const [scrubFraction, setScrubFraction] = useState<number | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const scrubbingRef = useRef(false)
  const latestFractionRef = useRef(0)

  const endScrubListenersRef = useRef<(() => void) | null>(null)

  const activePointerIdRef = useRef<number | null>(null)

  const attachDocumentScrubListeners = useCallback(() => {
    const onMove = (e: PointerEvent) => {
      if (!scrubbingRef.current || !barRef.current) return
      if (e.cancelable) e.preventDefault()
      const f = fractionFromClientX(barRef.current, e.clientX)
      latestFractionRef.current = f
      setScrubFraction(f)
    }
    const onEnd = (e: PointerEvent) => {
      if (!scrubbingRef.current) return
      if (e.cancelable) e.preventDefault()
      scrubbingRef.current = false
      const bar = barRef.current
      if (
        bar &&
        activePointerIdRef.current != null &&
        bar.hasPointerCapture(activePointerIdRef.current)
      ) {
        try {
          bar.releasePointerCapture(activePointerIdRef.current)
        } catch {
          /* ignore */
        }
      }
      activePointerIdRef.current = null
      if (bar && e.type !== "pointercancel") {
        latestFractionRef.current = fractionFromClientX(bar, e.clientX)
      }
      const f = latestFractionRef.current
      setScrubFraction(null)
      onSeekCommit?.(f)
      document.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerup", onEnd)
      document.removeEventListener("pointercancel", onEnd)
      endScrubListenersRef.current = null
    }
    document.addEventListener("pointermove", onMove, { passive: false })
    document.addEventListener("pointerup", onEnd, { passive: false })
    document.addEventListener("pointercancel", onEnd, { passive: false })
    endScrubListenersRef.current = () => {
      document.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerup", onEnd)
      document.removeEventListener("pointercancel", onEnd)
    }
  }, [onSeekCommit])

  useEffect(() => {
    return () => {
      endScrubListenersRef.current?.()
    }
  }, [])

  if (hidden) return null

  const pBase = Math.min(1, Math.max(0, progress))
  const displayFraction = scrubFraction ?? pBase
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
      aria-label={labels.stop}
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-destructive/35 bg-destructive/15 text-destructive",
        "transition-colors hover:bg-destructive/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
      )}
    >
      <X className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
    </button>
  )

  const renderPlayPauseButton = () =>
    isPlaying ? (
      <Button
        type="button"
        variant="primaryMuted"
        size="icon"
        onClick={onPause}
        aria-label={labels.pause}
        className="h-9 w-9 shrink-0 rounded-[14px] p-0"
      >
        <Pause className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      </Button>
    ) : (
      <Button
        type="button"
        variant="primaryMuted"
        size="icon"
        onClick={onResume}
        aria-label={labels.play}
        className="h-9 w-9 shrink-0 rounded-[14px] p-0"
      >
        <Play className="h-4 w-4 shrink-0 pl-0.5" strokeWidth={2.25} aria-hidden />
      </Button>
    )

  const onBarPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!onSeekCommit || e.button !== 0) return
    const el = barRef.current
    if (!el) return
    e.preventDefault()
    endScrubListenersRef.current?.()
    scrubbingRef.current = true
    activePointerIdRef.current = e.pointerId
    const f = fractionFromClientX(el, e.clientX)
    latestFractionRef.current = f
    setScrubFraction(f)
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    attachDocumentScrubListeners()
  }

  const renderProgressSection = () => (
    <div
      ref={barRef}
      className={cn(
        "relative flex h-3 min-h-[12px] min-w-0 flex-1 cursor-pointer items-center touch-none",
        !onSeekCommit && "cursor-default"
      )}
      onPointerDown={onBarPointerDown}
    >
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(displayFraction * 100)}
      >
        <div
          className={cn(
            "h-full rounded-full bg-primary ease-out",
            scrubFraction == null && "transition-[width] duration-200"
          )}
          style={{ width: `${displayFraction * 100}%` }}
        />
      </div>
    </div>
  )

  const timerDisplay =
    scrubFraction != null && estimatedDurationMs > 0
      ? formatRemainingClock(
          Math.max(0, ((1 - scrubFraction) * estimatedDurationMs) / 1000)
        )
      : remainingClock

  const renderTimer = () => (
    <span
      className="shrink-0 tabular-nums text-xs font-medium text-muted-foreground sm:text-sm"
      aria-live="polite"
    >
      {timerDisplay}
    </span>
  )

  return (
    <div
      className="flex w-full min-w-0 flex-row flex-nowrap items-center gap-3"
      role="group"
      aria-label={ariaLabel}
    >
      {renderStopButton()}
      {renderProgressSection()}
      {renderTimer()}
      {renderPlayPauseButton()}
    </div>
  )
}
