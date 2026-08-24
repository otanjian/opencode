import { describe, expect, test } from "bun:test"
import { activateMarkdownPath, markdownPathActionAttributes } from "./markdown-path-action"

describe("markdown path actions", () => {
  const opened: string[] = []
  const action = {
    label: "Open report",
    matches: (value: string) => /\.html(?:[?#].*)?$/i.test(value) && !/^https?:/i.test(value),
    open: (value: string) => {
      opened.push(value)
    },
  }

  test("adds button semantics only to matching inline paths", () => {
    expect(markdownPathActionAttributes("artifacts/report.html", action)).toEqual({
      role: "button",
      tabIndex: 0,
      ariaLabel: "Open report: artifacts/report.html",
    })
    expect(markdownPathActionAttributes("artifacts/report.json", action)).toBeUndefined()
    expect(markdownPathActionAttributes("https://example.com/report.html", action)).toBeUndefined()
    expect(markdownPathActionAttributes("artifacts/report.html?download=1", action)?.role).toBe("button")
  })

  test.each(["click", "Enter", " "] as const)("activates on %s", (kind) => {
    opened.length = 0
    expect(activateMarkdownPath({ kind, value: "artifacts/report.html", action })).toBe(true)
    expect(opened).toEqual(["artifacts/report.html"])
  })

  test.each(["Escape", "ArrowRight"])("ignores %s", (kind) => {
    opened.length = 0
    expect(activateMarkdownPath({ kind, value: "artifacts/report.html", action })).toBe(false)
    expect(opened).toEqual([])
  })

  test("does nothing without an action, preserving direct-route behavior", () => {
    expect(activateMarkdownPath({ kind: "click", value: "artifacts/report.html" })).toBe(false)
  })
})
