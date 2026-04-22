import { NextResponse } from "next/server"

export const runtime = "nodejs"

const MAX_BYTES = 25 * 1024 * 1024

export async function POST(req: Request) {
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

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 })
  }

  const locale = typeof form.get("locale") === "string" ? String(form.get("locale")) : "en"
  const whisperLang = locale === "fr" ? "fr" : "en"
  const filename =
    typeof form.get("filename") === "string" && String(form.get("filename")).trim()
      ? String(form.get("filename")).trim()
      : "audio.webm"

  const upstream = new FormData()
  upstream.append("file", file, filename)
  upstream.append("model", "whisper-1")
  upstream.append("language", whisperLang)

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
    },
    body: upstream,
  })

  const raw = await res.text()
  if (!res.ok) {
    return NextResponse.json(
      { error: "upstream_error", status: res.status },
      { status: 502 }
    )
  }

  let text = ""
  try {
    const parsed = JSON.parse(raw) as { text?: string }
    text = typeof parsed.text === "string" ? parsed.text : ""
  } catch {
    return NextResponse.json({ error: "invalid_upstream" }, { status: 502 })
  }

  return NextResponse.json({ text: text.trim() })
}
