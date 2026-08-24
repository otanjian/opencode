import { describe, expect, test } from "bun:test"
import { reasoningStatusKey } from "./reasoning-status"

describe("reasoningStatusKey", () => {
  test("uses the in-progress label while the assistant message is streaming", () => {
    expect(reasoningStatusKey(true)).toBe("ui.sessionTurn.status.thinking")
  })

  test("uses the completed label after the assistant message completes", () => {
    expect(reasoningStatusKey(false)).toBe("ui.sessionTurn.status.thinkingComplete")
  })
})
