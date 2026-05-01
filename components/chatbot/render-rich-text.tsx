import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { SourceLink } from "./source-link"

const MD_LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g

/**
 * Renders plain strings with **bold** segments as <strong>.
 * Incomplete trailing `**` is shown literally until closed.
 */
export function renderWithBold(text: string, keyPrefix = "b"): ReactNode[] {
  const nodes: ReactNode[] = []
  let i = 0
  let k = 0

  while (i < text.length) {
    const open = text.indexOf("**", i)
    if (open === -1) {
      if (i < text.length) {
        nodes.push(text.slice(i))
      }
      break
    }
    if (open > i) {
      nodes.push(text.slice(i, open))
    }
    const close = text.indexOf("**", open + 2)
    if (close === -1) {
      nodes.push(text.slice(open))
      break
    }
    const inner = text.slice(open + 2, close)
    nodes.push(
      <strong key={`${keyPrefix}-${k++}`}>{inner}</strong>
    )
    i = close + 2
  }

  return nodes
}

/** One line with **bold** and optional `[label](url)` segments (used for hospital address source line). */
export function renderRichLineWithBoldAndLinks(
  line: string,
  lineKey: string
): ReactNode {
  if (!line) return null
  const nodes: ReactNode[] = []
  const re = new RegExp(MD_LINK_RE.source, "g")
  let last = 0
  let m: RegExpExecArray | null
  let partIdx = 0
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) {
      const before = line.slice(last, m.index)
      nodes.push(
        <span key={`${lineKey}-p-${partIdx++}`}>
          {renderWithBold(before, `${lineKey}-b${partIdx}`)}
        </span>
      )
    }
    nodes.push(
      <SourceLink
        key={`${lineKey}-a-${partIdx++}`}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer"
      >
        {renderWithBold(m[1], `${lineKey}-lbl`)}
      </SourceLink>
    )
    last = m.index + m[0].length
  }
  if (last < line.length) {
    nodes.push(
      <span key={`${lineKey}-p-${partIdx++}`}>
        {renderWithBold(line.slice(last), `${lineKey}-end`)}
      </span>
    )
  }
  if (nodes.length === 0) {
    return <>{renderWithBold(line, lineKey)}</>
  }
  return <>{nodes}</>
}

function isMarkdownBulletLine(line: string): boolean {
  return /^-\s/.test(line.trimStart())
}

function stripLeadingMarkdownBullet(line: string): string {
  return line.replace(/^\s*-\s+/, "")
}

/** Matches services lists in chatbot-modal (• + primary bold marker, flex row, relaxed body). */
const richBulletListClassName =
  "space-y-2 text-foreground list-none p-0"
const richBulletRowClassName = "flex items-start gap-2"
const richBulletGlyphClassName = "text-primary-on-background font-bold"
const richBulletContentClassName = "min-w-0 text-foreground leading-relaxed"

/** One block per line (preserves list / paragraph breaks) with **bold** support. */
export function RichBlockLines({
  text,
  className,
  /** Extra class on the first line only (e.g. spacing after the intro paragraph). */
  firstLineClassName,
  /** When true, lines may include `[label](url)` rendered as inline links (bold still supported). */
  inlineLinks = false,
}: {
  text: string
  className?: string
  firstLineClassName?: string
  inlineLinks?: boolean
}) {
  if (!text) return null
  const lines = text.split("\n")
  const firstBulletIdx = lines.findIndex(isMarkdownBulletLine)
  /** Same gap as services_first: intro paragraph + ul with mt-4 (not mb-3 on intro + mt-0 on ul). */
  const introIsSingleParagraphBeforeFirstList =
    firstBulletIdx > 0 &&
    lines[0].trim() !== "" &&
    lines.slice(1, firstBulletIdx).every((l) => l.trim() === "")

  const blocks: ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    if (isMarkdownBulletLine(lines[i])) {
      const listStart = i
      while (i < lines.length && isMarkdownBulletLine(lines[i])) {
        i++
      }
      blocks.push(
        <ul
          key={`bullets-${listStart}`}
          className={cn(
            richBulletListClassName,
            listStart > 0 ? "mt-4" : "mt-0"
          )}
        >
          {lines.slice(listStart, i).map((line, j) => {
            const lineIndex = listStart + j
            const body = stripLeadingMarkdownBullet(line)
            return (
              <li key={`b-${lineIndex}`} className={richBulletRowClassName}>
                <span className={richBulletGlyphClassName} aria-hidden>
                  •
                </span>
                <span className={richBulletContentClassName}>
                  {inlineLinks
                    ? renderRichLineWithBoldAndLinks(body, `bl-${lineIndex}`)
                    : renderWithBold(body, `bl-${lineIndex}`)}
                </span>
              </li>
            )
          })}
        </ul>
      )
    } else {
      const line = lines[i]
      const prevLineEmpty = i > 0 && lines[i - 1].trim() === ""
      const marginTopAfterParagraphBreak =
        prevLineEmpty && line.trim() !== ""

      blocks.push(
        <span
          key={`line-${i}`}
          className={cn(
            "block",
            i === 0 && !introIsSingleParagraphBeforeFirstList && "mb-3",
            marginTopAfterParagraphBreak && "mt-3",
            i === 0 && firstLineClassName
          )}
        >
          {inlineLinks
            ? renderRichLineWithBoldAndLinks(line, `bl-${i}`)
            : renderWithBold(line, `bl-${i}`)}
        </span>
      )
      i++
    }
  }

  return (
    <div className={cn("text-foreground leading-relaxed", className)}>{blocks}</div>
  )
}

export function RichParagraph({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <p className={cn("text-foreground leading-relaxed", className)}>
      {renderWithBold(text, "p")}
    </p>
  )
}
