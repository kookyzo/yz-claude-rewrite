import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Image } from '@tarojs/components'
import styles from './index.module.scss'

interface LoadingBarProps {
  /** 控制显示隐藏 */
  visible: boolean
  /** 加载完成回调（进度到 100% 并隐藏后触发） */
  onFinish?: () => void
}

export default function LoadingBar({ visible, onFinish }: LoadingBarProps) {
  const [progress, setProgress] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (visible) {
      setProgress(0)
      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          const increment = Math.floor(Math.random() * 11) + 5
          return Math.min(prev + increment, 95)
        })
      }, 150)
    } else {
      clearTimer()
      // 隐藏时设为 100%，300ms 后重置
      setProgress((prev) => {
        if (prev > 0) {
          setTimeout(() => {
            setProgress(0)
            onFinish?.()
          }, 300)
          return 100
        }
        return prev
      })
    }

    return clearTimer
  }, [visible, clearTimer, onFinish])

  // 组件卸载时清除定时器
  useEffect(() => clearTimer, [clearTimer])

  if (!visible && progress === 0) return null

  return (
    <View className={styles.overlay}>
      <Image
        className={styles.logo}
        src='/assets/icons/top.png'
        mode='aspectFit'
      />
      <View className={styles.trackBar}>
        <View
          className={styles.fillBar}
          style={{ width: `${progress}%` }}
        />
      </View>
    </View>
  )
}
