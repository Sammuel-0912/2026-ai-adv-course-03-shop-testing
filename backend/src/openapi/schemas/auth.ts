import { z } from '../zod.js';

/** 與原本 routes/auth.ts 的手寫驗證同一份 regex */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const UserSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    email: z.email().openapi({ example: 'user@example.com' }),
    name: z.string().openapi({ example: '測試會員' }),
  })
  .openapi('User');

export const AuthResultSchema = z
  .object({
    token: z.string().openapi({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' }),
    user: UserSchema,
  })
  .openapi('AuthResult');

// 欄位順序即驗證順序：validateBody 取 issues[0]，
// 必須維持 email → password → name，與原本依序 if 檢查的行為一致
export const RegisterRequestSchema = z
  .object({
    email: z
      .string({ error: 'Email 格式不正確' })
      .regex(EMAIL_REGEX, 'Email 格式不正確')
      .openapi({ example: 'user@example.com' }),
    password: z
      .string({ error: '密碼長度至少 8 碼' })
      .min(8, '密碼長度至少 8 碼')
      .openapi({ example: '12345678' }),
    name: z
      .string({ error: '姓名為必填' })
      .trim()
      .min(1, '姓名為必填')
      .openapi({ example: '測試會員' }),
  })
  .openapi('RegisterRequest');

// 僅供文件使用：login 不掛 validateBody，
// 缺欄位／格式錯誤一律落到 401 INVALID_CREDENTIALS（不洩漏帳號是否存在）
export const LoginRequestSchema = z
  .object({
    email: z.string().openapi({ example: 'user@example.com' }),
    password: z.string().openapi({ example: '12345678' }),
  })
  .openapi('LoginRequest');
