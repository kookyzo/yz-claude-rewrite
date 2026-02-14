import { useState, useCallback, useMemo } from "react";
import { View, Text, Image, ScrollView, Button } from "@tarojs/components";
import { useLoad, useDidShow } from "@tarojs/taro";
import { useAuth } from "@/hooks/useAuth";
import { useSystemInfo } from "@/hooks/useSystemInfo";
import { useUserStore } from "@/stores/useUserStore";
import { useAppStore } from "@/stores/useAppStore";
import * as wishService from "@/services/wish.service";
import { navigateTo } from "@/utils/navigation";
import TopBar, { TOP_BAR_BOTTOM_PADDING_RPX } from "@/components/TopBar";
import FloatBtn from "@/components/FloatBtn";
import FloatPopup from "@/components/FloatPopup";
import LoadingBar from "@/components/LoadingBar";
import CustomTabBar from "@/custom-tab-bar";
import styles from "./index.module.scss";

const TOP_BAR_CONTENT_MARGIN_TOP_RPX = 20;

/** 复姓列表 */
const COMPOUND_SURNAMES = [
  "欧阳",
  "太史",
  "端木",
  "上官",
  "司马",
  "东方",
  "独孤",
  "南宫",
  "诸葛",
  "闻人",
  "夏侯",
  "皇甫",
  "公孙",
  "长孙",
  "慕容",
  "司徒",
  "司空",
  "宇文",
  "尉迟",
  "令狐",
  "西门",
];

/** 计算问候语 */
function computeGreeting(
  userInfo: { nickname?: string; lastName?: string; title?: string } | null,
): string {
  if (!userInfo) return "欢迎";
  const name = userInfo.nickname || userInfo.lastName || "";
  if (!name) return "欢迎";

  // 提取姓氏
  let surname = name.substring(0, 1);
  for (const cs of COMPOUND_SURNAMES) {
    if (name.startsWith(cs)) {
      surname = cs;
      break;
    }
  }

  const title = userInfo.title || "";
  return title ? `${surname}${title}` : name;
}

