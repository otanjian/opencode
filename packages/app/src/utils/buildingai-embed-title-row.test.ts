import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { isBuildingAIEmbedSearch } from "./buildingai-embed"

describe("BuildingAI embedded session title row contract", () => {
  test("recognizes only the explicit embed marker", () => {
    expect(isBuildingAIEmbedSearch("?buildingaiEmbed=1")).toBe(true)
    expect(isBuildingAIEmbedSearch("?buildingaiEmbed=0")).toBe(false)
  })

  test("gates the sticky title row in the message timeline instead of direct routes", () => {
    const source = readFileSync(resolve(import.meta.dir, "../pages/session/timeline/message-timeline.tsx"), "utf8")
    expect(source).toContain("const showSessionTitle = createMemo(() => showHeader() && !buildingAIEmbed)")
    expect(source).toContain("showSessionTitle() ? 64 : 0")
  })

  test("gates the responsive session/change tabs in the session shell", () => {
    const source = readFileSync(resolve(import.meta.dir, "../pages/session.tsx"), "utf8")
    expect(source).toContain("embedShell().mobileTabs &&")
    expect(source).toContain("<Show when={embedShell().mobileTabs && !!params.id && mobileTabsBottom()}>")
  })
})
