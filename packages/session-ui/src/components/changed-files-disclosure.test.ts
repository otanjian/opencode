import { describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { createChangedFilesDisclosure } from "./changed-files-disclosure"

describe("createChangedFilesDisclosure", () => {
  test("starts collapsed and toggles open and closed", () => {
    createRoot((dispose) => {
      const disclosure = createChangedFilesDisclosure("changed-files-test")

      expect(disclosure.contentId).toBe("changed-files-test")
      expect(disclosure.expanded()).toBe(false)

      disclosure.toggle()
      expect(disclosure.expanded()).toBe(true)

      disclosure.toggle()
      expect(disclosure.expanded()).toBe(false)
      dispose()
    })
  })
})
