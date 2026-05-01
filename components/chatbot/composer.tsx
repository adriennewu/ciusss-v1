"use client"

import { ArrowUp, Check, Mic, X } from "lucide-react"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { RecordingTimeline } from "./recording-timeline"

/** Middle slot in recording row: timeline + chrome. */
const inputShellBaseClass =
  "flex min-w-0 flex-1 items-end gap-2 rounded-2xl border border-border bg-card px-3 shadow-sm"
const inputShellCardClass =
  "rounded-2xl border border-border bg-card px-3 shadow-sm"
/** Collapsed row ≈ 60px tall: 1px borders + 11px×2 padding + 36px input track. Textarea + trailing 36×36 action inside shell. */
const inputShellClass = cn(
  "flex min-w-0 flex-1 items-end gap-2 sm:gap-3",
  inputShellCardClass,
  "py-[11px]",
)
const inputShellRecordingClass = cn(inputShellBaseClass, "py-3")

/** Matches footer send/mic (`h-9`); `py-2` + `leading-5` + `text-sm` ≈ 36px border-box. Floors auto-grow when `scrollHeight` is 0. */
const TEXTAREA_MIN_HEIGHT_PX = 36

function TranscriptionLoadingLabel({ text }: { text: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-0.5 text-sm text-muted-foreground">
      <span>{text.replace(/\u2026$/, "")}</span>
      <span
        className="inline-block motion-safe:animate-pulse font-normal text-muted-foreground"
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
  /**
   * Visible (rendered `sr-only`) label associated with the textarea via `<label htmlFor>`.
   * Required for SGQRI 008 / WCAG 3.3.2 — placeholder text alone is not a label.
   */
  messageLabel: string
  /**
   * @deprecated Superseded by `messageLabel`. Kept so callers can pass a longer accessible
   * description if they wish; otherwise the visible-but-hidden label is the field's name.
   */
  inputAriaLabel?: string
  sendAriaLabel: string
  micAriaLabel: string
  /** When the visible mic or send control is disabled (e.g. busy). */
  primaryActionUnavailableAriaLabel: string
  /** Optional polite announcement when the draft becomes non-empty (send visible). */
  sendModeAnnouncement?: string
  /** Optional polite announcement when the draft becomes empty (mic visible). */
  voiceModeAnnouncement?: string
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
}

export function Composer({
  value,
  onChange,
  onSubmit,
  placeholder = "Posez votre question...",
  transcriptionLoadingPlaceholder = "Transcription en cours…",
  messageLabel,
  inputAriaLabel,
  sendAriaLabel,
  micAriaLabel,
  primaryActionUnavailableAriaLabel,
  sendModeAnnouncement,
  voiceModeAnnouncement,
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
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const modeAnnouncerRef = useRef<HTMLDivElement | null>(null)
  const prevSendModeRef = useRef<boolean | null>(null)
  const inputLocked = disabled || isVoiceTranscribing
  const hasDraftText = value.trim().length > 0
  const canSend = !inputLocked && hasDraftText
  const canMic = !inputLocked && !micDisabled && !hasDraftText

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
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

  const sendMode = hasDraftText
  useEffect(() => {
    if (
      isRecording ||
      sendModeAnnouncement == null ||
      voiceModeAnnouncement == null
    ) {
      return
    }
    if (prevSendModeRef.current === null) {
      prevSendModeRef.current = sendMode
      return
    }
    if (prevSendModeRef.current === sendMode) return
    prevSendModeRef.current = sendMode
    const el = modeAnnouncerRef.current
    if (!el) return
    el.textContent = sendMode ? sendModeAnnouncement : voiceModeAnnouncement
  }, [isRecording, sendMode, sendModeAnnouncement, voiceModeAnnouncement])

  const handleTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSubmit()
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        ref={modeAnnouncerRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
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
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-[14px] border border-destructive/35 bg-destructive/15 text-destructive transition-colors hover:bg-destructive/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:ring-offset-2"
              aria-label={cancelRecordingAriaLabel}
              onClick={onRecordingCancel}
            >
              <X className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
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
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-[14px] bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={confirmRecordingAriaLabel}
              onClick={onRecordingConfirm}
            >
              <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
            </button>
          </>
        ) : (
          <div className={inputShellClass}>
            <form
              className="flex min-h-0 min-w-0 flex-1 items-end"
              onSubmit={(e) => {
                e.preventDefault()
                if (canSend) onSubmit()
              }}
            >
              <div className="relative flex min-h-[36px] min-w-0 flex-1 flex-col justify-center">
                <label htmlFor="chat-composer-message" className="sr-only">
                  {messageLabel}
                </label>
                <textarea
                  ref={textareaRef}
                  id="chat-composer-message"
                  rows={1}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  onInput={syncTextareaHeight}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder={isVoiceTranscribing ? "" : placeholder}
                  aria-describedby={
                    inputAriaLabel ? "chat-composer-desc" : undefined
                  }
                  className={cn(
                    "box-border max-h-[8rem] min-h-[36px] w-full resize-none overflow-y-auto bg-transparent py-2 text-sm leading-5 text-card-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    isVoiceTranscribing &&
                      "text-transparent caret-transparent",
                  )}
                  disabled={inputLocked}
                  autoComplete="off"
                />
                {inputAriaLabel ? (
                  <span id="chat-composer-desc" className="sr-only">
                    {inputAriaLabel}
                  </span>
                ) : null}
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
            </form>
            <div className="relative size-9 shrink-0 self-end">
              <Button
                type="button"
                variant="primaryMuted"
                onClick={() => {
                  void onMicClick()
                }}
                disabled={!canMic}
                aria-label={
                  canMic ? micAriaLabel : primaryActionUnavailableAriaLabel
                }
                aria-hidden={hasDraftText}
                style={{ display: hasDraftText ? "none" : "flex" }}
                className="absolute inset-0 z-[1] size-9 shrink-0 rounded-[14px] !p-0 gap-0 has-[>svg]:p-0"
              >
                <Mic className="h-4 w-4 shrink-0" aria-hidden />
              </Button>
              <button
                type="button"
                onClick={() => onSubmit()}
                disabled={!canSend}
                aria-label={
                  canSend ? sendAriaLabel : primaryActionUnavailableAriaLabel
                }
                aria-hidden={!hasDraftText}
                style={{ display: hasDraftText ? "flex" : "none" }}
                className="absolute inset-0 z-[1] flex size-9 shrink-0 items-center justify-center rounded-[14px] bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-50"
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
