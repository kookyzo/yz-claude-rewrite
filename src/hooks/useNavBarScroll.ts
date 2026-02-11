import { useState } from 'react'
import { usePageScroll } from '@tarojs/taro'

interface UseNavBarScrollOptions {
  criticalScrollTop?: number
  fromColor?: string
  toColor?: string
}

interface UseNavBarScrollReturn {
  backgroundColor: string
  textColor: string
  opacity: number
}

export function useNavBarScroll(
  options?: UseNavBarScrollOptions,
): UseNavBarScrollReturn {
  const criticalScrollTop = options?.criticalScrollTop ?? 400

  const [backgroundColor, setBackgroundColor] = useState('#000000')
  const [textColor, setTextColor] = useState('#ffffff')
  const [opacity, setOpacity] = useState(0)

  usePageScroll((res) => {
    const newOpacity = Math.min(res.scrollTop / criticalScrollTop, 1)
    const r = Math.floor(255 * newOpacity)
    const g = Math.floor(255 * newOpacity)
    const b = Math.floor(255 * newOpacity)

    const newBg =
      '#' +
      [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')

    const newTextColor = newOpacity > 0.5 ? '#000000' : '#ffffff'

    setBackgroundColor(newBg)
    setTextColor(newTextColor)
    setOpacity(newOpacity)
  })

  return { backgroundColor, textColor, opacity }
}
