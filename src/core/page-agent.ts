/**
 * This function is injected into the active tab with chrome.scripting.
 * Keep every runtime helper inside the function: Chrome serializes the
 * function body and does not preserve module closures.
 */
export function installPageAgent(policy?: {
  finalSource: string;
  nextSource: string;
  flags: string;
}): void {
  const pageWindow = window as typeof window & { __resumePilotAgent?: boolean };
  if (pageWindow.__resumePilotAgent) return;
  pageWindow.__resumePilotAgent = true;

  const FIELD_ATTRIBUTE = "data-resumepilot-field-id";
  const FINAL_ACTION = new RegExp(
    policy?.finalSource ??
      "(提交|投递|确认申请|申请职位|完成申请|submit|apply now|apply for|complete application|send application|finish application)",
    policy?.flags ?? "i"
  );
  const NEXT_ACTION = new RegExp(
    policy?.nextSource ??
      "^(下一步|继续|保存并继续|保存并下一步|next|continue|save and continue|save & continue)$",
    policy?.flags ?? "i"
  );
  const SUCCESS_TEXT = /投递成功|申请成功|提交成功|application submitted|successfully applied/i;

  function normalize(value: string): string {
    return value
      .toLocaleLowerCase()
      .normalize("NFKC")
      .replace(/[\s\p{P}\p{S}_]+/gu, "")
      .trim();
  }

  function hash(value: string): string {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  function visible(element: Element): boolean {
    if (!(element instanceof HTMLElement)) return false;
    const style = getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || "1") > 0 &&
      element.getClientRects().length > 0
    );
  }

  function compactText(element: Element | null, max = 180): string {
    return (element?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function labelFor(element: HTMLElement): string {
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel.trim();

    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => compactText(document.getElementById(id)))
        .filter(Boolean)
        .join(" ");
      if (text) return text;
    }

    if (element.id) {
      const explicit = [...document.querySelectorAll("label")].find(
        (label) => label.htmlFor === element.id
      );
      const text = compactText(explicit ?? null);
      if (text) return text;
    }

    if (element instanceof HTMLInputElement && element.type === "radio") {
      const legend = element.closest("fieldset")?.querySelector("legend");
      const legendText = compactText(legend ?? null);
      if (legendText) return legendText;
      const group = element.closest(".form-item,.form-group,.ant-form-item,.el-form-item");
      const groupLabel = compactText(group?.querySelector("label,.label,[class*='label']") ?? null);
      if (groupLabel && !optionMatches(groupLabel, element.value)) return groupLabel;
    }

    const wrappingLabel = element.closest("label");
    const wrappedText = compactText(wrappingLabel);
    if (wrappedText) return wrappedText;

    const fieldContainer = element.closest(
      ".form-item,.form-group,.ant-form-item,.el-form-item,[class*='field'],[class*='formItem'],[class*='form-item']"
    );
    if (fieldContainer) {
      const likelyLabel = fieldContainer.querySelector(
        "label,.label,[class*='label'],legend,.ant-form-item-label,.el-form-item__label"
      );
      const text = compactText(likelyLabel);
      if (text) return text;
    }

    const previous = element.previousElementSibling;
    const previousText = compactText(previous);
    return previousText.length <= 80 ? previousText : "";
  }

  function typeFor(element: HTMLElement): string {
    if (element instanceof HTMLInputElement) return element.type || "text";
    if (element instanceof HTMLTextAreaElement) return "textarea";
    if (element instanceof HTMLSelectElement)
      return element.multiple ? "select-multiple" : "select";
    if (element.isContentEditable) return "contenteditable";
    return element.getAttribute("role") ?? element.tagName.toLocaleLowerCase();
  }

  function valueFor(element: HTMLElement): string {
    if (element instanceof HTMLInputElement) {
      if (element.type === "checkbox" || element.type === "radio") {
        return element.checked ? element.value || "true" : "";
      }
      return element.value;
    }
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      return element.value;
    }
    return element.isContentEditable ? compactText(element, 1000) : "";
  }

  function scanFields() {
    const selector = [
      "input:not([type='hidden']):not([type='submit']):not([type='button'])",
      "textarea",
      "select",
      "[role='combobox']",
      "[contenteditable='true']"
    ].join(",");
    const elements = [...document.querySelectorAll<HTMLElement>(selector)].filter(
      (element, index, all) => {
        const duplicateRadio =
          element instanceof HTMLInputElement &&
          element.type === "radio" &&
          Boolean(element.name) &&
          all
            .slice(0, index)
            .some(
              (candidate) =>
                candidate instanceof HTMLInputElement &&
                candidate.type === "radio" &&
                candidate.name === element.name
            );
        return (
          !duplicateRadio &&
          (visible(element) ||
            (element instanceof HTMLInputElement &&
              element.type === "file" &&
              !element.disabled)) &&
          all.indexOf(element) === index
        );
      }
    );

    return elements.map((element, index) => {
      let id = element.getAttribute(FIELD_ATTRIBUTE);
      if (!id) {
        id = `rp_${Date.now().toString(36)}_${index}_${Math.random().toString(36).slice(2, 7)}`;
        element.setAttribute(FIELD_ATTRIBUTE, id);
      }
      const label = labelFor(element);
      const name =
        element.getAttribute("name") || element.getAttribute("data-field") || element.id || "";
      const placeholder = element.getAttribute("placeholder") || "";
      const type = typeFor(element);
      const options =
        element instanceof HTMLSelectElement
          ? [...element.options].map((option) => option.text.trim()).filter(Boolean)
          : element instanceof HTMLInputElement && element.type === "radio" && element.name
            ? [
                ...document.querySelectorAll<HTMLInputElement>(
                  `input[type='radio'][name="${CSS.escape(element.name)}"]`
                )
              ]
                .map((radio) => `${radio.value} ${compactText(radio.closest("label"))}`.trim())
                .filter(Boolean)
            : [];
      const fingerprint = hash(
        [element.tagName, type, name, label, placeholder].map(normalize).join("|")
      );
      return {
        id,
        fingerprint,
        tag: element.tagName.toLocaleLowerCase(),
        type,
        label,
        name,
        placeholder,
        required:
          element.hasAttribute("required") ||
          element.getAttribute("aria-required") === "true" ||
          Boolean(element.closest(".required,[class*='required']")),
        value: valueFor(element),
        options
      };
    });
  }

  function likelyJobDescription(): string {
    const selectors = [
      "[class*='job-description']",
      "[class*='jobDescription']",
      "[class*='description']",
      "[data-testid*='description']",
      "article",
      "main"
    ];
    const candidates = selectors
      .flatMap((selector) => [...document.querySelectorAll(selector)])
      .map((element) => compactText(element, 8_000))
      .filter((text) => text.length >= 80)
      .sort((a, b) => b.length - a.length);
    return candidates[0]?.slice(0, 8_000) ?? "";
  }

  function scanPage() {
    return {
      url: location.href,
      title: document.title,
      heading: compactText(document.querySelector("h1"), 300),
      jdText: likelyJobDescription(),
      fields: scanFields()
    };
  }

  function dispatchValueEvents(element: HTMLElement): void {
    for (const type of ["input", "change", "blur"]) {
      element.dispatchEvent(new Event(type, { bubbles: true }));
    }
  }

  function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    const prototype =
      element instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    setter?.call(element, value);
    if (!setter) element.value = value;
    dispatchValueEvents(element);
  }

  function optionMatches(option: string, desired: string): boolean {
    const left = normalize(option);
    const right = normalize(desired);
    return left === right || left.includes(right) || right.includes(left);
  }

  async function fillElement(element: HTMLElement, desired: string): Promise<void> {
    element.scrollIntoView({ block: "center", behavior: "auto" });
    if (element instanceof HTMLSelectElement) {
      const values = desired.split(/[、,，;；]/).map((item) => item.trim());
      let matched = false;
      for (const option of element.options) {
        const selected = values.some(
          (value) => optionMatches(option.text, value) || optionMatches(option.value, value)
        );
        if (element.multiple) option.selected = selected;
        else if (selected && !matched) {
          element.value = option.value;
          matched = true;
        }
        matched ||= selected;
      }
      if (!matched) throw new Error("没有匹配的下拉选项");
      dispatchValueEvents(element);
      return;
    }
    if (element instanceof HTMLInputElement) {
      if (element.type === "checkbox") {
        const truthy = /^(是|接受|同意|true|yes|1)$/i.test(desired.trim());
        if (element.checked !== truthy) element.click();
        return;
      }
      if (element.type === "radio") {
        const group = element.name
          ? [
              ...document.querySelectorAll<HTMLInputElement>(
                `input[type='radio'][name="${CSS.escape(element.name)}"]`
              )
            ]
          : [element];
        const match = group.find((radio) =>
          optionMatches(`${radio.value} ${labelFor(radio)}`, desired)
        );
        if (!match) throw new Error("没有匹配的单选项");
        if (!match.checked) match.click();
        return;
      }
      if (element.type === "file") throw new Error("请通过附件操作上传文件");
      setNativeValue(element, desired);
      return;
    }
    if (element instanceof HTMLTextAreaElement) {
      setNativeValue(element, desired);
      return;
    }
    if (element.isContentEditable) {
      element.focus();
      element.textContent = desired;
      dispatchValueEvents(element);
      return;
    }
    if (element.getAttribute("role") === "combobox") {
      element.click();
      await new Promise((resolve) => setTimeout(resolve, 180));
      const choices = [
        ...document.querySelectorAll<HTMLElement>(
          "[role='option'],.ant-select-item-option,.el-select-dropdown__item,[class*='option']"
        )
      ].filter(visible);
      const match = choices.find((choice) => optionMatches(compactText(choice), desired));
      if (!match) throw new Error("没有匹配的自定义下拉选项");
      match.click();
      return;
    }
    throw new Error("暂不支持此控件");
  }

  async function fillItems(items: Array<{ fieldId: string; value: string }>) {
    const filled: string[] = [];
    const failed: Array<{ fieldId: string; reason: string }> = [];
    for (const item of items) {
      const element = [...document.querySelectorAll<HTMLElement>(`[${FIELD_ATTRIBUTE}]`)].find(
        (candidate) => candidate.getAttribute(FIELD_ATTRIBUTE) === item.fieldId
      );
      if (!element || !visible(element)) {
        failed.push({ fieldId: item.fieldId, reason: "字段已消失或不可见" });
        continue;
      }
      try {
        await fillElement(element, item.value);
        filled.push(item.fieldId);
      } catch (error) {
        failed.push({
          fieldId: item.fieldId,
          reason: error instanceof Error ? error.message : "填写失败"
        });
      }
    }
    return { filled, failed };
  }

  function decodeBase64(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  async function uploadItems(
    items: Array<{
      fieldId: string;
      fileName: string;
      mimeType: string;
      bytesBase64: string;
    }>
  ) {
    const filled: string[] = [];
    const failed: Array<{ fieldId: string; reason: string }> = [];
    for (const item of items) {
      const element = [
        ...document.querySelectorAll<HTMLInputElement>(`input[type='file'][${FIELD_ATTRIBUTE}]`)
      ].find((candidate) => candidate.getAttribute(FIELD_ATTRIBUTE) === item.fieldId);
      if (!element || element.disabled) {
        failed.push({ fieldId: item.fieldId, reason: "文件上传字段已消失或不可见" });
        continue;
      }
      try {
        const bytes = decodeBase64(item.bytesBase64);
        const file = new File([bytes.slice().buffer], item.fileName, { type: item.mimeType });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        element.files = transfer.files;
        dispatchValueEvents(element);
        filled.push(item.fieldId);
      } catch (error) {
        element.scrollIntoView({ block: "center" });
        failed.push({
          fieldId: item.fieldId,
          reason: error instanceof Error ? error.message : "浏览器或网站阻止了自动上传"
        });
      }
    }
    return { filled, failed };
  }

  function buttonText(element: Element): string {
    if (element instanceof HTMLInputElement) return element.value.trim();
    return compactText(element, 80);
  }

  function isDisabled(element: Element): boolean {
    return (
      element.hasAttribute("disabled") ||
      element.getAttribute("aria-disabled") === "true" ||
      element.classList.contains("disabled")
    );
  }

  function goNext(): { clicked: boolean; text?: string; reason?: string } {
    const actions = [
      ...document.querySelectorAll<HTMLElement>(
        "button,a,[role='button'],input[type='button'],input[type='submit']"
      )
    ].filter((element) => visible(element) && !isDisabled(element));
    const finalActions = actions.filter((element) => FINAL_ACTION.test(buttonText(element)));
    const next = actions.find((element) => {
      const text = buttonText(element);
      return NEXT_ACTION.test(text) && !FINAL_ACTION.test(text);
    });
    if (!next) {
      return {
        clicked: false,
        reason: finalActions.length
          ? "已到最终提交页，ResumePilot 不会点击提交"
          : "没有找到含义明确的下一步按钮"
      };
    }
    const text = buttonText(next);
    next.click();
    return { clicked: true, text };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "RP_PAGE_SCAN") {
      sendResponse({ ok: true, data: scanPage() });
      return false;
    }
    if (message?.type === "RP_PAGE_FILL") {
      void fillItems(message.items ?? [])
        .then((data) => sendResponse({ ok: true, data }))
        .catch((error) =>
          sendResponse({ ok: false, error: error instanceof Error ? error.message : "填写失败" })
        );
      return true;
    }
    if (message?.type === "RP_PAGE_UPLOAD") {
      void uploadItems(message.items ?? [])
        .then((data) => sendResponse({ ok: true, data }))
        .catch((error) =>
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "附件上传失败"
          })
        );
      return true;
    }
    if (message?.type === "RP_PAGE_GO_NEXT") {
      sendResponse({ ok: true, data: goNext() });
      return false;
    }
    return false;
  });

  document.addEventListener(
    "click",
    (event) => {
      const target =
        event.target instanceof Element
          ? event.target.closest("button,a,[role='button'],input[type='submit']")
          : null;
      if (!target) return;
      const text = buttonText(target);
      if (FINAL_ACTION.test(text)) {
        void chrome.runtime.sendMessage({
          type: "RP_SUBMIT_DETECTED",
          url: location.href,
          title: document.title,
          buttonText: text
        });
      }
    },
    true
  );

  if (SUCCESS_TEXT.test(document.body.innerText.slice(0, 10_000))) {
    void chrome.runtime.sendMessage({
      type: "RP_SUCCESS_PAGE_DETECTED",
      url: location.href,
      title: document.title
    });
  }
}
