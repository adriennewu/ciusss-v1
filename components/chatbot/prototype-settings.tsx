"use client"

import { useState } from "react"
import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { ChatLocale } from "./chatbot-copy"
import { getPrototypeSettingsCopy } from "./prototype-settings-copy"
import {
  AUDIO_VARIANTS,
  PRIMARY_COLORS,
  SOURCE_VARIANTS,
  type AudioVariantId,
  type PrimaryColorId,
  type SourceVariantId,
} from "./prototype-config"

export interface PrototypeSettingsProps {
  locale: ChatLocale
  committedSource: SourceVariantId
  committedAudio: AudioVariantId
  committedPrimary: PrimaryColorId
  onSave: (next: {
    sourceVariant: SourceVariantId
    audioVariant: AudioVariantId
    primaryColor: PrimaryColorId
  }) => void
  className?: string
}

export function PrototypeSettings({
  locale,
  committedSource,
  committedAudio,
  committedPrimary,
  onSave,
  className,
}: PrototypeSettingsProps) {
  const copy = getPrototypeSettingsCopy(locale)
  const [open, setOpen] = useState(false)
  const [draftSource, setDraftSource] =
    useState<SourceVariantId>(committedSource)
  const [draftAudio, setDraftAudio] =
    useState<AudioVariantId>(committedAudio)
  const [draftPrimary, setDraftPrimary] =
    useState<PrimaryColorId>(committedPrimary)

  const audioSelectEnabled =
    draftSource === "v3" || draftSource === "v4"

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraftSource(committedSource)
      setDraftAudio(committedAudio)
      setDraftPrimary(committedPrimary)
    }
    setOpen(next)
  }

  const handleCancel = () => {
    setOpen(false)
  }

  const handleSave = () => {
    onSave({
      sourceVariant: draftSource,
      audioVariant: draftAudio,
      primaryColor: draftPrimary,
    })
    setOpen(false)
  }

  const audioLabelForId = (id: AudioVariantId) => {
    switch (id) {
      case "v1_icon_floating_action_modal":
        return copy.audioOptionV1
      case "v2_full_screen_reader":
        return copy.audioOptionV2
      case "v3_full_screen_audio":
        return copy.audioOptionV3
      case "v4_full_screen_audio":
        return copy.audioOptionV4
    }
  }

  return (
    <div className={cn(className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-10 rounded-full border-border bg-card/90 shadow-sm backdrop-blur-sm hover:bg-card"
        aria-label={copy.settingsAria}
        onClick={() => handleOpenChange(true)}
      >
        <Settings className="size-5" aria-hidden />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="w-full max-w-md gap-6 sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>{copy.dialogTitle}</DialogTitle>
            <DialogDescription className="sr-only">
              {copy.dialogDescription}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label
                htmlFor="prototype-sources"
                className="text-xs text-muted-foreground"
              >
                {copy.sourceVersion}
              </Label>
              <Select
                value={draftSource}
                onValueChange={(v) => setDraftSource(v as SourceVariantId)}
              >
                <SelectTrigger
                  id="prototype-sources"
                  size="sm"
                  className="min-w-0 w-full max-w-full bg-background"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[100]">
                  {SOURCE_VARIANTS.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <Label
                htmlFor="prototype-audio"
                className="text-xs text-muted-foreground"
              >
                {copy.audioVersion}
              </Label>
              <Select
                value={draftAudio}
                onValueChange={(v) => setDraftAudio(v as AudioVariantId)}
                disabled={!audioSelectEnabled}
              >
                <SelectTrigger
                  id="prototype-audio"
                  size="sm"
                  className="min-w-0 w-full max-w-full bg-background disabled:opacity-60"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[100]">
                  {AUDIO_VARIANTS.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {audioLabelForId(v.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <Label
                htmlFor="prototype-primary"
                className="text-xs text-muted-foreground"
              >
                {copy.primaryColor}
              </Label>
              <Select
                value={draftPrimary}
                onValueChange={(v) => setDraftPrimary(v as PrimaryColorId)}
              >
                <SelectTrigger
                  id="prototype-primary"
                  size="sm"
                  className="min-w-0 w-full max-w-full bg-background"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[100]">
                  {PRIMARY_COLORS.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              {copy.cancel}
            </Button>
            <Button type="button" onClick={handleSave}>
              {copy.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
