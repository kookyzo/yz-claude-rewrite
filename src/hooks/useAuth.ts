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
    const current = useUserStore.getState()
    if (current.isLoggedIn && current.userId) return true
    try {
      await useUserStore.getState().login()
      const next = useUserStore.getState()
      return next.isLoggedIn && !!next.userId
    } catch {
      return false
    }
  }

  const ensureRegistered = async (): Promise<boolean> => {
    const loggedIn = await ensureLogin()
    if (!loggedIn) return false

    const beforeFetch = useUserStore.getState()
    if (beforeFetch.isRegistered) return true

    try {
      await beforeFetch.fetchUserInfo()
    } catch {
      // Ignore and fallback to registration check below.
    }

    if (useUserStore.getState().isRegistered) return true

    Taro.navigateTo({ url: '/pages-sub/register/index' })
    return false
  }

  return { isLoggedIn, isRegistered, userId, userInfo, ensureLogin, ensureRegistered }
}
