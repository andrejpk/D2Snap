import { createHash } from "node:crypto";

export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export interface JsonObject { [key: string]: JsonValue }
declare const digestBrand: unique symbol;
export type Sha256 = string & { readonly [digestBrand]: true };

export function assertSha256(value: unknown): asserts value is Sha256 {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new TypeError("Expected a lowercase, 64-character SHA-256 digest");
  }
}

/** Sorted UTF-16 object keys, ordered arrays, JSON number/string encoding; no normalization. */
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  function encode(item: unknown): string {
    if (item === null) return "null";
    if (typeof item === "string" || typeof item === "boolean") return JSON.stringify(item);
    if (typeof item === "number" && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== "object") throw new TypeError("Unsupported canonical JSON value");
    if (ancestors.has(item)) throw new TypeError("Cyclic canonical JSON value");
    const array = Array.isArray(item);
    if (array && Object.getPrototypeOf(item) !== Array.prototype) {
      throw new TypeError("Canonical JSON requires ordinary arrays");
    }
    if (!array && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
      throw new TypeError("Canonical JSON requires plain objects");
    }
    ancestors.add(item);
    try {
      const keys = Reflect.ownKeys(item);
      if (keys.some(key => typeof key === "symbol")) throw new TypeError("Symbol keys are unsupported");
      const strings = keys as string[];
      const data = (key: string): unknown => {
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
          throw new TypeError("Canonical JSON requires enumerable data properties (no holes or getters)");
        }
        return descriptor.value;
      };
      if (array) {
        if (strings.length !== item.length + 1) throw new TypeError("Array holes or extra properties");
        const entries: string[] = [];
        for (let i = 0; i < item.length; i++) entries.push(encode(data(String(i))));
        return `[${entries.join(",")}]`;
      }
      return `{${strings.sort().map(key => `${JSON.stringify(key)}:${encode(data(key))}`).join(",")}}`;
    } finally {
      ancestors.delete(item);
    }
  }
  return encode(value);
}

export function sha256(bytes: string | Uint8Array): Sha256 {
  return createHash("sha256").update(bytes).digest("hex") as Sha256;
}

export function hashManifest(domain: string, schema: number, manifest: unknown): Sha256 {
  if (!/^[a-z][a-z0-9.-]*$/.test(domain) || !Number.isSafeInteger(schema) || schema < 1) {
    throw new TypeError("Invalid manifest domain or schema version");
  }
  return sha256(canonicalJson({ domain, schema, manifest }));
}

export function assertObject(value: unknown): asserts value is JsonObject {
  canonicalJson(value);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Expected a JSON object");
  }
}

export function assertFields(value: unknown, fields: readonly string[]): asserts value is JsonObject {
  assertObject(value);
  const keys = Object.keys(value);
  if (keys.length !== fields.length || fields.some(key => !Object.hasOwn(value, key))) {
    throw new TypeError(`Expected exactly these fields: ${fields.join(", ")}`);
  }
}

export function assertText(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.length) throw new TypeError("Expected a nonempty string");
}
