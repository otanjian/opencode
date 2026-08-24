import { createSignal, createUniqueId } from "solid-js"

export function createChangedFilesDisclosure(contentId?: string) {
  const [expanded, setExpanded] = createSignal(false)

  return {
    contentId: contentId ?? `changed-files-${createUniqueId()}`,
    expanded,
    toggle: () => setExpanded((value) => !value),
  }
}
