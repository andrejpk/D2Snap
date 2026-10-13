export interface IsActionableElementSettings {
    roleAttributeValues: readonly string[];
    tagNames: readonly string[];
}
export declare const DEFAULT_SETTINGS: Readonly<IsActionableElementSettings>;
export default function (elementNode: Element, settings?: Partial<IsActionableElementSettings>): boolean;
