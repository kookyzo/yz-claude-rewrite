import { View, Image } from "@tarojs/components";
import { useSystemInfo } from "@/hooks/useSystemInfo";
import styles from "./index.module.scss";

export const TOP_BAR_BOTTOM_PADDING_RPX = 24;

interface TopBarProps {
  /** Logo 图片路径，默认 '/assets/icons/top.png' */
  imageSrc?: string;
  /** 背景色，默认 'transparent' */
  backgroundColor?: string;
}

export default function TopBar({
  imageSrc = "/assets/icons/top2.png",
  backgroundColor = "#fff",
}: TopBarProps) {
  const { statusBarHeight, navBarHeight } = useSystemInfo();

  return (
    <View
      className={styles.wrapper}
      style={{
        paddingTop: `${statusBarHeight}px`,
        paddingBottom: `${TOP_BAR_BOTTOM_PADDING_RPX}rpx`,
        backgroundColor,
      }}
    >
      <View className={styles.content} style={{ height: `${navBarHeight}px` }}>
        <Image
          className={styles.logo}
          src={imageSrc}
          mode="heightFix"
          style={{ height: `${navBarHeight - 8}px` }}
        />
      </View>
    </View>
  );
}
