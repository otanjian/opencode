import { fileExtension, mediaKindFromPath } from "@opencode-ai/session-ui/pierre/media"

export type FileOpenAction = { kind: "review-diff" } | { kind: "editor-tab" } | { kind: "external" }

const binaryExtensions = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "zip",
  "tar",
  "gz",
  "bz2",
  "xz",
  "rar",
  "7z",
  "exe",
  "dll",
  "so",
  "dylib",
  "woff",
  "woff2",
  "eot",
  "sqlite",
  "db",
  "dmg",
  "iso",
  "bin",
])

export function resolveFileOpenAction(path: string): FileOpenAction {
  if (mediaKindFromPath(path)) return { kind: "review-diff" }
  if (binaryExtensions.has(fileExtension(path))) return { kind: "external" }
  return { kind: "review-diff" }
}

export function absoluteProjectPath(directory: string, relative: string) {
  const base = directory.replace(/[/\\]+$/, "")
  const file = relative.replace(/^[/\\]+/, "")
  return `${base}/${file}`
}
