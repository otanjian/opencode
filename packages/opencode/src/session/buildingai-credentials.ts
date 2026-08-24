const DEFAULT_BUILDINGAI_API_URL = "http://127.0.0.1:4090"
const DEFAULT_BUILDINGAI_INTERNAL_KEY = "buildingai-local-opencode"
const SAP_CONNECTION_TOOL_PATTERN = /(?:^|[_-])sap(?:[_-]pyrfc)?[_-](?:sap[_-])?connect$/i
const PASSWORD_KEY_PATTERN = /^(?:password|passwd|pwd|sap[_-]?password|密码)$/i
const MASKED_CREDENTIAL_PATTERN = /^(?:\[masked\]|\[redacted\]|<masked>|\*{3,})$/i
const MANAGED_PASSWORD_DESCRIPTION =
  "Optional for BuildingAI sessions. Omit this value or pass [masked]; BuildingAI securely injects the configured password when the tool executes."

type JsonSchemaRecord = Record<string, unknown> & {
  required?: unknown
  properties?: unknown
}

export function isBuildingAISapConnectionTool(toolName: string): boolean {
  return SAP_CONNECTION_TOOL_PATTERN.test(toolName.trim())
}

export function isBuildingAIMaskedCredential(value: unknown): boolean {
  return value == null || (typeof value === "string" && (!value.trim() || MASKED_CREDENTIAL_PATTERN.test(value.trim())))
}

export function adaptBuildingAISapConnectionSchema<T extends JsonSchemaRecord>(toolName: string, schema: T): T {
  if (!isBuildingAISapConnectionTool(toolName)) return schema
  if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) return schema

  const properties = schema.properties as Record<string, unknown>
  const passwordKey = Object.keys(properties).find((key) => PASSWORD_KEY_PATTERN.test(key))
  if (!passwordKey) return schema
  const passwordSchema = properties[passwordKey]
  const description =
    passwordSchema && typeof passwordSchema === "object" && !Array.isArray(passwordSchema)
      ? (passwordSchema as Record<string, unknown>).description
      : undefined
  const required = Array.isArray(schema.required)
    ? schema.required.filter((key) => key !== passwordKey)
    : schema.required

  return {
    ...schema,
    ...(required === undefined ? {} : { required }),
    properties: {
      ...properties,
      [passwordKey]: {
        ...(passwordSchema && typeof passwordSchema === "object" && !Array.isArray(passwordSchema)
          ? passwordSchema
          : {}),
        description:
          typeof description === "string" && description.trim()
            ? `${description.trim()} ${MANAGED_PASSWORD_DESCRIPTION}`
            : MANAGED_PASSWORD_DESCRIPTION,
      },
    },
  }
}

export function mergeBuildingAICredentialOverrides(
  args: Record<string, unknown>,
  overrides: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!overrides || Object.keys(overrides).length === 0) return args
  const result = { ...args }
  for (const [key, value] of Object.entries(overrides)) {
    const current = result[key]
    if (isBuildingAIMaskedCredential(current)) result[key] = value
  }
  return result
}

export async function resolveBuildingAICredentialOverrides(input: {
  sessionId: string
  toolName: string
  args: Record<string, unknown>
  fetchImpl?: (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>
}): Promise<Record<string, unknown>> {
  if (!isBuildingAISapConnectionTool(input.toolName)) return {}
  const explicitPassword = Object.entries(input.args).find(([key, value]) =>
    PASSWORD_KEY_PATTERN.test(key) && !isBuildingAIMaskedCredential(value),
  )
  if (explicitPassword) return {}

  const apiUrl = process.env.BUILDINGAI_API_URL?.trim() || DEFAULT_BUILDINGAI_API_URL
  const internalKey = process.env.BUILDINGAI_OPENCODE_INTERNAL_KEY?.trim() || DEFAULT_BUILDINGAI_INTERNAL_KEY
  const fetchImpl = input.fetchImpl ?? fetch
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2_000)
  try {
    const response = await fetchImpl(`${apiUrl.replace(/\/$/, "")}/api/internal-opencode/credentials`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-buildingai-opencode-key": internalKey,
      },
      body: JSON.stringify({
        sessionId: input.sessionId,
        toolName: input.toolName,
        arguments: input.args,
      }),
      signal: controller.signal,
    })
    if (!response.ok) return {}
    const body = (await response.json()) as {
      overrides?: unknown
      data?: { overrides?: unknown }
    }
    const overrides = body.overrides ?? body.data?.overrides
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return {}
    return overrides as Record<string, unknown>
  } catch {
    // Credential resolution is an enhancement to the normal MCP path. Never make an
    // unavailable BuildingAI bridge prevent unrelated or explicitly supplied calls.
    return {}
  } finally {
    clearTimeout(timeout)
  }
}
