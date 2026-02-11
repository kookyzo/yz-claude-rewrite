import Taro from '@tarojs/taro'
import type { User } from '@/types/user'
import { useUserStore } from '@/stores/useUserStore'

interface UseAuthReturn {
  isLoggedIn: boolean
  isRegistered: boolean
  userId: string | null
  userInfo: User | null
  ensureLogin: () => Promise<boolean>
  ensureRegistered: () => Promise<boolean>
}

export function useAuth(): UseAuthReturn {
  const { isLoggedIn, isRegistered, userId, userInfo, login } = useUserStore()

  const ensureLogin = async (): Promise<boolean> => {
    if (isLoggedIn) return true
    try {
      await useUserStore.getState().login()
      return useUserStore.getState().isLoggedIn
    } catch {
      return false
    }
  }

  const ensureRegistered = async (): Promise<boolean> => {
    if (isRegistered) return true
    Taro.navigateTo({ url: '/pages-sub/register/index' })
    return false
  }

  return { isLoggedIn, isRegistered, userId, userInfo, ensureLogin, ensureRegistered }
}
