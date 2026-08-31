import { describe, expect, test } from "bun:test"
import { groupAssistantMessages, groupAssistantTurn, groupParts } from "./message-part-groups"
import { readPartText } from "./message-part-text"

describe("readPartText", () => {
  test("returns empty string when accum is undefined and part text is undefined", () => {
    expect(readPartText(undefined, { id: "part_1" })).toBe("")
  })

  test("returns trimmed part text when accum is undefined", () => {
    expect(readPartText(undefined, { id: "part_1", text: "  hello  " })).toBe("hello")
  })

  test("prefers accum value over part text when accum has a hit", () => {
    expect(readPartText({ part_1: "  from accum  " }, { id: "part_1", text: "from part" })).toBe("from accum")
  })

  test("falls back to part text when accum misses", () => {
    expect(readPartText({ other_part: "ignored" }, { id: "part_1", text: "  from part  " })).toBe("from part")
  })

  test("returns empty string for whitespace-only text", () => {
    expect(readPartText(undefined, { id: "part_1", text: "   \n\t  " })).toBe("")
  })

  test("trims leading and trailing whitespace", () => {
    expect(readPartText(undefined, { id: "part_1", text: "\n  body  \n" })).toBe("body")
  })
})

describe("groupParts", () => {
  test("groups reasoning and completed tools in BuildingAI embed mode", () => {
    const parts = [
      { messageID: "assistant", part: { id: "reasoning-1", type: "reasoning", text: "first" } },
      { messageID: "assistant", part: { id: "reasoning-2", type: "reasoning", text: "second" } },
      {
        messageID: "assistant",
        part: {
          id: "tool-1",
          type: "tool",
          tool: "shell",
          state: { status: "completed", input: {}, output: "done" },
        },
      },
      {
        messageID: "assistant",
        part: {
          id: "tool-2",
          type: "tool",
          tool: "read",
          state: { status: "completed", input: {}, output: "done" },
        },
      },
    ] as any

    expect(groupParts(parts, { buildingAIEmbed: true }).map((item) => item.type)).toEqual(["reasoning", "tools"])
  })

  test("keeps the new groups opt-in and leaves running tools standalone", () => {
    const parts = [
      { messageID: "assistant", part: { id: "reasoning-1", type: "reasoning", text: "first" } },
      {
        messageID: "assistant",
        part: { id: "tool-running", type: "tool", tool: "shell", state: { status: "running", input: {} } },
      },
    ] as any

    expect(groupParts(parts).map((item) => item.type)).toEqual(["part", "part"])
    expect(groupParts(parts, { buildingAIEmbed: true }).map((item) => item.type)).toEqual(["reasoning", "part"])
  })
})

describe("groupAssistantMessages", () => {
  test("keeps all parts from one assistant message in one message-level group", () => {
    const parts = [
      { messageID: "assistant-1", part: { id: "reasoning", type: "reasoning", text: "thinking" } },
      { messageID: "assistant-1", part: { id: "tool", type: "tool", tool: "shell", state: { status: "completed" } } },
      { messageID: "assistant-1", part: { id: "text", type: "text", text: "answer" } },
      { messageID: "assistant-2", part: { id: "text-2", type: "text", text: "next" } },
    ] as any

    expect(groupAssistantMessages(parts)).toEqual([
      {
        key: "assistant-message:assistant-1",
        type: "assistant-message",
        messageID: "assistant-1",
        refs: [
          { messageID: "assistant-1", partID: "reasoning" },
          { messageID: "assistant-1", partID: "tool" },
          { messageID: "assistant-1", partID: "text" },
        ],
      },
      {
        key: "assistant-message:assistant-2",
        type: "assistant-message",
        messageID: "assistant-2",
        refs: [{ messageID: "assistant-2", partID: "text-2" }],
      },
    ])
  })
})

describe("groupAssistantTurn", () => {
  test("aggregates assistant protocol messages into one user-turn group", () => {
    const parts = [
      { messageID: "assistant-1", part: { id: "reasoning", type: "reasoning", text: "thinking" } },
      { messageID: "assistant-2", part: { id: "tool", type: "tool", tool: "shell", state: { status: "completed" } } },
      { messageID: "assistant-2", part: { id: "text", type: "text", text: "answer" } },
    ] as any

    expect(groupAssistantTurn(parts)).toEqual([
      {
        key: "assistant-turn:assistant-1:reasoning",
        type: "assistant-message",
        messageID: "assistant-1",
        refs: [
          { messageID: "assistant-1", partID: "reasoning" },
          { messageID: "assistant-2", partID: "tool" },
          { messageID: "assistant-2", partID: "text" },
        ],
      },
    ])
  })
})
