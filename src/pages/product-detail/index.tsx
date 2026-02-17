import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Swiper,
  SwiperItem,
  Button,
} from "@tarojs/components";
import Taro, { useRouter, useLoad, useShareAppMessage } from "@tarojs/taro";
import TopBarWithBack from "@/components/TopBarWithBack";
import LoadingBar from "@/components/LoadingBar";
import FloatPopup from "@/components/FloatPopup";
import SizePopup from "@/components/SizePopup";
import CartSuccessPopup from "@/components/CartSuccessPopup";
import { useAuth } from "@/hooks/useAuth";
import { useImageProcessor } from "@/hooks/useImageProcessor";
import { useSystemInfo } from "@/hooks/useSystemInfo";
import { useUserStore } from "@/stores/useUserStore";
import * as productService from "@/services/product.service";
import * as cartService from "@/services/cart.service";
import * as wishService from "@/services/wish.service";
import { formatPrice } from "@/utils/format";
import { navigateTo, switchTab } from "@/utils/navigation";
import { getPreloadedImagePath, preloadImages } from "@/utils/image";
import styles from "./index.module.scss";

const IMAGE_PRELOAD_TIMEOUT = 3000;
const RECOMMEND_IMAGE_PRELOAD_CONCURRENCY = 3;
const WEAPP_IMAGE_NO_FADE: any = { fadeShow: false, fadeIn: false };

interface SizeOption {
  skuId: string;
  sizeValue: string;
  stock: number;
  selected: boolean;
}

interface RelatedSku {
  _id: string;
  skuId: string;
  materialName: string;
  image: string;
  isCurrent: boolean;
}

interface RecommendProduct {
  _id: string;
  skuId: string;
  nameCN: string;
  nameEN: string;
  image: string;
  priority: number;
}

interface BufferedRecommendImageProps {
  src: string;
}

function BufferedRecommendImage({ src }: BufferedRecommendImageProps) {
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

  const onPendingError = useCallback(() => {
    if (!pendingSrc) return;
    setDisplaySrc(pendingSrc);
    setPendingSrc("");
  }, [pendingSrc]);

  if (!displaySrc && !pendingSrc) {
    return <View className={styles.recommendedImagePlaceholder}>暂无图片</View>;
  }

  return (
    <View className={styles.recommendedImageStage}>
      {displaySrc ? (
        <Image
          className={`${styles.recommendedImage} ${styles.recommendedImageCurrent}`}
          src={displaySrc}
          mode="aspectFill"
          lazyLoad={false}
          {...WEAPP_IMAGE_NO_FADE}
        />
      ) : null}
      {pendingSrc ? (
        <Image
          className={`${styles.recommendedImage} ${styles.recommendedImagePending}`}
          src={pendingSrc}
          mode="aspectFill"
          lazyLoad={false}
          onLoad={onPendingLoaded}
          onError={onPendingError}
          {...WEAPP_IMAGE_NO_FADE}
        />
      ) : null}
    </View>
  );
}

