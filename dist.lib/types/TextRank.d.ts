import { type TextRankSettings } from "./types.js";
interface TextRankSentence {
    index: number;
    score: number;
    sentence: string;
}
export declare const DEFAULT_SETTINGS: Readonly<TextRankSettings>;
export declare function textRank(sentences: string[], options?: Partial<TextRankSettings>): TextRankSentence[];
export declare function rankSentences(sentences: string[], options?: Partial<TextRankSettings>): string[];
export {};
