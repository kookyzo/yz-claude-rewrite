import Taro from '@tarojs/taro'
import { PropsWithChildren } from 'react'
import './app.scss'

function App({ children }: PropsWithChildren) {
  Taro.cloud.init({
    env: 'cloud1-9glm8muj52815539',
    traceUser: true,
  })
  return children
}

export default App