function toRecommendThumbUrl(url: string): string {
  if (!url || !/^https?:\/\//.test(url)) return url;
  if (url.includes("imageMogr2") || url.includes("imageView2")) return url;
  if (!url.includes("qcloud")) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}imageMogr2/thumbnail/300x300/quality/80/format/webp`;
}

export default function ProductDetail() {
  const router = useRouter();
  const { ensureRegistered } = useAuth();
  const { processImages } = useImageProcessor();
  const { statusBarHeight, navBarHeight } = useSystemInfo();

  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [nameCN, setNameCN] = useState("");
  const [nameEN, setNameEN] = useState("");
  const [skuId, setSkuId] = useState("");
  const [price, setPrice] = useState(0);
  const [sizeValue, setSizeValue] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [quantity] = useState(1);
  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [availableSizes, setAvailableSizes] = useState<SizeOption[]>([]);
  const [relatedSkus, setRelatedSkus] = useState<RelatedSku[]>([]);
  const [giftBoxImages, setGiftBoxImages] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendProduct[]>(
    [],
  );
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [currentWishId, setCurrentWishId] = useState<string | null>(null);
  const [serviceStates, setServiceStates] = useState<Record<string, boolean>>({
    delivery: false,
    afterSales: false,
    returnPolicy: false,
  });
  const [showCartSuccess, setShowCartSuccess] = useState(false);
  const [showFloatPopup, setShowFloatPopup] = useState(false);
  const [showSizePopup, setShowSizePopup] = useState(false);
  const currentSkuRef = useRef<any>(null);
  const spuIdRef = useRef("");

  const topOffset = statusBarHeight + navBarHeight;

  const loadProductDetail = useCallback(
    async (targetSkuId: string) => {
      setLoading(true);
      setCurrentImageIndex(0);
      setRecommendations([]);
      try {
        const res = await productService.getProductDetail(targetSkuId);
        if (res.code !== 200 || !res.data) {
          Taro.showToast({ title: "商品不存在", icon: "none" });
          return;
        }

        const productData = res.data as any;
        const sku = productData.currentSku || productData;
        currentSkuRef.current = sku;
        spuIdRef.current = sku.spuId || "";

        setNameCN(sku.nameCN || "");
        setNameEN(sku.nameEN || "");
        setSkuId(sku.skuId || "");
        setPrice(sku.price || 0);
        setSizeValue(sku.sizeValue || sku.size || "");
        setMaterialName(sku.materialName || sku.material_name || "");
        const recommendationsTask = productService
          .getRecommendations(targetSkuId)
          .catch(() => null);

        // Process SKU main images
        const mainImageUrls = sku.skuMainImages || [];
        if (mainImageUrls.length > 0) {
          const processed = await processImages(mainImageUrls, {
            width: 750,
            height: 750,
            quality: 80,
          });
          setImages(processed);
        } else {
          setImages([]);
        }

        // Process gift box images (skuDetailImages)
        const detailImageUrls = sku.skuDetailImages || [];
        if (detailImageUrls.length > 0) {
          const processedGiftBox = await processImages(detailImageUrls, {
            width: 750,
            height: 469,
            quality: 80,
          });
          setGiftBoxImages(processedGiftBox);
        } else {
          setGiftBoxImages([]);
        }

        // Process related SKUs (other materials)
        const otherMaterials = productData.relatedSkus?.otherMaterials || [];
        if (otherMaterials.length > 0) {
          const relatedImageUrls = otherMaterials
            .map((s: any) => s.skuMainImages?.[0] || "")
            .filter(Boolean);
          const processedRelated =
            relatedImageUrls.length > 0
              ? await processImages(relatedImageUrls, {
                  width: 300,
                  height: 300,
                  quality: 50,
                })
              : [];

          let imgIdx = 0;
          const related: RelatedSku[] = otherMaterials.map((s: any) => {
            const hasImage = s.skuMainImages?.[0];
            const img = hasImage ? processedRelated[imgIdx++] || "" : "";
            return {
              _id: s._id,
              skuId: s.skuId || "",
              materialName: s.materialName || "",
              image: img,
              isCurrent: s._id === targetSkuId,
            };
          });
          setRelatedSkus(related);
        } else {
          setRelatedSkus([]);
        }

        // Size selector (only for bracelets)
        const isBracelet = (sku.nameCN || "").includes("手镯");
        setShowSizeSelector(isBracelet);
        if (isBracelet) {
          const sameMaterialSizes =
            productData.relatedSkus?.sameMaterial?.sizes || [];
          const sizes: SizeOption[] = sameMaterialSizes.map((s: any) => ({
            skuId: s._id,
            sizeValue: s.sizeValue || s.sizeNum || "",
            stock: s.stock ?? 0,
            selected: s._id === targetSkuId,
          }));
          // Add current SKU size as selected if not in the list
          if (!sizes.some((s) => s.selected)) {
            sizes.unshift({
              skuId: targetSkuId,
              sizeValue: sku.sizeValue || sku.size || "",
              stock: sku.stock ?? 1,
              selected: true,
            });
          }
          setAvailableSizes(sizes);
        } else {
          setAvailableSizes([]);
        }

        // Check wishlist status
        const currentUserId = useUserStore.getState().userId;
        if (currentUserId && sku.spuId) {
          try {
            const wishRes = await wishService.checkWish(
              currentUserId,
              sku.spuId,
              targetSkuId,
            );
            if (wishRes.code === 200 && wishRes.data) {
              const wishData = wishRes.data as any;
              setIsInWishlist(
                wishData.isInWishlist || wishData.exists || false,
              );
              setCurrentWishId(
                wishData.wishItem?._id || wishData.wishId || null,
              );
            }
          } catch {
            // Ignore wish check errors
          }
        }

        // Load recommendations
        try {
          const recRes = await recommendationsTask;
          if (recRes && recRes.code === 200 && recRes.data) {
            const recData = recRes.data as any;
            const recList = recData.recommendations || recData || [];
            let items: RecommendProduct[] = (
              Array.isArray(recList) ? recList : []
            )
              .slice(0, 3)
              .map((r: any) => ({
                _id: r._skuId || r._id || "",
                skuId: r.skuId || "",
                nameCN: r.nameCN || r.name || "",
                nameEN: r.nameEN || r.foreign_name || "",
                image: r.image || "",
                priority: r.priority || 3,
              }));

            // Sort: highest priority (lowest number) goes to middle (index 1)
            if (items.length === 3) {
              items.sort((a, b) => a.priority - b.priority);
              const highest = items.shift()!;
              items.splice(1, 0, highest);
            }

            const recCloudUrls = items
              .map((r) => r.image)
              .filter((u): u is string => !!u && u.startsWith("cloud://"));
            if (recCloudUrls.length > 0) {
              const recHttpUrls = await processImages(recCloudUrls, {
                width: 300,
                height: 300,
                quality: 80,
              });
              const urlMap = new Map<string, string>();
              recCloudUrls.forEach((cu, i) => urlMap.set(cu, recHttpUrls[i]));
              items = items.map((r) => ({
                ...r,
                image: r.image.startsWith("cloud://")
                  ? urlMap.get(r.image) || r.image
                  : r.image,
              }));
            }

            items = items.map((r) => ({
              ...r,
              image: toRecommendThumbUrl(r.image),
            }));

            const recUrls = items
              .map((r) => r.image)
              .filter((u): u is string => !!u);
            if (recUrls.length > 0) {
              await preloadImages(recUrls, {
                concurrency: RECOMMEND_IMAGE_PRELOAD_CONCURRENCY,
                timeoutMs: IMAGE_PRELOAD_TIMEOUT,
              });
              items = items.map((r) => {
                const localPath = getPreloadedImagePath(r.image);
                if (!localPath) return r;
                return {
                  ...r,
                  image: localPath,
                };
              });
            }

            setRecommendations(items);
          } else {
            setRecommendations([]);
          }
        } catch {
          // Ignore recommendation errors
          setRecommendations([]);
        }
      } catch (err) {
        console.error("loadProductDetail error:", err);
        Taro.showToast({ title: "加载失败", icon: "none" });
      } finally {
        setLoading(false);
      }
    },
    [processImages],
  );

  useLoad(() => {
    const { skuId: paramSkuId, spuId: paramSpuId } = router.params as any;
    if (paramSkuId) {
      loadProductDetail(paramSkuId);
    } else if (paramSpuId) {
      // Fallback: use spuId to get default SKU
      productService.getProductDetail(paramSpuId).then((res) => {
        if (res.code === 200 && res.data) {
          const data = res.data as any;
          const defaultSkuId = data.currentSku?._id || data._id;
          if (defaultSkuId) {
            loadProductDetail(defaultSkuId);
          }
        }
      });
    }
  });

  useShareAppMessage(() => ({
    title: `${nameCN} ${nameEN}`,
    path: `/pages/product-detail/index?skuId=${currentSkuRef.current?._id || ""}`,
    imageUrl: "/assets/images/share.jpg",
  }));

  // Swiper change handler
  const handleSwiperChange = useCallback((e: any) => {
    setCurrentImageIndex(e.detail.current);
  }, []);

  // Preview image
  const handlePreviewImage = useCallback(() => {
    if (images.length > 0) {
      Taro.previewImage({
        urls: images,
        current: images[currentImageIndex],
      });
    }
  }, [images, currentImageIndex]);

  // Toggle wishlist
  const handleToggleWish = useCallback(async () => {
    const currentUserId = useUserStore.getState().userId;
    if (!currentUserId) {
      try {
        await useUserStore.getState().login();
      } catch {
        return;
      }
    }

    const uid = useUserStore.getState().userId;
    if (!uid) return;

    try {
      if (isInWishlist && currentWishId) {
        await wishService.removeWish(currentWishId);
        setIsInWishlist(false);
        setCurrentWishId(null);
      } else {
        const spuId = spuIdRef.current;
        const skuDbId = currentSkuRef.current?._id || "";
        const res = await wishService.addWish(uid, spuId, skuDbId);
        if (res.code === 200) {
          setIsInWishlist(true);
          const resData = res.data as any;
          setCurrentWishId(resData?._id || resData?.wishId || null);
        }
      }
    } catch {
      Taro.showToast({ title: "操作失败", icon: "none" });
    }
  }, [isInWishlist, currentWishId]);

  // Add to cart
  const handleAddToCart = useCallback(async () => {
    const registered = await ensureRegistered();
    if (!registered) return;

    const uid = useUserStore.getState().userId;
    const sku = currentSkuRef.current;
    if (!uid || !sku) return;

    try {
      const res = await cartService.addToCart(uid, sku._id, quantity);
      if (res.code === 200) {
        setShowCartSuccess(true);
      } else {
        Taro.showToast({ title: res.message || "加购失败", icon: "none" });
      }
    } catch {
      Taro.showToast({ title: "加购失败", icon: "none" });
    }
  }, [ensureRegistered, quantity]);

  // Direct buy (checkout)
  const handleCheckout = useCallback(async () => {
    const registered = await ensureRegistered();
    if (!registered) return;

    const sku = currentSkuRef.current;
    if (!sku) return;

    const productInfo = {
      skuId: sku._id,
      quantity,
      price,
      name: nameCN,
      nameEN,
      material: materialName,
      size: sizeValue,
      image: images[0] || "",
      directBuy: true,
    };
    Taro.setStorageSync("directBuyProduct", productInfo);
    navigateTo("/pages-sub/payment/index");
  }, [
    ensureRegistered,
    quantity,
    price,
    nameCN,
    nameEN,
    materialName,
    sizeValue,
    images,
  ]);

  // Size change
  const handleSizeChange = useCallback(
    (targetSkuId: string, stock: number) => {
      if (stock <= 0) return;
      loadProductDetail(targetSkuId);
    },
    [loadProductDetail],
  );

  // Related SKU navigation
  const handleGoToRelatedSku = useCallback(
    (relatedSkuId: string, isCurrent: boolean) => {
      if (isCurrent) return;
      navigateTo(`/pages/product-detail/index?skuId=${relatedSkuId}`);
    },
    [],
  );

  // Recommendation navigation
  const handleGoToRecommend = useCallback((recId: string) => {
    navigateTo(`/pages/product-detail/index?skuId=${recId}`);
  }, []);

  // Toggle service section
  const handleToggleService = useCallback((key: string) => {
    setServiceStates((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // Go to cart
  const handleGoToCart = useCallback(() => {
    switchTab("/pages/cart/index");
  }, []);

  const formattedPrice = `¥${formatPrice(price)}`;

  return (
    <>
      <TopBarWithBack />
      <View
        className={styles.container}
        style={{ marginTop: `${topOffset + 15}px` }}
      >
        <LoadingBar visible={loading} />

        {!loading && (
          <>
            <ScrollView
              className={styles.scrollArea}
              scrollY
              showScrollbar={false}
              style={{
                height: `calc(100vh - ${topOffset}px)`,
              }}
            >
              {/* Image Swiper */}
              <View className={styles.imageContainer}>
                {images.length > 0 ? (
                  <Swiper
                    className={styles.productSwiper}
                    autoplay
                    interval={4000}
                    circular
                    indicatorDots={false}
                    onChange={handleSwiperChange}
                  >
                    {images.map((src, idx) => (
                      <SwiperItem key={idx}>
                        <Image
                          className={styles.productImage}
                          src={src}
                          mode="aspectFill"
                          lazyLoad
                          onClick={handlePreviewImage}
                        />
                      </SwiperItem>
                    ))}
                  </Swiper>
                ) : (
                  <View className={styles.imagePlaceholder}>
                    <Text>暂无图片</Text>
                  </View>
                )}

                {/* Custom indicator: progress bar style */}
                {images.length > 1 && (
                  <View className={styles.swiperIndicators}>
                    {images.map((_, idx) => (
                      <View className={styles.indicatorItem} key={idx}>
                        <View
                          className={`${styles.indicatorProgress} ${currentImageIndex === idx ? styles.active : ""}`}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Product Info */}
              <View className={styles.infoContainer}>
                {/* Row: nameEN + skuId */}
                <View className={`${styles.infoRow} ${styles.rowNameAndId}`}>
                  <Text className={styles.nameEn}>{nameEN}</Text>
                  <View className={styles.productIdContainer}>
                    <Text className={styles.productIdName}>作品编号:</Text>
                    <Text className={styles.productId}>{skuId}</Text>
                  </View>
                </View>

                {/* Row: nameCN + actions */}
                <View
                  className={`${styles.infoRow} ${styles.rowNameAndActions}`}
                >
                  <Text className={styles.nameCn}>{nameCN}</Text>
                  <View className={styles.actionsIcons}>
                    <Image
                      className={styles.heartIcon}
                      src={
                        isInWishlist
                          ? "/assets/icons/heart_selected.png"
                          : "/assets/icons/heart.png"
                      }
                      mode="aspectFit"
                      onClick={handleToggleWish}
                    />
                    <Button className={styles.shareButton} openType="share">
                      <Image
                        className={styles.shareIcon}
                        src="/assets/icons/share.png"
                        mode="aspectFit"
                      />
                    </Button>
                  </View>
                </View>

                {/* Row: shipping info */}
                <View className={`${styles.infoRow} ${styles.rowShippingInfo}`}>
                  <Text className={styles.shippingText}>
                    付款后15至20个工作日之内发货
                  </Text>
                </View>

                {/* Row: price */}
                <View className={`${styles.infoRow} ${styles.rowPrice}`}>
                  <Text className={styles.productPrice}>{formattedPrice}</Text>
                </View>

                {/* Size Selector (bracelet only) */}
                {showSizeSelector && (
                  <View className={styles.sizeSelectorSection}>
                    <View className={styles.sizeSelectorHeader}>
                      <Text className={styles.sectionTitle}>选择尺码</Text>
                    </View>
                    <View className={styles.sizeOptionsContainer}>
                      {availableSizes.map((size) => (
                        <View
                          key={size.skuId}
                          className={`${styles.sizeOption} ${size.selected ? styles.selected : ""} ${size.stock <= 0 ? styles.outOfStock : ""}`}
                          onClick={() =>
                            handleSizeChange(size.skuId, size.stock)
                          }
                        >
                          <Text className={styles.sizeLabel}>
                            {size.sizeValue}
                          </Text>
                          {size.stock <= 0 && (
                            <Text className={styles.sizeStock}>售罄</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View className={styles.spacer} />

                {/* Detail Section */}
                <View className={`${styles.infoRow} ${styles.rowDetailTitle}`}>
                  <Text className={styles.sectionTitle}>细节</Text>
                </View>
                <View className={`${styles.infoRow} ${styles.rowDetailSize}`}>
                  <Text className={styles.detailItem}>
                    作品尺寸：{sizeValue}
                  </Text>
                </View>
                <View
                  className={`${styles.infoRow} ${styles.rowDetailMaterial}`}
                >
                  <Text className={styles.detailItem}>
                    作品材质：{materialName}
                  </Text>
                </View>
                <View className={`${styles.infoRow} ${styles.rowDetailOrigin}`}>
                  <Text className={styles.detailItem}>产地：中国</Text>
                </View>
                <View className={styles.infoRow}>
                  <Text className={styles.detailNote}>
                    如需证书，请联系客服获取
                  </Text>
                </View>

                {/* More Styles (Related SKUs) */}
                <View className={styles.moreStylesSection}>
                  <Text className={styles.sectionTitle}>更多款式</Text>
                  {relatedSkus.length > 0 ? (
                    <View
                      className={`${styles.relatedSkusContainer} ${relatedSkus.length === 1 ? styles.relatedSkusSingle : ""}`}
                    >
                      {relatedSkus.map((item) => (
                        <View
                          key={item._id}
                          className={`${styles.relatedSkuItem} ${item.isCurrent ? styles.selected : ""}`}
                          onClick={() =>
                            handleGoToRelatedSku(item._id, item.isCurrent)
                          }
                        >
                          <View className={styles.relatedSkuImageContainer}>
                            {item.image ? (
                              <Image
                                className={styles.relatedSkuImage}
                                src={item.image}
                                mode="aspectFill"
                                lazyLoad
                              />
                            ) : (
                              <View
                                className={styles.relatedSkuImagePlaceholder}
                              >
                                暂无图片
                              </View>
                            )}
                          </View>
                          <Text className={styles.relatedSkuName}>
                            {item.materialName}
                          </Text>
                          <Text className={styles.relatedSkuId}>
                            编号：{item.skuId}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View className={styles.noRelatedSkus}>
                      <Text>此商品暂无其他款式</Text>
                    </View>
                  )}
                </View>

                {/* Gift Box Images */}
                <View className={styles.giftBoxSection}>
                  <Text className={styles.sectionTitle}>礼盒包装</Text>
                  {giftBoxImages.length > 0 ? (
                    <View className={styles.giftBoxImages}>
                      {giftBoxImages.map((src, idx) => (
                        <View key={idx} className={styles.giftBoxImageWrapper}>
                          <Image
                            className={styles.giftBoxImage}
                            src={src}
                            mode="aspectFill"
                            lazyLoad
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View className={styles.giftBoxPlaceholder}>图片待定</View>
                  )}
                </View>

                {/* Collapsible Service Items */}
                <View className={styles.serviceItems}>
                  {/* Delivery */}
                  <View className={styles.serviceItem}>
                    <View
                      className={styles.serviceHeader}
                      onClick={() => handleToggleService("delivery")}
                    >
                      <Text className={styles.sectionTitle}>配送服务</Text>
                      <Image
                        className={styles.serviceArrow}
                        src={
                          serviceStates.delivery
                            ? "/assets/icons/up.png"
                            : "/assets/icons/down.png"
                        }
                        mode="aspectFit"
                      />
                    </View>
                    {serviceStates.delivery && (
                      <View className={styles.serviceContent}>
                        <Text className={styles.policyDesc}>
                          珠宝作品均使用顺丰包邮保价配送。
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* After Sales */}
                  <View className={styles.serviceItem}>
                    <View
                      className={styles.serviceHeader}
                      onClick={() => handleToggleService("afterSales")}
                    >
                      <Text className={styles.sectionTitle}>售后服务</Text>
                      <Image
                        className={styles.serviceArrow}
                        src={
                          serviceStates.afterSales
                            ? "/assets/icons/up.png"
                            : "/assets/icons/down.png"
                        }
                        mode="aspectFit"
                      />
                    </View>
                    {serviceStates.afterSales && (
                      <View className={styles.serviceContent}>
                        <View className={styles.policyItem}>
                          <Text className={styles.policyTitle}>珠宝护理</Text>
                          <Text className={styles.policyDesc}>
                            您在家中可使用棉布或亚麻布沾取热水和洗涤液轻轻擦洗作品，如需其他服务，您可联系官方客服寄送作品至品牌工坊，由工作人员为您提供专业的珠宝清洁护理。
                          </Text>
                        </View>
                        <View className={styles.policyItem}>
                          <Text className={styles.policyTitle}>定期保养</Text>
                          <Text className={styles.policyDesc}>
                            我们建议您每年进行一次珠宝检查，确保您的珠宝始终保持最佳状态。
                          </Text>
                        </View>
                        <View className={styles.policyItem}>
                          <Text className={styles.policyTitle}>镌刻服务</Text>
                          <Text className={styles.policyDesc}>
                            部分珠宝作品可提供免费刻字服务，详情请联系官方客服。
                          </Text>
                        </View>
                        <View className={styles.policyItem}>
                          <Text className={styles.policyTitle}>珠宝证书</Text>
                          <Text className={styles.policyDesc}>
                            可联系官方客服获取珠宝证书。
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Return Policy */}
                  <View className={styles.serviceItem}>
                    <View
                      className={styles.serviceHeader}
                      onClick={() => handleToggleService("returnPolicy")}
                    >
                      <Text className={styles.sectionTitle}>退换货服务</Text>
                      <Image
                        className={styles.serviceArrow}
                        src={
                          serviceStates.returnPolicy
                            ? "/assets/icons/up.png"
                            : "/assets/icons/down.png"
                        }
                        mode="aspectFit"
                      />
                    </View>
                    {serviceStates.returnPolicy && (
                      <View className={styles.serviceContent}>
                        <Text className={styles.policyDesc}>
                          您有权在签收之日起30天内申请退换货。
                        </Text>
                        <View className={styles.exploreMoreSection}>
                          <Text
                            className={styles.exploreMoreBtn}
                            onClick={() =>
                              navigateTo(
                                "/pages-sub/return-exchange-detail/index",
                              )
                            }
                          >
                            探索更多
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {/* Recommendations */}
                <View className={styles.recommendedSection}>
                  <View className={styles.selectionBar}>
                    <Text className={styles.sectionTitle}>为您推荐</Text>
                  </View>
                  <View className={styles.recommendedContainer}>
                    {recommendations.map((item, index) => (
                      <View
                        key={`rec-slot-${index}`}
                        className={styles.recommendedItem}
                        onClick={() => handleGoToRecommend(item._id)}
                      >
                        <View className={styles.recommendedImageContainer}>
                          <BufferedRecommendImage src={item.image} />
                        </View>
                        <Text className={styles.recommendedNameEn}>
                          {item.nameEN}
                        </Text>
                        <View className={styles.recommendedNameCn}>
                          {item.nameCN}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Bottom Action Bar */}
            <View className={styles.tabbar}>
              <View
                className={styles.tabbarIconBtn}
                onClick={() => setShowFloatPopup(true)}
              >
                <Image
                  className={styles.tabbarIconImg}
                  src="/assets/icons/ke_fu.png"
                  mode="aspectFit"
                />
                <Text className={styles.tabbarIconLabel}>客服</Text>
              </View>
              <View className={styles.tabbarIconBtn} onClick={handleGoToCart}>
                <Image
                  className={styles.tabbarIconImg}
                  src="/assets/icons/shopping.png"
                  mode="aspectFit"
                />
                <Text className={styles.tabbarIconLabel}>购物车</Text>
              </View>
              <View
                className={styles.tabbarAddToCart}
                onClick={handleAddToCart}
              >
                <Text>加入购物车</Text>
              </View>
              <View className={styles.tabbarCheckout} onClick={handleCheckout}>
                <Text>立即结算</Text>
              </View>
            </View>

            {/* Popups */}
            <FloatPopup
              visible={showFloatPopup}
              onClose={() => setShowFloatPopup(false)}
            />
            <SizePopup
              visible={showSizePopup}
              onClose={() => setShowSizePopup(false)}
            />
            <CartSuccessPopup
              visible={showCartSuccess}
              onContinue={() => setShowCartSuccess(false)}
              onGoToCart={() => {
                setShowCartSuccess(false);
                handleGoToCart();
              }}
              onClose={() => setShowCartSuccess(false)}
            />
          </>
        )}
      </View>
    </>
  );
}
