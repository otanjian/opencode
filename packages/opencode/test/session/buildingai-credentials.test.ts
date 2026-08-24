import { describe, expect, it } from "bun:test"
import {
  adaptBuildingAISapConnectionSchema,
  isBuildingAISapConnectionTool,
  mergeBuildingAICredentialOverrides,
  resolveBuildingAICredentialOverrides,
} from "../../src/session/buildingai-credentials"

describe("BuildingAI credential bridge", () => {
  it("recognizes SAP connection tools", () => {
    expect(isBuildingAISapConnectionTool("sap-pyrfc_sap_connect")).toBe(true)
    expect(isBuildingAISapConnectionTool("sap_pyrfc_connect")).toBe(true)
    expect(isBuildingAISapConnectionTool("sap-pyrfc_run_query")).toBe(false)
  })

  it("merges the server override without replacing an explicit password", () => {
    expect(mergeBuildingAICredentialOverrides({ password: "[masked]" }, { password: "Rock123" })).toEqual({
      password: "Rock123",
    })
    expect(mergeBuildingAICredentialOverrides({ password: "UserProvided" }, { password: "Rock123" })).toEqual({
      password: "UserProvided",
    })
  })

  it("makes only the SAP connection password optional for the model", () => {
    const schema = {
      type: "object",
      required: ["user", "password"],
      properties: {
        user: { type: "string" },
        password: { type: "string", description: "SAP password" },
      },
    }
    expect(adaptBuildingAISapConnectionSchema("sap-pyrfc_sap_connect", schema)).toEqual({
      ...schema,
      required: ["user"],
      properties: {
        ...schema.properties,
        password: {
          ...schema.properties.password,
          description: expect.stringContaining("BuildingAI"),
        },
      },
    })
    expect(adaptBuildingAISapConnectionSchema("sap-pyrfc_run_query", schema)).toBe(schema)
  })

  it("requests the override only from the internal API and fails open", async () => {
    let request: Request | undefined
    const overrides = await resolveBuildingAICredentialOverrides({
      sessionId: "ses_1",
      toolName: "sap_connect",
      args: { password: "[masked]" },
      fetchImpl: async (input, init) => {
        request = new Request(input, init)
        return new Response(JSON.stringify({ overrides: { password: "Rock123" } }), { status: 200 })
      },
    })
    expect(overrides).toEqual({ password: "Rock123" })
    expect(request?.url).toContain("/api/internal-opencode/credentials")
    expect(request?.headers.get("x-buildingai-opencode-key")).toBeTruthy()

    const wrapped = await resolveBuildingAICredentialOverrides({
      sessionId: "ses_1",
      toolName: "sap_connect",
      args: { password: "[masked]" },
      fetchImpl: async () =>
        new Response(JSON.stringify({ data: { overrides: { password: "Rock123" } } }), { status: 200 }),
    })
    expect(wrapped).toEqual({ password: "Rock123" })

    const unavailable = await resolveBuildingAICredentialOverrides({
      sessionId: "ses_1",
      toolName: "sap_connect",
      args: {},
      fetchImpl: async () => {
        throw new Error("offline")
      },
    })
    expect(unavailable).toEqual({})

    let called = false
    const explicit = await resolveBuildingAICredentialOverrides({
      sessionId: "ses_1",
      toolName: "sap_connect",
      args: { password: "UserProvided" },
      fetchImpl: async () => {
        called = true
        return new Response(JSON.stringify({ overrides: { password: "Rock123" } }), { status: 200 })
      },
    })
    expect(explicit).toEqual({})
    expect(called).toBe(false)
  })
})
