import { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Swiper as TaroSwiper,
  SwiperItem as TaroSwiperItem,
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
import {
  preloadImage,
  preloadImages,
  getPreloadedImagePath,
} from "@/utils/image";
import { Swiper as NutSwiper } from "@nutui/nutui-react-taro";
import TopBar, { TOP_BAR_BOTTOM_PADDING_RPX } from "@/components/TopBar";
import SlidingBar from "@/components/SlidingBar";
import FloatBtn from "@/components/FloatBtn";
import FloatPopup from "@/components/FloatPopup";
import LoadingBar from "@/components/LoadingBar";
import CustomTabBar from "@/custom-tab-bar";
import type { Sku } from "@/types/product";
import styles from "./index.module.scss";

const WEAPP_IMAGE_NO_FADE: any = { fadeShow: false, fadeIn: false };

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

/** Lightweight product card model to reduce setData payload */
interface SeriesProductCard {
  _id: string;
  nameCN: string;
  formattedPrice: string;
  image: string;
}

interface BufferedProductImageProps {
  src: string;
}

function BufferedProductImage({ src }: BufferedProductImageProps) {
  const [displaySrc, setDisplaySrc] = useState(src);
  const [pendingSrc, setPendingSrc] = useState<string>("");

  useEffect(() => {
    if (!src) {
      setDisplaySrc("");
      setPendingSrc("");
      return;
    }
    if (!displaySrc) {
      setDisplaySrc(src);
      return;
    }
    if (src === displaySrc || src === pendingSrc) return;
    setPendingSrc(src);
  }, [src, displaySrc, pendingSrc]);

  const onPendingLoaded = useCallback(() => {
    if (!pendingSrc) return;
    setDisplaySrc(pendingSrc);
    setPendingSrc("");
  }, [pendingSrc]);

  if (!displaySrc && !pendingSrc) {
    return <View className={styles.productImage} />;
  }

  return (
    <View className={styles.productImageStage}>
      {displaySrc ? (
        <Image
          className={`${styles.productImage} ${styles.productImageCurrent}`}
          src={displaySrc}
          mode="aspectFill"
          lazyLoad
          {...WEAPP_IMAGE_NO_FADE}
        />
      ) : null}
      {pendingSrc ? (
        <Image
          className={`${styles.productImage} ${styles.productImagePending}`}
          src={pendingSrc}
          mode="aspectFill"
          lazyLoad
          onLoad={onPendingLoaded}
          {...WEAPP_IMAGE_NO_FADE}
        />
      ) : null}
    </View>
  );
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
const SERIES_RESUME_DELAY = 6000;
const MODEL_RESUME_DELAY = 3000;
const MODEL_OBSERVER_SETUP_RETRY_DELAY = 100;
const MODEL_OBSERVER_SETUP_MAX_RETRY = 10;
const SERIES_SWIPER_SELECTOR = "#home-series-swiper";
const MODEL_SWIPER_SELECTOR = "#home-model-swiper";
const IMAGE_PRELOAD_TIMEOUT = 3000;
const PRODUCT_IMAGE_PRELOAD_CONCURRENCY = 3;
const CRITICAL_PRODUCT_PRELOAD_CONCURRENCY = 4;
const SECOND_SERIES_PRELOAD_CONCURRENCY = 6;
const BACKGROUND_SERIES_BATCH_SIZE = 2;
const BACKGROUND_PRODUCT_PRELOAD_CONCURRENCY = 2;
const CRITICAL_PRODUCT_READY_COUNT = 4;
const PRODUCT_PRELOAD_RETRY_COOLDOWN_MS = 12000;
const PRODUCT_PRELOAD_LOG_COOLDOWN_MS = 30000;
const ENABLE_IMAGE_PRELOAD_DEBUG_LOG = false;

function isRemoteImageUrl(url: string): boolean {
  return /^https?:\/\//.test(url) || url.startsWith("cloud://");
}

function toHomeProductThumbUrl(url: string): string {
  if (!url || !/^https?:\/\//.test(url)) return url;
  if (url.includes("imageMogr2") || url.includes("imageView2")) return url;
  // Keep this optimization on COS-like URLs to avoid affecting unknown origins.
  if (!url.includes("qcloud")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}imageMogr2/thumbnail/280x280/quality/80/format/webp`;
}

export default function Home() {
  // ===== Hooks =====
  const { backgroundColor } = useNavBarScroll();
  const { statusBarHeight, navBarHeight, screenWidth, safeAreaBottom } =
    useSystemInfo();
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
    SeriesProductCard[]
  >([]);
  const [currentSubSeriesNameEN, setCurrentSubSeriesNameEN] = useState("");
  const [seriesSwipeDisabled, setSeriesSwipeDisabled] = useState(false);

  const [modelShowList, setModelShowList] = useState<ModelShowItem[]>([]);
  const [currentModelIndex, setCurrentModelIndex] = useState(0);

  // Layout
  const [swiperContainerTop, setSwiperContainerTop] = useState("170rpx");
  const [swiperContainerHeight, setSwiperContainerHeight] = useState("1300rpx");

  // ===== Refs (for timer/observer access without stale closures) =====
  const allSeriesProductsRef = useRef<Record<string, ProductItem[]>>({});
  const allSeriesProductCardsRef = useRef<Record<string, SeriesProductCard[]>>(
    {},
  );
  const subSeriesListRef = useRef<SubSeriesItem[]>([]);
  const currentSeriesIndexRef = useRef(0);
  const modelShowListRef = useRef<ModelShowItem[]>([]);
  const currentModelIndexRef = useRef(0);
  const seriesAnimatingRef = useRef(false);

  const seriesAutoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const modelAutoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seriesResumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelResumeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelObserverSetupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const seriesInViewportRef = useRef(false);
  const modelInViewportRef = useRef(false);
  const seriesIsTouchingRef = useRef(false);
  const seriesProductsIsTouchingRef = useRef(false);
  const modelIsTouchingRef = useRef(false);

  const seriesObserverRef = useRef<Taro.IntersectionObserver | null>(null);
  const modelObserverRef = useRef<Taro.IntersectionObserver | null>(null);
  const mountedRef = useRef(true);
  const firstScreenReadyRef = useRef(false);
  const firstScreenGuardRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const productLoadTasksRef = useRef<Record<string, Promise<ProductItem[]>>>(
    {},
  );
  const seriesImageReadyRef = useRef<Set<string>>(new Set());
  const seriesImageTasksRef = useRef<Record<string, Promise<void>>>({});
  const seriesProductImageReadyRef = useRef<Set<string>>(new Set());
  const seriesProductImageTasksRef = useRef<Record<string, Promise<boolean>>>(
    {},
  );
  const seriesProductImageRetryAfterRef = useRef<Record<string, number>>({});
  const seriesProductImageLastLogAtRef = useRef<Record<string, number>>({});
  const seriesTouchStartPointRef = useRef<{ x: number; y: number } | null>(
    null,
  );
  const seriesTouchDirectionRef = useRef<"none" | "horizontal" | "vertical">(
    "none",
  );

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

  const markFirstScreenReady = useCallback(() => {
    if (firstScreenReadyRef.current) return;
    firstScreenReadyRef.current = true;
    if (firstScreenGuardRef.current) {
      clearTimeout(firstScreenGuardRef.current);
      firstScreenGuardRef.current = null;
    }
    if (mountedRef.current) {
      setShowLoading(false);
    }
  }, []);

  const ensureSeriesDisplayImagePreloaded = useCallback(
    async (series: SubSeriesItem | undefined) => {
      if (!series?._id || !series.displayImage) return;
      if (seriesImageReadyRef.current.has(series._id)) return;

      const existing = seriesImageTasksRef.current[series._id];
      if (existing) {
        await existing;
        return;
      }

      const task = (async () => {
        const ok = await preloadImage(
          series.displayImage,
          IMAGE_PRELOAD_TIMEOUT,
        );
        if (ok) {
          seriesImageReadyRef.current.add(series._id);
        }
      })().finally(() => {
        delete seriesImageTasksRef.current[series._id];
      });

      seriesImageTasksRef.current[series._id] = task;
      await task;
    },
    [],
  );

  const getSeriesProductImageUrls = useCallback(
    (items: ProductItem[]): string[] => {
      return items
        .map((p) => p.skuMainImages?.[0])
        .filter((u): u is string => !!u && isRemoteImageUrl(u));
    },
    [],
  );

  const hasCriticalSeriesProductImagesReady = useCallback(
    (items: ProductItem[]) => {
      const criticalUrls = items
        .map((p) => p.skuMainImages?.[0])
        .filter((u): u is string => !!u)
        .slice(0, CRITICAL_PRODUCT_READY_COUNT);
      if (criticalUrls.length === 0) return true;
      return criticalUrls.every(
        (url) => !isRemoteImageUrl(url) || !!getPreloadedImagePath(url),
      );
    },
    [],
  );

  const ensureSeriesProductImagesPreloaded = useCallback(
    async (
      subSeriesId: string,
      items: ProductItem[],
      concurrency: number = PRODUCT_IMAGE_PRELOAD_CONCURRENCY,
    ): Promise<boolean> => {
      if (!subSeriesId) return false;
      if (seriesProductImageReadyRef.current.has(subSeriesId)) return true;

      const existing = seriesProductImageTasksRef.current[subSeriesId];
      if (existing) {
        return existing;
      }

      const now = Date.now();
      const retryAfter =
        seriesProductImageRetryAfterRef.current[subSeriesId] || 0;
      if (retryAfter > now) {
        return hasCriticalSeriesProductImagesReady(items);
      }

      const task = (async () => {
        const urls = getSeriesProductImageUrls(items);
        if (urls.length === 0) {
          seriesProductImageReadyRef.current.add(subSeriesId);
          delete seriesProductImageRetryAfterRef.current[subSeriesId];
          return true;
        }

        const result = await preloadImages(urls, {
          concurrency,
          timeoutMs: IMAGE_PRELOAD_TIMEOUT,
        });

        const criticalReady = hasCriticalSeriesProductImagesReady(items);
        if (criticalReady) {
          seriesProductImageReadyRef.current.add(subSeriesId);
          delete seriesProductImageRetryAfterRef.current[subSeriesId];
        } else {
          seriesProductImageReadyRef.current.delete(subSeriesId);
          seriesProductImageRetryAfterRef.current[subSeriesId] =
            Date.now() + PRODUCT_PRELOAD_RETRY_COOLDOWN_MS;
        }

        if (result.failed.length > 0 && ENABLE_IMAGE_PRELOAD_DEBUG_LOG) {
          const logAt =
            seriesProductImageLastLogAtRef.current[subSeriesId] || 0;
          const canLog = Date.now() - logAt >= PRODUCT_PRELOAD_LOG_COOLDOWN_MS;
          if (canLog) {
            seriesProductImageLastLogAtRef.current[subSeriesId] = Date.now();
            console.info(
              `[home] product image preload partial: ${subSeriesId}, failed=${result.failed.length}`,
            );
          }
        }

        return criticalReady;
      })().finally(() => {
        delete seriesProductImageTasksRef.current[subSeriesId];
      });

      seriesProductImageTasksRef.current[subSeriesId] = task;
      return task;
    },
    [getSeriesProductImageUrls, hasCriticalSeriesProductImagesReady],
  );

  const hydrateSeriesProductsWithLocalPaths = useCallback(
    (_subSeriesId: string, items: ProductItem[]): ProductItem[] => {
      // Keep render src stable as remote URL (legacy behavior) and only use
      // getImageInfo as warm-up signal to avoid local-path switch flicker.
      return items;
    },
    [],
  );

  const buildSeriesProductCards = useCallback(
    (subSeriesId: string, items: ProductItem[]): SeriesProductCard[] => {
      if (!subSeriesId) return [];
      const cards: SeriesProductCard[] = items.map((p) => ({
        _id: p._id,
        nameCN: p.nameCN,
        formattedPrice: p.formattedPrice,
        image: p.skuMainImages?.[0] || "",
      }));
      allSeriesProductCardsRef.current[subSeriesId] = cards;
      return cards;
    },
    [],
  );

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
        }
      } else {
        if (mountedRef.current) {
          setBanners([]);
          setIsLoadingBanners(false);
        }
      }
    } catch {
      if (mountedRef.current) {
        setBanners([]);
        setIsLoadingBanners(false);
      }
    }
  }, [processImages]);

  /** Load products for a single series into cache */
  const loadSeriesProductsToCache = useCallback(
    async (
      subSeriesId: string,
      options?: { preloadProductImages?: boolean; preloadConcurrency?: number },
    ): Promise<ProductItem[]> => {
      if (!subSeriesId) return [];

      const preloadProductImages = options?.preloadProductImages ?? false;
      const preloadConcurrency =
        options?.preloadConcurrency ?? PRODUCT_IMAGE_PRELOAD_CONCURRENCY;
      const cached = allSeriesProductsRef.current[subSeriesId];
      if (cached) {
        if (preloadProductImages) {
          await ensureSeriesProductImagesPreloaded(
            subSeriesId,
            cached,
            preloadConcurrency,
          );
        }
        return hydrateSeriesProductsWithLocalPaths(subSeriesId, cached);
      }

      const existingTask = productLoadTasksRef.current[subSeriesId];
      if (existingTask) {
        const items = await existingTask;
        if (preloadProductImages) {
          await ensureSeriesProductImagesPreloaded(
            subSeriesId,
            items,
            preloadConcurrency,
          );
        }
        return hydrateSeriesProductsWithLocalPaths(subSeriesId, items);
      }

      const loadTask: Promise<ProductItem[]> = (async () => {
        try {
          const res = await getProductsBySubSeries({
            subSeriesId,
            sortBy: "default",
            page: 1,
            pageSize: 10,
          });
          if (res.code !== 200) return [];

          // Runtime data may be { products: [...] } or { items: [...] }
          const rawData = res.data as any;
          let products: Sku[] = rawData?.products || rawData?.items || [];

          // Process cloud:// URLs for first image only
          const cloudUrls = products
            .map((p) => p.skuMainImages?.[0])
            .filter((u): u is string => !!u && u.startsWith("cloud://"));
          const urlMap = new Map<string, string>();

          if (cloudUrls.length > 0) {
            const httpUrls = await processImages(cloudUrls, {
              width: 280,
              height: 280,
              quality: 80,
            });
            cloudUrls.forEach((cu, i) => urlMap.set(cu, httpUrls[i]));
          }

          products = products.map((p) => {
            const first = p.skuMainImages?.[0];
            if (!first) return p;
            const normalized = first.startsWith("cloud://")
              ? urlMap.get(first) || first
              : first;
            const thumb = toHomeProductThumbUrl(normalized);
            return { ...p, skuMainImages: [thumb] };
          });

          const items: ProductItem[] = products.map((p) => ({
            ...p,
            formattedPrice: formatPrice(p.price),
          }));

          allSeriesProductsRef.current[subSeriesId] = items;
          return items;
        } catch {
          // silently fail for preload
          return [];
        }
      })();

      productLoadTasksRef.current[subSeriesId] = loadTask.finally(() => {
        delete productLoadTasksRef.current[subSeriesId];
      });

      const items = await productLoadTasksRef.current[subSeriesId];
      if (preloadProductImages) {
        await ensureSeriesProductImagesPreloaded(
          subSeriesId,
          items,
          preloadConcurrency,
        );
      }
      return hydrateSeriesProductsWithLocalPaths(subSeriesId, items);
    },
    [
      ensureSeriesProductImagesPreloaded,
      hydrateSeriesProductsWithLocalPaths,
      processImages,
    ],
  );

  const warmupSeriesAndSyncIfActive = useCallback(
    async (series: SubSeriesItem | undefined, targetIndex: number) => {
      if (!series?._id) return;
      await ensureSeriesDisplayImagePreloaded(series);
      const items = await loadSeriesProductsToCache(series._id, {
        preloadProductImages: true,
        preloadConcurrency: CRITICAL_PRODUCT_PRELOAD_CONCURRENCY,
      });
      if (!hasCriticalSeriesProductImagesReady(items)) {
        await ensureSeriesProductImagesPreloaded(
          series._id,
          items,
          CRITICAL_PRODUCT_PRELOAD_CONCURRENCY,
        );
      }

      const hydrated = hydrateSeriesProductsWithLocalPaths(series._id, items);
      const cards = buildSeriesProductCards(series._id, hydrated);
      if (
        mountedRef.current &&
        currentSeriesIndexRef.current === targetIndex &&
        !seriesAnimatingRef.current
      ) {
        setCurrentSubSeriesNameEN(series.nameEN);
        setCurrentSeriesProducts(cards);
      }
    },
    [
      buildSeriesProductCards,
      ensureSeriesDisplayImagePreloaded,
      ensureSeriesProductImagesPreloaded,
      hasCriticalSeriesProductImagesReady,
      hydrateSeriesProductsWithLocalPaths,
      loadSeriesProductsToCache,
    ],
  );

  const hasSeriesProductsCache = useCallback((subSeriesId: string) => {
    return Object.prototype.hasOwnProperty.call(
      allSeriesProductsRef.current,
      subSeriesId,
    );
  }, []);

  const syncSeriesContentFromCache = useCallback(
    (index: number): boolean => {
      const list = subSeriesListRef.current;
      const series = list[index];
      if (!series?._id) return false;
      if (!hasSeriesProductsCache(series._id)) return false;

      const cached = allSeriesProductsRef.current[series._id] || [];
      const hydrated = hydrateSeriesProductsWithLocalPaths(series._id, cached);
      if (!hasCriticalSeriesProductImagesReady(hydrated)) {
        return false;
      }

      seriesProductImageReadyRef.current.add(series._id);
      const cards = buildSeriesProductCards(series._id, hydrated);

      if (mountedRef.current) {
        setCurrentSubSeriesNameEN(series.nameEN);
        setCurrentSeriesProducts(cards);
      }
      return true;
    },
    [
      buildSeriesProductCards,
      hasCriticalSeriesProductImagesReady,
      hasSeriesProductsCache,
      hydrateSeriesProductsWithLocalPaths,
    ],
  );

  const preloadSecondSeries = useCallback(
    async (list: SubSeriesItem[]) => {
      const second = list[1];
      if (!second) return;
      await ensureSeriesDisplayImagePreloaded(second);
      await loadSeriesProductsToCache(second._id, {
        preloadProductImages: true,
        preloadConcurrency: SECOND_SERIES_PRELOAD_CONCURRENCY,
      });
    },
    [ensureSeriesDisplayImagePreloaded, loadSeriesProductsToCache],
  );

  const preloadRemainingSeries = useCallback(
    async (list: SubSeriesItem[]) => {
      const remaining = list.slice(2);
      if (remaining.length === 0) return;

      for (let i = 0; i < remaining.length; i += BACKGROUND_SERIES_BATCH_SIZE) {
        const batch = remaining.slice(i, i + BACKGROUND_SERIES_BATCH_SIZE);
        await Promise.all(
          batch.map(async (series) => {
            await ensureSeriesDisplayImagePreloaded(series);
            const items = await loadSeriesProductsToCache(series._id);
            await ensureSeriesProductImagesPreloaded(
              series._id,
              items,
              BACKGROUND_PRODUCT_PRELOAD_CONCURRENCY,
            );
          }),
        );
        if (i + BACKGROUND_SERIES_BATCH_SIZE < remaining.length) {
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
      }
    },
    [
      ensureSeriesDisplayImagePreloaded,
      ensureSeriesProductImagesPreloaded,
      loadSeriesProductsToCache,
    ],
  );

  /** Load sub-series list */
  const loadSubSeriesData = useCallback(async () => {
    try {
      const res = await listSubSeries(true);
      if (res.code !== 200) {
        markFirstScreenReady();
        return;
      }

      // Runtime: data may be { subSeries: [...] } or direct array
      const rawData = res.data as any;
      let rawList: any[] = Array.isArray(rawData)
        ? rawData
        : rawData?.subSeries || [];

      // Sort by sortNum
      rawList.sort((a: any, b: any) => (a.sortNum ?? 999) - (b.sortNum ?? 999));

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

      currentSeriesIndexRef.current = 0;
      if (mountedRef.current) {
        setCurrentSeriesIndex(0);
        setSubSeriesList(list);
        subSeriesListRef.current = list;
        setCurrentSubSeriesNameEN(list[0]?.nameEN || "");
      }

      if (list.length === 0) {
        if (mountedRef.current) setCurrentSeriesProducts([]);
        markFirstScreenReady();
        return;
      }

      // Start second-series warmup as early as possible to reduce first swipe flash.
      const secondWarmupTask = list[1]
        ? preloadSecondSeries(list)
        : Promise.resolve();

      // First screen gate: first sub-series image + first product list image preloading
      const first = list[0];
      await ensureSeriesDisplayImagePreloaded(first);
      const firstProducts = await loadSeriesProductsToCache(first._id, {
        preloadProductImages: true,
        preloadConcurrency: CRITICAL_PRODUCT_PRELOAD_CONCURRENCY,
      });
      const firstCards = buildSeriesProductCards(first._id, firstProducts);
      if (mountedRef.current) {
        setCurrentSeriesProducts(firstCards);
        setCurrentSubSeriesNameEN(first.nameEN);
      }
      markFirstScreenReady();

      // Keep second as highest priority, then warm up the rest in background.
      void secondWarmupTask.finally(() => {
        void preloadRemainingSeries(list);
      });
    } catch {
      markFirstScreenReady();
    }
  }, [
    buildSeriesProductCards,
    ensureSeriesDisplayImagePreloaded,
    loadSeriesProductsToCache,
    markFirstScreenReady,
    preloadRemainingSeries,
    preloadSecondSeries,
    processImages,
  ]);

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

  const clearSeriesResumeTimer = useCallback(() => {
    if (!seriesResumeRef.current) return;
    clearTimeout(seriesResumeRef.current);
    seriesResumeRef.current = null;
  }, []);

  const clearModelResumeTimer = useCallback(() => {
    if (!modelResumeRef.current) return;
    clearTimeout(modelResumeRef.current);
    modelResumeRef.current = null;
  }, []);

  const startSeriesAutoplay = useCallback(() => {
    stopSeriesAutoplay();
    if (!seriesInViewportRef.current) return;
    if (subSeriesListRef.current.length === 0) return;

    seriesAutoplayRef.current = setInterval(() => {
      if (seriesIsTouchingRef.current || seriesProductsIsTouchingRef.current) {
        return;
      }
      const list = subSeriesListRef.current;
      const idx = currentSeriesIndexRef.current;
      const next = (idx + 1) % list.length;
      const nextSeries = list[next];

      seriesAnimatingRef.current = true;
      currentSeriesIndexRef.current = next;
      setCurrentSeriesIndex(next);
      void warmupSeriesAndSyncIfActive(nextSeries, next);
    }, AUTOPLAY_INTERVAL);
  }, [stopSeriesAutoplay, warmupSeriesAndSyncIfActive]);

  const scheduleSeriesAutoplayResume = useCallback(
    (delay: number = SERIES_RESUME_DELAY) => {
      clearSeriesResumeTimer();
      seriesResumeRef.current = setTimeout(() => {
        seriesResumeRef.current = null;
        if (!seriesInViewportRef.current) return;
        if (seriesIsTouchingRef.current || seriesProductsIsTouchingRef.current)
          return;
        startSeriesAutoplay();
      }, delay);
    },
    [clearSeriesResumeTimer, startSeriesAutoplay],
  );

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
  const onSeriesTouchStart = useCallback(
    (e: any) => {
      const touch = e?.touches?.[0];
      if (touch) {
        seriesTouchStartPointRef.current = {
          x: touch.pageX ?? touch.clientX ?? 0,
          y: touch.pageY ?? touch.clientY ?? 0,
        };
      } else {
        seriesTouchStartPointRef.current = null;
      }
      seriesTouchDirectionRef.current = "none";
      if (seriesSwipeDisabled) setSeriesSwipeDisabled(false);

      seriesIsTouchingRef.current = true;
      stopSeriesAutoplay();
      clearSeriesResumeTimer();
    },
    [clearSeriesResumeTimer, seriesSwipeDisabled, stopSeriesAutoplay],
  );

  const onSeriesTouchMove = useCallback((e: any) => {
    if (seriesTouchDirectionRef.current !== "none") return;
    const start = seriesTouchStartPointRef.current;
    const touch = e?.touches?.[0];
    if (!start || !touch) return;

    const currentX = touch.pageX ?? touch.clientX ?? 0;
    const currentY = touch.pageY ?? touch.clientY ?? 0;
    const dx = Math.abs(currentX - start.x);
    const dy = Math.abs(currentY - start.y);

    if (dx < 6 && dy < 6) return;

    if (dy > dx + 4) {
      seriesTouchDirectionRef.current = "vertical";
      setSeriesSwipeDisabled(true);
      return;
    }

    if (dx > dy + 4) {
      seriesTouchDirectionRef.current = "horizontal";
    }
  }, []);

  const finalizeSeriesTouch = useCallback(() => {
    seriesIsTouchingRef.current = false;
    seriesTouchStartPointRef.current = null;
    seriesTouchDirectionRef.current = "none";
    if (seriesSwipeDisabled) setSeriesSwipeDisabled(false);
    scheduleSeriesAutoplayResume();
  }, [scheduleSeriesAutoplayResume, seriesSwipeDisabled]);

  const onSeriesTouchEnd = useCallback(() => {
    finalizeSeriesTouch();
  }, [finalizeSeriesTouch]);

  const onSeriesTouchCancel = useCallback(() => {
    finalizeSeriesTouch();
  }, [finalizeSeriesTouch]);

  const onProductsTouchStart = useCallback(() => {
    seriesProductsIsTouchingRef.current = true;
    stopSeriesAutoplay();
    clearSeriesResumeTimer();
  }, [clearSeriesResumeTimer, stopSeriesAutoplay]);

  const onProductsTouchEnd = useCallback(() => {
    seriesProductsIsTouchingRef.current = false;
    scheduleSeriesAutoplayResume();
  }, [scheduleSeriesAutoplayResume]);

  const onProductsScroll = useCallback(() => {
    if (!seriesInViewportRef.current) return;
    stopSeriesAutoplay();
    scheduleSeriesAutoplayResume();
  }, [scheduleSeriesAutoplayResume, stopSeriesAutoplay]);

  const onModelTouchStart = useCallback(() => {
    modelIsTouchingRef.current = true;
    stopModelAutoplay();
    clearModelResumeTimer();
  }, [clearModelResumeTimer, stopModelAutoplay]);

  const onModelTouchEnd = useCallback(() => {
    modelIsTouchingRef.current = false;
    clearModelResumeTimer();
    modelResumeRef.current = setTimeout(() => {
      if (modelInViewportRef.current) startModelAutoplay();
    }, MODEL_RESUME_DELAY);
  }, [clearModelResumeTimer, startModelAutoplay]);

  const clearModelObserverSetupTimer = useCallback(() => {
    if (!modelObserverSetupTimerRef.current) return;
    clearTimeout(modelObserverSetupTimerRef.current);
    modelObserverSetupTimerRef.current = null;
  }, []);

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
              if (
                !seriesIsTouchingRef.current &&
                !seriesProductsIsTouchingRef.current
              ) {
                startSeriesAutoplay();
              }
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
    clearSeriesResumeTimer();
    clearModelResumeTimer();
    clearModelObserverSetupTimer();
    seriesAnimatingRef.current = false;
    if (firstScreenGuardRef.current) {
      clearTimeout(firstScreenGuardRef.current);
      firstScreenGuardRef.current = null;
    }
    if (seriesObserverRef.current) {
      seriesObserverRef.current.disconnect();
      seriesObserverRef.current = null;
    }
    if (modelObserverRef.current) {
      modelObserverRef.current.disconnect();
      modelObserverRef.current = null;
    }
  }, [
    clearModelObserverSetupTimer,
    clearModelResumeTimer,
    clearSeriesResumeTimer,
    stopModelAutoplay,
    stopSeriesAutoplay,
  ]);

  // ===== Setup model observer when model data loads =====
  useEffect(() => {
    if (modelShowList.length <= 0) return;
    let retries = 0;

    const trySetup = () => {
      if (!mountedRef.current || modelObserverRef.current) return;
      setupModelObserver();
      if (modelObserverRef.current) return;
      if (retries >= MODEL_OBSERVER_SETUP_MAX_RETRY) return;

      retries += 1;
      clearModelObserverSetupTimer();
      modelObserverSetupTimerRef.current = setTimeout(() => {
        modelObserverSetupTimerRef.current = null;
        trySetup();
      }, MODEL_OBSERVER_SETUP_RETRY_DELAY);
    };

    clearModelObserverSetupTimer();
    trySetup();

    return () => {
      clearModelObserverSetupTimer();
    };
  }, [clearModelObserverSetupTimer, modelShowList.length, setupModelObserver]);

  // ===== Lifecycle Hooks =====
  useLoad(() => {
    mountedRef.current = true;
    firstScreenReadyRef.current = false;
    seriesAnimatingRef.current = false;
    if (firstScreenGuardRef.current) {
      clearTimeout(firstScreenGuardRef.current);
    }
    firstScreenGuardRef.current = setTimeout(() => {
      markFirstScreenReady();
    }, 8000);
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
    if (
      seriesInViewportRef.current &&
      !seriesIsTouchingRef.current &&
      !seriesProductsIsTouchingRef.current
    ) {
      startSeriesAutoplay();
    }
    if (modelInViewportRef.current && !modelIsTouchingRef.current) {
      startModelAutoplay();
    }
  });

  useDidHide(() => {
    stopSeriesAutoplay();
    stopModelAutoplay();
    clearSeriesResumeTimer();
    clearModelResumeTimer();
    clearModelObserverSetupTimer();
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
      seriesAnimatingRef.current = true;
      currentSeriesIndexRef.current = idx;
      setCurrentSeriesIndex(idx);
      void warmupSeriesAndSyncIfActive(series, idx);
    },
    [warmupSeriesAndSyncIfActive],
  );

  const onSeriesSwiperChange = useCallback(
    (e) => {
      const current = e.detail.current;
      const list = subSeriesListRef.current;
      const series = list[current];
      seriesAnimatingRef.current = true;
      currentSeriesIndexRef.current = current;
      setCurrentSeriesIndex(current);
      void warmupSeriesAndSyncIfActive(series, current);
    },
    [warmupSeriesAndSyncIfActive],
  );

  const onSeriesAnimationFinish = useCallback(
    (e) => {
      const current = e.detail.current;
      seriesAnimatingRef.current = false;
      currentSeriesIndexRef.current = current;
      setCurrentSeriesIndex(current);

      const synced = syncSeriesContentFromCache(current);
      if (!synced) {
        const series = subSeriesListRef.current[current];
        void warmupSeriesAndSyncIfActive(series, current);
      }
    },
    [syncSeriesContentFromCache, warmupSeriesAndSyncIfActive],
  );

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
    Taro.navigateTo({
      url: `/pages-sub/series-detail/index?subSeriesId=${id}`,
    });
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
        enhanced
        enablePassive
        minDragDistance={4}
        showScrollbar={false}
        style={{ top: swiperContainerTop, height: swiperContainerHeight }}
      >
        {/* Banner Section */}
        <View
          className={styles.bannerSection}
          style={{
            height: "calc(100% - 100rpx - env(safe-area-inset-bottom))",
          }}
        >
          {isLoadingBanners ? (
            <View className={styles.loadingContainer}>
              <Text>正在加载轮播图...</Text>
            </View>
          ) : (
            <TaroSwiper
              className={styles.bannerSwiper}
              indicatorDots
              autoplay
              interval={5000}
              circular
            >
              {banners.map((banner) => (
                <TaroSwiperItem key={banner._id} onClick={onBannerTap}>
                  <Image
                    className={styles.bannerImage}
                    src={banner.image}
                    mode="aspectFill"
                    lazyLoad
                    {...WEAPP_IMAGE_NO_FADE}
                  />
                  {banner.text && (
                    <View className={styles.bannerNav}>{banner.text}</View>
                  )}
                </TaroSwiperItem>
              ))}
            </TaroSwiper>
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

          <NutSwiper
            id="home-series-swiper"
            className={styles.seriesSwiper}
            height="700rpx"
            defaultValue={0}
            autoPlay={false}
            indicator={false}
            loop
            current={currentSeriesIndex}
            onChange={onSeriesSwiperChange}
            onAnimationFinish={onSeriesAnimationFinish}
            disableTouch={seriesSwipeDisabled}
            onTouchStart={onSeriesTouchStart}
            onTouchMove={onSeriesTouchMove}
            onTouchEnd={onSeriesTouchEnd}
            onTouchCancel={onSeriesTouchCancel}
            nextMargin="100rpx"
            circular
            duration={400}
            easingFunction="easeOutCubic"
          >
            {subSeriesList.map((series, index) => (
              <NutSwiper.Item key={series._id}>
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
                      lazyLoad
                      {...WEAPP_IMAGE_NO_FADE}
                    />
                  </View>
                </View>
              </NutSwiper.Item>
            ))}
          </NutSwiper>

          {/* Products horizontal scroll */}
          <ScrollView
            className={styles.productsScroll}
            scrollX
            enableFlex
            showScrollbar={false}
            onTouchStart={onProductsTouchStart}
            onTouchEnd={onProductsTouchEnd}
            onTouchCancel={onProductsTouchEnd}
            onScroll={onProductsScroll}
          >
            <View className={styles.productsContainer}>
              {currentSeriesProducts.length > 0 ? (
                currentSeriesProducts.map((product) => (
                  <View
                    key={product._id}
                    className={styles.productCard}
                    onClick={() => goToProductDetail(product._id)}
                  >
                    <BufferedProductImage src={product.image} />
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

            <TaroSwiper
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
                <TaroSwiperItem key={model._id}>
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
                        lazyLoad
                        {...WEAPP_IMAGE_NO_FADE}
                      />
                    </View>
                  </View>
                </TaroSwiperItem>
              ))}
            </TaroSwiper>
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

      <CustomTabBar />
    </View>
  );
}
