import { showToast } from "@/utils/toast"

export async function copyTextValue(input: { text: string; copiedTitle: string }) {
  if (!navigator.clipboard?.writeText) return
  await navigator.clipboard.writeText(input.text)
  showToast({
    variant: "success",
    icon: "circle-check",
    title: input.copiedTitle,
    description: input.text,
  })
}
