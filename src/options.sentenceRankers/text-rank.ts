import { type TextRankSettings } from "../types.js";
import { DEFAULT_SETTINGS as TEXT_RANK_SETTINGS, rankSentences } from "../TextRank.js";


export { type TextRankSettings };

export const DEFAULT_SETTINGS: Readonly<TextRankSettings> = TEXT_RANK_SETTINGS;


// Sentences ordered by TextRank centrality (most relevant first).
export default function textRank(
	sentences: string[],
	settings: Partial<TextRankSettings> = {}
): string[] {
	return rankSentences(sentences, settings);
}
