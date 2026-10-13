import { type NormalizerContext } from "../types.js";
type TypedNormalizerFn<T extends Node, S extends object> = (virtualTarget: T, liveTarget: T, context: NormalizerContext, settings?: Partial<S>) => void;
type SettingsNormalizerFn<S extends object> = (virtualNode: Node, liveNode: Node, context: NormalizerContext, settings?: Partial<S>) => void;
export declare function forElements<S extends object = object>(normalizer: TypedNormalizerFn<Element, S>): SettingsNormalizerFn<S>;
export declare function forAttributes<S extends object = object>(normalizer: TypedNormalizerFn<Attr, S>): SettingsNormalizerFn<S>;
export declare function forTexts<S extends object = object>(normalizer: TypedNormalizerFn<Text, S>): SettingsNormalizerFn<S>;
export declare function forComments<S extends object = object>(normalizer: TypedNormalizerFn<Comment, S>): SettingsNormalizerFn<S>;
export {};
