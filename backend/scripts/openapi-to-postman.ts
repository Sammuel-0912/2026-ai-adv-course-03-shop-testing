// OpenAPI → Postman Collection 轉換器。
//
// 讀取 docs/openapi.json，輸出 docs/postman_collection.json（Postman Collection v2.1）。
// 產生的 Collection：
// - 使用 {{baseUrl}} 作為 API 網址，預設 http://localhost:3001。
// - 內建 baseUrl、token、sessionId 三個 collection 變數。
// - Collection 層級套用 Bearer {{token}}；未標記 security 的公開 API 個別設 noauth。
// - 登入成功後由測試腳本自動把 JWT 存入 token。
//
// 用法：pnpm postman（會先跑 generate-openapi 再轉換）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const INPUT = path.join(import.meta.dirname, '../../docs/openapi.json');
const OUTPUT = path.join(import.meta.dirname, '../../docs/postman_collection.json');

// ---------- 型別（僅取用到的欄位） ----------
interface Schema {
  $ref?: string;
  type?: string;
  format?: string;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
}
interface MediaType {
  schema?: Schema;
}
interface Operation {
  tags?: string[];
  summary?: string;
  security?: Array<Record<string, unknown>>;
  parameters?: Array<{ name: string; in: string }>;
  requestBody?: { content?: Record<string, MediaType> };
}
interface OpenApiDoc {
  info: { title: string; description?: string };
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, Schema> };
}

const doc = JSON.parse(readFileSync(INPUT, 'utf8')) as OpenApiDoc;
const schemas = doc.components?.schemas ?? {};

/** 解析 $ref（僅支援 #/components/schemas/*） */
function resolve(schema: Schema | undefined): Schema {
  if (!schema) return {};
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop() as string;
    return resolve(schemas[name]);
  }
  return schema;
}

/** 由 schema 產生範例值（供 Postman request body 用） */
function exampleOf(input: Schema | undefined): unknown {
  const schema = resolve(input);
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];

  switch (schema.type) {
    case 'object': {
      const obj: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(schema.properties ?? {})) {
        obj[key] = exampleOf(prop);
      }
      return obj;
    }
    case 'array':
      return [exampleOf(schema.items)];
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return false;
    default:
      return '';
  }
}

/** 路徑轉 Postman path 陣列，並收集 path 變數（{id} → :id） */
function toUrl(pathStr: string) {
  const segments = pathStr.split('/').filter(Boolean);
  const variables: Array<{ key: string; value: string }> = [];
  const postmanPath = segments.map((seg) => {
    const match = seg.match(/^\{(.+)\}$/);
    if (match) {
      variables.push({ key: match[1], value: '1' });
      return `:${match[1]}`;
    }
    return seg;
  });
  return {
    raw: `{{baseUrl}}/${postmanPath.join('/')}`,
    host: ['{{baseUrl}}'],
    path: postmanPath,
    ...(variables.length > 0 ? { variable: variables } : {}),
  };
}

/** 登入端點：成功後把 JWT 存進 token 變數 */
function loginEvent() {
  return [
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [
          "pm.test('login success', () => pm.response.code === 200);",
          'const body = pm.response.json();',
          'if (body && body.data && body.data.token) {',
          "  pm.collectionVariables.set('token', body.data.token);",
          "  console.log('token saved to collection variable');",
          '}',
        ],
      },
    },
  ];
}

// ---------- 依 tag 分組建立 folder ----------
const folders = new Map<string, { name: string; item: unknown[] }>();
function folderFor(tag: string) {
  if (!folders.has(tag)) folders.set(tag, { name: tag, item: [] });
  return folders.get(tag)!;
}

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

for (const [pathStr, ops] of Object.entries(doc.paths)) {
  for (const method of METHODS) {
    const op = ops[method];
    if (!op) continue;

    const tag = op.tags?.[0] ?? 'default';
    const bodySchema = op.requestBody?.content?.['application/json']?.schema;
    const hasBody = Boolean(bodySchema);
    const isPublic = !op.security || op.security.length === 0;

    const request: Record<string, unknown> = {
      method: method.toUpperCase(),
      header: hasBody ? [{ key: 'Content-Type', value: 'application/json' }] : [],
      url: toUrl(pathStr),
    };
    if (hasBody) {
      request.body = {
        mode: 'raw',
        raw: JSON.stringify(exampleOf(bodySchema), null, 2),
        options: { raw: { language: 'json' } },
      };
    }
    // 公開端點明確標 noauth；需登入端點沿用 collection 層級的 Bearer {{token}}
    if (isPublic) {
      request.auth = { type: 'noauth' };
    }

    const item: Record<string, unknown> = {
      name: `${method.toUpperCase()} ${pathStr}${op.summary ? ` — ${op.summary}` : ''}`,
      request,
      response: [],
    };
    if (pathStr === '/api/auth/login' && method === 'post') {
      item.event = loginEvent();
    }

    folderFor(tag).item.push(item);
  }
}

const collection = {
  info: {
    name: doc.info.title,
    description: doc.info.description ?? '',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [...folders.values()],
  auth: {
    type: 'bearer',
    bearer: [{ key: 'token', value: '{{token}}', type: 'string' }],
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3001', type: 'string' },
    { key: 'token', value: '', type: 'string' },
    { key: 'sessionId', value: '', type: 'string' },
  ],
};

mkdirSync(path.dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(collection, null, 2) + '\n', 'utf8');
console.log(`[openapi-to-postman] 已輸出 ${path.relative(process.cwd(), OUTPUT)}`);
