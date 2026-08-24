import { expect, test } from "@playwright/test"
import {
  assistantMessage,
  reasoningPart,
  setupTimeline,
  userMessage,
} from "../performance/timeline-stability/fixture"

test("labels completed and live reasoning accurately in the BuildingAI embed", async ({ page }) => {
  const completedUser = userMessage(undefined, { id: "msg_reasoning_completed_user", created: 1700000000000 })
  const liveUser = userMessage(undefined, { id: "msg_reasoning_live_user", created: 1700000010000 })

  await setupTimeline(page, {
    locale: "zh",
    settings: { showReasoningSummaries: true },
    messages: [
      completedUser,
      assistantMessage([reasoningPart("prt_reasoning_completed", "Completed analysis")], {
        id: "msg_reasoning_completed_assistant",
        parentID: completedUser.info.id,
        created: 1700000001000,
      }),
      liveUser,
      assistantMessage([reasoningPart("prt_reasoning_live", "Active analysis")], {
        id: "msg_reasoning_live_assistant",
        parentID: liveUser.info.id,
        completed: false,
        created: 1700000011000,
      }),
    ],
  })

  await expect(page.locator('[data-timeline-part-id="prt_reasoning_completed"] summary')).toHaveCount(0)
  await page.goto(`${page.url()}?buildingaiEmbed=1`)

  const completed = page.locator('[data-timeline-part-id="prt_reasoning_completed"]')
  const live = page.locator('[data-timeline-part-id="prt_reasoning_live"]')
  await expect(completed.locator("summary")).toHaveText("思考完成")
  await expect(completed).not.toHaveAttribute("open", "")
  await expect(live.locator("summary")).toHaveText("思考中")
  await expect(live).toHaveAttribute("open", "")
})
