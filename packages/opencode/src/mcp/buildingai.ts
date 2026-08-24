import type { ConfigV1 } from "@opencode-ai/core/v1/config/config"

const BOWI_SERVER_NAME = "bowi"

type ManagedEnvironment = {
  [name: string]: string | undefined
  BUILDINGAI_API_URL?: string
  BUILDINGAI_OPENCODE_INTERNAL_KEY?: string
}

function managedBowiMcp(env: ManagedEnvironment) {
  const apiUrl = env.BUILDINGAI_API_URL?.trim()
  const key = env.BUILDINGAI_OPENCODE_INTERNAL_KEY?.trim()
  if (!apiUrl || !key) return
  return {
    type: "remote" as const,
    url: `${apiUrl.replace(/\/+$/, "")}/api/mcp/bowi-mcp`,
    enabled: true,
    oauth: false as const,
    timeout: 30_000,
  }
}

export function buildingAIManagedHeaders(server: string, url: string, env: ManagedEnvironment) {
  if (server !== BOWI_SERVER_NAME) return
  const managed = managedBowiMcp(env)
  if (!managed || managed.url !== url) return
  return { "x-buildingai-opencode-key": env.BUILDINGAI_OPENCODE_INTERNAL_KEY!.trim() }
}

export function withBuildingAIBowiMcp(config: ConfigV1.Info, env: ManagedEnvironment): ConfigV1.Info {
  const bowi = managedBowiMcp(env)
  if (!bowi) return config
  return {
    ...config,
    mcp: {
      ...config.mcp,
      [BOWI_SERVER_NAME]: bowi,
    },
  }
}

export function buildingAIInvocationMeta(server: string, sessionId: string, callId?: string) {
  if (server !== BOWI_SERVER_NAME) return
  return {
    buildingai: {
      sessionId,
      ...(callId ? { callId } : {}),
    },
  }
}
