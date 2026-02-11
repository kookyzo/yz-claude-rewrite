/** 验证手机号（中国大陆） */
export function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone)
}

/** 验证邮箱 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/** 验证非空字符串 */
export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0
}
