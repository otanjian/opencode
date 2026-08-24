import type { UiI18nKey } from "@opencode-ai/ui/context/i18n"

export function reasoningStatusKey(streaming: boolean): UiI18nKey {
  return streaming ? "ui.sessionTurn.status.thinking" : "ui.sessionTurn.status.thinkingComplete"
}
