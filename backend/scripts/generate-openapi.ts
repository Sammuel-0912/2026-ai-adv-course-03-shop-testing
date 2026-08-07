/**
 * 從 zod schema 產生 backend/openapi.json。
 *
 *   pnpm openapi:generate   產生並寫檔
 *   pnpm openapi:check      只比對，內容不一致就以非 0 結束（給 CI／code review 當漂移守門員）
 *
 * 不要手改 openapi.json —— 契約異動一律先改 src/openapi/schemas/，再重跑本 script。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import SwaggerParser from 'swagger-parser';
import { buildOpenApiDocument } from '../src/openapi/document.js';

const OUTPUT_PATH = path.join(import.meta.dirname, '../openapi.json');

// swagger-parser 的 index.d.ts 以 `import * as` 轉出 @apidevtools/swagger-parser 的 `export = class`，
// 型別上會遺失 static 方法（runtime 正常）。在此窄化回實際的 runtime 介面。
const parser = SwaggerParser as unknown as { validate(api: object): Promise<unknown> };

const checkOnly = process.argv.includes('--check');

const document = buildOpenApiDocument();

// validate() 會就地 dereference，先深拷貝一份避免污染要寫出的文件
await parser.validate(structuredClone(document));

const serialized = `${JSON.stringify(document, null, 2)}\n`;

if (checkOnly) {
  let current: string;
  try {
    current = readFileSync(OUTPUT_PATH, 'utf8');
  } catch {
    console.error('❌ 找不到 openapi.json，請先執行 `pnpm openapi:generate`');
    process.exit(1);
  }

  if (current !== serialized) {
    console.error('❌ openapi.json 與 zod schema 不同步，請執行 `pnpm openapi:generate` 後重新提交');
    process.exit(1);
  }

  console.log('✅ openapi.json 與 zod schema 同步');
} else {
  writeFileSync(OUTPUT_PATH, serialized);
  const pathCount = Object.keys(document.paths ?? {}).length;
  const schemaCount = Object.keys(document.components?.schemas ?? {}).length;
  console.log(`✅ 已產生 openapi.json（${pathCount} 條路徑、${schemaCount} 個 schema）`);
}
