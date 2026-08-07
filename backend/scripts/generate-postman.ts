/**
 * 從 backend/openapi.json 產生 Postman collection。
 *
 *   pnpm postman:generate   產生並寫檔
 *   pnpm postman:check      只比對，內容不一致就以非 0 結束
 *
 * 不要手改 postman/collection.json —— 契約異動一律「先改 zod schema →
 * pnpm openapi:generate → pnpm postman:generate」。
 *
 * openapi-to-postmanv2 的原始輸出無法直接使用，本 script 額外做三件事：
 *   1. 去除隨機 id（_postman_id 與每個 response 的 id），讓輸出可重現。
 *   2. 把寫死的帳密、路徑參數換成 environment 變數。
 *   3. 在登入／建立訂單／建立優惠券掛上「把回應寫回變數」的 script，
 *      讓整份 collection 可以從頭跑到尾。**只做變數擷取，不做任何斷言**
 *      （契約斷言是後續 contract test 階段的工作）。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { convert } from 'openapi-to-postmanv2';

const ROOT = path.join(import.meta.dirname, '..');
const SPEC_PATH = path.join(ROOT, 'openapi.json');
const OUTPUT_PATH = path.join(ROOT, 'postman/collection.json');

// 固定 id：openapi-to-postmanv2 每次都會產新的 UUID，寫死才能做漂移檢查
const COLLECTION_ID = '5f0a5c3e-9d21-4c7b-9f8e-2a1b3c4d5e6f';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const checkOnly = process.argv.includes('--check');

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

// ------------------------------------------------------------ 產生原始 collection

const collection: Json = await new Promise((resolve, reject) => {
  convert(
    { type: 'string', data: readFileSync(SPEC_PATH, 'utf8') },
    {
      folderStrategy: 'Tags',
      requestNameSource: 'Fallback',
      // 用 schema 裡的 example 當請求值（seed 資料），而不是隨機假資料
      requestParametersResolution: 'Example',
      exampleParametersResolution: 'Example',
      includeAuthInfoInExample: false,
    },
    (err, result: Json) => {
      if (err) return reject(new Error(err.message));
      if (!result.result) return reject(new Error(String(result.reason)));
      resolve(result.output[0].data);
    }
  );
});

// ------------------------------------------------------------------- 後處理工具

/** 遞迴移除隨機 uuid 形式的 id 欄位（Postman 匯入時會自行重新產生） */
function stripRandomIds(node: Json): void {
  if (Array.isArray(node)) {
    node.forEach(stripRandomIds);
    return;
  }
  if (node === null || typeof node !== 'object') return;

  for (const key of Object.keys(node)) {
    if (key === 'id' && typeof node[key] === 'string' && UUID_RE.test(node[key])) {
      delete node[key];
      continue;
    }
    stripRandomIds(node[key]);
  }
}

const allRequests: Json[] = [];
for (const folder of collection.item ?? []) {
  for (const item of folder.item ?? []) allRequests.push(item);
}

/** 依 `METHOD /path` 找到請求（path 用 openapi 的原始寫法） */
function requestKey(item: Json): string {
  const url = item.request.url;
  return `${item.request.method} /${(url.path ?? []).join('/')}`;
}

function find(key: string): Json {
  const item = allRequests.find((i) => requestKey(i) === key);
  if (!item) throw new Error(`找不到請求 ${key}；openapi.json 的路徑可能變了`);
  return item;
}

function setBody(item: Json, body: unknown): void {
  item.request.body.raw = `${JSON.stringify(body, null, 2)}\n`;
}

/** 把 :param 的值換成 environment 變數 */
function usePathVariable(item: Json, param: string, variable: string): void {
  const target = (item.request.url.variable ?? []).find((v: Json) => v.key === param);
  if (!target) throw new Error(`${requestKey(item)} 沒有路徑參數 ${param}`);
  target.value = `{{${variable}}}`;
}

function useBearer(item: Json, variable: string): void {
  item.request.auth = { type: 'bearer', bearer: [{ key: 'token', value: `{{${variable}}}` }] };
}

/** 掛上「把回應欄位寫回 environment」的 script */
function captureToEnv(item: Json, pairs: Record<string, string>, okCodes: number[]): void {
  const lines = [
    `if (${okCodes.map((c) => `pm.response.code === ${c}`).join(' || ')}) {`,
    '  const { data } = pm.response.json();',
    ...Object.entries(pairs).map(([variable, field]) => `  pm.environment.set('${variable}', ${field});`),
    '}',
  ];

  item.event = [
    ...(item.event ?? []).filter((e: Json) => e.listen !== 'test'),
    { listen: 'test', script: { type: 'text/javascript', exec: lines } },
  ];
}

