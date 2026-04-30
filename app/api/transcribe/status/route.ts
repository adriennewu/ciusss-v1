import { NextResponse } from "next/server"

export const runtime = "nodejs"

/** Lets the client choose MediaRecorder+Whisper vs browser Web Speech. */
export async function GET() {
  const configured = Boolean(process.env.OPENAI_API_KEY?.trim())
  return NextResponse.json({ configured })
}
