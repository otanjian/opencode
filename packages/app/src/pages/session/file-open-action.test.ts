import { describe, expect, test } from "bun:test"
import { absoluteProjectPath, resolveFileOpenAction } from "./file-open-action"

describe("resolveFileOpenAction", () => {
  test("routes media files to review diff preview", () => {
    expect(resolveFileOpenAction("assets/logo.png").kind).toBe("review-diff")
    expect(resolveFileOpenAction("audio/track.mp3").kind).toBe("review-diff")
  })

  test("routes binary files to external open", () => {
    expect(resolveFileOpenAction("resume/report.pdf").kind).toBe("external")
    expect(resolveFileOpenAction("archive.zip").kind).toBe("external")
  })

  test("routes text files to review diff preview", () => {
    expect(resolveFileOpenAction("src/index.ts").kind).toBe("review-diff")
    expect(resolveFileOpenAction("notes.md").kind).toBe("review-diff")
    expect(resolveFileOpenAction("page.html").kind).toBe("review-diff")
  })
})

describe("absoluteProjectPath", () => {
  test("joins directory and relative path", () => {
    expect(absoluteProjectPath("/tmp/project", "resume/report.pdf")).toBe("/tmp/project/resume/report.pdf")
    expect(absoluteProjectPath("/tmp/project/", "/resume/report.pdf")).toBe("/tmp/project/resume/report.pdf")
  })
})
