import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// 全專案唯一的 extend 點：讓 zod schema 可以呼叫 .openapi()
// 其他檔案一律 `import { z } from '.../openapi/zod.js'`，不要直接 from 'zod'
extendZodWithOpenApi(z);

export { z };
