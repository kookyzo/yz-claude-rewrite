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
          set({
            isLoggedIn: true,
            userId: res.data.userId,
            openId: res.data.openId,
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
          set({ isRegistered: true, userInfo: res.data })
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
