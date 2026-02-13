import { useState, useRef, useCallback, useEffect } from "react";
import { View, Text, Image, ScrollView } from "@tarojs/components";
import Taro, { useLoad, useReady, useDidShow } from "@tarojs/taro";
import { useSystemInfo } from "@/hooks/useSystemInfo";
import { useImageProcessor } from "@/hooks/useImageProcessor";
import { useAppStore } from "@/stores/useAppStore";
import {
  listSubSeries,
  listCategories,
  listMaterials,
  getProductsBySubSeries,
  getProductsByCategory,
  getProductsByMaterial,
  getProductsByFilter,
} from "@/services/product.service";
import { formatPrice } from "@/utils/format";
import TopBar, { TOP_BAR_BOTTOM_PADDING_RPX } from "@/components/TopBar";
import FloatBtn from "@/components/FloatBtn";
import FloatPopup from "@/components/FloatPopup";
import LoadingBar from "@/components/LoadingBar";
import CustomTabBar from "@/custom-tab-bar";
import styles from "./index.module.scss";

// ===== Constants =====
const FILTER_ICON = "/assets/icons/filter.png";
const SORT_ICON = "/assets/icons/sort.png";
const SELECTED_ICON = "/assets/icons/selected.png";
const NOT_SELECTED_ICON = "/assets/icons/not_selected.png";

const PAGE_SIZE = 200;

const SORT_TEXT_MAP: Record<string, string> = {
  default: "默认排序",
  price_asc: "价格从低到高",
  price_desc: "价格从高到低",
};

const MATERIAL_GROUPS = [
  { id: "material_18k_gold", name: "18k黄金", colorKey: "黄金" },
  { id: "material_18k_white", name: "18k白金", colorKey: "白金" },
  { id: "material_18k_black", name: "18k黑金", colorKey: "黑金" },
];

// ===== Types =====
type FilterType = "subseries" | "category" | "material";
type SortType = "default" | "price_asc" | "price_desc";

interface FilterItem {
  id: string;
  name: string;
  nameEN?: string;
  nameCN?: string;
  type: FilterType;
  active: boolean;
  isSelected?: boolean;
  isMaterialGroup?: boolean;
  materialIds?: string[];
  materialImage?: string;
}

interface FilterSection {
  id: string;
  title: string;
  type: FilterType;
  expanded: boolean;
  collapsible: boolean;
  items: FilterItem[];
}

interface SubSeriesListItem {
  _id: string;
  name: string;
  nameEN: string;
  displayImage: string;
}

interface ProductItem {
  _id: string;
  nameCN: string;
  nameEN: string;
  price: number;
  skuMainImages: string[];
  formattedPrice: string;
}

interface SelectedFilter {
  type: FilterType | "";
  id: string;
  name: string;
}

