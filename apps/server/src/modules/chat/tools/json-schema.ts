import { z } from "zod";

type JsonSchema = Record<string, unknown>;

/**
 * zod schema → JSON Schema accepted by OpenAI strict mode (D-27):
 * - every object has `additionalProperties: false`;
 * - every property is listed in `required` (optional fields must be `.nullable()`,
 *   and the tool treats null as "not provided").
 *
 * An `.optional()` field is a programming error here, not something to patch
 * silently: the API would reject the tool at request time, so this throws when the
 * registry is built (and in the registry test).
 */
export function toStrictJsonSchema(schema: z.ZodType): JsonSchema {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema, { io: "input" }) as JsonSchema;
  enforceStrict(json, "$");
  return json;
}

function enforceStrict(node: unknown, path: string): void {
  if (Array.isArray(node)) {
    node.forEach((item, index) => enforceStrict(item, `${path}[${index}]`));
    return;
  }
  if (typeof node !== "object" || node === null) return;

  const schema = node as JsonSchema;
  if (schema.type === "object") {
    const properties = (schema.properties ?? {}) as Record<string, unknown>;
    const required = new Set((schema.required as string[] | undefined) ?? []);
    const optional = Object.keys(properties).filter((key) => !required.has(key));
    if (optional.length > 0) {
      throw new Error(`Strict tool schema: ${path} has optional fields (${optional.join(", ")}); use .nullable()`);
    }
    schema.properties = properties;
    schema.required = Object.keys(properties);
    schema.additionalProperties = false;
  }

  for (const [key, value] of Object.entries(schema)) enforceStrict(value, `${path}.${key}`);
}
