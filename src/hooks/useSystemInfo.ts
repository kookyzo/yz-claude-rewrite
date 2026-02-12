import { useAppStore } from '@/stores/useAppStore'
import {
  getNormalizedSystemInfo,
  getMenuButtonInfo,
  DEFAULT_MENU_BUTTON_RECT,
} from '@/utils/systemInfo'

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

const defaultSystemInfo: UseSystemInfoReturn = {
  statusBarHeight: 20,
  navBarHeight: 44,
  menuButtonRect: DEFAULT_MENU_BUTTON_RECT,
  screenWidth: 375,
  safeAreaBottom: 0,
}

function getRuntimeSystemInfo(): UseSystemInfoReturn {
  try {
    const sysInfo = getNormalizedSystemInfo()
    const { menuButtonRect, hasValidRect } = getMenuButtonInfo()

    const statusBarHeight = sysInfo.statusBarHeight
    const screenWidth = sysInfo.screenWidth
    const safeAreaBottom = sysInfo.safeArea.bottom

    const topGap = Math.max(menuButtonRect.top - statusBarHeight, 0)
    const navBarHeight = hasValidRect
      ? topGap * 2 + menuButtonRect.height
      : defaultSystemInfo.navBarHeight

    return {
      statusBarHeight,
      navBarHeight,
      menuButtonRect,
      screenWidth,
      safeAreaBottom,
    }
  } catch {
    return defaultSystemInfo
  }
}

export function useSystemInfo(): UseSystemInfoReturn {
  const systemInfo = useAppStore((s) => s.systemInfo)

  if (!systemInfo || systemInfo.statusBarHeight <= 0 || systemInfo.navBarHeight <= 0) {
    return getRuntimeSystemInfo()
  }

  return {
    statusBarHeight: systemInfo.statusBarHeight,
    navBarHeight: systemInfo.navBarHeight,
    menuButtonRect: systemInfo.menuButtonRect,
    screenWidth: systemInfo.screenWidth,
    safeAreaBottom: systemInfo.safeArea.bottom,
  }
}
