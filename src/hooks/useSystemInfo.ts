import { useAppStore } from '@/stores/useAppStore'

interface UseSystemInfoReturn {
  statusBarHeight: number
  navBarHeight: number
  menuButtonRect: {
    top: number
    bottom: number
    left: number
    right: number
    width: number
    height: number
  }
  screenWidth: number
  safeAreaBottom: number
}

const defaultMenuButtonRect = {
  top: 26,
  bottom: 58,
  left: 278,
  right: 365,
  width: 87,
  height: 32,
}

export function useSystemInfo(): UseSystemInfoReturn {
  const systemInfo = useAppStore((s) => s.systemInfo)

  if (!systemInfo) {
    return {
      statusBarHeight: 20,
      navBarHeight: 44,
      menuButtonRect: defaultMenuButtonRect,
      screenWidth: 375,
      safeAreaBottom: 0,
    }
  }

  return {
    statusBarHeight: systemInfo.statusBarHeight,
    navBarHeight: systemInfo.navBarHeight,
    menuButtonRect: systemInfo.menuButtonRect,
    screenWidth: systemInfo.screenWidth,
    safeAreaBottom: systemInfo.safeArea.bottom,
  }
}