export default function My() {
  const { ensureLogin } = useAuth();
  const { statusBarHeight, navBarHeight, screenWidth } = useSystemInfo();
  const isRegistered = useUserStore(state => state.isRegistered);
  const fetchUserInfo = useUserStore(state => state.fetchUserInfo);

  const [isPopupShow, setIsPopupShow] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [greeting, setGreeting] = useState("欢迎");
  const [wishlistCount, setWishlistCount] = useState(0);
  const topBarHeightRpx = useMemo(() => {
    const rpxRatio = 750 / screenWidth;
    return (
      (statusBarHeight + navBarHeight) * rpxRatio +
      TOP_BAR_BOTTOM_PADDING_RPX +
      TOP_BAR_CONTENT_MARGIN_TOP_RPX
    );
  }, [statusBarHeight, navBarHeight, screenWidth]);

  const loadUserData = useCallback(async () => {
    try {
      await fetchUserInfo();
      const currentState = useUserStore.getState();
      setGreeting(computeGreeting(currentState.userInfo));

      // 获取心愿单数量
      if (currentState.userId) {
        try {
          const res = await wishService.listWishes(currentState.userId);
          const list = Array.isArray(res.data) ? res.data : [];
          setWishlistCount(list.length);
        } catch {
          // 心愿单获取失败静默处理
        }
      }
    } catch {
      // 用户信息获取失败静默处理
    } finally {
      setPageLoading(false);
    }
  }, [fetchUserInfo]);

  useLoad(() => {
    setPageLoading(true);
    ensureLogin().then(() => loadUserData());
  });

  useDidShow(() => {
    useAppStore.getState().setCurrentTab(3);
    // 从编辑信息页返回时重新计算问候语
    const currentState = useUserStore.getState();
    setGreeting(computeGreeting(currentState.userInfo));
  });

  /** 我的订单 */
  const goToOrders = () => {
    navigateTo("/pages-sub/order-list/index?tab=1");
  };

  /** 心愿单 */
  const goToWishlist = () => {
    navigateTo("/pages-sub/wishlist/index");
  };

  /** 个人信息 / 注册 */
  const goToPersonalInfo = () => {
    if (isRegistered) {
      navigateTo("/pages-sub/edit-info/index");
    } else {
      navigateTo("/pages-sub/register/index");
    }
  };

  /** 售后服务 */
  const goToAfterSales = () => {
    navigateTo("/pages-sub/after-sales/index");
  };

  /** 隐私政策 */
  const goToPrivacyPolicy = () => {
    navigateTo("/pages-sub/privacy-policy/index");
  };

  /** 用户协议 */
  const goToUserAgreement = () => {
    navigateTo("/pages-sub/user-agreement/index");
  };

  return (
    <>
      <TopBar backgroundColor="white" />
      <LoadingBar visible={pageLoading} />
      <View
        className={styles.container}
        style={{ height: `calc(100vh - ${topBarHeightRpx}rpx)` }}
      >
        {/* 顶部欢迎区 */}
        <View
          className={styles.topImageContainer}
          style={{ marginTop: `${topBarHeightRpx - 28}rpx` }}
        >
          <Image
            className={styles.topImage}
            src="/assets/icons/my_top_image.jpg"
            mode="aspectFill"
          />
          <View className={styles.userName}>
            <Text className={styles.welcomeText}>您好，欢迎来到Y.ZHENG</Text>
            <Text className={styles.greetingText}>{greeting}</Text>
          </View>
        </View>

        {/* 主内容区域 */}
        <View className={styles.mainContentContainer}>
          {/* 功能入口区域 */}
          <View className={styles.functionEntryArea}>
            <View className={styles.functionItem} onClick={goToOrders}>
              <Image
                className={styles.functionIcon}
                src="/assets/icons/my_order.png"
                mode="aspectFit"
              />
              <Text className={styles.functionText}>我的订单</Text>
            </View>
            <View className={styles.functionItem} onClick={goToWishlist}>
              <Image
                className={styles.functionIcon}
                src="/assets/icons/my_heart.png"
                mode="aspectFit"
              />
              {/* {wishlistCount > 0 && (
                  <View className={styles.badge}>
                    <Text className={styles.badgeText}>
                      {wishlistCount > 99 ? "99+" : wishlistCount}
                    </Text>
                  </View>
                )} */}

              <Text className={styles.functionText}>我的心愿</Text>
            </View>
            <View className={styles.functionItem} onClick={goToPersonalInfo}>
              <Image
                className={styles.functionIcon}
                src="/assets/icons/my_edit.png"
                mode="aspectFit"
              />
              <Text className={styles.functionText}>个人信息</Text>
            </View>
            <View className={styles.functionItem} onClick={goToAfterSales}>
              <Image
                className={styles.functionIcon}
                src="/assets/icons/my_service.png"
                mode="aspectFit"
              />
              <Text className={styles.functionText}>售后服务</Text>
            </View>
          </View>

          {/* 可滚动内容区域 */}
          <ScrollView className={styles.scrollableContent} scrollY>
            {/* 客户服务区域 */}
            <View className={styles.customerServiceArea}>
              <Text className={styles.serviceTitle}>客户服务</Text>
              <Button className={styles.contactBtn} openType="contact">
                <Text className={styles.linkText}>联系在线客服</Text>
              </Button>
              <Text className={styles.serviceTime}>
                周一至周五 9:00-21:00 *节假日除外
              </Text>
            </View>

            {/* 微信二维码区域 */}
            <View className={styles.wechatQrArea}>
              <Image
                className={styles.qrCodeImage}
                src="/assets/icons/qr_code.jpg"
                mode="aspectFit"
              />
              <Text className={styles.qrTitle}>关注Y.ZHENG官方微信</Text>
              <Text className={styles.qrDesc}>
                长按二维码, 优先获取品牌咨询
              </Text>
              <View className={styles.policyLinks}>
                <Text className={styles.policyText}>查看</Text>
                <Text className={styles.policyLink} onClick={goToUserAgreement}>
                  销售条款
                </Text>
                <Text className={styles.policyText}>及</Text>
                <Text className={styles.policyLink} onClick={goToPrivacyPolicy}>
                  隐私政策
                </Text>
              </View>
            </View>

            {/* 账号注销信息 */}
            <View className={styles.accountDeleteInfo}>
              <Text className={styles.deleteText}>
                如需注销账号, 请联系在线客服
              </Text>
            </View>
          </ScrollView>
        </View>

        <FloatBtn onPress={() => setIsPopupShow(true)} />
        <FloatPopup
          visible={isPopupShow}
          onClose={() => setIsPopupShow(false)}
        />
        <CustomTabBar />
      </View>
    </>
  );
}
