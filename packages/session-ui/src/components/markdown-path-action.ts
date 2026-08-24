import { inlineCodeKind } from "./markdown-inline-code-kind"

export type MarkdownPathAction = {
  label: string
  matches: (value: string) => boolean
  open: (value: string) => void | Promise<void>
}

type MarkdownPathActionAttributes = {
  role: "button"
  tabIndex: 0
  ariaLabel: string
}

export function markdownPathActionAttributes(
  value: string,
  action: MarkdownPathAction | undefined,
): MarkdownPathActionAttributes | undefined {
  const path = value.trim().split(/[?#]/, 1)[0] ?? ""
  if (!action || inlineCodeKind(path) !== "path" || !action.matches(value)) return undefined
  return {
    role: "button" as const,
    tabIndex: 0,
    ariaLabel: `${action.label}: ${value}`,
  }
}

export function activateMarkdownPath(input: { kind: string; value: string; action?: MarkdownPathAction }) {
  if (!markdownPathActionAttributes(input.value, input.action)) return false
  if (input.kind !== "click" && input.kind !== "Enter" && input.kind !== " ") return false
  void input.action?.open(input.value)
  return true
}
