import { readTestFile, writeActual, readExpected } from "../test.util.js";

import { d2Snap } from "../../dist.lib/api.js";


const PIZZA_HTML = await readTestFile("pizza/pizza.defaults");


await test("Take DOM snapshot (defaults)", async () => {
    const snapshotPizza = await d2Snap(PIZZA_HTML, 0.5, 0.5, 0.5, {
        debug: true
    });

    await writeActual("pizza/pizza.defaults", snapshotPizza.html);
    const expectedPizza = await readExpected("pizza/pizza.defaults");

    assertEqual(
        snapshotPizza.html,
        expectedPizza,
        "Invalid DOM snapshot (pizza)"
    );
});
