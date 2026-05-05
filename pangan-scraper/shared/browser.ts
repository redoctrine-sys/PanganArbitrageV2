import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

const STEALTH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  close: () => Promise<void>;
}

export async function launchBrowser(opts: { headless?: boolean } = {}): Promise<BrowserSession> {
  const browser = await chromium.launch({
    headless: opts.headless ?? true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--no-sandbox",
    ],
  });

  const context = await browser.newContext({
    userAgent: STEALTH_USER_AGENT,
    viewport: { width: 1366, height: 900 },
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
  });

  // Hide webdriver flag — basic anti-detection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await context.newPage();

  return {
    browser,
    context,
    page,
    close: async () => {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
}
