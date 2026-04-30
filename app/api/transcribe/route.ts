import { NextResponse } from "next/server"
import { inferLocaleFromText } from "@/lib/infer-locale-from-text"

export const runtime = "nodejs"

const MAX_BYTES = 25 * 1024 * 1024
const MIN_INCOMING_BYTES = 32

/** Map Whisper `verbose_json` language field to UI locale (FR/EN only). */
function whisperLanguageToChatLocale(
  lang: string | undefined
): "en" | "fr" | null {
  if (lang == null) return null
  const s = String(lang).trim().toLowerCase().replace(/_/g, "-")
  if (
    s === "fr" ||
    s.startsWith("fr-") ||
    s === "fra" ||
    s === "fre" ||
    s.includes("french")
  ) {
    return "fr"
  }
  if (
    s === "en" ||
    s.startsWith("en-") ||
    s === "eng" ||
    s.includes("english")
  ) {
    return "en"
  }
  return null
}

function resolveDetectedLocale(
  parsed: unknown,
  text: string,
  uiLocaleHint?: "en" | "fr"
): "en" | "fr" | null {
  const p = parsed as { language?: unknown }
  const raw =
    typeof p.language === "string"
      ? p.language
      : p.language != null
        ? String(p.language)
        : undefined
  const whisper = whisperLanguageToChatLocale(raw)
  const inferred = inferLocaleFromText(
    text,
    uiLocaleHint ? { uiLocale: uiLocaleHint } : undefined
  )

  if (whisper == null) return inferred
  if (inferred == null) return whisper
  if (whisper === inferred) return whisper

  if (/[àâäéèêëïîôùûüÿæœç]/i.test(text)) return "fr"
  if (inferred === "fr") return "fr"
  if (inferred === "en") return "en"
  return whisper
}

function extractTranscriptionText(parsed: unknown): string {
  if (!parsed || typeof parsed !== "object") return ""
  const p = parsed as { text?: unknown; segments?: unknown }
  if (typeof p.text === "string" && p.text.trim()) return p.text.trim()
  if (Array.isArray(p.segments)) {
    const joined = p.segments
      .map((seg) => {
        if (
          seg &&
          typeof seg === "object" &&
          "text" in seg &&
          typeof (seg as { text: unknown }).text === "string"
        ) {
          return (seg as { text: string }).text
        }
        return ""
      })
      .join("")
      .trim()
    if (joined) return joined
  }
  return typeof p.text === "string" ? p.text.trim() : ""
}

function openAiErrorMessage(raw: string): string | undefined {
  try {
    const j = JSON.parse(raw) as { error?: { message?: string } }
    const m = j.error?.message
    return typeof m === "string" ? m : undefined
  } catch {
    return undefined
  }
}

async function whisperPost(key: string, body: FormData) {
  return fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
    },
    body,
  })
}

export async function POST(req: Request) {
  try {
    const key = process.env.OPENAI_API_KEY
    if (!key?.trim()) {
      return NextResponse.json(
        { error: "missing_api_key" },
        { status: 503 }
      )
    }

    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return NextResponse.json({ error: "invalid_form" }, { status: 400 })
    }

    const file = form.get("file")
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 })
    }

    if (file.size < MIN_INCOMING_BYTES) {
      return NextResponse.json({ error: "file_too_small" }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "file_too_large" }, { status: 413 })
    }

    const localeField =
      typeof form.get("locale") === "string" ? String(form.get("locale")) : "en"
    const autoDetect = localeField === "auto"
    const filename =
      typeof form.get("filename") === "string" && String(form.get("filename")).trim()
        ? String(form.get("filename")).trim()
        : "audio.webm"
    const uiLocaleParam =
      typeof form.get("ui_locale") === "string"
        ? String(form.get("ui_locale")).trim().toLowerCase()
        : ""
    const uiLocaleHint: "en" | "fr" | undefined =
      uiLocaleParam === "en" || uiLocaleParam === "fr"
        ? uiLocaleParam
        : undefined

    let arrayBuf: ArrayBuffer
    try {
      arrayBuf = await file.arrayBuffer()
    } catch (e) {
      return NextResponse.json(
        { error: "file_read_failed", detail: String(e).slice(0, 120) },
        { status: 500 }
      )
    }

    const mime = file.type || "application/octet-stream"
    const fileBlob = new Blob([arrayBuf], { type: mime })

    const buildForm = (
      responseFormat: "verbose_json" | "json",
      lang?: "fr" | "en",
      bilingualPrompt?: boolean
    ) => {
      const upstream = new FormData()
      upstream.append("file", fileBlob, filename)
      upstream.append("model", "whisper-1")
      upstream.append("response_format", responseFormat)
      if (lang) upstream.append("language", lang)
      if (bilingualPrompt) {
        const uiLine =
          uiLocaleParam === "fr" || uiLocaleParam === "en"
            ? ` The chat UI is in ${uiLocaleParam === "fr" ? "French" : "English"}; the spoken language may differ.`
            : ""
        upstream.append(
          "prompt",
          "The speaker may use English or French (including Canadian French)." + uiLine
        )
      }
      return upstream
    }

    if (!autoDetect) {
      const upstream = buildForm(
        "json",
        localeField === "fr" ? "fr" : "en"
      )
      const res = await whisperPost(key, upstream)
      const raw = await res.text()
      if (!res.ok) {
        return NextResponse.json(
          {
            error: "upstream_error",
            status: res.status,
            detail: openAiErrorMessage(raw),
          },
          { status: 502 }
        )
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        return NextResponse.json({ error: "invalid_upstream" }, { status: 502 })
      }
      return NextResponse.json({ text: extractTranscriptionText(parsed) })
    }

    let res = await whisperPost(key, buildForm("verbose_json", undefined, true))
    let raw = await res.text()

    if (!res.ok) {
      const detailVerbose = openAiErrorMessage(raw)
      res = await whisperPost(key, buildForm("json", undefined, true))
      raw = await res.text()
      if (!res.ok) {
        return NextResponse.json(
          {
            error: "upstream_error",
            status: res.status,
            detail: openAiErrorMessage(raw) ?? detailVerbose,
          },
          { status: 502 }
        )
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        return NextResponse.json({ error: "invalid_upstream" }, { status: 502 })
      }
      const t = extractTranscriptionText(parsed)
      return NextResponse.json({
        text: t,
        detectedLocale: resolveDetectedLocale(parsed, t, uiLocaleHint),
      })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      res = await whisperPost(key, buildForm("json", undefined, true))
      raw = await res.text()
      if (!res.ok) {
        return NextResponse.json(
          {
            error: "upstream_error",
            status: res.status,
            detail: openAiErrorMessage(raw),
          },
          { status: 502 }
        )
      }
      try {
        parsed = JSON.parse(raw)
      } catch {
        return NextResponse.json({ error: "invalid_upstream" }, { status: 502 })
      }
      const t = extractTranscriptionText(parsed)
      return NextResponse.json({
        text: t,
        detectedLocale: resolveDetectedLocale(parsed, t, uiLocaleHint),
      })
    }

    const text = extractTranscriptionText(parsed)
    const detectedLocale = resolveDetectedLocale(parsed, text, uiLocaleHint)

    return NextResponse.json({
      text,
      detectedLocale,
    })
  } catch (e) {
    return NextResponse.json(
      { error: "route_exception", detail: String(e).slice(0, 200) },
      { status: 500 }
    )
  }
}
