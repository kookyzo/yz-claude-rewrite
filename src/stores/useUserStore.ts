import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import Taro from '@tarojs/taro'
import type { User } from '@/types/user'
import * as userService from '@/services/user.service'

const taroStorage = {
  getItem: (name: string) => Taro.getStorageSync(name) || null,
  setItem: (name: string, value: string) => Taro.setStorageSync(name, value),
  removeItem: (name: string) => Taro.removeStorageSync(name),
}

interface UserState {
  isLoggedIn: boolean
  isRegistered: boolean
  userId: string | null
  openId: string | null
  userInfo: User | null

  login: () => Promise<void>
  checkLogin: () => Promise<boolean>
  fetchUserInfo: () => Promise<void>
  logout: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      isRegistered: false,
      userId: null,
      openId: null,
      userInfo: null,

      login: async () => {
        const res = await userService.login()
        if (res.code === 200 && res.data) {
          const loginData = res.data as any
          const resolvedUserId =
            loginData._userId || loginData._id || loginData.userId || null
          const resolvedOpenId =
            loginData.openid || loginData.openId || null

          set({
            isLoggedIn: true,
            userId: resolvedUserId,
            openId: resolvedOpenId,
          })
        }
      },

      checkLogin: async () => {
        const res = await userService.checkLogin()
        return res.code === 200
      },

      fetchUserInfo: async () => {
        const res = await userService.getUserInfo()
        if (res.code === 200 && res.data) {
          set((state) => ({
            isLoggedIn: true,
            isRegistered: true,
            userInfo: res.data,
            userId: res.data?._id || state.userId,
            openId: (res.data as any)?.openId || state.openId,
          }))
        } else if (res.code === 404) {
          set({ isRegistered: false, userInfo: null })
        }
      },

      logout: () => {
        set({
          isLoggedIn: false,
          isRegistered: false,
          userId: null,
          openId: null,
          userInfo: null,
        })
      },
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => taroStorage),
      partialize: (state) => ({
        isLoggedIn: state.isLoggedIn,
        userId: state.userId,
        openId: state.openId,
      }),
    },
  ),
)
