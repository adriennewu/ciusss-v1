/** Interactive elements that participate in Tab order inside the chat widget. */
const TABBABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ")

function isDisplayed(el: HTMLElement, root: HTMLElement): boolean {
  if (!root.contains(el)) return false
  const style = window.getComputedStyle(el)
  if (style.visibility === "hidden" || style.display === "none") return false
  return el.getClientRects().length > 0
}

/** Focusable descendants of `root`, in tree order, suitable for focus trapping. */
export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)
  const out: HTMLElement[] = []
  for (const el of nodes) {
    if (el.hasAttribute("disabled")) continue
    if (el.getAttribute("aria-hidden") === "true") continue
    if (!isDisplayed(el, root)) continue
    if (el.tabIndex < 0) continue
    out.push(el)
  }
  return out
}
