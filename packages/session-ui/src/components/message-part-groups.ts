import type { Part as PartType, ToolPart } from "@opencode-ai/sdk/v2"

const CONTEXT_GROUP_TOOLS = new Set(["read", "glob", "grep", "list"])

export type PartRef = {
  messageID: string
  partID: string
}

export type PartGroup =
  | { key: string; type: "part"; ref: PartRef }
  | { key: string; type: "context"; refs: PartRef[] }
  | { key: string; type: "reasoning" | "tools"; refs: PartRef[] }
  | { key: string; type: "assistant-message"; messageID: string; refs: PartRef[] }

function sameRef(a: PartRef, b: PartRef) {
  return a.messageID === b.messageID && a.partID === b.partID
}

function sameGroup(a: PartGroup, b: PartGroup) {
  if (a === b) return true
  if (a.key !== b.key || a.type !== b.type) return false
  if (a.type === "part") return b.type === "part" && sameRef(a.ref, b.ref)
  if (a.type === "assistant-message") {
    return (
      b.type === "assistant-message" &&
      a.messageID === b.messageID &&
      a.refs.length === b.refs.length &&
      a.refs.every((ref, i) => sameRef(ref, b.refs[i]!))
    )
  }
  if (b.type !== "context" && b.type !== "reasoning" && b.type !== "tools") return false
  return a.refs.length === b.refs.length && a.refs.every((ref, i) => sameRef(ref, b.refs[i]!))
}

export function sameGroups(a: readonly PartGroup[] | undefined, b: readonly PartGroup[] | undefined) {
  if (a === b) return true
  if (!a || !b || a.length !== b.length) return false
  return a.every((item, i) => sameGroup(item, b[i]!))
}

function isContextGroupTool(part: PartType): part is ToolPart {
  return part.type === "tool" && CONTEXT_GROUP_TOOLS.has(part.tool)
}

function isCompletedTool(part: PartType): part is ToolPart {
  if (part.type !== "tool" || part.tool === "question") return false
  return part.state.status === "completed" || part.state.status === "error"
}

export function groupParts(parts: { messageID: string; part: PartType }[], options?: { buildingAIEmbed?: boolean }) {
  const result: PartGroup[] = []
  let start = -1
  let groupType: "context" | "reasoning" | "tools" | undefined

  const flush = (end: number) => {
    if (start < 0) return
    const first = parts[start]
    const last = parts[end]
    if (!first || !last) {
      start = -1
      groupType = undefined
      return
    }
    result.push({
      key: `${groupType ?? "context"}:${first.part.id}`,
      type: groupType ?? "context",
      refs: parts.slice(start, end + 1).map((item) => ({ messageID: item.messageID, partID: item.part.id })),
    })
    start = -1
    groupType = undefined
  }

  parts.forEach((item, index) => {
    const type = options?.buildingAIEmbed
      ? item.part.type === "reasoning"
        ? "reasoning"
        : isCompletedTool(item.part)
          ? "tools"
          : isContextGroupTool(item.part)
            ? "context"
            : undefined
      : isContextGroupTool(item.part)
        ? "context"
        : undefined

    if (type) {
      if (start < 0) {
        start = index
        groupType = type
      } else if (groupType !== type) {
        flush(index - 1)
        start = index
        groupType = type
      }
      return
    }

    flush(index - 1)
    result.push({
      key: `part:${item.messageID}:${item.part.id}`,
      type: "part",
      ref: { messageID: item.messageID, partID: item.part.id },
    })
  })

  flush(parts.length - 1)
  return result
}

export function groupAssistantMessages(parts: { messageID: string; part: PartType }[]): PartGroup[] {
  const result: PartGroup[] = []
  let current: { messageID: string; refs: PartRef[] } | undefined

  for (const item of parts) {
    if (!current || current.messageID !== item.messageID) {
      current = { messageID: item.messageID, refs: [] }
      result.push({
        key: `assistant-message:${item.messageID}`,
        type: "assistant-message",
        messageID: item.messageID,
        refs: current.refs,
      })
    }
    current.refs.push({ messageID: item.messageID, partID: item.part.id })
  }

  return result
}

export function groupAssistantTurn(parts: { messageID: string; part: PartType }[]): PartGroup[] {
  const first = parts[0]
  if (!first) return []
  return [
    {
      key: `assistant-turn:${first.messageID}:${first.part.id}`,
      type: "assistant-message",
      messageID: first.messageID,
      refs: parts.map((item) => ({ messageID: item.messageID, partID: item.part.id })),
    },
  ]
}
