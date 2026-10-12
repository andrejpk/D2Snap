import { readTestFile, writeActual, readExpected, flattenDOMSnapshot } from "../test.util.js";

import { d2Snap, defaults } from "../../dist.lib/api.js";


const HAMBURGER_HTML = await readTestFile("hamburger/hamburger.options.normalizers.filterDataUrls");


await test("Take DOM snapshot (options.normalizers; filterDataUrls)", async () => {
    const snapshotFilter = await d2Snap(HAMBURGER_HTML, 0.5, 0, 1, {
        debug: true,
        skip: {
            markdown: true
        }
    });

    await writeActual("hamburger/hamburger.options.normalizers.filterDataUrls", snapshotFilter.html);
    const expected = await readExpected("hamburger/hamburger.options.normalizers.filterDataUrls");

    assertEqual(
        flattenDOMSnapshot(snapshotFilter.html),
        flattenDOMSnapshot(expected),
        "Invalid DOM snapshot"
    );

    assertNotIn(
        "data:image/png;base64,",
        snapshotFilter.html,
        "Invalid DOM snapshot"
    );

    const snapshotNoFilter = await d2Snap(HAMBURGER_HTML, 0.5, 0, 1, {
        debug: true,
        normalizers: defaults.NORMALIZERS
            .filter(normalizer => normalizer !== defaults.normalizers.filterDataUrls),
        skip: {
            markdown: true
        }
    });

    assertIn(
        "data:image/png;base64,",
        snapshotNoFilter.html,
        "Invalid DOM snapshot"
    );
});
