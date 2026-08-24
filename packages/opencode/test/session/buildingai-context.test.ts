import { expect, test } from "bun:test"
import {
  BUILDINGAI_CONTEXT_METADATA_KEY,
  getBuildingAIContext,
  getBuildingAIManagedCredentialInstructions,
} from "../../src/session/buildingai-context"

test("reads a valid BuildingAI session context", () => {
  expect(getBuildingAIContext({ [BUILDINGAI_CONTEXT_METADATA_KEY]: "user=S2385" })).toBe("user=S2385")
})

test("ignores missing and malformed metadata", () => {
  expect(getBuildingAIContext(undefined)).toBeUndefined()
  expect(getBuildingAIContext({})).toBeUndefined()
  expect(getBuildingAIContext({ [BUILDINGAI_CONTEXT_METADATA_KEY]: 42 })).toBeUndefined()
  expect(getBuildingAIContext([])).toBeUndefined()
})

test("adds managed credential policy for BuildingAI sessions", () => {
  const instruction = getBuildingAIManagedCredentialInstructions({
    [BUILDINGAI_CONTEXT_METADATA_KEY]: "sap password=[masked]",
  })
  expect(instruction).toContain("normal Todo and SAP business tasks")
  expect(instruction).toContain("`bowi_*`")
  expect(instruction).toContain("Do not call direct `sap_connect`")
  expect(instruction).toContain("absent from ordinary OpenCode configuration")
  expect(instruction).toContain("reuse the returned `connection_id`")
  expect(instruction).toContain("`lock`, `setObjectSource`, and `unLock` in the same MCP session")
  expect(instruction).toContain("Do not ask the user")
  expect(instruction).toContain("BuildingAI personal parameters")
  expect(getBuildingAIManagedCredentialInstructions(undefined)).toBeUndefined()
})
