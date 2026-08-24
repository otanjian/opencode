import { isBuildingAIEmbedSearch } from "./buildingai-embed"

export type HtmlArtifactPreviewLabels = {
  loading: string
  failed: string
  limitation: string
}

type WorkspaceFile = {
  type?: string
  content?: string
}

type PreviewDocument = {
  open: () => void
  write: (html: string) => void
  close: () => void
}

type PreviewTab = {
  opener: unknown
  document: PreviewDocument
  location: { replace: (url: string) => void }
  addEventListener?: (type: "load", listener: () => void, options?: { once?: boolean }) => void
}

export type OpenHtmlArtifactPreviewInput = {
  path: string
  labels: HtmlArtifactPreviewLabels
  readFile: (path: string) => Promise<WorkspaceFile | undefined>
  openWindow?: () => PreviewTab | null
  createObjectURL?: (blob: Blob) => string
  revokeObjectURL?: (url: string) => void
  scheduleCleanup?: (callback: () => void, delay: number) => unknown
}

const approvedCdn = "https://cdn.jsdelivr.net"

const reportCsp = [
  "default-src 'none'",
  `script-src 'unsafe-inline' ${approvedCdn}`,
  `style-src 'unsafe-inline' ${approvedCdn}`,
  `img-src data: blob: ${approvedCdn}`,
  `font-src data: ${approvedCdn}`,
  "media-src data: blob:",
  "connect-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "manifest-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ")

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function reportDocument(html: string) {
  const policy = `<meta http-equiv="Content-Security-Policy" content="${reportCsp}">`
  const head = /<head(?:\s[^>]*)?>/i
  if (head.test(html)) return html.replace(head, (opening) => `${opening}${policy}`)

  const root = /<html(?:\s[^>]*)?>/i
  if (root.test(html)) return html.replace(root, (opening) => `${opening}<head>${policy}</head>`)

  return `<!doctype html><html><head>${policy}</head><body>${html}</body></html>`
}

function pageStyles() {
  return `
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: Canvas; color: CanvasText; }
    header { min-height: 42px; padding: 10px 16px; display: flex; align-items: center; gap: 12px;
      border-bottom: 1px solid color-mix(in srgb, CanvasText 18%, transparent); font-size: 13px; }
    header strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    header span { margin-inline-start: auto; color: color-mix(in srgb, CanvasText 66%, transparent); }
    iframe { display: block; width: 100%; height: calc(100vh - 43px); border: 0; background: white; }
    main { min-height: 100vh; display: grid; place-content: center; gap: 10px; padding: 32px; text-align: center; }
    main p, main code { max-width: min(720px, 90vw); overflow-wrap: anywhere; }
    main p { margin: 0; color: color-mix(in srgb, CanvasText 72%, transparent); }
    main code { display: block; padding: 8px 10px; border-radius: 6px;
      background: color-mix(in srgb, CanvasText 8%, transparent); }
  `
}

function trustedPage(input: { title: string; body: string; csp?: string }) {
  const csp =
    input.csp ??
    `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; frame-src 'self'; base-uri 'none'; form-action 'none'; connect-src 'none'`
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <title>${escapeHtml(input.title)}</title>
    <style>${pageStyles()}</style>
  </head>
  <body>
    ${input.body}
  </body>
</html>`
}

export function htmlArtifactPath(value: string): string | undefined {
  const input = value.trim()
  if (!input || /^[a-z][a-z\d+.-]*:\/\//i.test(input) || /^file:/i.test(input) || input.startsWith("//")) {
    return undefined
  }
  const path = input.split(/[?#]/, 1)[0]?.trim()
  if (!path || !/\.html?$/i.test(path)) return undefined
  return path
}

export function embeddedHtmlArtifactPath(value: string, search: string): string | undefined {
  if (!isBuildingAIEmbedSearch(search)) return undefined
  return htmlArtifactPath(value)
}

export function workspaceHtmlArtifactPath(value: string, directory: string): string | undefined {
  const path = htmlArtifactPath(value)
  if (!path) return undefined
  const workspace = directory
    .replace(/[/\\]+$/, "")
    .split(/[/\\]/)
    .at(-1)
  if (!workspace) return path
  const prefix = `${workspace}/`
  return path.replaceAll("\\", "/").startsWith(prefix) ? path.slice(prefix.length) : path
}

function normalizedRelativeReportPath(value: string, artifactRoot: string): string | undefined {
  const path = htmlArtifactPath(value)?.replaceAll("\\", "/")
  if (!path) return undefined

  const root = artifactRoot.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "")
  if (!root) return undefined
  const rootSegments = root.split("/").filter(Boolean)
  const pathSegments = path.split("/").filter(Boolean)
  if (pathSegments.some((segment) => segment === "." || segment === ".." || segment.includes("\0"))) {
    return undefined
  }

  let relative = pathSegments
  const marker = pathSegments.findIndex((_, index) =>
    rootSegments.every((segment, offset) => pathSegments[index + offset] === segment),
  )
  if (marker >= 0) {
    relative = pathSegments.slice(marker + rootSegments.length)
  } else if (pathSegments.includes(rootSegments[0] ?? "")) {
    return undefined
  } else if (/^(?:[a-z]:)?\//i.test(path)) {
    return undefined
  }

  if (relative.length === 0 || !/\.html?$/i.test(relative.at(-1) ?? "")) return undefined
  return relative.join("/")
}

export function buildBuildingAIReportUrl(value: string, search: string): string | undefined {
  if (!isBuildingAIEmbedSearch(search)) return undefined
  const params = new URLSearchParams(search)
  const reportBaseValue = params.get("buildingaiReportBase")?.trim()
  const artifactRoot = params.get("buildingaiArtifactRoot")?.trim()
  if (!reportBaseValue || !artifactRoot) return undefined

  let reportBase: URL
  try {
    reportBase = new URL(reportBaseValue)
  } catch {
    return undefined
  }
  if (!["http:", "https:"].includes(reportBase.protocol) || reportBase.username || reportBase.password) {
    return undefined
  }
  reportBase.search = ""
  reportBase.hash = ""
  if (!reportBase.pathname.endsWith("/")) reportBase.pathname += "/"

  const relative = normalizedRelativeReportPath(value, artifactRoot)
  if (!relative) return undefined
  const encoded = relative.split("/").map(encodeURIComponent).join("/")
  return `${reportBase.toString()}${encoded}`
}

export function buildHtmlArtifactPreviewShell(input: {
  path: string
  html: string
  labels: HtmlArtifactPreviewLabels
}) {
  const report = escapeHtml(reportDocument(input.html))
  const body = `<header>
      <strong>${escapeHtml(input.path)}</strong>
      <span>${escapeHtml(input.labels.limitation)}</span>
    </header>
    <iframe title="${escapeHtml(input.path)}" sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${report}"></iframe>`
  return trustedPage({
    title: input.path,
    body,
    csp: reportCsp.replace("frame-src 'none'", "frame-src 'self'"),
  })
}

function buildHtmlArtifactLoadingPage(input: { path: string; labels: HtmlArtifactPreviewLabels }) {
  return trustedPage({
    title: input.labels.loading,
    body: `<main><h1>${escapeHtml(input.labels.loading)}</h1><code>${escapeHtml(input.path)}</code></main>`,
  })
}

export function buildHtmlArtifactErrorPage(input: { path: string; error: string; labels: HtmlArtifactPreviewLabels }) {
  return trustedPage({
    title: input.labels.failed,
    body: `<main><h1>${escapeHtml(input.labels.failed)}</h1><code>${escapeHtml(input.path)}</code><p>${escapeHtml(input.error)}</p></main>`,
  })
}

function writePage(tab: PreviewTab, html: string) {
  tab.document.open()
  tab.document.write(html)
  tab.document.close()
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object" && "data" in error) {
    const data = error.data
    if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
      return data.message
    }
  }
  return typeof error === "string" ? error : "The workspace file could not be read."
}

