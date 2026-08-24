import { describe, expect, test } from "bun:test"
import {
  buildingAIInvocationMeta,
  buildingAIManagedHeaders,
  withBuildingAIBowiMcp,
} from "@/mcp/buildingai"

describe("BuildingAI managed Bowi MCP", () => {
  test("does nothing unless the managed API URL and key are both present", () => {
    expect(withBuildingAIBowiMcp({}, {})).toEqual({})
    expect(withBuildingAIBowiMcp({}, { BUILDINGAI_API_URL: "http://localhost:4090" })).toEqual({})
  })

  test("adds the reserved bowi server without replacing other MCP servers", () => {
    const weather = { type: "remote" as const, url: "https://weather.example/mcp" }

    expect(
      withBuildingAIBowiMcp(
        { mcp: { weather } },
        {
          BUILDINGAI_API_URL: "http://127.0.0.1:4090/",
          BUILDINGAI_OPENCODE_INTERNAL_KEY: "managed-secret",
        },
      ),
    ).toEqual({
      mcp: {
        weather,
        bowi: {
          type: "remote",
          url: "http://127.0.0.1:4090/api/mcp/bowi-mcp",
          enabled: true,
          oauth: false,
          timeout: 30_000,
        },
      },
    })
    expect(JSON.stringify(withBuildingAIBowiMcp({}, {
      BUILDINGAI_API_URL: "http://127.0.0.1:4090",
      BUILDINGAI_OPENCODE_INTERNAL_KEY: "managed-secret",
    }))).not.toContain("managed-secret")
  })

  test("the reserved bowi entry cannot be redirected by workspace config", () => {
    const result = withBuildingAIBowiMcp(
      { mcp: { bowi: { type: "remote", url: "https://untrusted.example/mcp" } } },
      {
        BUILDINGAI_API_URL: "https://building.example/base/",
        BUILDINGAI_OPENCODE_INTERNAL_KEY: "managed-secret",
      },
    )

    expect(result.mcp?.bowi).toMatchObject({
      url: "https://building.example/base/api/mcp/bowi-mcp",
    })
  })

  test("injects the managed key only at the canonical transport boundary", () => {
    const env = {
      BUILDINGAI_API_URL: "https://building.example/base/",
      BUILDINGAI_OPENCODE_INTERNAL_KEY: "managed-secret",
    }
    expect(
      buildingAIManagedHeaders("bowi", "https://building.example/base/api/mcp/bowi-mcp", env),
    ).toEqual({ "x-buildingai-opencode-key": "managed-secret" })
    expect(
      buildingAIManagedHeaders("weather", "https://building.example/base/api/mcp/bowi-mcp", env),
    ).toBeUndefined()
    expect(buildingAIManagedHeaders("bowi", "https://untrusted.example/mcp", env)).toBeUndefined()
  })

  test("creates hidden invocation metadata only for the reserved bowi server", () => {
    expect(buildingAIInvocationMeta("weather", "ses_1", "call_1")).toBeUndefined()
    expect(buildingAIInvocationMeta("bowi-shadow", "ses_1", "call_1")).toBeUndefined()
    expect(buildingAIInvocationMeta("bowi", "ses_1", "call_1")).toEqual({
      buildingai: { sessionId: "ses_1", callId: "call_1" },
    })
  })
})
