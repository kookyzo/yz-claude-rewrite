import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Swiper,
  SwiperItem,
} from "@tarojs/components";
import Taro, {
  useLoad,
  useReady,
  useDidShow,
  useDidHide,
  useUnload,
} from "@tarojs/taro";
import { useNavBarScroll } from "@/hooks/useNavBarScroll";
import { useSystemInfo } from "@/hooks/useSystemInfo";
import { useImageProcessor } from "@/hooks/useImageProcessor";
import { useAppStore } from "@/stores/useAppStore";
import { listBanners } from "@/services/banner.service";
import {
  listSubSeries,
  getProductsBySubSeries,
  getModelShowData,
} from "@/services/product.service";
import { formatPrice } from "@/utils/format";
import TopBar, { TOP_BAR_BOTTOM_PADDING_RPX } from "@/components/TopBar";
import SlidingBar from "@/components/SlidingBar";
import FloatBtn from "@/components/FloatBtn";
import FloatPopup from "@/components/FloatPopup";
import LoadingBar from "@/components/LoadingBar";
import type { Sku } from "@/types/product";
import styles from "./index.module.scss";

/** Banner item from cloud */
interface BannerItem {
  _id: string;
  image: string;
  url: string;
  text: string;
}

/** SubSeries with nameEN (cloud returns it but type omits it) */
interface SubSeriesItem {
  _id: string;
  name: string;
  nameEN: string;
  displayImage: string;
  sortNum?: number;
}

/** Product item for display */
interface ProductItem extends Sku {
  formattedPrice: string;
}

/** Model show item from cloud */
interface ModelShowItem {
  _id: string;
  skuId: string;
  image: string;
  nameCN: string;
  nameEN: string;
  price: number;
  tabName: string;
}

const MODEL_SKU_IDS = [
  "25b91eb368e669ac01dffc8766d0ce66",
  "25b91eb368e72a1501f306044c88f50e",
  "2d0db0d268e6363001da19c452718054",
  "2d0db0d268e66d3501dfe0c57b543f45",
];

const AUTOPLAY_INTERVAL = 3000;
const RESUME_DELAY = 3000;
const SERIES_SWIPER_SELECTOR = "#home-series-swiper";
const MODEL_SWIPER_SELECTOR = "#home-model-swiper";

