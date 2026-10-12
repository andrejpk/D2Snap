import { DEFAULT_SETTINGS as TEXT_RANK_SETTINGS, rankSentences } from "../TextRank.js";
const DEFAULT_SETTINGS = TEXT_RANK_SETTINGS;
function textRank(sentences, settings = {}) {
  return rankSentences(sentences, settings);
}
export {
  DEFAULT_SETTINGS,
  textRank as default
};
