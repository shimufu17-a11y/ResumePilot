import type { PageSnapshot } from "./model";

export type BackgroundRequest =
  | { type: "RP_SCAN_ACTIVE_TAB" }
  | {
      type: "RP_FILL_ACTIVE_TAB";
      items: Array<{ fieldId: string; value: string }>;
    }
  | {
      type: "RP_UPLOAD_ACTIVE_TAB";
      items: Array<{
        fieldId: string;
        fileName: string;
        mimeType: string;
        bytesBase64: string;
      }>;
    }
  | { type: "RP_GO_NEXT" }
  | { type: "RP_GET_ACTIVE_TAB" };

export interface BackgroundResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type PageRequest =
  | { type: "RP_PAGE_SCAN" }
  | { type: "RP_PAGE_FILL"; items: Array<{ fieldId: string; value: string }> }
  | {
      type: "RP_PAGE_UPLOAD";
      items: Array<{
        fieldId: string;
        fileName: string;
        mimeType: string;
        bytesBase64: string;
      }>;
    }
  | { type: "RP_PAGE_GO_NEXT" };

export interface PageFillResult {
  filled: string[];
  failed: Array<{ fieldId: string; reason: string }>;
}

export interface ActiveTabInfo {
  tabId: number;
  url: string;
  title: string;
}

export type ScanResponse = BackgroundResponse<PageSnapshot>;
