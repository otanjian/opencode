import { getDirectory, getFilename } from "@opencode-ai/core/util/path"
import type { SelectedLineRange } from "@pierre/diffs"
import { DiffChanges } from "@opencode-ai/ui/v2/diff-changes-v2"
import { FileIcon } from "@opencode-ai/ui/file-icon"
import { useFileComponent } from "@opencode-ai/ui/context/file"
import { useI18n } from "@opencode-ai/ui/context/i18n"
import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { SegmentedControlItemV2, SegmentedControlV2 } from "@opencode-ai/ui/v2/segmented-control-v2"
import { mediaKindFromPath, reviewPreviewKind } from "../../pierre/media"
import { cloneSelectedLineRange, previewSelectedLines } from "../../pierre/selection-bridge"
import type { FileContent, SnapshotFileDiff, VcsFileDiff } from "@opencode-ai/sdk/v2"
import { createEffect, createMemo, createResource, onCleanup, Show, untrack } from "solid-js"
import { createStore } from "solid-js/store"
import { Dynamic } from "solid-js/web"
import { normalize, text, type ViewDiff } from "../../components/session-diff"
import type {
  SessionReviewComment,
  SessionReviewCommentActions,
  SessionReviewCommentDelete,
  SessionReviewCommentUpdate,
  SessionReviewDiffStyle,
  SessionReviewFocus,
  SessionReviewLineComment,
} from "../../components/session-review"
import type { SessionReviewExpandMode } from "./session-review-v2"
import { createLineCommentControllerV2 } from "./line-comment-annotations-v2"
import { LineCommentV2OverflowIcon } from "@opencode-ai/ui/v2/line-comment-v2"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { SessionReviewRenderPreviewV2 } from "./session-review-render-preview-v2"
import "./session-review-v2.css"

type ReviewDiff = (SnapshotFileDiff & { file: string }) | VcsFileDiff

export type SessionReviewFilePreviewV2Props = {
  file: string
  diff: ReviewDiff
  diffStyle: SessionReviewDiffStyle
  expandMode?: SessionReviewExpandMode
  readFile?: (path: string) => Promise<FileContent | undefined>
  onViewFile?: (path: string) => void
  onOpenExternal?: (path: string) => void
  onOpenInBrowser?: (path: string) => void
  canOpenExternal?: () => boolean
  onLineComment?: (comment: SessionReviewLineComment) => void
  onLineCommentUpdate?: (comment: SessionReviewCommentUpdate) => void
  onLineCommentDelete?: (comment: SessionReviewCommentDelete) => void
  lineCommentActions?: SessionReviewCommentActions
  comments?: SessionReviewComment[]
  focusedComment?: SessionReviewFocus | null
  onFocusedCommentChange?: (focus: SessionReviewFocus | null) => void
}

function statusLabel(status: ViewDiff["status"]) {
  if (status === "added") return "A"
  if (status === "deleted") return "D"
  return "M"
}

function statusType(status: ViewDiff["status"]) {
  if (status === "added") return "added"
  if (status === "deleted") return "deleted"
  return "modified"
}

function selectionSide(range: SelectedLineRange) {
  return range.endSide ?? range.side ?? "additions"
}

function selectionPreview(diff: ViewDiff, range: SelectedLineRange) {
  const side = selectionSide(range)
  const contents = text(diff, side)
  if (contents.length === 0) return undefined
  return previewSelectedLines(contents, range)
}

function ReviewCommentMenuV2(props: {
  labels: SessionReviewCommentActions
  onEdit: VoidFunction
  onDelete: VoidFunction
}) {
  return (
    <div onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <MenuV2 gutter={4}>
        <MenuV2.Trigger
          as="button"
          type="button"
          data-slot="line-comment-v2-overflow"
          aria-label={props.labels.moreLabel}
        >
          <LineCommentV2OverflowIcon />
        </MenuV2.Trigger>
        <MenuV2.Portal>
          <MenuV2.Content>
            <MenuV2.Item onSelect={props.onEdit}>{props.labels.editLabel}</MenuV2.Item>
            <MenuV2.Item onSelect={props.onDelete}>{props.labels.deleteLabel}</MenuV2.Item>
          </MenuV2.Content>
        </MenuV2.Portal>
      </MenuV2>
    </div>
  )
}

