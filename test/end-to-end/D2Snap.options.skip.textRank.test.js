import { readTestFile, writeActual, readExpected, flattenDOMSnapshot } from "../test.util.js";

import { d2Snap } from "../../dist.lib/api.js";


const FRIES_HTML = await readTestFile("fries/fries.options.skip.textRank");


await test("Take DOM snapshot (options.skip.textRank)", async () => {
    const snapshotTrue = await d2Snap(FRIES_HTML, 1, 1, 0.5, {
        debug: true,
        skip: {
            textRank: true
        }
    });

    await writeActual("fries/fries.options.skip.textRank.true", snapshotTrue.html);
    const expected = await readExpected("fries/fries.options.skip.textRank.true");

    assertEqual(
        flattenDOMSnapshot(snapshotTrue.html),
        flattenDOMSnapshot(expected),
        "Invalid DOM snapshot (skip.textRank = true)"
    );

    const snapshotFalse = await d2Snap(FRIES_HTML, 1, 1, 0.5, {
        debug: true,
        skip: {
            textRank: false
        }
    });

    await writeActual("fries/fries.options.skip.textRank.false", snapshotFalse.html);
    const expectedFalse = await readExpected("fries/fries.options.skip.textRank.false");

    assertEqual(
        flattenDOMSnapshot(snapshotFalse.html),
        flattenDOMSnapshot(expectedFalse),
        "Invalid DOM snapshot (skip.textRank = false)"
    );
});
