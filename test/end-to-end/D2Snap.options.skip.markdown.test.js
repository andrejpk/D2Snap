import { readTestFile, writeActual, readExpected, flattenDOMSnapshot } from "../test.util.js";

import { d2Snap } from "../../dist.lib/api.js";


const FRIES_HTML = await readTestFile("fries/fries.options.skip.markdown");


await test("Take DOM snapshot (options.skip.markdown)", async () => {
    const snapshotTrue = await d2Snap(FRIES_HTML, 0.7, 0.8, 1, {
        debug: true,
        skip: {
            markdown: true
        }
    });

    await writeActual("fries/fries.options.skip.markdown.true", snapshotTrue.html);
    const expectedTrue = await readExpected("fries/fries.options.skip.markdown.true");

    assertEqual(
        flattenDOMSnapshot(snapshotTrue.html),
        flattenDOMSnapshot(expectedTrue),
        "Invalid DOM snapshot (skip.markdown = true)"
    );

    const snapshotFalse = await d2Snap(FRIES_HTML, 0.7, 0.8, 1, {
        debug: true,
        skip: {
            markdown: false
        }
    });

    await writeActual("fries/fries.options.skip.markdown.false", snapshotFalse.html);
    const expectedFalse = await readExpected("fries/fries.options.skip.markdown.false");

    assertEqual(
        flattenDOMSnapshot(snapshotFalse.html),
        flattenDOMSnapshot(expectedFalse),
        "Invalid DOM snapshot (skip.markdown = false)"
    );
});
