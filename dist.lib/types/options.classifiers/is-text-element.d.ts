export interface IsTextElementSettings {
    tagNames: readonly string[];
}
export declare const DEFAULT_SETTINGS: Readonly<IsTextElementSettings>;
export default function (elementNode: Element, settings?: Partial<IsTextElementSettings>): boolean;
