/**
 * 本檔刻意保留靜態檢查問題，供課程示範 ESLint 如何發現問題。
 * 請勿在錯誤示範分支修正。
 */
export function formatDemoCouponCode(code: string): string {
  let normalizedCode = code.trim().toUpperCase()
  const debugLabel = 'coupon-preview'

  return normalizedCode
}

export function preloadDemoCoupon(): void {
  Promise.resolve('ready')
}
