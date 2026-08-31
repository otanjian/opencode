export function isBuildingAIEmbedSearch(search: string): boolean {
  return new URLSearchParams(search).get("buildingaiEmbed") === "1"
}

export function resolveBuildingAIEmbedShell(search: string): {
  headerActions: boolean
  sidePanel: boolean
  mobileTabs: boolean
} {
  const visible = !isBuildingAIEmbedSearch(search)
  return { headerActions: visible, sidePanel: visible, mobileTabs: visible }
}

export function shouldShowBuildingAIReasoning(search: string, configured: boolean): boolean {
  return configured || isBuildingAIEmbedSearch(search)
}

export function resolveBuildingAIToolDefaults(
  search: string,
  configuredShell: boolean,
  configuredEdit: boolean,
): { shell: boolean; edit: boolean; collapseAll: boolean } {
  if (isBuildingAIEmbedSearch(search)) {
    return { shell: false, edit: false, collapseAll: true }
  }

  return { shell: configuredShell, edit: configuredEdit, collapseAll: false }
}
