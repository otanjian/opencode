import { describe, expect, test } from "bun:test"
import {
  buildBuildingAIReportUrl,
  buildHtmlArtifactErrorPage,
  buildHtmlArtifactPreviewShell,
  embeddedHtmlArtifactPath,
  htmlArtifactPath,
  openHtmlArtifactPreview,
  workspaceHtmlArtifactPath,
} from "./html-artifact-preview"

describe("HTML artifact paths", () => {
  test.each([
    ["artifacts/report.html", "artifacts/report.html"],
    ["artifacts/report.HTM", "artifacts/report.HTM"],
    [" artifacts/report.HTML?download=1#summary ", "artifacts/report.HTML"],
  ])("recognizes %s", (value, expected) => {
    expect(htmlArtifactPath(value)).toBe(expected)
  })

  test.each(["artifacts/report.json", "artifacts/report.html.txt", "", "https://example.com/report.html"])(
    "rejects %s",
    (value) => {
      expect(htmlArtifactPath(value)).toBeUndefined()
    },
  )

  test.each(["../report.html", "/tmp/report.html", "C:\\tmp\\report.html"])(
    "passes %s to workspace validation",
    (value) => {
      expect(htmlArtifactPath(value)).toBe(value)
    },
  )

  test("activates only in the explicit BuildingAI embed", () => {
    expect(embeddedHtmlArtifactPath("artifacts/report.html", "?buildingaiEmbed=1")).toBe("artifacts/report.html")
    expect(embeddedHtmlArtifactPath("artifacts/report.html", "")).toBeUndefined()
    expect(embeddedHtmlArtifactPath("artifacts/report.html", "?buildingaiEmbed=0")).toBeUndefined()
  })

  test("normalizes project-prefixed changed-file paths to the active workspace", () => {
    const directory = "/Users/jiantan/ai_assistant/sapwork"
    expect(workspaceHtmlArtifactPath("sapwork/artifacts/report.html", directory)).toBe("artifacts/report.html")
    expect(workspaceHtmlArtifactPath("artifacts/report.html", directory)).toBe("artifacts/report.html")
    expect(workspaceHtmlArtifactPath("sapwork/report.json", directory)).toBeUndefined()
  })

  test.each([
    ["artifacts/conversation-1/report.html", "report.html"],
    ["sapwork/artifacts/conversation-1/采购报告.html", "%E9%87%87%E8%B4%AD%E6%8A%A5%E5%91%8A.html"],
    ["/Users/me/sapwork/artifacts/conversation-1/nested/report.htm", "nested/report.htm"],
  ])("builds a BuildingAI report URL for %s", (path, expected) => {
    const search = new URLSearchParams({
      buildingaiEmbed: "1",
      buildingaiReportBase: "http://127.0.0.1:4091/agents/a/c/conversation-1/reports/",
      buildingaiArtifactRoot: "artifacts/conversation-1",
    }).toString()

    expect(buildBuildingAIReportUrl(path, `?${search}`)).toBe(
      `http://127.0.0.1:4091/agents/a/c/conversation-1/reports/${expected}`,
    )
  })

  test.each([
    "../secret.html",
    "artifacts/other-conversation/report.html",
    "https://example.com/report.html",
    "artifacts/conversation-1/report.pdf",
  ])("rejects unsafe BuildingAI report path %s", (path) => {
    const search = new URLSearchParams({
      buildingaiEmbed: "1",
      buildingaiReportBase: "http://127.0.0.1:4091/agents/a/c/conversation-1/reports/",
      buildingaiArtifactRoot: "artifacts/conversation-1",
    }).toString()
    expect(buildBuildingAIReportUrl(path, `?${search}`)).toBeUndefined()
  })
})

