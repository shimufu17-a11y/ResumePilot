import { browser } from "wxt/browser";
import type {
  ActiveTabInfo,
  BackgroundRequest,
  BackgroundResponse,
  PageRequest
} from "../src/core/messages";
import { installPageAgent } from "../src/core/page-agent";
import { PAGE_ACTION_POLICY } from "../src/core/navigation-policy";

const SESSION_KEY = "resumepilot.session";
const SUBMISSION_CANDIDATE_KEY = "resumepilot.submission-candidate";

async function activeTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || !tab.url) throw new Error("找不到当前活动页面");
  if (!/^https?:\/\//i.test(tab.url)) {
    throw new Error("浏览器内部页面不允许扩展填写，请打开招聘网站页面");
  }
  return tab;
}

async function ensureAgent(tabId: number): Promise<void> {
  await browser.scripting.executeScript({
    target: { tabId },
    func: installPageAgent,
    args: [PAGE_ACTION_POLICY]
  });
}

async function requestPage<T>(tabId: number, message: PageRequest): Promise<T> {
  await ensureAgent(tabId);
  const response = (await browser.tabs.sendMessage(tabId, message)) as BackgroundResponse<T>;
  if (!response?.ok) throw new Error(response?.error || "页面通信失败");
  return response.data as T;
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener((details) => {
    void browser.alarms.create("resumepilot-auto-lock", { periodInMinutes: 1 });
    if (details.reason === "install") void browser.runtime.openOptionsPage();
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== "resumepilot-auto-lock") return;
    void browser.storage.session.get(SESSION_KEY).then((result) => {
      const session = result[SESSION_KEY] as { expiresAt?: number } | undefined;
      if (session?.expiresAt && Date.now() >= session.expiresAt) {
        void browser.storage.session.remove(SESSION_KEY);
      }
    });
  });

  browser.runtime.onMessage.addListener(
    (message: BackgroundRequest | Record<string, unknown>, sender) => {
      if (message.type === "RP_SUBMIT_DETECTED" || message.type === "RP_SUCCESS_PAGE_DETECTED") {
        const candidate = {
          ...message,
          tabId: sender.tab?.id,
          detectedAt: new Date().toISOString()
        };
        return browser.storage.session
          .set({ [SUBMISSION_CANDIDATE_KEY]: candidate })
          .then(() => ({ ok: true }));
      }

      return (async (): Promise<BackgroundResponse> => {
        try {
          if (message.type === "RP_GET_ACTIVE_TAB") {
            const tab = await activeTab();
            return {
              ok: true,
              data: {
                tabId: tab.id!,
                url: tab.url!,
                title: tab.title ?? ""
              } satisfies ActiveTabInfo
            };
          }
          if (message.type === "RP_SCAN_ACTIVE_TAB") {
            const tab = await activeTab();
            return { ok: true, data: await requestPage(tab.id!, { type: "RP_PAGE_SCAN" }) };
          }
          if (message.type === "RP_FILL_ACTIVE_TAB") {
            const tab = await activeTab();
            const items = (message as Extract<BackgroundRequest, { type: "RP_FILL_ACTIVE_TAB" }>)
              .items;
            return {
              ok: true,
              data: await requestPage(tab.id!, {
                type: "RP_PAGE_FILL",
                items
              })
            };
          }
          if (message.type === "RP_UPLOAD_ACTIVE_TAB") {
            const tab = await activeTab();
            const items = (message as Extract<BackgroundRequest, { type: "RP_UPLOAD_ACTIVE_TAB" }>)
              .items;
            return {
              ok: true,
              data: await requestPage(tab.id!, {
                type: "RP_PAGE_UPLOAD",
                items
              })
            };
          }
          if (message.type === "RP_GO_NEXT") {
            const tab = await activeTab();
            return { ok: true, data: await requestPage(tab.id!, { type: "RP_PAGE_GO_NEXT" }) };
          }
          return { ok: false, error: "未知操作" };
        } catch (error) {
          const messageText = error instanceof Error ? error.message : "扩展操作失败";
          return { ok: false, error: messageText };
        }
      })();
    }
  );
});
