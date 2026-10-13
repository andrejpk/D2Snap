import { textRank } from "../../dist.lib/options.sentenceRankers.js";
import { DEFAULT_SETTINGS } from "../../dist.lib/options.sentenceRankers/text-rank.js";
import { rankSentences, DEFAULT_SETTINGS as TEXT_RANK_DEFAULT_SETTINGS } from "../../dist.lib/TextRank.js";


const SENTENCES = [
    "Burgers are popular.",
    "Fries are popular too.",
    "Burgers and fries are popular together.",
    "Ketchup is red."
];


await test("Rank sentences via TextRank (sentence ranker)", () => {
    assertEqual(
        textRank(SENTENCES),
        rankSentences(SENTENCES),
        "Invalid ranked sentences (default settings)"
    );
    assertEqual(
        [ ...textRank(SENTENCES) ].sort(),
        [ ...SENTENCES ].sort(),
        "Invalid ranked sentences (sentences lost or added)"
    );
    assertEqual(
        textRank([]),
        [],
        "Invalid ranked sentences (no sentences)"
    );
});

await test("Rank sentences via TextRank (settings)", () => {
    assertEqual(
        textRank(SENTENCES, { damping: 0.5 }),
        rankSentences(SENTENCES, { damping: 0.5 }),
        "Settings not passed to TextRank"
    );
});

await test("Freeze default sentence ranker settings", () => {
    assertEqual(
        DEFAULT_SETTINGS,
        TEXT_RANK_DEFAULT_SETTINGS,
        "Invalid default settings (not the TextRank defaults)"
    );
    assertEqual(
        { ...DEFAULT_SETTINGS },
        {
            damping: 0.75,
            maxIterations: 20,
            minSimilarity: 0.1,
            tolerance: 1e-4
        },
        "Invalid default settings"
    );
    assertTrue(Object.isFrozen(DEFAULT_SETTINGS), "Mutable default settings");
});
