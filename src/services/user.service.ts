import { callCloudFunction } from '@/services/cloud'
import type { CloudResponse } from '@/types/api'
import type { User } from '@/types/user'

/** 微信登录（获取 openId） */
export function login(): Promise<CloudResponse<User>> {
  return callCloudFunction<User>('login', {})
}

/** 检查登录状态 */
export function checkLogin(): Promise<CloudResponse<User>> {
  return callCloudFunction<User>('login-easy', {
    action: 'checkLogin',
  })
}

/** 快捷登录（带用户信息） */
export function loginEasy(userInfo: Record<string, any>): Promise<CloudResponse<User>> {
  return callCloudFunction<User>('login-easy', {
    action: 'login',
    userInfo,
  })
}

/** 注册新用户 */
export function register(userInfo: {
  gender?: string
  title?: string
  nickname?: string
  phone?: string
  birthday?: string
  region?: string[]
  mail?: string
}): Promise<CloudResponse<User>> {
  return callCloudFunction<User>('sign_up', { userInfo })
}

/** 获取当前用户信息 */
export function getUserInfo(): Promise<CloudResponse<User>> {
  return callCloudFunction<User>('getUserInfo', {})
}

/** 更新用户信息 */
export function updateUser(data: Partial<User>): Promise<CloudResponse> {
  return callCloudFunction('manage-user', {
    action: 'update',
    data,
  })
}

/** 绑定手机号 */
export function bindPhone(code: string): Promise<CloudResponse> {
  return callCloudFunction('bindPhoneNumber', { code })
}
