import { writeActual, readExpected } from "../test.util.js";

import { d2Snap } from "../../dist.lib/api.js";


await test("Take DOM snapshot (empty)", async () => {
    const snapshot = await d2Snap("", 0.5, 0.5, 0.5, {
        debug: true
    });

    await writeActual("pizza/pizza.empty", snapshot.html);
    const expected = await readExpected("pizza/pizza.empty");

    assertEqual(
        snapshot.html,
        expected,
        "Invalid DOM snapshot"
    );
});