describe("HTML artifact preview documents", () => {
  const labels = {
    loading: "Loading",
    failed: "Preview failed",
    limitation: "Only single-file reports and approved CDN resources are supported.",
  }

  test("isolates report HTML behind a restrictive sandbox and CSP", () => {
    const shell = buildHtmlArtifactPreviewShell({
      path: `artifacts/<report>.html`,
      html: `<script>document.body.textContent = "ready"</script>`,
      labels,
    })

    expect(shell).toContain('sandbox="allow-scripts"')
    expect(shell).not.toContain("allow-same-origin")
    expect(shell).not.toContain("allow-forms")
    expect(shell).not.toContain("allow-top-navigation")
    expect(shell).toContain("default-src 'none'")
    expect(shell).toContain("connect-src 'none'")
    expect(shell).toContain("form-action 'none'")
    expect(shell).toContain("https://cdn.jsdelivr.net")
    expect(shell).not.toContain("https://example.com")
    expect(shell).toContain("Only single-file reports and approved CDN resources are supported.")
    expect(shell).toContain("artifacts/&lt;report&gt;.html")
    expect(shell).not.toContain(`<script>document.body.textContent = "ready"</script>`)
  })

  test("escapes paths and error details", () => {
    const page = buildHtmlArtifactErrorPage({
      path: `artifacts/<img src=x onerror=alert(1)>.html`,
      error: `<script>alert(1)</script>`,
      labels,
    })

    expect(page).toContain("&lt;img src=x onerror=alert(1)&gt;")
    expect(page).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
    expect(page).not.toContain("<script>alert(1)</script>")
  })
})

describe("HTML artifact preview lifecycle", () => {
  const labels = {
    loading: "Loading",
    failed: "Preview failed",
    limitation: "Only single-file reports and approved CDN resources are supported.",
  }

  function harness(file: { type: string; content?: string } | undefined, reject?: Error) {
    const events: string[] = []
    const pages: string[] = []
    const replaced: string[] = []
    const revoked: string[] = []
    const tab = {
      opener: {} as unknown,
      document: {
        open: () => events.push("document.open"),
        write: (value: string) => pages.push(value),
        close: () => events.push("document.close"),
      },
      location: { replace: (value: string) => replaced.push(value) },
      addEventListener: (_type: string, callback: () => void) => callback(),
    }

    const promise = openHtmlArtifactPreview({
      path: "artifacts/report.html",
      labels,
      openWindow: () => {
        events.push("window.open")
        return tab
      },
      readFile: async (path) => {
        events.push(`read:${path}`)
        if (reject) throw reject
        return file
      },
      createObjectURL: () => {
        events.push("blob.create")
        return "blob:preview"
      },
      revokeObjectURL: (value) => revoked.push(value),
      scheduleCleanup: (callback) => {
        callback()
        return 1
      },
    })

    return { events, pages, promise, replaced, revoked, tab }
  }

  test("reserves a tab synchronously, removes its opener, reads the workspace file, and navigates on success", async () => {
    const state = harness({ type: "text", content: "<!doctype html><h1>Report</h1>" })

    expect(state.events.slice(0, 3)).toEqual(["window.open", "document.open", "document.close"])
    expect(state.tab.opener).toBeNull()
    expect(state.pages[0]).toContain("Loading")
    expect(await state.promise).toBe("opened")
    expect(state.events).toContain("read:artifacts/report.html")
    expect(state.events).toContain("blob.create")
    expect(state.replaced).toEqual(["blob:preview"])
    expect(state.revoked).toContain("blob:preview")
  })

  test.each([
    ["missing", undefined],
    ["binary", { type: "binary", content: "AA==" }],
    ["empty", { type: "text", content: "" }],
  ])("renders a visible failure for %s files", async (_name, file) => {
    const state = harness(file)
    expect(await state.promise).toBe("failed")
    expect(state.pages.at(-1)).toContain("Preview failed")
    expect(state.replaced).toEqual([])
  })

  test("renders a visible failure when the workspace read rejects", async () => {
    const state = harness(undefined, new Error(`<denied>`))
    expect(await state.promise).toBe("failed")
    expect(state.pages.at(-1)).toContain("&lt;denied&gt;")
  })

  test("does not create a preview Blob for a non-HTML selection", async () => {
    const events: string[] = []
    const pages: string[] = []
    const result = await openHtmlArtifactPreview({
      path: "artifacts/report.txt",
      labels,
      openWindow: () => ({
        opener: {},
        document: { open: () => {}, write: (value) => pages.push(value), close: () => {} },
        location: { replace: () => events.push("replace") },
      }),
      readFile: async () => {
        events.push("read")
        return { type: "text", content: "report" }
      },
      createObjectURL: () => {
        events.push("blob")
        return "blob:preview"
      },
    })

    expect(result).toBe("failed")
    expect(events).toEqual([])
    expect(pages.at(-1)).toContain("not an HTML file")
  })

  test("reports a blocked popup without reading", async () => {
    const events: string[] = []
    const result = await openHtmlArtifactPreview({
      path: "artifacts/report.html",
      labels,
      openWindow: () => null,
      readFile: async () => {
        events.push("read")
        return { type: "text", content: "report" }
      },
    })

    expect(result).toBe("blocked")
    expect(events).toEqual([])
  })
})
