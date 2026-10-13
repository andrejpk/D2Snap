import { format, formatWithCursor } from "prettier/standalone";
import type { Options } from "prettier";
import * as htmlPlugin from "prettier/plugins/html";

const options: Options = {
  parser: "html",
  plugins: [htmlPlugin],
  printWidth: 100,
  tabWidth: 2,
  htmlWhitespaceSensitivity: "ignore",
  embeddedLanguageFormatting: "off",
  endOfLine: "lf",
};

export function formatHTMLSource(source: string): Promise<string> {
  return format(source, options);
}

export async function formattedOffset(source: string, offset: number, formatted: string): Promise<number> {
  const result = await formatWithCursor(source, { ...options, cursorOffset: offset });
  if (result.formatted !== formatted || result.cursorOffset < 0 || result.cursorOffset > formatted.length) {
    throw new Error("Formatter could not map the source location consistently.");
  }
  return result.cursorOffset;
}
