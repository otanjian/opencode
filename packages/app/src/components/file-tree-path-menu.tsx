import { getFilename } from "@opencode-ai/core/util/path"
import { MenuV2 } from "@opencode-ai/ui/v2/menu-v2"
import { copyTextValue } from "@/pages/session/file-path-copy"
import { useLanguage } from "@/context/language"
import { splitProps, type JSX, type ParentProps } from "solid-js"

export function FileTreeRowContextMenu(
  props: ParentProps<{
    path: string
    as?: "button" | "div"
    role?: "button"
    tabIndex?: number
    onClick?: JSX.EventHandlerUnion<HTMLElement, MouseEvent>
    onDblClick?: JSX.EventHandlerUnion<HTMLElement, MouseEvent>
    onKeyDown?: JSX.EventHandlerUnion<HTMLElement, KeyboardEvent>
    class?: string
    classList?: JSX.HTMLAttributes<HTMLElement>["classList"]
    style?: string
    draggable?: boolean
    onDragStart?: JSX.EventHandlerUnion<HTMLElement, DragEvent>
    "data-slot"?: string
    "data-selected"?: string
    "data-highlighted"?: string
    "data-ignored"?: string
  }>,
) {
  const language = useLanguage()
  const [local, rest] = splitProps(props, [
    "path",
    "as",
    "role",
    "tabIndex",
    "onClick",
    "onDblClick",
    "onKeyDown",
    "class",
    "classList",
    "style",
    "draggable",
    "onDragStart",
    "data-slot",
    "data-selected",
    "data-highlighted",
    "data-ignored",
    "children",
  ])

  const copyPath = () => {
    void copyTextValue({
      text: local.path,
      copiedTitle: language.t("ui.sessionReviewV2.copyPath"),
    })
  }

  const copyFilename = () => {
    void copyTextValue({
      text: getFilename(local.path),
      copiedTitle: language.t("ui.sessionReviewV2.copyFilename"),
    })
  }

  return (
    <MenuV2.Context>
      <MenuV2.Context.Trigger
        as={local.as ?? "div"}
        role={local.role}
        tabIndex={local.tabIndex}
        data-slot={local["data-slot"]}
        data-selected={local["data-selected"]}
        data-highlighted={local["data-highlighted"]}
        data-ignored={local["data-ignored"]}
        data-file-tree-path={local.path}
        class={local.class}
        classList={local.classList}
        style={local.style}
        draggable={local.draggable}
        onDragStart={local.onDragStart}
        onClick={local.onClick}
        onDblClick={local.onDblClick}
        onKeyDown={local.onKeyDown}
        {...rest}
      >
        {local.children}
      </MenuV2.Context.Trigger>
      <MenuV2.Context.Portal>
        <MenuV2.Context.Content gutter={4}>
          <MenuV2.Item onSelect={copyFilename}>{language.t("ui.sessionReviewV2.copyFilename")}</MenuV2.Item>
          <MenuV2.Item onSelect={copyPath}>{language.t("ui.sessionReviewV2.copyPath")}</MenuV2.Item>
        </MenuV2.Context.Content>
      </MenuV2.Context.Portal>
    </MenuV2.Context>
  )
}
