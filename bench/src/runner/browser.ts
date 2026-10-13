import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import { dataset } from "@perception-bench/scenarios";
import type { CellAdapter } from "../contracts.ts";
import type { Capture, Configuration, Counts } from "./models.ts";
import { startServer } from "./server.ts";

declare global {
  interface Window {
    perceptionSubject: (configuration: Configuration) => string;
  }
}

export const acquisitionPolicy = {
  version: 1,
  scope: "body.outerHTML",
  properties: ["input.value", "input.checked", "textarea.value", "option.selected"],
  visibility: "inline computed display:none and visibility:hidden/collapse from source",
  execution: "scripts/handlers removed for replay; JavaScript and network disabled",
};

export function captureBody(): string {
  const clone = document.body.cloneNode(true);
  if (!(clone instanceof HTMLBodyElement)) throw new Error("Could not clone document body");
  const original = [document.body, ...document.body.querySelectorAll("*")];
  const copied = [clone, ...clone.querySelectorAll("*")];
  original.forEach((source, index) => {
    const target = copied[index];
    if (!target) throw new Error("DOM clone correspondence lost");
    if (source instanceof HTMLInputElement) {
      target.setAttribute("value", source.value);
      if (["checkbox", "radio"].includes(source.type)) target.toggleAttribute("checked", source.checked);
    } else if (source instanceof HTMLTextAreaElement) target.textContent = source.value;
    else if (source instanceof HTMLOptionElement) target.toggleAttribute("selected", source.selected);
    const style = getComputedStyle(source);
    if (target instanceof HTMLElement || target instanceof SVGElement) {
      if (style.display === "none") target.style.display = "none";
      if (["hidden", "collapse"].includes(style.visibility)) target.style.visibility = style.visibility;
    }
  });
  return clone.outerHTML;
}

export class BrowserSession {
  private browser?: Browser;
  private server?: Awaited<ReturnType<typeof startServer>>;
  private readonly files: Record<string, string>;
  private readonly counts: Counts;
  constructor(files: Record<string, string>, counts: Counts) {
    this.files = files;
    this.counts = counts;
  }

  private async launch(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
      this.counts.browserLaunches++;
    }
    return this.browser;
  }

  async capture(stateId: string, adapter: CellAdapter<Page>): Promise<Capture> {
    const browser = await this.launch();
    this.server ??= await startServer(this.files);
    const baseURL = this.server.url;
    const context = await browser.newContext({
      viewport: dataset.environment.viewport, locale: dataset.environment.locale,
      timezoneId: dataset.environment.timezoneId, reducedMotion: "reduce", colorScheme: "light",
      serviceWorkers: "block",
    });
    const errors: string[] = [];
    await context.route("**/*", route => {
      if (new URL(route.request().url()).origin === baseURL) return route.continue();
      errors.push(`Unexpected external request: ${route.request().url()}`);
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => {
      if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    try {
      await page.clock.setFixedTime(new Date(dataset.environment.clock));
      await page.addInitScript((seed: number) => {
        let value = seed;
        Math.random = () => {
          value = (Math.imul(1664525, value) + 1013904223) >>> 0;
          return value / 4294967296;
        };
      }, dataset.seed);
      await page.goto(`${baseURL}/fixture/?clawpilotTheme=light`, { waitUntil: "load" });
      await adapter.prepare(page, stateId);
      await adapter.assertReady(page, stateId);
      await page.evaluate(() => document.fonts.ready);
      const html = await page.evaluate(captureBody);
      const screenshot = (await page.screenshot({ fullPage: true, animations: "disabled" })).toString("base64");
      if (errors.length) throw new Error(`Fixture failed: ${errors.join("; ")}`);
      return { html, screenshot };
    } finally { await context.close(); }
  }

  async transform(input: string, bundle: string, configuration: Configuration): Promise<string> {
    const browser = await this.launch();
    const context = await browser.newContext({
      javaScriptEnabled: false, serviceWorkers: "block",
      viewport: dataset.environment.viewport, locale: dataset.environment.locale,
      timezoneId: dataset.environment.timezoneId,
    });
    await context.route("**/*", route => route.abort("blockedbyclient"));
    try {
      const page = await context.newPage();
      // DOMParser makes the supplied capture inert; original scripts never run.
      await page.evaluate((html: string) => {
        const parsed = new DOMParser().parseFromString(html, "text/html");
        parsed.querySelectorAll("script,iframe,object,embed").forEach(element => element.remove());
        parsed.querySelectorAll("*").forEach(element => {
          for (const attribute of [...element.attributes]) {
            if (attribute.name.toLowerCase().startsWith("on")) element.removeAttribute(attribute.name);
          }
        });
        document.body.replaceWith(document.importNode(parsed.body, true));
      }, input);
      await page.evaluate((code: string) => { (0, eval)(code); }, bundle);
      const output = await page.evaluate(config => window.perceptionSubject(config), configuration);
      if (typeof output !== "string") throw new Error("Subject returned non-string output");
      return output;
    } finally { await context.close(); }
  }

  async close(): Promise<void> {
    try { await this.browser?.close(); }
    finally { await this.server?.close(); }
  }
}
