import { useI18n } from "@opencode-ai/ui/context/i18n"
import { Markdown } from "../../components/markdown"
import "../../components/markdown.css"
import type { ReviewPreviewKind } from "../../pierre/media"
import { Show, Switch, Match } from "solid-js"

export function SessionReviewRenderPreviewV2(props: {
  kind: ReviewPreviewKind
  file: string
  content: string
  loading?: boolean
  error?: string
}) {
  const i18n = useI18n()

  return (
    <div data-slot="session-review-v2-render-preview">
      <Show when={props.loading}>
        <div class="px-6 py-4 text-12-regular text-text-weak">
          {i18n.t("common.loading")}
          {i18n.t("common.loading.ellipsis")}
        </div>
      </Show>
      <Show when={!props.loading && props.error}>
        <div class="px-6 py-4 text-12-regular text-text-weak">{props.error}</div>
      </Show>
      <Show when={!props.loading && !props.error}>
        <Switch>
          <Match when={props.kind === "markdown"}>
            <Markdown text={props.content} cacheKey={props.file} class="px-6 py-4" />
          </Match>
          <Match when={props.kind === "html"}>
            <iframe
              data-slot="session-review-v2-html-preview"
              sandbox=""
              srcdoc={props.content}
              title={props.file}
            />
          </Match>
        </Switch>
      </Show>
    </div>
  )
}
