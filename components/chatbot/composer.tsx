"use client"

import { ArrowUp, Check, Mic, X } from "lucide-react"
import {
  useCallback,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from "react"
import { cn } from "@/lib/utils"
import { SecondaryPrimaryButton } from "@/components/ui/secondary-primary-button"
import { RecordingTimeline } from "./recording-timeline"

const inputShellBaseClass =
  "flex min-w-0 flex-1 items-end gap-2 rounded-2xl border border-border bg-card px-3 shadow-sm"
/** Collapsed row ≈ 60px tall: 1px borders + 11px×2 padding + 36px input track. */
const inputShellClass = cn(inputShellBaseClass, "py-[11px]")
const inputShellRecordingClass = cn(inputShellBaseClass, "py-3")

/** Matches footer send/mic (`h-9`); `py-2` + `leading-5` + `text-sm` ≈ 36px border-box. Floors auto-grow when `scrollHeight` is 0. */
const TEXTAREA_MIN_HEIGHT_PX = 36

function TranscriptionLoadingLabel({ text }: { text: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-0.5 text-sm text-neutral-400">
      <span>{text.replace(/\u2026$/, "")}</span>
      <span
        className="inline-block animate-pulse font-normal text-neutral-400"
        aria-hidden
      >
        …
      </span>
    </div>
  )
}

export interface ComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder?: string
  transcriptionLoadingPlaceholder?: string
  sendAriaLabel?: string
  micAriaLabel?: string
  cancelRecordingAriaLabel?: string
  confirmRecordingAriaLabel?: string
  disabled?: boolean
  className?: string
  isRecording: boolean
  isVoiceTranscribing?: boolean
  onMicClick: () => void
  micDisabled?: boolean
  micStream: MediaStream | null
  timelineVisualizationActive: boolean
  onRecordingCancel: () => void
  onRecordingConfirm: () => void
  voiceError?: string | null
}

export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder = "Posez votre question...",
  transcriptionLoadingPlaceholder = "Transcription en cours…",
  sendAriaLabel = "Envoyer",
  micAriaLabel = "Enregistrer un message vocal",
  cancelRecordingAriaLabel = "Annuler l'enregistrement",
  confirmRecordingAriaLabel = "Confirmer la dictée",
  disabled = false,
  className,
  isRecording,
  isVoiceTranscribing = false,
  onMicClick,
  micDisabled = false,
  micStream,
  timelineVisualizationActive,
  onRecordingCancel,
  onRecordingConfirm,
  voiceError,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const inputLocked = disabled || isVoiceTranscribing
  const canSend = !inputLocked && value.trim().length > 0

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    // Empty: avoid using `scrollHeight` after collapse — it can read ~42px in some engines.
    if (value.length === 0) {
      el.style.height = `${TEXTAREA_MIN_HEIGHT_PX}px`
      return
    }
    el.style.height = "0px"
    void el.offsetHeight
    el.style.height = `${Math.max(el.scrollHeight, TEXTAREA_MIN_HEIGHT_PX)}px`
  }, [value])

  useLayoutEffect(() => {
    syncTextareaHeight()
  }, [value, isVoiceTranscribing, syncTextareaHeight])

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSubmit()
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {voiceError ? (
        <p className="text-sm text-destructive" role="alert">
          {voiceError}
        </p>
      ) : null}
      <div
        className={cn(
          "flex min-w-0 gap-2 sm:gap-3",
          isRecording ? "items-center" : "items-end",
        )}
      >
        {isRecording ? (
          <>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] border border-destructive/35 bg-destructive/15 text-destructive hover:bg-destructive/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 transition-colors"
              aria-label={cancelRecordingAriaLabel}
              onClick={onRecordingCancel}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            <div className={cn(inputShellRecordingClass, "min-h-[52px]")} aria-hidden>
              <RecordingTimeline
                mediaStream={micStream}
                visualizationActive={timelineVisualizationActive}
                className="h-9 w-full border-0 bg-transparent"
              />
            </div>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-primary text-primary-foreground shadow-md hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
              aria-label={confirmRecordingAriaLabel}
              onClick={onRecordingConfirm}
            >
              <Check className="h-4 w-4" aria-hidden />
            </button>
          </>
        ) : (
          <>
            <form
              className={cn(inputShellClass)}
              onSubmit={(e) => {
                e.preventDefault()
                if (canSend) onSubmit()
              }}
            >
              <div className="relative flex min-h-[36px] min-w-0 flex-1 flex-col justify-center">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onInput={syncTextareaHeight}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder={isVoiceTranscribing ? "" : placeholder}
                  className={cn(
                    "box-border max-h-[8rem] min-h-[36px] w-full resize-none overflow-y-auto bg-transparent py-2 text-sm leading-5 text-[#11161f] placeholder:text-neutral-400 focus:outline-none",
                    isVoiceTranscribing &&
                      "text-transparent caret-transparent",
                  )}
                  disabled={inputLocked}
                  autoComplete="off"
                />
                {isVoiceTranscribing ? (
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center"
                    aria-live="polite"
                  >
                    <TranscriptionLoadingLabel
                      text={transcriptionLoadingPlaceholder}
                    />
                  </div>
                ) : null}
              </div>
              <button
                type="submit"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                aria-label={sendAriaLabel}
                disabled={!canSend}
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </button>
            </form>
            <div className="flex shrink-0 flex-col pb-3">
              <SecondaryPrimaryButton
                type="button"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-[14px]"
                aria-label={micAriaLabel}
                disabled={micDisabled}
                onClick={() => {
                  void onMicClick()
                }}
              >
                <Mic className="h-4 w-4" aria-hidden />
              </SecondaryPrimaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
