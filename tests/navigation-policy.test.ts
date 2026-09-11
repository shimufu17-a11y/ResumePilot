import { describe, expect, it } from "vitest";
import { classifyPageAction } from "../src/core/navigation-policy";

describe("safe navigation policy", () => {
  it.each(["下一步", "保存并继续", "Next", "Save and continue"])(
    "allows an explicit next action: %s",
    (text) => expect(classifyPageAction(text)).toBe("next")
  );

  it.each([
    "提交",
    "确认提交",
    "立即投递",
    "投递简历",
    "Submit application",
    "Apply now",
    "Complete application"
  ])("blocks a final action: %s", (text) => expect(classifyPageAction(text)).toBe("final"));

  it.each(["保存草稿", "查看详情", "稍后处理", "返回"])(
    "treats ambiguous actions as unknown: %s",
    (text) => expect(classifyPageAction(text)).toBe("unknown")
  );
});