export async function openHtmlArtifactPreview(
  input: OpenHtmlArtifactPreviewInput,
): Promise<"opened" | "failed" | "blocked"> {
  const openWindow = input.openWindow ?? (() => window.open("", "_blank"))
  const tab = openWindow()
  if (!tab) return "blocked"

  tab.opener = null
  writePage(tab, buildHtmlArtifactLoadingPage({ path: input.path, labels: input.labels }))

  const path = htmlArtifactPath(input.path)
  if (!path) {
    writePage(
      tab,
      buildHtmlArtifactErrorPage({
        path: input.path,
        error: "The selected path is not an HTML file.",
        labels: input.labels,
      }),
    )
    return "failed"
  }

  try {
    const file = await input.readFile(path)
    if (!file || file.type !== "text" || typeof file.content !== "string" || file.content.length === 0) {
      throw new Error("The selected file is missing or is not a text HTML file.")
    }

    const shell = buildHtmlArtifactPreviewShell({ path, html: file.content, labels: input.labels })
    const createObjectURL = input.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob))
    const revokeObjectURL = input.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url))
    const scheduleCleanup =
      input.scheduleCleanup ?? ((callback: () => void, delay: number) => setTimeout(callback, delay))
    const url = createObjectURL(new Blob([shell], { type: "text/html;charset=utf-8" }))
    let navigated = false
    let revoked = false
    const cleanup = () => {
      if (!navigated || revoked) return
      revoked = true
      revokeObjectURL(url)
    }
    tab.addEventListener?.("load", cleanup, { once: true })
    tab.location.replace(url)
    navigated = true
    scheduleCleanup(cleanup, 60_000)
    return "opened"
  } catch (error) {
    writePage(tab, buildHtmlArtifactErrorPage({ path, error: errorMessage(error), labels: input.labels }))
    return "failed"
  }
}
