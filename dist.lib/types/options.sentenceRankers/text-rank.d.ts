import { type TextRankSettings } from "../types.js";
export { type TextRankSettings };
export declare const DEFAULT_SETTINGS: Readonly<TextRankSettings>;
export default function textRank(sentences: string[], settings?: Partial<TextRankSettings>): string[];
