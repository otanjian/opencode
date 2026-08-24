import { describe, expect, test } from "bun:test"
import {
  isBuildingAIEmbedSearch,
  resolveBuildingAIEmbedShell,
  resolveBuildingAIToolDefaults,
  shouldShowBuildingAIReasoning,
} from "./buildingai-embed"

describe("BuildingAI OpenCode embed mode", () => {
  test("publishes the managed Web UI contract in the application HTML", async () => {
    const html = await Bun.file(new URL("../../index.html", import.meta.url)).text()

    expect(html).toContain('<meta name="buildingai-web-ui-contract" content="buildingai-embed-shell-v1" />')
  })

  test("recognizes the explicit embed marker", () => {
    expect(isBuildingAIEmbedSearch("?buildingaiEmbed=1")).toBe(true)
    expect(isBuildingAIEmbedSearch("?directory=%2Fworkspace&buildingaiEmbed=1")).toBe(true)
  })

  test("does not affect direct OpenCode routes", () => {
    expect(isBuildingAIEmbedSearch("")).toBe(false)
    expect(isBuildingAIEmbedSearch("?buildingaiEmbed=0")).toBe(false)
    expect(isBuildingAIEmbedSearch("?embed=1")).toBe(false)
  })

  test("hides redundant shell controls only in BuildingAI embeds", () => {
    expect(resolveBuildingAIEmbedShell("?buildingaiEmbed=1")).toEqual({
      headerActions: false,
      sidePanel: false,
    })
    expect(resolveBuildingAIEmbedShell("")).toEqual({
      headerActions: true,
      sidePanel: true,
    })
    expect(resolveBuildingAIEmbedShell("?buildingaiEmbed=0")).toEqual({
      headerActions: true,
      sidePanel: true,
    })
  })

  test("forces structured reasoning visibility only for BuildingAI embeds", () => {
    expect(shouldShowBuildingAIReasoning("?buildingaiEmbed=1", false)).toBe(true)
    expect(shouldShowBuildingAIReasoning("", false)).toBe(false)
    expect(shouldShowBuildingAIReasoning("", true)).toBe(true)
  })

  test("collapses shell and edit tool details only in the BuildingAI embed", () => {
    expect(resolveBuildingAIToolDefaults("?buildingaiEmbed=1", true, true)).toEqual({
      shell: false,
      edit: false,
      collapseAll: true,
    })
    expect(resolveBuildingAIToolDefaults("", true, true)).toEqual({
      shell: true,
      edit: true,
      collapseAll: false,
    })
    expect(resolveBuildingAIToolDefaults("?buildingaiEmbed=0", false, false)).toEqual({
      shell: false,
      edit: false,
      collapseAll: false,
    })
  })
})