/** 複製一個既有請求，放在同一個資料夾內指定請求的後面 */
function duplicate(item: Json, newName: string): Json {
  const copy = JSON.parse(JSON.stringify(item));
  copy.name = newName;

  const folder = collection.item.find((f: Json) => (f.item ?? []).includes(item));
  folder.item.splice(folder.item.indexOf(item) + 1, 0, copy);
  allRequests.push(copy);

  return copy;
}

// ----------------------------------------------------------------- 套用後處理

// 1) 註冊：用 environment 的新帳號欄位；成功後把 token 存起來
const register = find('POST /api/auth/register');
setBody(register, {
  email: '{{newUserEmail}}',
  password: '{{newUserPassword}}',
  name: '{{newUserName}}',
});
captureToEnv(register, { token: 'data.token' }, [201]);

// 2) 登入（會員）→ token
const login = find('POST /api/auth/login');
login.name = '登入（會員）';
setBody(login, { email: '{{memberEmail}}', password: '{{memberPassword}}' });
captureToEnv(login, { token: 'data.token' }, [200]);

// 3) 登入（管理者）→ adminToken。openapi 只有一條 login，複製一份改用管理者帳密，
//    否則 collection 無法操作需要 admin 的優惠券端點。
const adminLogin = duplicate(login, '登入（管理者）');
setBody(adminLogin, { email: '{{adminEmail}}', password: '{{adminPassword}}' });
captureToEnv(adminLogin, { adminToken: 'data.token' }, [200]);

// 4) 需登入的端點改用 {{token}}（原本是預設的 {{bearerToken}}）
for (const item of allRequests) {
  const bearer = item.request.auth?.bearer?.[0];
  if (bearer?.value === '{{bearerToken}}') bearer.value = '{{token}}';
}

// 5) 管理者端點改用 {{adminToken}}
useBearer(find('POST /api/coupons'), 'adminToken');
useBearer(find('PATCH /api/coupons/:id'), 'adminToken');
// 券列表本身公開，但預設帶的 includeInactive=true 需要管理者權限
useBearer(find('GET /api/coupons'), 'adminToken');

// 6) 建立優惠券：用 environment 的代碼，成功後把 id 存起來給 PATCH 用
const createCoupon = find('POST /api/coupons');
setBody(createCoupon, {
  code: '{{newCouponCode}}',
  percentOff: 20,
  maxDiscount: 500,
  minSpend: 2000,
  usageLimit: 100,
  isActive: true,
});
captureToEnv(createCoupon, { couponId: 'data.id' }, [201]);

// 7) 路徑參數改用 environment 變數
usePathVariable(find('PATCH /api/coupons/:id'), 'id', 'couponId');
usePathVariable(find('GET /api/coupons/:code'), 'code', 'couponCode');
for (const key of [
  'GET /api/orders/:id',
  'POST /api/orders/:id/checkout',
  'POST /api/orders/:id/check-payment',
]) {
  usePathVariable(find(key), 'id', 'orderId');
}

// 8) 建立訂單：成功後把訂單 id 存起來給後面三支訂單端點用
captureToEnv(find('POST /api/orders'), { orderId: 'data.id' }, [201]);

// 9) 收斂 id 與 baseUrl
stripRandomIds(collection);
collection.info._postman_id = COLLECTION_ID;
// 保留 collection variable 當預設值；掛上 environment 時會被覆寫
collection.variable = [{ key: 'baseUrl', value: 'http://localhost:3001', type: 'string' }];

// ------------------------------------------------------------------------ 輸出

const serialized = `${JSON.stringify(collection, null, 2)}\n`;

if (checkOnly) {
  let current: string;
  try {
    current = readFileSync(OUTPUT_PATH, 'utf8');
  } catch {
    console.error('❌ 找不到 postman/collection.json，請先執行 `pnpm postman:generate`');
    process.exit(1);
  }

  if (current !== serialized) {
    console.error(
      '❌ postman/collection.json 與 openapi.json 不同步，請執行 `pnpm postman:generate` 後重新提交'
    );
    process.exit(1);
  }

  console.log('✅ postman/collection.json 與 openapi.json 同步');
} else {
  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, serialized);
  console.log(`✅ 已產生 postman/collection.json（${allRequests.length} 個請求）`);
}
