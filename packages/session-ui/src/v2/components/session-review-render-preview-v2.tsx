import { useI18n } from "@opencode-ai/ui/context/i18n"
import { Markdown } from "../../components/markdown"
import "../../components/markdown.css"
import type { ReviewPreviewKind } from "../../pierre/media"
import { Show, Switch, Match, createEffect, createSignal, onCleanup } from "solid-js"

const htmlPreviewMinHeight = 480

function HtmlPreviewIframe(props: { content: string; file: string }) {
  const [height, setHeight] = createSignal(htmlPreviewMinHeight)
  let iframe: HTMLIFrameElement | undefined
  let observer: ResizeObserver | undefined
  let syncTimer: ReturnType<typeof setTimeout> | undefined

  const syncHeight = () => {
    const doc = iframe?.contentDocument
    if (!doc) return
    const next = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0, htmlPreviewMinHeight)
    setHeight(next)
  }

  const scheduleSync = () => {
    syncHeight()
    clearTimeout(syncTimer)
    syncTimer = setTimeout(syncHeight, 250)
  }

  const handleLoad = () => {
    scheduleSync()
    observer?.disconnect()
    const doc = iframe?.contentDocument
    if (!doc) return
    observer = new ResizeObserver(scheduleSync)
    observer.observe(doc.documentElement)
    if (doc.body) observer.observe(doc.body)
  }

  createEffect(() => {
    props.content
    setHeight(htmlPreviewMinHeight)
  })

  onCleanup(() => {
    observer?.disconnect()
    clearTimeout(syncTimer)
  })

  return (
    <iframe
      ref={iframe}
      data-slot="session-review-v2-html-preview"
      sandbox="allow-scripts allow-same-origin"
      srcdoc={props.content}
      title={props.file}
      style={{ height: `${height()}px` }}
      onLoad={handleLoad}
    />
  )
}

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
            <HtmlPreviewIframe content={props.content} file={props.file} />
          </Match>
        </Switch>
      </Show>
    </div>
  )
}
