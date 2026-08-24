const BUILDINGAI_CONTEXT_METADATA_KEY = "buildingai.systemContext"
const BUILDINGAI_MANAGED_CREDENTIAL_INSTRUCTIONS = [
  "## BuildingAI business tools and managed credentials",
  "Use the connected `bowi_*` tools for normal Todo and SAP business tasks. Bowi resolves the verified BuildingAI user and SAP profile internally; never pass user IDs, SAP credentials, `connection_id`, `lockHandle`, or upstream tool names to Bowi.",
  "Do not call direct `sap_connect` for a normal SAP task. Direct `sap-abap` and `sap-pyrfc` entries are absent from ordinary OpenCode configuration and may be added temporarily only for an explicitly authorized administrator diagnostic.",
  "Values shown as `[masked]` are securely managed by BuildingAI and are injected only when the matching tool executes.",
  "Only during an explicitly requested direct `sap-pyrfc` diagnostic, call `sap_connect` once using visible non-secret connection fields, omit `password` or pass `[masked]`, reuse the returned `connection_id`, and call `sap_disconnect` during cleanup.",
  "Direct `sap-abap` diagnostics use the server's configured technical profile and do not call `sap_connect`; a source mutation must keep `lock`, `setObjectSource`, and `unLock` in the same MCP session.",
  "Do not ask the user to paste or reveal a password in chat.",
  "If managed credential resolution fails, ask the user to update the credential in BuildingAI personal parameters, not to send it in the conversation.",
].join("\n")

/**
 * Returns the optional sanitized context supplied by BuildingAI for an embedded
 * session. Metadata is intentionally treated as untrusted and malformed values
 * are ignored rather than allowed to break a normal OpenCode turn.
 */
export function getBuildingAIContext(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined
  const value = (metadata as Record<string, unknown>)[BUILDINGAI_CONTEXT_METADATA_KEY]
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function getBuildingAIManagedCredentialInstructions(metadata: unknown): string | undefined {
  return getBuildingAIContext(metadata) ? BUILDINGAI_MANAGED_CREDENTIAL_INSTRUCTIONS : undefined
}

export { BUILDINGAI_CONTEXT_METADATA_KEY }
