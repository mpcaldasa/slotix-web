import { readFileSync, writeFileSync } from 'node:fs';
import { format } from 'prettier';
const document = JSON.parse(
  readFileSync(new URL('../contracts/openapi.json', import.meta.url), 'utf8'),
);
function type(schema) {
  if (schema.$ref) return `components['schemas'][${JSON.stringify(schema.$ref.split('/').at(-1))}]`;
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  if (schema.allOf) return schema.allOf.map(type).join(' & ');
  if (schema.oneOf || schema.anyOf) return (schema.oneOf ?? schema.anyOf).map(type).join(' | ');
  if (Array.isArray(schema.type))
    return schema.type.map((value) => type({ ...schema, type: value })).join(' | ');
  if (schema.type === 'array') return `Array<${type(schema.items)}>`;
  if (schema.type === 'string') return 'string';
  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'null') return 'null';
  if (schema.type === 'object' || schema.properties) {
    if (schema.additionalProperties)
      return `Record<string, ${schema.additionalProperties === true ? 'unknown' : type(schema.additionalProperties)}>`;
    return `{ ${Object.entries(schema.properties ?? {})
      .map(
        ([key, value]) =>
          `${JSON.stringify(key)}${schema.required?.includes(key) ? '' : '?'}: ${type(value)}`,
      )
      .join('; ')} }`;
  }
  throw new Error(`Unsupported schema: ${JSON.stringify(schema)}`);
}
const output =
  '// Generated from contracts/openapi.json. Do not edit.\nexport interface components {\n  schemas: {\n' +
  Object.entries(document.components.schemas)
    .map(([key, schema]) => `    ${JSON.stringify(key)}: ${type(schema)};`)
    .join('\n') +
  '\n  };\n}\n';
const outputUrl = new URL('../src/app/core/openapi.d.ts', import.meta.url);
const formatted = await format(output, {
  parser: 'typescript',
  singleQuote: true,
  printWidth: 100,
});
if (process.argv.includes('--check')) {
  if (readFileSync(outputUrl, 'utf8') !== formatted) {
    console.error('Generated OpenAPI types are stale. Run npm run contract:generate.');
    process.exitCode = 1;
  }
} else {
  writeFileSync(outputUrl, formatted);
}
