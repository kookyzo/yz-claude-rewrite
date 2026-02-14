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
  const isLoggedIn = useUserStore(state => state.isLoggedIn)
  const isRegistered = useUserStore(state => state.isRegistered)
  const userId = useUserStore(state => state.userId)
  const userInfo = useUserStore(state => state.userInfo)

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
