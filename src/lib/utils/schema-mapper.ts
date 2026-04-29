import { z } from "zod";

export function mapSchemaToZod(
  customSchema: Record<string, any> = {},
): z.ZodObject<any, any> {
  if (!customSchema || Object.keys(customSchema).length === 0) {
    return z.object({});
  }

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, typeHint] of Object.entries(customSchema)) {
    // 1. Handle nested Arrays of Objects
    if (Array.isArray(typeHint)) {
      shape[key] = z.array(mapSchemaToZod(typeHint[0]));
      continue;
    }

    // 2. Handle nested Objects
    if (typeof typeHint === "object" && typeHint !== null) {
      shape[key] = mapSchemaToZod(typeHint);
      continue;
    }

    // 3. Handle Primitives
    const isOptional = String(typeHint).endsWith("?");
    const cleanType = String(typeHint).replace("?", "").toLowerCase();

    let zType: z.ZodTypeAny;
    if (cleanType === "number") zType = z.number();
    else if (cleanType === "boolean") zType = z.boolean();
    else if (cleanType === "array<string>" || cleanType === "string[]")
      zType = z.array(z.string());
    else if (cleanType.includes("array") || cleanType.includes("[]"))
      zType = z.array(z.any());
    else if (cleanType === "object" || cleanType === "dict")
      zType = z.record(z.string(), z.any());
    else zType = z.string();

    shape[key] = isOptional ? zType.nullable() : zType;
  }

  return z.object(shape);
}
