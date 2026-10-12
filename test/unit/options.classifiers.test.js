import { isActionableElement, isTextElement } from "../../dist.lib/options.classifiers.js";
import { CLASSIFIER_SETTINGS } from "../../dist.lib/constants.defaults.js";


const MOCKED_ACTIONABLE_ELEMENT_TAG_NAMES = [
    "A",
    "BUTTON"
];

const MOCKED_ACTIONABLE_ELEMENT_ROLE_ATTRIBUTE_VALUES = [
    "button"
];


const _mockGetAttribute = (name, attrsDict = {}) => {
    return attrsDict[name];
};

const _mockElement = (tagName, attrsDict = {}) => {
    return {
        tagName,
        getAttribute(name) {
            return _mockGetAttribute(name, attrsDict);
        }
    };
};

const _wrapIsActionableElement = element => {
    return isActionableElement(element, {
        tagNames: MOCKED_ACTIONABLE_ELEMENT_TAG_NAMES,
        roleAttributeValues: MOCKED_ACTIONABLE_ELEMENT_ROLE_ATTRIBUTE_VALUES
    });
};


await test("Check element actionability", () => {
    // Disjunction checks

    assertEqual(
        _wrapIsActionableElement(_mockElement("BUTTON", {
            role: "button"
        })),
        true,
        "Invalid is-actionable classification (true axes: [1, 1])"
    );
    assertEqual(
        _wrapIsActionableElement(_mockElement("BUTTON", {
            role: "static"
        })),
        true,
        "Invalid is-actionable classification (true axes: [1, 0 (explicit)])"
    );
    assertEqual(
        _wrapIsActionableElement(_mockElement("A")),
        true,
        "Invalid is-actionable classification (true axes: [1, 0 (implicit)])"
    );
    assertEqual(
        _wrapIsActionableElement(_mockElement("DIV", {
            role: "button"
        })),
        true,
        "Invalid is-actionable classification (true axex: [0, 1])"
    );
    assertEqual(
        _wrapIsActionableElement(_mockElement("SECTION", {
            role: "static"
        })),
        false,
        "Invalid is-actionable classification (true axes: [0, 0 (explicit)])"
    );
    assertEqual(
        _wrapIsActionableElement(_mockElement("section")),
        false,
        "Invalid is-actionable classification (true axes: [0, 0 (implicit)])"
    );
});

await test("Check element actionability (default settings)", () => {
    assertEqual(
        isActionableElement(_mockElement("INPUT")),
        true,
        "Invalid is-actionable classification (default tag names)"
    );
    assertEqual(
        isActionableElement(_mockElement("DIV", {
            role: "Checkbox"
        })),
        true,
        "Invalid is-actionable classification (default role attribute values, case-insensitive)"
    );
    assertEqual(
        isActionableElement(_mockElement("X-ORDER-BUTTON"), {
            tagNames: [ ...CLASSIFIER_SETTINGS.isActionableElement.tagNames, "x-order-button" ]
        }),
        true,
        "Invalid is-actionable classification (extended default tag names)"
    );
    assertEqual(
        [ _mockElement("A"), _mockElement("DIV") ]
            .filter(isActionableElement)
            .map(element => element.tagName),
        [ "A" ],
        "Invalid is-actionable classification (array method callback)"
    );
});

await test("Check element text formatting", () => {
    assertEqual(
        isTextElement(_mockElement("STRONG")),
        true,
        "Invalid is-text classification (default tag names)"
    );
    assertEqual(
        isTextElement(_mockElement("div")),
        false,
        "Invalid is-text classification (default tag names, negative)"
    );
    assertEqual(
        isTextElement(_mockElement("div"), {
            tagNames: [ "DIV" ]
        }),
        true,
        "Invalid is-text classification (custom tag names)"
    );
});

await test("Check element actionability (role property)", () => {
    // Role property without role attribute (e.g., element internals)
    const element = _mockElement("DIV");
    element.role = "button";

    assertEqual(
        isActionableElement(element),
        true,
        "Invalid is-actionable classification (role property)"
    );
});