export default function Home() {
  // ===== Hooks =====
  const { backgroundColor } = useNavBarScroll();
  const { statusBarHeight, navBarHeight, screenWidth } = useSystemInfo();
  const { processImages } = useImageProcessor();
  const setCurrentTab = useAppStore((s) => s.setCurrentTab);

  // ===== State =====
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [isLoadingBanners, setIsLoadingBanners] = useState(true);
  const [showLoading, setShowLoading] = useState(false);
  const [isPopupShow, setIsPopupShow] = useState(false);

  const [subSeriesList, setSubSeriesList] = useState<SubSeriesItem[]>([]);
  const [currentSeriesIndex, setCurrentSeriesIndex] = useState(0);
  const [currentSeriesProducts, setCurrentSeriesProducts] = useState<
    ProductItem[]
  >([]);
  const [currentSubSeriesNameEN, setCurrentSubSeriesNameEN] = useState("");

  const [modelShowList, setModelShowList] = useState<ModelShowItem[]>([]);
  const [currentModelIndex, setCurrentModelIndex] = useState(0);

  // Layout
  const [swiperContainerTop, setSwiperContainerTop] = useState("170rpx");
  const [swiperContainerHeight, setSwiperContainerHeight] = useState("1300rpx");

  // ===== Refs (for timer/observer access without stale closures) =====
  const allSeriesProductsRef = useRef<Record<string, ProductItem[]>>({});
  const subSeriesListRef = useRef<SubSeriesItem[]>([]);
  const currentSeriesIndexRef = useRef(0);
  const modelShowListRef = useRef<ModelShowItem[]>([]);
  const currentModelIndexRef = useRef(0);

  const seriesAutoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modelAutoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seriesResumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelResumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const seriesInViewportRef = useRef(false);
  const modelInViewportRef = useRef(false);
  const seriesIsTouchingRef = useRef(false);
  const modelIsTouchingRef = useRef(false);

  const seriesObserverRef = useRef<Taro.IntersectionObserver | null>(null);
  const modelObserverRef = useRef<Taro.IntersectionObserver | null>(null);
  const mountedRef = useRef(true);

  // ===== Layout Calculation =====
  const calculateLayout = useCallback(() => {
    const rpxRatio = 750 / screenWidth;
    const topBarTotalHeight =
      (statusBarHeight + navBarHeight) * rpxRatio + TOP_BAR_BOTTOM_PADDING_RPX;

    const windowInfo = Taro.getWindowInfo();
    const windowHeightRpx = windowInfo.windowHeight * rpxRatio;
    const swiperHeight = windowHeightRpx - topBarTotalHeight;

    setSwiperContainerTop(topBarTotalHeight + "rpx");
    setSwiperContainerHeight(swiperHeight + "rpx");
  }, [statusBarHeight, navBarHeight, screenWidth]);

  // ===== Data Loading =====
  const loadBannersData = useCallback(async () => {
    setIsLoadingBanners(true);
    try {
      const res = await listBanners();
      if (res.code === 200) {
        const rawBanners = (res.data as any)?.banners || [];
        const items: BannerItem[] = rawBanners.map((b: any) => ({
          _id: b._id,
          image: b.imgUrl || "",
          url: "/pages/category/index",
          text: "",
        }));

        // Process cloud:// URLs
        const cloudUrls = items
          .map((b) => b.image)
          .filter((u) => u.startsWith("cloud://"));
        if (cloudUrls.length > 0) {
          const httpUrls = await processImages(cloudUrls, {
            width: 750,
            height: 1200,
            quality: 80,
          });
          const urlMap = new Map<string, string>();
          cloudUrls.forEach((cu, i) => urlMap.set(cu, httpUrls[i]));
          items.forEach((b) => {
            if (b.image.startsWith("cloud://")) {
              b.image = urlMap.get(b.image) || b.image;
            }
          });
        }

        if (mountedRef.current) {
          setBanners(items);
          setIsLoadingBanners(false);
          setShowLoading(false);
        }
      } else {
        if (mountedRef.current) {
          setBanners([]);
          setIsLoadingBanners(false);
          setShowLoading(false);
        }
      }
    } catch {
      if (mountedRef.current) {
        setBanners([]);
        setIsLoadingBanners(false);
        setShowLoading(false);
      }
    }
  }, [processImages]);

  /** Load products for a single series into cache */
  const loadSeriesProductsToCache = useCallback(
    async (subSeriesId: string) => {
      try {
        const res = await getProductsBySubSeries({
          subSeriesId,
          sortBy: "default",
          page: 1,
          pageSize: 10,
        });
        if (res.code === 200) {
          // Runtime data may be { products: [...] } or { items: [...] }
          const rawData = res.data as any;
          let products: Sku[] = rawData?.products || rawData?.items || [];

          // Process cloud:// URLs for first image only
          const cloudUrls = products
            .map((p) => p.skuMainImages?.[0])
            .filter((u): u is string => !!u && u.startsWith("cloud://"));

          if (cloudUrls.length > 0) {
            const httpUrls = await processImages(cloudUrls, {
              width: 280,
              height: 280,
              quality: 80,
            });
            const urlMap = new Map<string, string>();
            cloudUrls.forEach((cu, i) => urlMap.set(cu, httpUrls[i]));

            products = products.map((p) => {
              const first = p.skuMainImages?.[0];
              if (first && first.startsWith("cloud://")) {
                return { ...p, skuMainImages: [urlMap.get(first) || first] };
              }
              return p;
            });
          }

          const items: ProductItem[] = products.map((p) => ({
            ...p,
            formattedPrice: formatPrice(p.price),
          }));

          allSeriesProductsRef.current[subSeriesId] = items;
          return items;
        }
      } catch {
        // silently fail for preload
      }
      return [];
    },
    [processImages],
  );

  /** Three-phase preload: first screen → adjacent → remaining */
  const preloadAllSeriesProducts = useCallback(
    async (list: SubSeriesItem[]) => {
      if (list.length === 0) return;

      // Phase 1: Load first series immediately
      const firstId = list[0]._id;
      const firstProducts = await loadSeriesProductsToCache(firstId);
      if (mountedRef.current) {
        setCurrentSeriesProducts(firstProducts);
        setShowLoading(false);
      }

      // Phase 2: Adjacent series after 200ms
      setTimeout(async () => {
        const adjacent = [1].filter((i) => i < list.length);
        await Promise.all(
          adjacent.map((i) => loadSeriesProductsToCache(list[i]._id)),
        );
      }, 200);

      // Phase 3: Remaining series after 500ms, batched
      setTimeout(async () => {
        const loaded = new Set([firstId, list[1]?._id].filter(Boolean));
        const remaining = list.filter((s) => !loaded.has(s._id));
        const batchSize = 3;
        for (let i = 0; i < remaining.length; i += batchSize) {
          const batch = remaining.slice(i, i + batchSize);
          await Promise.all(batch.map((s) => loadSeriesProductsToCache(s._id)));
          if (i + batchSize < remaining.length) {
            await new Promise((r) => setTimeout(r, 100));
          }
        }
      }, 500);
    },
    [loadSeriesProductsToCache],
  );

  /** Load sub-series list */
  const loadSubSeriesData = useCallback(async () => {
    try {
      const res = await listSubSeries(true);
      if (res.code === 200) {
        // Runtime: data may be { subSeries: [...] } or direct array
        const rawData = res.data as any;
        let rawList: any[] = Array.isArray(rawData)
          ? rawData
          : rawData?.subSeries || [];

        // Sort by sortNum
        rawList.sort(
          (a: any, b: any) => (a.sortNum ?? 999) - (b.sortNum ?? 999),
        );

        const list: SubSeriesItem[] = rawList.map((item: any) => ({
          _id: item._id,
          name: item.name || "",
          nameEN: item.nameEN || "",
          displayImage: item.displayImage || "",
          sortNum: item.sortNum,
        }));

        // Process display images
        const cloudUrls = list
          .map((s) => s.displayImage)
          .filter((u) => u.startsWith("cloud://"));
        if (cloudUrls.length > 0) {
          const httpUrls = await processImages(cloudUrls, {
            width: 600,
            height: 700,
            quality: 80,
          });
          const urlMap = new Map<string, string>();
          cloudUrls.forEach((cu, i) => urlMap.set(cu, httpUrls[i]));
          list.forEach((s) => {
            if (s.displayImage.startsWith("cloud://")) {
              s.displayImage = urlMap.get(s.displayImage) || s.displayImage;
            }
          });
        }

        if (mountedRef.current) {
          setSubSeriesList(list);
          subSeriesListRef.current = list;
          if (list.length > 0) {
            setCurrentSubSeriesNameEN(list[0].nameEN);
          }
        }

        // Start preloading products
        preloadAllSeriesProducts(list);
      }
    } catch {
      // silently fail
    }
  }, [processImages, preloadAllSeriesProducts]);

  /** Load model show data */
  const loadModelShowData = useCallback(async () => {
    try {
      const res = await getModelShowData(MODEL_SKU_IDS);
      if (res.code === 200) {
        const rawData = res.data as any;
        let list: ModelShowItem[] = rawData?.modelShowList || [];

        // Process cloud:// URLs for model images
        const cloudUrls = list
          .map((m) => m.image)
          .filter((u) => u && u.startsWith("cloud://"));
        if (cloudUrls.length > 0) {
          const httpUrls = await processImages(cloudUrls, {
            width: 600,
            height: 700,
            quality: 80,
          });
          const urlMap = new Map<string, string>();
          cloudUrls.forEach((cu, i) => urlMap.set(cu, httpUrls[i]));
          list = list.map((m) => ({
            ...m,
            image:
              m.image && m.image.startsWith("cloud://")
                ? urlMap.get(m.image) || m.image
                : m.image,
          }));
        }

        if (mountedRef.current) {
          setModelShowList(list);
          modelShowListRef.current = list;
        }
      }
    } catch {
      // silently fail
    }
  }, [processImages]);

  // ===== Auto-slide Logic =====
  const stopSeriesAutoplay = useCallback(() => {
    if (seriesAutoplayRef.current) {
      clearInterval(seriesAutoplayRef.current);
      seriesAutoplayRef.current = null;
    }
  }, []);

  const startSeriesAutoplay = useCallback(() => {
    stopSeriesAutoplay();
    if (!seriesInViewportRef.current) return;
    if (subSeriesListRef.current.length === 0) return;

    seriesAutoplayRef.current = setInterval(() => {
      if (seriesIsTouchingRef.current) return;
      const list = subSeriesListRef.current;
      const idx = currentSeriesIndexRef.current;
      const next = (idx + 1) % list.length;
      const nextSeries = list[next];
      const cached = nextSeries
        ? allSeriesProductsRef.current[nextSeries._id] || []
        : [];

      currentSeriesIndexRef.current = next;
      setCurrentSeriesIndex(next);
      setCurrentSubSeriesNameEN(nextSeries?.nameEN || "");
      setCurrentSeriesProducts(cached);
    }, AUTOPLAY_INTERVAL);
  }, [stopSeriesAutoplay]);

  const stopModelAutoplay = useCallback(() => {
    if (modelAutoplayRef.current) {
      clearInterval(modelAutoplayRef.current);
      modelAutoplayRef.current = null;
    }
  }, []);

  const startModelAutoplay = useCallback(() => {
    stopModelAutoplay();
    if (!modelInViewportRef.current) return;
    if (modelShowListRef.current.length === 0) return;

    modelAutoplayRef.current = setInterval(() => {
      if (modelIsTouchingRef.current) return;
      const list = modelShowListRef.current;
      const idx = currentModelIndexRef.current;
      const next = (idx + 1) % list.length;

      currentModelIndexRef.current = next;
      setCurrentModelIndex(next);
    }, AUTOPLAY_INTERVAL);
  }, [stopModelAutoplay]);

  // ===== Touch Handlers =====
  const onSeriesTouchStart = useCallback(() => {
    seriesIsTouchingRef.current = true;
    stopSeriesAutoplay();
    if (seriesResumeRef.current) {
      clearTimeout(seriesResumeRef.current);
      seriesResumeRef.current = null;
    }
  }, [stopSeriesAutoplay]);

  const onSeriesTouchEnd = useCallback(() => {
    seriesIsTouchingRef.current = false;
    seriesResumeRef.current = setTimeout(() => {
      if (seriesInViewportRef.current) startSeriesAutoplay();
    }, RESUME_DELAY);
  }, [startSeriesAutoplay]);

  const onModelTouchStart = useCallback(() => {
    modelIsTouchingRef.current = true;
    stopModelAutoplay();
    if (modelResumeRef.current) {
      clearTimeout(modelResumeRef.current);
      modelResumeRef.current = null;
    }
  }, [stopModelAutoplay]);

  const onModelTouchEnd = useCallback(() => {
    modelIsTouchingRef.current = false;
    modelResumeRef.current = setTimeout(() => {
      if (modelInViewportRef.current) startModelAutoplay();
    }, RESUME_DELAY);
  }, [startModelAutoplay]);

  // ===== IntersectionObserver Setup =====
  const setupSeriesObserver = useCallback(() => {
    const page = Taro.getCurrentInstance().page;
    if (!page || seriesObserverRef.current) return;

    const query = Taro.createSelectorQuery();
    query.select(SERIES_SWIPER_SELECTOR).boundingClientRect();
    query.exec((nodes) => {
      if (!nodes?.[0] || seriesObserverRef.current) return;

      try {
        seriesObserverRef.current = Taro.createIntersectionObserver(page, {
          thresholds: [0.5],
        });
        seriesObserverRef.current
          .relativeToViewport()
          .observe(SERIES_SWIPER_SELECTOR, (res) => {
            const inView = (res.intersectionRatio ?? 0) >= 0.5;
            if (inView && !seriesInViewportRef.current) {
              seriesInViewportRef.current = true;
              if (!seriesIsTouchingRef.current) startSeriesAutoplay();
            } else if (!inView && seriesInViewportRef.current) {
              seriesInViewportRef.current = false;
              stopSeriesAutoplay();
            }
          });
      } catch (err) {
        console.warn("setupSeriesObserver failed", err);
      }
    });
  }, [startSeriesAutoplay, stopSeriesAutoplay]);

  const setupModelObserver = useCallback(() => {
    if (modelObserverRef.current) return;
    const page = Taro.getCurrentInstance().page;
    if (!page) return;

    const query = Taro.createSelectorQuery();
    query.select(MODEL_SWIPER_SELECTOR).boundingClientRect();
    query.exec((nodes) => {
      if (!nodes?.[0] || modelObserverRef.current) return;

      try {
        modelObserverRef.current = Taro.createIntersectionObserver(page, {
          thresholds: [0.5],
        });
        modelObserverRef.current
          .relativeToViewport()
          .observe(MODEL_SWIPER_SELECTOR, (res) => {
            const inView = (res.intersectionRatio ?? 0) >= 0.5;
            if (inView && !modelInViewportRef.current) {
              modelInViewportRef.current = true;
              if (!modelIsTouchingRef.current) startModelAutoplay();
            } else if (!inView && modelInViewportRef.current) {
              modelInViewportRef.current = false;
              stopModelAutoplay();
            }
          });
      } catch (err) {
        console.warn("setupModelObserver failed", err);
      }
    });
  }, [startModelAutoplay, stopModelAutoplay]);

  const clearAllTimersAndObservers = useCallback(() => {
    stopSeriesAutoplay();
    stopModelAutoplay();
    if (seriesResumeRef.current) {
      clearTimeout(seriesResumeRef.current);
      seriesResumeRef.current = null;
    }
    if (modelResumeRef.current) {
      clearTimeout(modelResumeRef.current);
      modelResumeRef.current = null;
    }
    if (seriesObserverRef.current) {
      seriesObserverRef.current.disconnect();
      seriesObserverRef.current = null;
    }
    if (modelObserverRef.current) {
      modelObserverRef.current.disconnect();
      modelObserverRef.current = null;
    }
  }, [stopSeriesAutoplay, stopModelAutoplay]);

  // ===== Setup model observer when model data loads =====
  useEffect(() => {
    if (modelShowList.length > 0) {
      setTimeout(() => setupModelObserver(), 100);
    }
  }, [modelShowList.length, setupModelObserver]);

  // ===== Lifecycle Hooks =====
  useLoad(() => {
    setShowLoading(true);
    loadBannersData();
    loadSubSeriesData();
    loadModelShowData();
  });

  useReady(() => {
    calculateLayout();
    setupSeriesObserver();
  });

  useDidShow(() => {
    setCurrentTab(0);
    if (seriesInViewportRef.current && !seriesIsTouchingRef.current) {
      startSeriesAutoplay();
    }
    if (modelInViewportRef.current && !modelIsTouchingRef.current) {
      startModelAutoplay();
    }
  });

  useDidHide(() => {
    stopSeriesAutoplay();
    stopModelAutoplay();
  });

  useUnload(() => {
    mountedRef.current = false;
    clearAllTimersAndObservers();
  });

  // ===== Event Handlers =====
  const onBannerTap = useCallback(() => {
    Taro.switchTab({ url: "/pages/category/index" });
  }, []);

  const onSeriesTabSelect = useCallback(
    (item: { id: string; text: string }) => {
      const list = subSeriesListRef.current;
      const idx = list.findIndex((s) => s._id === item.id);
      if (idx === -1 || idx === currentSeriesIndexRef.current) return;

      const series = list[idx];
      const cached = allSeriesProductsRef.current[series._id] || [];

      currentSeriesIndexRef.current = idx;
      setCurrentSeriesIndex(idx);
      setCurrentSubSeriesNameEN(series.nameEN);
      setCurrentSeriesProducts(cached);
    },
    [],
  );

  const onSeriesSwiperChange = useCallback((e) => {
    const current = e.detail.current;
    if (current === currentSeriesIndexRef.current) return;

    const list = subSeriesListRef.current;
    const series = list[current];
    const cached = series ? allSeriesProductsRef.current[series._id] || [] : [];

    currentSeriesIndexRef.current = current;
    setCurrentSeriesIndex(current);
    setCurrentSubSeriesNameEN(series?.nameEN || "");
    setCurrentSeriesProducts(cached);
  }, []);

  const onModelTabSelect = useCallback((item: { id: string; text: string }) => {
    const list = modelShowListRef.current;
    const idx = list.findIndex((m) => m._id === item.id);
    if (idx === -1 || idx === currentModelIndexRef.current) return;

    currentModelIndexRef.current = idx;
    setCurrentModelIndex(idx);
  }, []);

  const onModelSwiperChange = useCallback((e) => {
    const current = e.detail.current;
    if (current === currentModelIndexRef.current) return;

    currentModelIndexRef.current = current;
    setCurrentModelIndex(current);
  }, []);

  const goToSeriesDetail = useCallback((id: string) => {
    if (!id) return;
    Taro.navigateTo({ url: `/pages/series-detail/index?subSeriesId=${id}` });
  }, []);

  const goToProductDetail = useCallback((skuId: string) => {
    if (!skuId) return;
    Taro.navigateTo({ url: `/pages/product-detail/index?skuId=${skuId}` });
  }, []);

  // ===== Derived Data for SlidingBar =====
  const seriesTabItems = subSeriesList.map((s) => ({
    id: s._id,
    text: s.nameEN,
  }));
  const modelTabItems = modelShowList.map((m) => ({
    id: m._id,
    text: m.tabName === "耳环" ? "耳饰" : m.tabName,
  }));
  const activeSeriesId = subSeriesList[currentSeriesIndex]?._id || "";
  const activeModelId = modelShowList[currentModelIndex]?._id || "";

  // ===== Render =====
  return (
    <View className={styles.container}>
      <TopBar backgroundColor={backgroundColor} />

      {/* Main scrollable content */}
      <ScrollView
        className={styles.mainContent}
        scrollY
        style={{ top: swiperContainerTop, height: swiperContainerHeight }}
      >
        {/* Banner Section */}
        <View className={styles.bannerSection} style={{ height: "100%" }}>
          {isLoadingBanners ? (
            <View className={styles.loadingContainer}>
              <Text>正在加载轮播图...</Text>
            </View>
          ) : (
            <Swiper
              className={styles.bannerSwiper}
              indicatorDots
              autoplay
              interval={5000}
              circular
            >
              {banners.map((banner) => (
                <SwiperItem key={banner._id} onClick={onBannerTap}>
                  <Image
                    className={styles.bannerImage}
                    src={banner.image}
                    mode="aspectFill"
                  />
                  {banner.text && (
                    <View className={styles.bannerNav}>{banner.text}</View>
                  )}
                </SwiperItem>
              ))}
            </Swiper>
          )}

          {/* Pull-up hint arrow */}
          <View className={styles.pullUpHint}>
            <Text className={styles.pullUpIcon}>⌵</Text>
          </View>
        </View>

        {/* Jewelry Series Section */}
        <View className={styles.jewelrySeriesSection}>
          <View className={styles.sectionTitle}>珠宝系列</View>

          <SlidingBar
            items={seriesTabItems}
            activeId={activeSeriesId}
            onSelect={onSeriesTabSelect}
          />

          <Swiper
            id="home-series-swiper"
            className={styles.seriesSwiper}
            current={currentSeriesIndex}
            onChange={onSeriesSwiperChange}
            onTouchStart={onSeriesTouchStart}
            onTouchEnd={onSeriesTouchEnd}
            nextMargin="100rpx"
            circular
            duration={400}
            easingFunction="easeOutCubic"
          >
            {subSeriesList.map((series, index) => (
              <SwiperItem key={series._id}>
                <View className={styles.swiperItemInner}>
                  <View
                    className={`${styles.seriesImageWrapper} ${
                      currentSeriesIndex === index
                        ? styles.seriesImageWrapperActive
                        : styles.seriesImageWrapperInactive
                    }`}
                    onClick={() => goToSeriesDetail(series._id)}
                  >
                    <Image
                      className={styles.seriesImage}
                      src={series.displayImage}
                      mode="aspectFill"
                    />
                  </View>
                </View>
              </SwiperItem>
            ))}
          </Swiper>

          {/* Products horizontal scroll */}
          <ScrollView className={styles.productsScroll} scrollX enableFlex>
            <View className={styles.productsContainer}>
              {currentSeriesProducts.length > 0 ? (
                currentSeriesProducts.map((product) => (
                  <View
                    key={product._id}
                    className={styles.productCard}
                    onClick={() => goToProductDetail(product._id)}
                  >
                    <Image
                      className={styles.productImage}
                      src={product.skuMainImages?.[0] || ""}
                      mode="aspectFill"
                    />
                    <Text className={styles.seriesName}>
                      {currentSubSeriesNameEN}
                    </Text>
                    <Text className={styles.productName}>{product.nameCN}</Text>
                    <Text className={styles.productPrice}>
                      {product.formattedPrice}
                    </Text>
                  </View>
                ))
              ) : (
                <View className={styles.productsEmpty}>
                  <Text>暂无商品</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>

        {/* Model Show Section */}
        {modelShowList.length > 0 && (
          <View className={styles.modelShowSection}>
            <View className={styles.sectionTitle}>模特展示</View>

            <SlidingBar
              items={modelTabItems}
              activeId={activeModelId}
              onSelect={onModelTabSelect}
            />

            <Swiper
              id="home-model-swiper"
              className={styles.modelSwiper}
              current={currentModelIndex}
              onChange={onModelSwiperChange}
              onTouchStart={onModelTouchStart}
              onTouchEnd={onModelTouchEnd}
              nextMargin="100rpx"
              circular
              duration={400}
              easingFunction="easeOutCubic"
            >
              {modelShowList.map((model, index) => (
                <SwiperItem key={model._id}>
                  <View className={styles.swiperItemInner}>
                    <View
                      className={`${styles.modelImageWrapper} ${
                        currentModelIndex === index
                          ? styles.modelImageWrapperActive
                          : styles.modelImageWrapperInactive
                      }`}
                      onClick={() => goToProductDetail(model._id)}
                    >
                      <Image
                        className={styles.modelImage}
                        src={model.image}
                        mode="aspectFill"
                      />
                    </View>
                  </View>
                </SwiperItem>
              ))}
            </Swiper>
          </View>
        )}

        {/* Brand Story Section */}
        <View className={styles.brandStorySection}>
          <View className={styles.storyDividerWrapper}>
            <View className={styles.storyDivider} />
          </View>
          <View className={styles.storyContent}>
            <Text className={styles.storyText}>
              Y.ZHENG Fine Jewelry
              是一个探索本质的当代珠宝品牌，用理性思维构造感性认知，通过珠宝设计呈现自我与自然的共生关系。
            </Text>
            <Text className={styles.storyText}>
              秉持对创新精神与精工造艺的追求，用行动与未来对话。以内在的、坚韧的、源于本能的生命力，通过不断裂变和成长。
            </Text>
            <Text className={styles.storyText}>
              用理性之手，解构自然物性。金属的冷测和矿石的粗粝，经由当代语言重组，成为可佩戴的艺术品。
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Floating consultation */}
      <FloatBtn onPress={() => setIsPopupShow(true)} />
      <FloatPopup visible={isPopupShow} onClose={() => setIsPopupShow(false)} />

      {/* Loading indicator */}
      <LoadingBar visible={showLoading} />
    </View>
  );
}
