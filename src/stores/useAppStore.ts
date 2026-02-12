import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import Taro from '@tarojs/taro'
import { getNormalizedSystemInfo, getMenuButtonInfo } from '@/utils/systemInfo'

const taroStorage = {
  getItem: (name: string) => Taro.getStorageSync(name) || null,
  setItem: (name: string, value: string) => Taro.setStorageSync(name, value),
  removeItem: (name: string) => Taro.removeStorageSync(name),
}

interface SystemInfo {
  statusBarHeight: number
  menuButtonRect: {
    top: number
    bottom: number
    left: number
    right: number
    width: number
    height: number
  }
  navBarHeight: number
  screenWidth: number
  screenHeight: number
  safeArea: {
    top: number
    bottom: number
    left: number
    right: number
    width: number
    height: number
  }
  pixelRatio: number
  platform: string
}

interface AppState {
  systemInfo: SystemInfo | null
  currentTab: number
  privacyAgreed: boolean

  setCurrentTab: (index: number) => void
  initSystemInfo: () => void
  agreePrivacy: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      systemInfo: null,
      currentTab: 0,
      privacyAgreed: false,

      setCurrentTab: (index) => {
        set({ currentTab: index })
      },

      initSystemInfo: () => {
        const sysInfo = getNormalizedSystemInfo()
        const { menuButtonRect, hasValidRect } = getMenuButtonInfo()
        const statusBarHeight = sysInfo.statusBarHeight
        const topGap = Math.max(menuButtonRect.top - statusBarHeight, 0)
        const navBarHeight = hasValidRect ? topGap * 2 + menuButtonRect.height : 44

        set({
          systemInfo: {
            statusBarHeight,
            menuButtonRect,
            navBarHeight,
            screenWidth: sysInfo.screenWidth,
            screenHeight: sysInfo.screenHeight,
            safeArea: {
              top: sysInfo.safeArea?.top ?? 0,
              bottom: sysInfo.safeArea?.bottom ?? 0,
              left: sysInfo.safeArea?.left ?? 0,
              right: sysInfo.safeArea?.right ?? 0,
              width: sysInfo.safeArea?.width ?? 0,
              height: sysInfo.safeArea?.height ?? 0,
            },
            pixelRatio: sysInfo.pixelRatio,
            platform: sysInfo.platform,
          },
        })
      },

      agreePrivacy: () => {
        set({ privacyAgreed: true })
      },
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => taroStorage),
      partialize: (state) => ({
        privacyAgreed: state.privacyAgreed,
      }),
    },
  ),
)
