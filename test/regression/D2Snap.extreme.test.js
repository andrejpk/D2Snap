import { JSDOM } from "jsdom";

import { readTestFile, writeActual } from "../test.util.js";

import { d2Snap } from "../../dist.lib/api.js";


// ---------------------------------------------------------------------------
// Downsampling ratio <-> Quality ratio: `quality` -> D2snap `rE = rA = rT = 1 - quality`
// 
// The replaceWithLabel pass is UNCONDITIONAL — it runs before rE/rA/rT pruning
// — so it must yield the same label-preservation guarantee at every quality in
// [0, 1). Tests sweep that range to lock the contract in.
// ---------------------------------------------------------------------------

function qualityRatioToDownsamplingRatio(quality) {
    const r = 1 - quality;

    return {
        rE: r,
        rA: r,
        rT: r
    };
}

// ---------------------------------------------------------------------------
// Deeply nested markup (wrapper soup) must not overflow the stack, nor take
// quadratic time in the normalizers. Regression: the icon normalizer ran a subtree
// text check for EVERY element (before a constant-time check), visiting O(depth²)
// nodes. The normalizer cost is measured against the same snapshot without
// normalizers (same traversal and merging, same JSDOM costs), so it holds on any
// machine. Note: JSDOM's serializer (parse5) itself overflows at ~3000 levels.
// ---------------------------------------------------------------------------
await test("Deeply nested DOM (1000 levels) does not crash or take quadratic time", async () => {
    const depth = 1000;
    const html = "<div>".repeat(depth) + "<p>Deep-fried onion rings</p>" + "</div>".repeat(depth);

    for(const r of [ 0, 0.5, 1 ]) {
        const snapshot = await d2Snap(html, r, r, r);

        assertIn("Deep-fried onion rings", snapshot.html, `Deeply nested content was lost at r=${r}`);
    }

    // Fastest of three runs (filters garbage collection pauses)
    const time = async options => {
        const elapsedMs = [];
        for(let i = 0; i < 3; i++) {
            const start = Date.now();
            await d2Snap(html, 0, 0, 0, options);
            elapsedMs.push(Date.now() - start);
        }

        return Math.min(...elapsedMs);
    };

    const withoutNormalizersMs = await time({ normalizers: [] });
    const withNormalizersMs = await time({});

    assertLess(
        withNormalizersMs,
        1.5 * withoutNormalizersMs,
        `Normalizers took ${withNormalizersMs}ms vs. ${withoutNormalizersMs}ms without (> 1.5x) — quadratic regression?`
    );
});

// ---------------------------------------------------------------------------
// Very wide DOMs (long product lists, infinite scroll) must scale linearly, not
// quadratically, and keep all interactive elements. Measured as growth when the
// input doubles (linear ~2x, quadratic ~4x), so it holds on any machine. Only D2Snap
// is timed: markup is parsed outside the measurement, and each JSDOM window is
// closed afterwards (unclosed windows retain ~2 MB each, and the growing heap
// distorts timings). Each size takes the fastest of three runs (filters GC pauses).
// Containers are DIVs on purpose: a single text element (e.g., a UL with thousands
// of items) is converted by ONE Turndown call, whose join() copies the accumulated
// output per child (trimTrailingNewlines → substring) — quadratic upstream
// (Turndown 7.2.4), not in D2Snap.
// ---------------------------------------------------------------------------
await test("Wide DOM (2000 interactive siblings) scales linearly and keeps all actionables", async () => {
    const createHTML = count => `<div class="toppings">${
        Array.from({ length: count }, (_, i) => `<div class="topping"><button>Topping ${i}</button></div>`).join("")
    }</div>`;

    // Fastest of three runs
    const time = async count => {
        const html = createHTML(count);
        const elapsedMs = [];
        let buttonCount;
        for(let i = 0; i < 3; i++) {
            const window = new JSDOM(html).window;

            const start = Date.now();
            const snapshot = await d2Snap(window.document, 0.5, 0.5, 0.5);
            elapsedMs.push(Date.now() - start);

            buttonCount = snapshot.dom.querySelectorAll("button").length;

            window.close();
        }

        return { elapsedMs: Math.min(...elapsedMs), buttonCount };
    };

    const { elapsedMs: halfElapsedMs } = await time(1000);
    const { elapsedMs: fullElapsedMs, buttonCount } = await time(2000);

    assertLess(
        fullElapsedMs,
        3 * halfElapsedMs,
        `Doubling the DOM width took ${fullElapsedMs}ms vs. ${halfElapsedMs}ms (> 3x) — quadratic regression?`
    );
    assertEqual(buttonCount, 2000, "Actionable elements were lost");
});

// ---------------------------------------------------------------------------
// TextRank compares all sentence pairs of a text node (quadratic by design: ~4x when
// the sentence count doubles). Long single text nodes (legal text, articles without
// markup) must not scale worse than that. Measured as growth when the input doubles,
// so it holds on any machine.
// ---------------------------------------------------------------------------
await test("Long single text node (2000 sentences) is ranked without super-quadratic growth", async () => {
    const createHTML = count => `<p>${Array.from({ length: count }, (_, i) => `Fries batch ${i} is crispy.`).join(" ")}</p>`;

    const halfStart = Date.now();
    await d2Snap(createHTML(1000), 0, 0, 0.5);
    const halfElapsedMs = Date.now() - halfStart;

    const html = createHTML(2000);
    const fullStart = Date.now();
    const snapshot = await d2Snap(html, 0, 0, 0.5);
    const fullElapsedMs = Date.now() - fullStart;

    assertLess(
        fullElapsedMs,
        6 * halfElapsedMs,
        `Doubling the sentences took ${fullElapsedMs}ms vs. ${halfElapsedMs}ms (> 6x) — super-quadratic regression?`
    );
    assertMore(snapshot.html.length, 0, "Text was lost entirely");
    assertLess(snapshot.html.length, html.length, "Text was not reduced");
});

// ---------------------------------------------------------------------------
// End-to-end regression guard on the full, real-world news homepage (cnn.com; >2MB).
// ---------------------------------------------------------------------------
for(const quality of [ 0, 0.3, 0.6, 0.9, 1 ]) {
    const cnnHTML = await readTestFile("_regression/edition.cnn.com");  // huge file

    await test(`Snapshot huge page without crash or collapse (q=${quality})`, async () => {
        const { rE, rA, rT } = qualityRatioToDownsamplingRatio(quality);

        const start = Date.now();
        const snapshot = await d2Snap(cnnHTML, rE, rA, rT, {
            debug: true
        });
        const elapsedMs = Date.now() - start;

        await writeActual(`_regression/edition.cnn.com.q=${quality}`, snapshot.html);

        assertLess(elapsedMs, 10000, `Snapshot took ${elapsedMs}ms — re-traversal blow-up regression?`);
        assertIn(
            "The Assignment with Audie Cornish",
            snapshot.html,
            "Actionable content was lost"
        );

        if(quality > 0) {
            assertMore(
                snapshot.html.length,
                2**15,
                `Snapshot collapsed to ${snapshot.html.length} bytes (< ~32K B) — content was destroyed`
            );
        }
    });
}