export function SessionReviewFilePreviewV2(props: SessionReviewFilePreviewV2Props) {
  const i18n = useI18n()
  const fileComponent = useFileComponent()
  let scrollRef: HTMLDivElement | undefined
  let focusToken = 0

  const [store, setStore] = createStore({
    selection: null as SelectedLineRange | null,
    commenting: null as SelectedLineRange | null,
    opened: null as string | null,
    viewMode: "diff" as "diff" | "preview",
  })

  const previewKind = createMemo(() => reviewPreviewKind(props.file))
  const supportsPreview = () => !!previewKind()

  createEffect(() => {
    props.file
    setStore("viewMode", previewKind() ? "preview" : "diff")
  })

  const [previewContent] = createResource(
    () => {
      if (store.viewMode !== "preview" || !previewKind() || !props.readFile) return
      return props.file
    },
    (file) =>
      props.readFile!(file).then((result) => {
        if (!result || result.type !== "text") return ""
        return result.content
      }),
  )

  const view = createMemo(() => ({
    ...normalize(props.diff),
    preloaded: "preloaded" in props.diff ? props.diff.preloaded : undefined,
  }))
  const diffCanRender = createMemo(() => view().additions !== 0 || view().deletions !== 0)
  const mediaKind = createMemo(() => mediaKindFromPath(props.file))
  const comments = createMemo(() => (props.comments ?? []).filter((comment) => comment.file === props.file))
  const commentedLines = createMemo(() => comments().map((comment) => comment.selection))
  const lineCommentsEnabled = () => props.onLineComment != null

  const commentsUi = createLineCommentControllerV2<SessionReviewComment>({
    comments,
    label: i18n.t("ui.lineComment.submit"),
    draftKey: () => props.file,
    state: {
      opened: () => store.opened,
      setOpened: (id) => setStore("opened", id),
      selected: () => store.selection,
      setSelected: (range) => setStore("selection", range),
      commenting: () => store.commenting,
      setCommenting: (range) => setStore("commenting", range),
    },
    getSide: selectionSide,
    onSubmit: ({ comment, selection }) => {
      props.onLineComment?.({
        file: props.file,
        selection,
        comment,
        preview: selectionPreview(view(), selection),
      })
    },
    onUpdate: ({ id, comment, selection }) => {
      props.onLineCommentUpdate?.({
        id,
        file: props.file,
        selection,
        comment,
        preview: selectionPreview(view(), selection),
      })
    },
    onDelete: (comment) => {
      props.onLineCommentDelete?.({
        id: comment.id,
        file: props.file,
      })
    },
    editSubmitLabel: props.lineCommentActions?.saveLabel,
    renderCommentActions: props.lineCommentActions
      ? (comment, controls) => (
          <ReviewCommentMenuV2 labels={props.lineCommentActions!} onEdit={controls.edit} onDelete={controls.remove} />
        )
      : undefined,
  })

  onCleanup(() => {
    focusToken++
  })

  createEffect(() => {
    const focus = props.focusedComment
    if (!focus) return
    if (focus.file !== props.file) {
      // The focused file has no mounted preview (e.g. not in the current diff
      // set); clear the focus anyway so it cannot hijack a later diff refresh.
      // V1 clears unconditionally the same way.
      untrack(() => {
        const token = focusToken
        requestAnimationFrame(() => {
          if (token !== focusToken) return
          props.onFocusedCommentChange?.(null)
        })
      })
      return
    }

    untrack(() => {
      setStore("opened", focus.id)

      const comment = (props.comments ?? []).find((item) => item.file === focus.file && item.id === focus.id)
      if (comment) setStore("selection", cloneSelectedLineRange(comment.selection))

      // The diff renders asynchronously, so poll for the comment anchor before
      // scrolling; clear the focus once handled so revisiting the file does not
      // re-open a stale comment (mirrors the v1 review behavior).
      focusToken++
      const token = focusToken
      const scrollTo = (attempt: number) => {
        if (token !== focusToken) return
        const anchor = scrollRef?.querySelector(`[data-comment-id="${focus.id}"]`)
        if (anchor instanceof HTMLElement) {
          anchor.scrollIntoView({ block: "center" })
          return
        }
        if (attempt >= 120) return
        requestAnimationFrame(() => scrollTo(attempt + 1))
      }
      requestAnimationFrame(() => scrollTo(0))
      requestAnimationFrame(() => {
        if (token !== focusToken) return
        props.onFocusedCommentChange?.(null)
      })
    })
  })

  const expandUnchanged = () => props.expandMode === "expand"
  const openFileLabel = () => i18n.t("ui.sessionReview.openFile")
  const showOpenFile = () => !!props.onViewFile && (diffCanRender() || !!mediaKind())
  const showOpenExternal = () => !!props.onOpenExternal && props.canOpenExternal?.() && !diffCanRender() && !mediaKind()
  const showOpenInBrowser = () => previewKind() === "html" && !!props.onOpenInBrowser && props.canOpenExternal?.()
  const showPreviewToggle = () => supportsPreview() && (diffCanRender() || previewKind())
  const showPreview = () => store.viewMode === "preview" && !!previewKind()
  const showDiff = () => !showPreview() && (diffCanRender() || !!mediaKind())

  const diffViewer = () => (
    <Dynamic
      component={fileComponent}
      mode="diff"
      fileDiff={view().fileDiff}
      preloadedDiff={view().preloaded}
      diffStyle={props.diffStyle}
      expandUnchanged={expandUnchanged()}
      hunkSeparators={view().fileDiff.isPartial ? "simple" : "line-info-basic"}
      enableLineSelection={lineCommentsEnabled()}
      enableGutterUtility={lineCommentsEnabled()}
      onLineSelected={(range: SelectedLineRange | null) => {
        if (!lineCommentsEnabled()) return
        commentsUi.onLineSelected(range)
      }}
      onLineSelectionEnd={(range: SelectedLineRange | null) => {
        if (!lineCommentsEnabled()) return
        commentsUi.onLineSelectionEnd(range)
      }}
      onLineNumberSelectionEnd={commentsUi.onLineNumberSelectionEnd}
      annotations={commentsUi.annotations()}
      renderAnnotation={commentsUi.renderAnnotation}
      renderGutterUtility={lineCommentsEnabled() ? commentsUi.renderGutterUtility : undefined}
      selectedLines={store.selection}
      commentedLines={commentedLines()}
      media={{
        mode: "auto",
        path: props.file,
        deleted: view().status === "deleted",
        readFile: view().status === "deleted" ? undefined : props.readFile,
      }}
    />
  )

  return (
    <>
      <div data-slot="session-review-v2-file-header">
        <div data-slot="session-review-v2-file-title">
          <div data-slot="session-review-v2-file-status" data-type={statusType(view().status)}>
            {statusLabel(view().status)}
          </div>
          <FileIcon node={{ path: props.file, type: "file" }} />
          <span data-slot="session-review-v2-file-name">{getFilename(props.file)}</span>
          <Show when={props.file.includes("/")}>
            <span data-slot="session-review-v2-file-path">{getDirectory(props.file)}</span>
          </Show>
          <Show when={showOpenInBrowser()}>
            <TooltipV2 openDelay={2000} value={i18n.t("ui.sessionReviewV2.openInBrowser")}>
              <IconButtonV2
                variant="ghost"
                size="small"
                aria-label={i18n.t("ui.sessionReviewV2.openInBrowser")}
                onClick={(event) => {
                  event.stopPropagation()
                  props.onOpenInBrowser?.(props.file)
                }}
                icon={<Icon name="open-link" />}
              />
            </TooltipV2>
          </Show>
          <Show when={showOpenFile()}>
            <TooltipV2 openDelay={2000} value={openFileLabel()}>
              <IconButtonV2
                variant="ghost"
                size="small"
                aria-label={openFileLabel()}
                onClick={(event) => {
                  event.stopPropagation()
                  props.onViewFile?.(props.file)
                }}
                icon={<Icon name="open-file" />}
              />
            </TooltipV2>
          </Show>
        </div>
        <div data-slot="session-review-v2-file-actions">
          <Show when={showPreviewToggle()}>
            <SegmentedControlV2
              value={store.viewMode}
              onChange={(value) => {
                if (value !== "diff" && value !== "preview") return
                setStore("viewMode", value)
              }}
              class="session-review-v2-segmented-control session-review-v2-segmented-control--text"
              aria-label={i18n.t("ui.sessionReviewV2.previewMode")}
            >
              <SegmentedControlItemV2 value="diff">{i18n.t("ui.sessionReviewV2.viewDiff")}</SegmentedControlItemV2>
              <SegmentedControlItemV2 value="preview">{i18n.t("ui.sessionReviewV2.viewPreview")}</SegmentedControlItemV2>
            </SegmentedControlV2>
          </Show>
          <DiffChanges changes={view()} />
        </div>
      </div>
      <div
        ref={(el) => {
          scrollRef = el
        }}
        data-slot="session-review-v2-diff-scroll"
      >
        <Show
          when={showPreview()}
          fallback={
            <Show
              when={showDiff()}
              fallback={
                <div data-slot="session-review-v2-empty">
                  <span class="text-12-regular text-text-weak">{i18n.t("ui.fileMedia.binary.title")}</span>
                  <Show when={showOpenExternal()}>
                    <ButtonV2 variant="outline" size="small" onClick={() => props.onOpenExternal?.(props.file)}>
                      {i18n.t("ui.sessionReviewV2.openWithDefaultApp")}
                    </ButtonV2>
                  </Show>
                </div>
              }
            >
              {diffViewer()}
            </Show>
          }
        >
          <SessionReviewRenderPreviewV2
            kind={previewKind()!}
            file={props.file}
            content={previewContent() ?? ""}
            loading={previewContent.loading}
            error={previewContent.error ? i18n.t("ui.fileMedia.state.error", { kind: previewKind()! }) : undefined}
          />
        </Show>
      </div>
    </>
  )
}
