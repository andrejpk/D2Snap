import { type NormalizerContext } from "../types.js";
import { NodeType } from "../enums.js";


type TypedNormalizerFn<T extends Node, S extends object> = (
	virtualTarget: T,
	liveTarget: T,
	context: NormalizerContext,
	settings?: Partial<S>
) => void;

type SettingsNormalizerFn<S extends object> = (
	virtualNode: Node,
	liveNode: Node,
	context: NormalizerContext,
	settings?: Partial<S>
) => void;


// Element normalizer as node normalizer (type check and cast done).
export function forElements<S extends object = object>(normalizer: TypedNormalizerFn<Element, S>): SettingsNormalizerFn<S> {
	return (virtualNode: Node, liveNode: Node, context: NormalizerContext, settings?: Partial<S>): void => {
		if(virtualNode.nodeType !== NodeType.ELEMENT_NODE) return;

		normalizer(virtualNode as Element, liveNode as Element, context, settings);
	};
}

// Attribute normalizer as node normalizer (type check and cast done).
export function forAttributes<S extends object = object>(normalizer: TypedNormalizerFn<Attr, S>): SettingsNormalizerFn<S> {
	return (virtualNode: Node, liveNode: Node, context: NormalizerContext, settings?: Partial<S>): void => {
		if(virtualNode.nodeType !== NodeType.ATTRIBUTE_NODE) return;

		normalizer(virtualNode as Attr, liveNode as Attr, context, settings);
	};
}

// Text normalizer as node normalizer (type check and cast done).
export function forTexts<S extends object = object>(normalizer: TypedNormalizerFn<Text, S>): SettingsNormalizerFn<S> {
	return (virtualNode: Node, liveNode: Node, context: NormalizerContext, settings?: Partial<S>): void => {
		if(virtualNode.nodeType !== NodeType.TEXT_NODE) return;

		normalizer(virtualNode as Text, liveNode as Text, context, settings);
	};
}

// Comment normalizer as node normalizer (type check and cast done).
export function forComments<S extends object = object>(normalizer: TypedNormalizerFn<Comment, S>): SettingsNormalizerFn<S> {
	return (virtualNode: Node, liveNode: Node, context: NormalizerContext, settings?: Partial<S>): void => {
		if(virtualNode.nodeType !== NodeType.COMMENT_NODE) return;

		normalizer(virtualNode as Comment, liveNode as Comment, context, settings);
	};
}
