import { getAttributeScore } from "../../dist.lib/D2Snap.js";


await test("Get attribute scores", () => {
    // Disjunction checks
    const attributeScores = new Map(
        Object.entries({
            "test": 1,
            "data-override-1": 0.3,
            "data-*": 0.7,
            "data-override-2": 0.4,
            "aria-label": 0.4,
            "*": 0.2
        })
            .map(entry => [ entry[0].toLowerCase(), entry[1] ])
    );

    assertEqual(
        getAttributeScore("test", attributeScores),
        1,
        "Invalid retireved attribute score ('test')"
    );
    assertEqual(
        getAttributeScore("data-test", attributeScores),
        0.7,
        "Invalid retireved attribute score ('data-test'; specified wildcard)"
    );
    assertEqual(
        getAttributeScore("aria-label", attributeScores),
        0.4,
        "Invalid retireved attribute score ('aria-label')"
    );
    assertEqual(
        getAttributeScore("aria-test", attributeScores),
        0.2,
        "Invalid retireved attribute score ('data-test'; unspecified wildcard, default)"
    );
    assertEqual(
        getAttributeScore("test-test", attributeScores),
        0.2,
        "Invalid retireved attribute score ('test-test'; default)"
    );
    assertEqual(
        getAttributeScore("data-override-1", attributeScores),
        0.3,
        "Invalid retireved attribute score ('data-override-1')"
    );
    assertEqual(
        getAttributeScore("data-override-2", attributeScores),
        0.4,
        "Invalid retireved attribute score ('data-override-1')"
    );
});

await test("Get attribute scores (default scores)", () => {
    assertEqual(
        getAttributeScore("HREF"),
        0.91,
        "Invalid retireved attribute score ('HREF'; default scores, case-insensitive)"
    );
    assertEqual(
        getAttributeScore("aria-expanded"),
        0.62,
        "Invalid retireved attribute score ('aria-expanded'; default scores, wildcard)"
    );
    assertEqual(
        getAttributeScore("data-unknown"),
        0,
        "Invalid retireved attribute score ('data-unknown'; default scores, fallback)"
    );
});
