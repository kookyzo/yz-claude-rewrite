import { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, Image, ScrollView } from "@tarojs/components";
import Taro, { useLoad, useDidShow } from "@tarojs/taro";
import { Swipe } from "@nutui/nutui-react-taro";
import type { SwipeInstance } from "@nutui/nutui-react-taro";
import { useAuth } from "@/hooks/useAuth";
import { useCartStore } from "@/stores/useCartStore";
import { useAppStore } from "@/stores/useAppStore";
import { useSystemInfo } from "@/hooks/useSystemInfo";
import { TOP_BAR_BOTTOM_PADDING_RPX } from "@/components/TopBar";
import type { CartItem } from "@/types/cart";
import { formatPrice } from "@/utils/format";
import { navigateTo, switchTab } from "@/utils/navigation";
import * as productService from "@/services/product.service";
import TopBar from "@/components/TopBar";
import FloatPopup from "@/components/FloatPopup";
import LoadingBar from "@/components/LoadingBar";
import CustomTabBar from "@/custom-tab-bar";
import styles from "./index.module.scss";

interface CartRecommendation {
  _skuId: string;
  nameCN: string;
  nameEN: string;
  image: string;
  price: number;
}

export default function Cart() {
  const { ensureLogin } = useAuth();
  const items = useCartStore((state) => state.items);
  const loading = useCartStore((state) => state.loading);
  const totalPrice = useCartStore((state) => state.totalPrice);
  const selectedCount = useCartStore((state) => state.selectedCount);
  const isAllChecked = useCartStore((state) => state.isAllChecked);
  const fetchCart = useCartStore((state) => state.fetchCart);
  const toggleItem = useCartStore((state) => state.toggleItem);
  const toggleAll = useCartStore((state) => state.toggleAll);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);

  const { statusBarHeight, navBarHeight, screenWidth } = useSystemInfo();

  const [isPopupShow, setIsPopupShow] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [layoutTop, setLayoutTop] = useState("190rpx");
  const [layoutHeight, setLayoutHeight] = useState("calc(100vh - 190rpx)");
  const [recommendations, setRecommendations] = useState<CartRecommendation[]>(
    []
  );
  const [openedSwipeId, setOpenedSwipeId] = useState<string | null>(null);
  const openedSwipeIdRef = useRef<string | null>(null);
  const recommendReqSeqRef = useRef(0);
  const swipeRefs = useRef<Record<string, SwipeInstance | null>>({});

  const isEmpty = items.length === 0 && !loading;

  useEffect(() => {
    const rpxRatio = 750 / screenWidth;
    const topBarTotalHeight =
      (statusBarHeight + navBarHeight) * rpxRatio + TOP_BAR_BOTTOM_PADDING_RPX;
    const windowInfo = Taro.getWindowInfo();
    const windowHeightRpx = windowInfo.windowHeight * rpxRatio;
    setLayoutTop(topBarTotalHeight + "rpx");
    setLayoutHeight(windowHeightRpx - topBarTotalHeight + "rpx");
  }, [statusBarHeight, navBarHeight, screenWidth]);

  const fetchRecommendationsByItems = useCallback(
    async (cartItems: CartItem[]) => {
      const reqSeq = ++recommendReqSeqRef.current;

      if (cartItems.length === 0) {
        setRecommendations([]);
        return;
      }

      const spuIds = [...new Set(cartItems.map((item) => item.spuId))].filter(
        Boolean
      );
      const excludeSkuIds = cartItems.map((item) => item.skuId).filter(Boolean);

      if (spuIds.length === 0) {
        setRecommendations([]);
        return;
      }

      try {
        const res = await productService.getRecommendationsByCategories(
          spuIds,
          excludeSkuIds,
          8
        );

        if (reqSeq !== recommendReqSeqRef.current) return;

        if (res.code === 200 && res.data) {
          const list = Array.isArray(res.data.recommendations)
            ? (res.data.recommendations as CartRecommendation[])
            : [];
          setRecommendations(list);
        } else {
          setRecommendations([]);
        }
      } catch {
        if (reqSeq === recommendReqSeqRef.current) {
          setRecommendations([]);
        }
      }
    },
    []
  );

  const refreshCart = useCallback(async () => {
    const loggedIn = await ensureLogin();
    if (!loggedIn) return;
    await fetchCart();
    const latestItems = useCartStore.getState().items;
    await fetchRecommendationsByItems(latestItems);
    setPageLoading(false);
  }, [ensureLogin, fetchCart, fetchRecommendationsByItems]);

  useLoad(() => {
    setPageLoading(true);
  });

  useDidShow(() => {
    useAppStore.getState().setCurrentTab(2);
    refreshCart();
  });

  useEffect(() => {
    openedSwipeIdRef.current = openedSwipeId;
  }, [openedSwipeId]);

  useEffect(() => {
    if (!openedSwipeId) return;
    const exists = items.some((item) => item._cartItemId === openedSwipeId);
    if (!exists) {
      openedSwipeIdRef.current = null;
      setOpenedSwipeId(null);
    }
  }, [items, openedSwipeId]);

  /** 勾选单个商品 */
  const handleToggleItem = (cartItemId: string, checked: boolean) => {
    toggleItem(cartItemId, !checked);
  };

  /** 全选/全不选 */
  const handleToggleAll = () => {
    toggleAll(!isAllChecked);
  };

  /** 增加数量 */
  const handlePlus = (cartItemId: string, currentQty: number) => {
    updateQuantity(cartItemId, currentQty + 1);
  };

  /** 减少数量 */
  const handleMinus = (cartItemId: string, currentQty: number) => {
    if (currentQty <= 1) return;
    updateQuantity(cartItemId, currentQty - 1);
  };

  /** 删除商品 */
  const handleRemove = (cartItemId: string) => {
    swipeRefs.current[cartItemId]?.close();
    if (openedSwipeIdRef.current === cartItemId) {
      openedSwipeIdRef.current = null;
    }
    setOpenedSwipeId((prev) => (prev === cartItemId ? null : prev));
    removeItem(cartItemId);
  };

  const handleSwipeOpen = (cartItemId: string) => {
    if (openedSwipeIdRef.current && openedSwipeIdRef.current !== cartItemId) {
      swipeRefs.current[openedSwipeIdRef.current]?.close();
    }
    openedSwipeIdRef.current = cartItemId;
    setOpenedSwipeId(cartItemId);
  };

  const handleSwipeClose = (cartItemId: string) => {
    if (openedSwipeIdRef.current === cartItemId) {
      openedSwipeIdRef.current = null;
      setOpenedSwipeId(null);
    }
  };

  /** 跳转商品详情 */
  const goToProductDetail = (skuId: string, spuId: string) => {
    if (skuId) {
      navigateTo(`/pages/product-detail/index?skuId=${skuId}`);
    } else if (spuId) {
      navigateTo(`/pages/product-detail/index?spuId=${spuId}`);
    }
  };

  /** 去逛逛 */
  const goShop = () => {
    switchTab("/pages/category/index");
  };

  /** 结算 */
  const goPay = () => {
    if (selectedCount <= 0) {
      Taro.showToast({ title: "请选择商品", icon: "none" });
      return;
    }
    navigateTo("/pages/payment/payment");
  };

  return (
    <View className={styles.container}>
      <TopBar backgroundColor="white" />
      <LoadingBar visible={pageLoading && loading} />

      {/* 加载中 */}
      {loading && (
        <View
          className={styles.loadingContainer}
          style={{ marginTop: layoutTop }}
        />
      )}

      {/* 空购物车 */}
      {isEmpty && !pageLoading && (
        <View
          className={styles.emptyContainer}
          style={{ marginTop: layoutTop }}
        >
          <Image
            className={styles.cartIcon}
            src="/assets/icons/shopping_cart.png"
            mode="aspectFit"
          />
          <Text className={styles.emptyTip}>购物车是空的</Text>
          <View className={styles.goShopBtnContainer}>
            <View className={styles.goShopBtn} onClick={goShop}>
              <Text>去逛逛</Text>
            </View>
          </View>
        </View>
      )}

      {/* 非空购物车 */}
      {items.length > 0 && !loading && (
        <View
          className={styles.cartContainer}
          style={{ marginTop: layoutTop, height: layoutHeight }}
        >
          <ScrollView className={styles.cartList} scrollY>
            {items.map((item) => (
              <Swipe
                key={item._cartItemId}
                className={styles.cartSwipe}
                name={item._cartItemId}
                rightAction={
                  <View className={styles.swipeDeleteAction}>
                    <Text className={styles.swipeDeleteText}>删除</Text>
                  </View>
                }
                ref={(instance) => {
                  if (instance) {
                    swipeRefs.current[item._cartItemId] = instance;
                  } else {
                    delete swipeRefs.current[item._cartItemId];
                  }
                }}
                onOpen={({ name }) => handleSwipeOpen(String(name))}
                onClose={({ name }) => handleSwipeClose(String(name))}
                onActionClick={(_, position) => {
                  if (position === "right") {
                    handleRemove(item._cartItemId);
                  }
                }}
              >
                <View className={styles.item}>
                  {/* 勾选框 */}
                  <View
                    className={styles.productCheckbox}
                    onClick={() =>
                      handleToggleItem(item._cartItemId, item.checked)
                    }
                  >
                    <View className={styles.checkboxView}>
                      <Image
                        className={styles.checkboxImg}
                        src={
                          item.checked
                            ? "/assets/icons/selected.png"
                            : "/assets/icons/not_selected.png"
                        }
                      />
                    </View>
                  </View>

                  {/* 商品区域 */}
                  <View className={styles.product}>
                    {/* 商品图片 */}
                    <View
                      className={styles.display}
                      onClick={() => goToProductDetail(item.skuId, item.spuId)}
                    >
                      <Image
                        className={styles.displayImg}
                        src={item.image}
                        mode="aspectFill"
                      />
                    </View>

                    {/* 信息区 */}
                    <View className={styles.infoTop}>
                      <View
                        className={styles.infoContent}
                        onClick={() =>
                          goToProductDetail(item.skuId, item.spuId)
                        }
                      >
                        <Text className={styles.foreignName}>{item.nameEN}</Text>
                        <Text className={styles.name}>{item.name}</Text>
                        {item.size && (
                          <Text className={styles.size}>
                            作品尺寸：{item.size}
                          </Text>
                        )}
                        {item.material && (
                          <Text className={styles.material}>
                            作品材质：{item.material}
                          </Text>
                        )}

                        {/* 数量 + 价格 */}
                        <View className={styles.infoBottom}>
                          <Text className={styles.price}>
                            ¥ {formatPrice(item.price * item.quantity)}
                          </Text>
                          <View className={styles.quantity}>
                            <View
                              className={styles.minus}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMinus(item._cartItemId, item.quantity);
                              }}
                            >
                              <Image
                                className={styles.minusImg}
                                src="/assets/icons/minus.png"
                              />
                            </View>
                            <Text className={styles.number}>{item.quantity}</Text>
                            <View
                              className={styles.plus}
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlus(item._cartItemId, item.quantity);
                              }}
                            >
                              <Image
                                className={styles.plusImg}
                                src="/assets/icons/add.png"
                              />
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              </Swipe>
            ))}

            {/* 分隔符 */}
            <View className={styles.cartDivider} />

            {/* 为你推荐 */}
            {recommendations.length > 0 && (
              <View className={styles.recommendSection}>
                <Text className={styles.recommendTitle}>为你推荐</Text>
                <View className={styles.recommendGrid}>
                  {recommendations.map((item, index) => (
                    <View
                      key={`cart-rec-${index}`}
                      className={styles.recommendItem}
                      onClick={() =>
                        navigateTo(
                          `/pages/product-detail/index?skuId=${item._skuId}`
                        )
                      }
                    >
                      <View className={styles.recommendImgWrap}>
                        <Image
                          className={styles.recommendImg}
                          src={item.image}
                          mode="aspectFill"
                        />
                      </View>
                      <Text className={styles.recommendNameEn}>
                        {item.nameEN}
                      </Text>
                      <Text className={styles.recommendNameCn}>
                        {item.nameCN}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* 底部结算栏 */}
          <View className={styles.bottomBar}>
            <View className={styles.selectAllContainer}>
              <View className={styles.checkboxLabel} onClick={handleToggleAll}>
                <View className={styles.productCheckbox}>
                  <View className={styles.checkboxView}>
                    <Image
                      className={styles.checkboxImg}
                      src={
                        isAllChecked
                          ? "/assets/icons/selected.png"
                          : "/assets/icons/not_selected.png"
                      }
                    />
                  </View>
                </View>
                <Text className={styles.checkboxText}>全选</Text>
              </View>
            </View>
            <View className={styles.total}>
              <Text>共计：</Text>
              <Text className={styles.totalPrice}>
                ¥{formatPrice(totalPrice)}
              </Text>
            </View>
          </View>

          <View className={styles.checkoutContainer}>
            <View className={styles.checkoutBtn} onClick={goPay}>
              <Text>去结算</Text>
            </View>
          </View>
        </View>
      )}

      <FloatPopup visible={isPopupShow} onClose={() => setIsPopupShow(false)} />

      <CustomTabBar />
    </View>
  );
}