// ===== Component =====
export default function Category() {
  const { statusBarHeight, navBarHeight, screenWidth } = useSystemInfo();
  const { processImages } = useImageProcessor();
  const setCurrentTab = useAppStore((s) => s.setCurrentTab);

  // Layout
  const [layoutTop, setLayoutTop] = useState("170rpx");
  const [layoutHeight, setLayoutHeight] = useState("1300rpx");

  // Loading
  const [showLoading, setShowLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [isPopupShow, setIsPopupShow] = useState(false);

  // Filter sections (left sidebar)
  const [filterSections, setFilterSections] = useState<FilterSection[]>([
    {
      id: "subseries",
      title: "Sperà",
      type: "subseries",
      expanded: true,
      collapsible: false,
      items: [],
    },
    {
      id: "category",
      title: "分类",
      type: "category",
      expanded: false,
      collapsible: true,
      items: [],
    },
    {
      id: "material",
      title: "材质",
      type: "material",
      expanded: false,
      collapsible: true,
      items: [],
    },
  ]);
  const filterSectionsRef = useRef(filterSections);

  // SubSeries display list (ALL view grid)
  const [subSeriesList, setSubSeriesList] = useState<SubSeriesListItem[]>([]);

  // View mode
  const [viewMode, setViewMode] = useState<"ALL" | "FILTERED">("ALL");
  const [selectedFilter, setSelectedFilter] = useState<SelectedFilter>({
    type: "",
    id: "",
    name: "",
  });

  // Product data (unified for all filter types)
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productCount, setProductCount] = useState(0);
  const [headerImage, setHeaderImage] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Sort
  const [currentSort, setCurrentSort] = useState<SortType>("default");
  const [sortText, setSortText] = useState("默认排序");
  const [showSortOptions, setShowSortOptions] = useState(false);

  // Secondary filter
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedSubSeriesIds, setSelectedSubSeriesIds] = useState<string[]>(
    [],
  );

  const mountedRef = useRef(true);

  // Keep ref in sync
  const updateFilterSections = useCallback((sections: FilterSection[]) => {
    setFilterSections(sections);
    filterSectionsRef.current = sections;
  }, []);

  // ===== Layout =====
  const calculateLayout = useCallback(() => {
    const rpxRatio = 750 / screenWidth;
    const topBarTotalHeight =
      (statusBarHeight + navBarHeight) * rpxRatio + TOP_BAR_BOTTOM_PADDING_RPX;
    const windowInfo = Taro.getWindowInfo();
    const windowHeightRpx = windowInfo.windowHeight * rpxRatio;
    const height = windowHeightRpx - topBarTotalHeight;

    setLayoutTop(topBarTotalHeight + "rpx");
    setLayoutHeight(height + "rpx");
  }, [statusBarHeight, navBarHeight, screenWidth]);

  // ===== Material helpers =====
  const expandMaterialIds = useCallback((rawIds: string[]): string[] => {
    const materialSection = filterSectionsRef.current.find(
      (s) => s.type === "material",
    );
    const items = materialSection?.items || [];
    const groupMap = new Map(items.map((it) => [String(it.id), it]));

    const out: string[] = [];
    rawIds.forEach((id) => {
      const key = String(id);
      const it = groupMap.get(key);
      if (it?.materialIds?.length) {
        out.push(...it.materialIds);
      } else {
        out.push(key);
      }
    });
    return [...new Set(out.filter(Boolean))];
  }, []);

  const isMaterialGroupId = useCallback((id: string): boolean => {
    const materialSection = filterSectionsRef.current.find(
      (s) => s.type === "material",
    );
    const item = materialSection?.items.find(
      (x) => String(x.id) === String(id),
    );
    return !!item?.isMaterialGroup;
  }, []);

  // ===== Image processing helper =====
  const processProductData = useCallback(
    async (
      rawProducts: any[],
      topImageUrl?: string,
    ): Promise<{ processed: ProductItem[]; topImage: string }> => {
      // Collect all cloud:// URLs
      const allCloudUrls: string[] = [];
      rawProducts.forEach((p) => {
        const img = p.skuMainImages?.[0];
        if (img?.startsWith("cloud://")) allCloudUrls.push(img);
      });
      if (topImageUrl?.startsWith("cloud://")) allCloudUrls.push(topImageUrl);

      const uniqueUrls = [...new Set(allCloudUrls)];
      const urlMap = new Map<string, string>();

      if (uniqueUrls.length > 0) {
        const httpUrls = await processImages(uniqueUrls, {
          width: 300,
          height: 300,
          quality: 50,
        });
        uniqueUrls.forEach((cu, i) => urlMap.set(cu, httpUrls[i]));
      }

      const processed: ProductItem[] = rawProducts.map((p) => {
        let firstImage = p.skuMainImages?.[0] || "";
        if (firstImage.startsWith("cloud://")) {
          firstImage = urlMap.get(firstImage) || firstImage;
        }
        return {
          _id: p._id,
          nameCN: p.nameCN || "",
          nameEN: p.nameEN || "",
          price: p.price || 0,
          skuMainImages: [firstImage],
          formattedPrice: formatPrice(p.price || 0),
        };
      });

      let topImage = topImageUrl || "";
      if (topImage.startsWith("cloud://")) {
        topImage = urlMap.get(topImage) || topImage;
      }

      return { processed, topImage };
    },
    [processImages],
  );

  // ===== Data loading =====
  const loadFilterData = useCallback(async () => {
    setShowLoading(true);
    try {
      const [subSeriesRes, categoriesRes, materialsRes] = await Promise.all([
        listSubSeries(true),
        listCategories(),
        listMaterials(true),
      ]);

      const sections: FilterSection[] = [
        {
          id: "subseries",
          title: "Sperà",
          type: "subseries",
          expanded: true,
          collapsible: false,
          items: [],
        },
        {
          id: "category",
          title: "分类",
          type: "category",
          expanded: false,
          collapsible: true,
          items: [],
        },
        {
          id: "material",
          title: "材质",
          type: "material",
          expanded: false,
          collapsible: true,
          items: [],
        },
      ];

      // --- SubSeries ---
      if (subSeriesRes.code === 200) {
        const rawData = subSeriesRes.data as any;
        let rawList: any[] = Array.isArray(rawData)
          ? rawData
          : rawData?.subSeries || [];
        rawList.sort(
          (a: any, b: any) => (a.sortNum ?? 999) - (b.sortNum ?? 999),
        );

        sections[0].items = rawList.map((item: any) => ({
          id: item._id,
          name: `${item.nameEN || ""}${item.nameEN && item.name ? " " : ""}${item.name || ""}`.trim(),
          nameEN: item.nameEN || "",
          nameCN: item.name || "",
          type: "subseries" as FilterType,
          active: false,
        }));

        // Build display list for ALL view
        const displayList: SubSeriesListItem[] = rawList.map((item: any) => ({
          _id: item._id,
          name: item.name || "",
          nameEN: item.nameEN || "",
          displayImage: item.displayImage || "",
        }));

        // Convert cloud:// display images
        const cloudUrls = displayList
          .map((s) => s.displayImage)
          .filter((u) => u.startsWith("cloud://"));
        if (cloudUrls.length > 0) {
          const httpUrls = await processImages(cloudUrls, {
            width: 750,
            height: 500,
            quality: 50,
          });
          const urlMap = new Map<string, string>();
          cloudUrls.forEach((cu, i) => urlMap.set(cu, httpUrls[i]));
          displayList.forEach((s) => {
            if (s.displayImage.startsWith("cloud://")) {
              s.displayImage = urlMap.get(s.displayImage) || s.displayImage;
            }
          });
        }

        if (mountedRef.current) setSubSeriesList(displayList);
      }

      // --- Categories ---
      if (categoriesRes.code === 200) {
        const rawData = categoriesRes.data as any;
        let rawList: any[] = Array.isArray(rawData)
          ? rawData
          : rawData?.categories || [];
        rawList = rawList.filter((item: any) => item.status === true);
        rawList.sort(
          (a: any, b: any) =>
            (parseInt(a.categoryId, 10) || 999) -
            (parseInt(b.categoryId, 10) || 999),
        );

        sections[1].items = rawList.map((item: any) => ({
          id: item._id,
          name: item.categoryName || item.typeName || "",
          type: "category" as FilterType,
          active: false,
        }));
      }

      // --- Materials (grouped into 18k gold types) ---
      if (materialsRes.code === 200) {
        const rawData = materialsRes.data as any;
        const rawList: any[] = Array.isArray(rawData)
          ? rawData
          : rawData?.materials || [];

        const normalize = (v: string) => String(v || "").toLowerCase();
        const getSearchText = (m: any) =>
          normalize([m?.nameCN, m?.description].filter(Boolean).join(" "));
        const isMatchGroup = (text: string, colorKey: string) =>
          text.includes(`18k${colorKey}`) ||
          (text.includes("18k") && text.includes(colorKey));

        const groupAgg = new Map(
          MATERIAL_GROUPS.map((g) => [
            g.id,
            { ...g, materialIds: [] as string[], materialImage: "" },
          ]),
        );

        rawList.forEach((m: any) => {
          const text = getSearchText(m);
          MATERIAL_GROUPS.forEach((g) => {
            if (isMatchGroup(text, g.colorKey)) {
              const agg = groupAgg.get(g.id)!;
              if (m?._id) agg.materialIds.push(m._id);
              if (!agg.materialImage && m?.materialImage)
                agg.materialImage = m.materialImage;
            }
          });
        });

        sections[2].items = MATERIAL_GROUPS.map((g) => {
          const agg = groupAgg.get(g.id)!;
          return {
            id: g.id,
            name: g.name,
            type: "material" as FilterType,
            active: false,
            isMaterialGroup: true,
            materialIds: [
              ...new Set(agg.materialIds.filter(Boolean).map(String)),
            ],
            materialImage: agg.materialImage || "",
          };
        });
      }

      if (mountedRef.current) {
        updateFilterSections(sections);
        setShowLoading(false);
      }
    } catch {
      if (mountedRef.current) setShowLoading(false);
      Taro.showToast({ title: "数据加载失败", icon: "none" });
    }
  }, [processImages, updateFilterSections]);

  /** Load products by a single filter dimension */
  const loadProducts = useCallback(
    async (
      filterType: FilterType,
      filterId: string,
      page: number = 1,
      sort: SortType = "default",
      append: boolean = false,
    ) => {
      setLoadingProducts(true);
      try {
        let res: any;

        if (filterType === "subseries") {
          res = await getProductsBySubSeries({
            subSeriesId: filterId,
            sortBy: sort,
            page,
            pageSize: PAGE_SIZE,
          });
        } else if (filterType === "category") {
          res = await getProductsByCategory({
            categoryId: filterId,
            sortBy: sort,
            page,
            pageSize: PAGE_SIZE,
          });
        } else if (filterType === "material") {
          if (isMaterialGroupId(filterId)) {
            const expandedIds = expandMaterialIds([filterId]);
            if (expandedIds.length === 0) {
              if (mountedRef.current) {
                setProducts([]);
                setProductCount(0);
                setHeaderImage("");
                setLoadingProducts(false);
                setHasMore(false);
              }
              return;
            }
            res = await getProductsByFilter({
              materialIds: expandedIds,
              sortBy: sort,
              page,
              pageSize: PAGE_SIZE,
            });
          } else {
            res = await getProductsByMaterial({
              materialId: filterId,
              sortBy: sort,
              page,
              pageSize: PAGE_SIZE,
            });
          }
        }

        if (res?.code === 200) {
          const rawData = res.data as any;
          const rawProducts = rawData?.products || rawData?.items || [];
          const skuCount = rawData?.skuCount || rawProducts.length;
          const pagination = rawData?.pagination || {};

          // Determine header image URL
          let topImageUrl = "";
          if (filterType === "subseries") {
            topImageUrl = rawData?.subSeriesInfo?.displayImage || "";
          } else if (filterType === "category") {
            topImageUrl = rawData?.categoryInfo?.displayImage || "";
          } else if (filterType === "material") {
            if (isMaterialGroupId(filterId)) {
              const materialSection = filterSectionsRef.current.find(
                (s) => s.type === "material",
              );
              const groupItem = materialSection?.items.find(
                (it) => String(it.id) === String(filterId),
              );
              topImageUrl = groupItem?.materialImage || "";
            } else {
              topImageUrl = rawData?.materialInfo?.materialImage || "";
            }
          }

          const { processed, topImage } = await processProductData(
            rawProducts,
            topImageUrl,
          );
          const moreAvailable = pagination.page < pagination.totalPages;

          if (mountedRef.current) {
            setProducts((prev) =>
              append ? [...prev, ...processed] : processed,
            );
            setProductCount(skuCount);
            setHeaderImage(topImage);
            setCurrentPage(page);
            setHasMore(moreAvailable);
            setLoadingProducts(false);
          }
        } else {
          if (mountedRef.current) {
            if (!append) {
              setProducts([]);
              setProductCount(0);
              setHeaderImage("");
            }
            setLoadingProducts(false);
          }
        }
      } catch {
        if (mountedRef.current) {
          if (!append) {
            setProducts([]);
            setProductCount(0);
            setHeaderImage("");
          }
          setLoadingProducts(false);
        }
        Taro.showToast({ title: "加载商品失败", icon: "none" });
      }
    },
    [processProductData, isMaterialGroupId, expandMaterialIds],
  );

  /** Load products with combined secondary filters */
  const loadProductsWithFilter = useCallback(
    async (
      primaryType: FilterType,
      primaryId: string,
      catIds: string[],
      matIds: string[],
      subIds: string[],
      sort: SortType,
    ) => {
      setLoadingProducts(true);
      try {
        const filterData: Record<string, any> = {
          sortBy: sort,
          page: 1,
          pageSize: PAGE_SIZE,
        };

        const expandedMatIds = expandMaterialIds(matIds);

        if (primaryType === "subseries") {
          filterData.subSeriesIds = [...new Set([primaryId, ...subIds])];
          if (catIds.length > 0) filterData.categoryIds = catIds;
          if (expandedMatIds.length > 0)
            filterData.materialIds = expandedMatIds;
        } else if (primaryType === "category") {
          filterData.categoryIds = [...new Set([primaryId, ...catIds])];
          if (subIds.length > 0) filterData.subSeriesIds = subIds;
          if (expandedMatIds.length > 0)
            filterData.materialIds = expandedMatIds;
        } else if (primaryType === "material") {
          filterData.materialIds = expandMaterialIds([primaryId, ...matIds]);
          if (subIds.length > 0) filterData.subSeriesIds = subIds;
          if (catIds.length > 0) filterData.categoryIds = catIds;
        }

        const res = await getProductsByFilter(filterData);

        if (res?.code === 200) {
          const rawData = res.data as any;
          const rawProducts = rawData?.products || rawData?.items || [];
          const skuCount = rawData?.skuCount || rawProducts.length;
          const pagination = rawData?.pagination || {};

          const { processed } = await processProductData(rawProducts);
          const moreAvailable = pagination.page < pagination.totalPages;

          if (mountedRef.current) {
            setProducts(processed);
            setProductCount(skuCount);
            setCurrentPage(1);
            setHasMore(moreAvailable);
            setLoadingProducts(false);
          }
        } else {
          if (mountedRef.current) setLoadingProducts(false);
        }
      } catch {
        if (mountedRef.current) setLoadingProducts(false);
        Taro.showToast({ title: "筛选失败", icon: "none" });
      }
    },
    [expandMaterialIds, processProductData],
  );

  // ===== Interaction handlers =====

  /** Return to ALL view */
  const handleSelectAll = useCallback(() => {
    const sections = filterSectionsRef.current.map((s) => ({
      ...s,
      items: s.items.map((it) => ({ ...it, active: false, isSelected: false })),
    }));
    updateFilterSections(sections);

    setViewMode("ALL");
    setSelectedFilter({ type: "", id: "", name: "" });
    setProducts([]);
    setProductCount(0);
    setHeaderImage("");
    setCurrentPage(1);
    setHasMore(true);
    setCurrentSort("default");
    setSortText("默认排序");
    setShowSortOptions(false);
    setShowFilterPanel(false);
    setSelectedCategories([]);
    setSelectedMaterials([]);
    setSelectedSubSeriesIds([]);
  }, [updateFilterSections]);

  /** Toggle section collapse/expand */
  const handleToggleSection = useCallback(
    (type: FilterType) => {
      setShowFilterPanel(false);
      setShowSortOptions(false);

      const sections = filterSectionsRef.current.map((s) => ({ ...s }));
      const section = sections.find((s) => s.type === type);
      if (!section) return;

      // Non-collapsible (Sperà) → go back to ALL
      if (!section.collapsible) {
        handleSelectAll();
        return;
      }

      section.expanded = !section.expanded;
      updateFilterSections(sections);
    },
    [updateFilterSections, handleSelectAll],
  );

  /** Select a primary filter item */
  const handleSelectFilterItem = useCallback(
    (type: FilterType, id: string, name: string) => {
      const sections = filterSectionsRef.current.map((s) => ({
        ...s,
        items: s.items.map((it) => ({
          ...it,
          active: it.type === type && it.id === id,
          isSelected: false,
        })),
      }));
      updateFilterSections(sections);

      setViewMode("FILTERED");
      setSelectedFilter({ type, id, name });
      setCurrentSort("default");
      setSortText("默认排序");
      setShowSortOptions(false);
      setShowFilterPanel(false);
      setSelectedCategories([]);
      setSelectedMaterials([]);
      setSelectedSubSeriesIds([]);
      setCurrentPage(1);
      setHasMore(true);

      loadProducts(type, id, 1, "default");
    },
    [updateFilterSections, loadProducts],
  );

  /** Click subseries card in ALL view */
  const handleSubSeriesClick = useCallback(
    (id: string, name: string) => {
      handleSelectFilterItem("subseries", id, name);
    },
    [handleSelectFilterItem],
  );

  /** Select sort option */
  const handleSelectSort = useCallback(
    (sort: SortType) => {
      setCurrentSort(sort);
      setSortText(SORT_TEXT_MAP[sort] || "默认排序");
      setShowSortOptions(false);

      if (selectedFilter.type && selectedFilter.id) {
        loadProducts(
          selectedFilter.type as FilterType,
          selectedFilter.id,
          1,
          sort,
        );
      }
    },
    [selectedFilter, loadProducts],
  );

  /** Toggle secondary filter item (multi-select checkbox) */
  const handleToggleSecondaryItem = useCallback(
    (type: FilterType, id: string) => {
      const toggle = (prev: string[]) => {
        const idx = prev.indexOf(id);
        return idx > -1 ? prev.filter((x) => x !== id) : [...prev, id];
      };

      if (type === "category") setSelectedCategories(toggle);
      else if (type === "material") setSelectedMaterials(toggle);
      else if (type === "subseries") setSelectedSubSeriesIds(toggle);

      // Sync isSelected flag in filterSections
      const sections = filterSectionsRef.current.map((s) => {
        if (s.type !== type) return s;
        return {
          ...s,
          items: s.items.map((it) =>
            String(it.id) === String(id)
              ? { ...it, isSelected: !it.isSelected }
              : it,
          ),
        };
      });
      updateFilterSections(sections);
    },
    [updateFilterSections],
  );

  /** Reset secondary filter */
  const handleResetFilter = useCallback(() => {
    setSelectedCategories([]);
    setSelectedMaterials([]);
    setSelectedSubSeriesIds([]);

    const sections = filterSectionsRef.current.map((s) => ({
      ...s,
      items: s.items.map((it) => ({ ...it, isSelected: false })),
    }));
    updateFilterSections(sections);
  }, [updateFilterSections]);

  /** Confirm secondary filter */
  const handleConfirmFilter = useCallback(() => {
    const hasSecondary =
      selectedCategories.length > 0 ||
      selectedMaterials.length > 0 ||
      selectedSubSeriesIds.length > 0;

    setShowFilterPanel(false);

    if (hasSecondary && selectedFilter.type) {
      loadProductsWithFilter(
        selectedFilter.type as FilterType,
        selectedFilter.id,
        selectedCategories,
        selectedMaterials,
        selectedSubSeriesIds,
        currentSort,
      );
    } else if (selectedFilter.type && selectedFilter.id) {
      loadProducts(
        selectedFilter.type as FilterType,
        selectedFilter.id,
        1,
        currentSort,
      );
    }
  }, [
    selectedFilter,
    selectedCategories,
    selectedMaterials,
    selectedSubSeriesIds,
    currentSort,
    loadProducts,
    loadProductsWithFilter,
  ]);

  /** Scroll to bottom — load next page */
  const handleScrollToLower = useCallback(() => {
    if (!hasMore || loadingProducts) return;
    if (!selectedFilter.type || !selectedFilter.id) return;

    loadProducts(
      selectedFilter.type as FilterType,
      selectedFilter.id,
      currentPage + 1,
      currentSort,
      true,
    );
  }, [
    hasMore,
    loadingProducts,
    selectedFilter,
    currentPage,
    currentSort,
    loadProducts,
  ]);

  /** Close all dropdown panels */
  const handleClosePanels = useCallback(() => {
    if (showFilterPanel || showSortOptions) {
      setShowFilterPanel(false);
      setShowSortOptions(false);
    }
  }, [showFilterPanel, showSortOptions]);

  /** Navigate to product detail */
  const handleProductTap = useCallback((skuId: string) => {
    if (!skuId) return;
    Taro.navigateTo({ url: `/pages/product-detail/index?skuId=${skuId}` });
  }, []);

  // ===== Lifecycle =====
  useLoad(() => {
    setShowLoading(true);
    loadFilterData();
  });

  useReady(() => {
    calculateLayout();
  });

  useDidShow(() => {
    setCurrentTab(1);
  });

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ===== Render helpers =====

  /** Get the two secondary filter sections (excluding the primary filter type) */
  const getSecondaryFilterSections = (): FilterSection[] => {
    if (!selectedFilter.type) return [];
    return filterSectionsRef.current.filter(
      (s) => s.type !== selectedFilter.type,
    );
  };

  /** Check if a secondary item is selected */
  const isSecondaryItemSelected = (type: FilterType, id: string): boolean => {
    if (type === "category") return selectedCategories.includes(id);
    if (type === "material") return selectedMaterials.includes(id);
    if (type === "subseries") return selectedSubSeriesIds.includes(id);
    return false;
  };

  /** Get display title for a secondary filter section */
  const getSecondaryTitle = (type: FilterType): string => {
    if (type === "subseries") return "子系列";
    if (type === "category") return "分类";
    return "材质";
  };

  /** Get display text for a secondary filter item */
  const getSecondaryItemText = (item: FilterItem): string => {
    if (item.type === "subseries") {
      return `${item.nameEN || ""} ${item.nameCN || item.name}`.trim();
    }
    return item.name;
  };

  // ===== Render =====
  return (
    <View className={styles.container}>
      <TopBar backgroundColor="#fff" />

      {/* Left sidebar — filter sections */}
      <ScrollView
        className={styles.series}
        scrollY
        style={{ top: layoutTop, height: layoutHeight }}
        onClick={handleClosePanels}
      >
        <View className={styles.seriesList}>
          {filterSections.map((section) => (
            <View key={section.id}>
              {/* Section header */}
              <View
                className={`${styles.filterSectionHeader} ${
                  !section.collapsible && viewMode === "ALL"
                    ? styles.filterSectionHeaderSelected
                    : ""
                }`}
                onClick={() => handleToggleSection(section.type)}
              >
                <Text className={styles.sectionTitle}>{section.title}</Text>
                {section.collapsible && (
                  <View
                    className={`${styles.sectionIcon} ${
                      section.expanded ? styles.sectionIconExpanded : ""
                    }`}
                  />
                )}
              </View>

              {/* Section items */}
              {section.expanded &&
                section.items.map((item) => (
                  <View
                    key={item.id}
                    className={`${styles.seriesSubitem} ${
                      item.active ? styles.seriesSubitemSelected : ""
                    }`}
                    onClick={() =>
                      handleSelectFilterItem(item.type, item.id, item.name)
                    }
                  >
                    {item.type === "subseries" ? (
                      <>
                        <Text className={styles.subitemNameEn}>
                          {item.nameEN}
                        </Text>
                        <Text className={styles.subitemNameCn}>
                          {item.nameCN}
                        </Text>
                      </>
                    ) : (
                      <Text className={styles.subitemNameSingle}>
                        {item.name}
                      </Text>
                    )}
                  </View>
                ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Right content — products */}
      <ScrollView
        className={styles.product}
        scrollY
        style={{ top: layoutTop, height: layoutHeight }}
        onScrollToLower={handleScrollToLower}
        lowerThreshold={100}
        onClick={handleClosePanels}
      >
        {/* ALL view — subseries grid */}
        {viewMode === "ALL" && (
          <View className={styles.subseriesListContainer}>
            {subSeriesList.map((sub) => (
              <View
                key={sub._id}
                className={styles.subseriesItem}
                onClick={() => handleSubSeriesClick(sub._id, sub.name)}
              >
                <View className={styles.subseriesName}>
                  <Text className={styles.subseriesNameEn}>{sub.nameEN}</Text>
                  <Text className={styles.subseriesNameSpace}> </Text>
                  <Text className={styles.subseriesNameCn}>{sub.name}</Text>
                </View>
                <View className={styles.subseriesImageBox}>
                  {sub.displayImage ? (
                    <Image
                      className={styles.subseriesImage}
                      src={sub.displayImage}
                      mode="aspectFill"
                      lazyLoad
                    />
                  ) : (
                    <View className={styles.subseriesImagePlaceholder}>
                      暂无图片
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* FILTERED view — product list */}
        {viewMode === "FILTERED" && (
          <>
            {/* Header image */}
            {headerImage !== "" && (
              <View className={styles.headerImageWrapper}>
                <Image
                  className={styles.headerImage}
                  src={headerImage}
                  mode="aspectFill"
                  lazyLoad
                />
              </View>
            )}

            {/* Summary bar */}
            <View className={styles.productSummaryBar}>
              <Text className={styles.productCount}>
                共{productCount}件商品
              </Text>
              <View className={styles.summaryRight}>
                <View
                  className={styles.toolItem}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFilterPanel((p) => !p);
                    setShowSortOptions(false);
                  }}
                >
                  <Image
                    className={styles.toolIcon}
                    src={FILTER_ICON}
                    mode="aspectFit"
                  />
                  <Text className={styles.toolText}>筛选</Text>
                </View>
                <View
                  className={styles.toolItem}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSortOptions((p) => !p);
                    setShowFilterPanel(false);
                  }}
                >
                  <Image
                    className={styles.toolIcon}
                    src={SORT_ICON}
                    mode="aspectFit"
                  />
                  <Text className={styles.toolText}>{sortText}</Text>
                </View>
              </View>

              {/* Sort options panel */}
              {showSortOptions && (
                <View
                  className={styles.sortOptionsPanel}
                  onClick={(e) => e.stopPropagation()}
                >
                  {(["default", "price_asc", "price_desc"] as SortType[]).map(
                    (sort) => (
                      <View
                        key={sort}
                        className={`${styles.sortOption} ${
                          currentSort === sort ? styles.sortOptionActive : ""
                        }`}
                        onClick={() => handleSelectSort(sort)}
                      >
                        {currentSort === sort && (
                          <Text className={styles.sortCheckMark}>✓</Text>
                        )}
                        <Text>{SORT_TEXT_MAP[sort]}</Text>
                      </View>
                    ),
                  )}
                </View>
              )}

              {/* Secondary filter panel */}
              {showFilterPanel && (
                <View
                  className={styles.filterPanel}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ScrollView scrollY className={styles.filterOptionsContainer}>
                    {getSecondaryFilterSections().map((section) => (
                      <View key={section.id} className={styles.filterSection}>
                        <Text className={styles.filterSectionTitle}>
                          {getSecondaryTitle(section.type)}
                        </Text>
                        <View className={styles.filterItems}>
                          {section.items.map((item) => (
                            <View
                              key={item.id}
                              className={styles.filterItemOption}
                              onClick={() =>
                                handleToggleSecondaryItem(section.type, item.id)
                              }
                            >
                              <Image
                                className={styles.filterCheckIcon}
                                src={
                                  isSecondaryItemSelected(section.type, item.id)
                                    ? SELECTED_ICON
                                    : NOT_SELECTED_ICON
                                }
                                mode="aspectFit"
                              />
                              <Text className={styles.filterItemText}>
                                {getSecondaryItemText(item)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                  <View className={styles.filterButtons}>
                    <View
                      className={`${styles.filterBtn} ${styles.filterBtnReset}`}
                      onClick={handleResetFilter}
                    >
                      <Text>重置</Text>
                    </View>
                    <View
                      className={`${styles.filterBtn} ${styles.filterBtnConfirm}`}
                      onClick={handleConfirmFilter}
                    >
                      <Text>确定</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Product grid */}
            <View className={styles.productGridContainer}>
              <View className={styles.productGrid}>
                {products.map((product) => (
                  <View
                    key={product._id}
                    className={styles.productItem}
                    onClick={() => handleProductTap(product._id)}
                  >
                    <View className={styles.productImageWrapper}>
                      {product.skuMainImages[0] ? (
                        <Image
                          className={styles.productImage}
                          src={product.skuMainImages[0]}
                          mode="aspectFill"
                          lazyLoad
                        />
                      ) : (
                        <View className={styles.productImagePlaceholder}>
                          暂无图片
                        </View>
                      )}
                    </View>
                    <View className={styles.productInfo}>
                      <Text className={styles.productNameEn}>
                        {product.nameEN}
                      </Text>
                      <Text className={styles.productNameCn}>
                        {product.nameCN}
                      </Text>
                      <Text className={styles.productPrice}>
                        {product.formattedPrice}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Empty state */}
              {products.length === 0 && !loadingProducts && (
                <View className={styles.emptyProducts}>
                  <Text>暂无商品</Text>
                </View>
              )}

              {/* No more */}
              {!hasMore && products.length > 0 && (
                <View className={styles.noMore}>
                  <Text>没有更多商品了</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Loading overlay for product loading */}
      {loadingProducts && (
        <View className={styles.loadingOverlay}>
          <View className={styles.loadingContent}>
            <View className={styles.loadingSpinner} />
            <Text className={styles.loadingText}>加载中...</Text>
          </View>
        </View>
      )}

      {/* Floating consultation */}
      <FloatBtn onPress={() => setIsPopupShow(true)} />
      <FloatPopup visible={isPopupShow} onClose={() => setIsPopupShow(false)} />

      {/* Page loading bar */}
      <LoadingBar
        visible={showLoading}
        onFinish={() => setShowLoading(false)}
      />

      <CustomTabBar />
    </View>
  );
}
