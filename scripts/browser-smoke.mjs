import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const extensionPath = resolve(root, ".output", "chrome-mv3");
const chromePath = process.argv[2] || process.env.CHROMIUM_PATH;
const port = 9333;

if (!chromePath || !existsSync(chromePath)) {
  throw new Error(
    "Pass a Chromium/Chrome-for-Testing executable path or set CHROMIUM_PATH. Branded Chrome/Edge ignore command-line extension side-loading."
  );
}
if (!existsSync(extensionPath)) throw new Error("Build the Chrome extension before smoke testing");

const profileRoot = resolve(root, ".browser-test");
mkdirSync(profileRoot, { recursive: true });
const profilePath = resolve(profileRoot, `session-${Date.now()}`);
mkdirSync(profilePath, { recursive: true });

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profilePath}`,
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank"
  ],
  { windowsHide: true, stdio: "ignore" }
);

async function retry(operation, timeoutMs = 12_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 180));
    }
  }
  throw lastError ?? new Error("Timed out");
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.sequence = 0;
    this.pending = new Map();
  }

  async open() {
    await new Promise((resolveOpen, rejectOpen) => {
      this.socket.addEventListener("open", resolveOpen, { once: true });
      this.socket.addEventListener("error", rejectOpen, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((resolveSend, rejectSend) => {
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description || "Browser evaluation failed"
      );
    }
    return result.result?.value;
  }

  close() {
    this.socket.close();
  }
}

try {
  let requestedOptions = false;
  const targets = await retry(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    if (!response.ok) throw new Error("Chrome DevTools endpoint is not ready");
    const list = await response.json();
    const options = list.find(
      (target) =>
        target.type === "page" && /^chrome-extension:\/\/[^/]+\/options\.html/.test(target.url)
    );
    if (!options) {
      const extensionTarget = list.find(
        (target) =>
          ["service_worker", "background_page"].includes(target.type) &&
          /^chrome-extension:\/\/[^/]+\/background\.js(?:\?|$)/.test(target.url)
      );
      if (extensionTarget && !requestedOptions) {
        requestedOptions = true;
        const extensionId = new URL(extensionTarget.url).hostname;
        await fetch(
          `http://127.0.0.1:${port}/json/new?${encodeURIComponent(`chrome-extension://${extensionId}/options.html`)}`,
          { method: "PUT" }
        );
      }
      const seen = list.map((target) => `${target.type}:${target.url}`).join(", ");
      throw new Error(`ResumePilot options page has not opened. Targets: ${seen}`);
    }
    return { list, options };
  });

  const extensionId = new URL(targets.options.url).hostname;
  const client = new CdpClient(targets.options.webSocketDebuggerUrl);
  await client.open();
  await client.send("Runtime.enable");
  await retry(async () => {
    const text = await client.evaluate("document.body.innerText");
    if (!String(text).includes("创建本地资料库")) {
      const state = await client.evaluate(`JSON.stringify({
        readyState: document.readyState,
        title: document.title,
        text: document.body?.innerText?.slice(0, 500),
        html: document.body?.innerHTML?.slice(0, 500),
        scripts: [...document.scripts].map((item) => item.src)
      })`);
      throw new Error(`Onboarding UI is not ready: ${state}`);
    }
    return text;
  });

  const created = await client.evaluate(`(() => {
    const inputs = [...document.querySelectorAll('input[type="password"]')];
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const input of inputs) {
      setter.call(input, 'Smoke test password 123!');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('创建并进入'));
    button?.click();
    return Boolean(button && inputs.length === 2);
  })()`);
  if (!created) throw new Error("Could not operate onboarding controls");

  await retry(async () => {
    const text = await client.evaluate("document.body.innerText");
    if (!String(text).includes("求职档案")) {
      throw new Error("Vault did not unlock into the dashboard");
    }
    return text;
  }, 20_000);

  const storageText = await client.evaluate(`new Promise((resolve) => {
    chrome.storage.local.get(null).then((value) => resolve(JSON.stringify(value)));
  })`);
  if (!String(storageText).includes("resumepilot.vault")) {
    throw new Error("Encrypted vault was not persisted");
  }
  if (String(storageText).includes("Smoke test password 123!")) {
    throw new Error("Master password leaked into persistent storage");
  }
  client.close();
  process.stdout.write(
    `Chrome smoke test passed: extension ${extensionId}, onboarding, Web Crypto vault, and dashboard loaded.\n`
  );
} finally {
  chrome.kill();
}
