const { init } = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});
const db = cloud.database();
const client = init(cloud);
const models = client.models;

// 通用错误处理函数
const handleError = (err, event) => {
  console.error('Error:', err, 'Event:', event);
  return {
    code: 500,
    message: err.message,
  };
};

// 获取子系列商品列表
async function getProductsBySubSeries(data) {
  const {
    subSeriesId,
    sortBy = 'default', // 'default' 默认排序, 'price_asc' 价格升序, 'price_desc' 价格降序
    page = 1,
    pageSize = 20,
  } = data;

  if (!subSeriesId) {
    return {
      code: 400,
      message: '缺少必要参数: subSeriesId',
    };
  }

  try {
    // 构建查询条件
    let skuFilter = {
      where: {
        subSeries: { $eq: subSeriesId },
        isOnSale: { $eq: true },
        isShow: { $eq: true }, // 新增：只查询isShow为true的商品
      },
      select: {
        _id: true,
        skuId: true,
        nameCN: true,
        nameEN: true,
        price: true,
        skuMainImages: true,
        spuId: true,
        materialId: true,
        subSeries: true,
        createdAt: true,
      },
    };

    // 查询SKU列表
    const { data: skuList } = await models.ProductSkus.list({
      filter: skuFilter,
      pageSize: pageSize, // 分页大小
      pageNumber: page, // 第几页
      envType: 'prod',
    });

    if (!skuList.records || skuList.records.length === 0) {
      return {
        code: 200,
        data: {
          products: [],
          skuCount: 0,
          subSeriesInfo: null,
        },
      };
    }

    // 获取子系列信息
    const { data: subSeriesInfo } = await models.SubSeries.get({
      filter: {
        where: { _id: { $eq: subSeriesId } },
      },
      select: {
        _id: true,
        name: true,
        displayImage: true,
        introduction: true,
      },
      envType: 'prod',
    });

    // 提取SPU ID列表
    const spuIds = [...new Set(skuList.records.map((sku) => sku.spuId))];

    // 批量查询SPU信息
    const { data: spuList } = await models.ProductSpus.list({
      filter: {
        where: {
          _id: { $in: spuIds },
        },
        select: {
          _id: true,
          spuId: true,
          name: true,
          description: true,
          category: true,
          seriesId: true,
        },
      },
      pageSize: 100, // 分页大小
      pageNumber: 1, // 第几页
      envType: 'prod',
    });

    // 提取材质ID列表
    const materialIds = [
      ...new Set(skuList.records.map((sku) => sku.materialId).filter(Boolean)),
    ];

    // 批量查询材质信息
    const { data: materialList } = await models.Materials.list({
      filter: {
        where: {
          _id: { $in: materialIds },
        },
        select: {
          _id: true,
          nameCN: true,
          materialImage: true,
        },
      },
      envType: 'prod',
    });

    // 构建材质映射
    const materialMap = new Map();
    if (materialList.records) {
      materialList.records.forEach((material) => {
        materialMap.set(material._id, material);
      });
    }

    // 构建SPU映射
    const spuMap = new Map();
    if (spuList.records) {
      spuList.records.forEach((spu) => {
        spuMap.set(spu._id, spu);
      });
    }

    // 组合商品数据
    let products = skuList.records.map((sku) => {
      const spu = spuMap.get(sku.spuId);
      const material = materialMap.get(sku.materialId);

      return {
        _id: sku._id,
        skuId: sku.skuId,
        spuId: spu ? spu._id : null,
        spuName: spu ? spu.name : '',
        nameCN: sku.nameCN,
        nameEN: sku.nameEN,
        price: sku.price,
        skuMainImages: sku.skuMainImages || [],
        subSeriesName: subSeriesInfo ? subSeriesInfo.name : '',
        materialId: sku.materialId, // 确保包含materialId
        materialName: material ? material.nameCN : '',
        materialImage: material ? material.materialImage : '',
        createdAt: sku.createdAt,
      };
    });

    // 根据排序方式处理商品顺序
    if (sortBy === 'price_asc') {
      // 价格升序：直接按价格排序
      products.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      // 价格降序：直接按价格排序
      products.sort((a, b) => b.price - a.price);
    } else {
      // 默认排序：相同SPU的商品相邻展示
      products = groupProductsBySpu(products);
    }

    // 分页处理
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedProducts = products.slice(startIndex, endIndex);

    return {
      code: 200,
      data: {
        products: paginatedProducts,
        skuCount: products.length,
        subSeriesInfo: subSeriesInfo,
        pagination: {
          page,
          pageSize,
          total: products.length,
          totalPages: Math.ceil(products.length / pageSize),
        },
      },
    };
  } catch (error) {
    console.error('获取子系列商品失败:', error);
    return {
      code: 500,
      message: '获取子系列商品失败: ' + error.message,
    };
  }
}

// 获取分类商品列表
async function getProductsByCategory(data) {
  const { categoryId, sortBy = 'default', page = 1, pageSize = 20 } = data;

  if (!categoryId) {
    return {
      code: 400,
      message: '缺少必要参数: categoryId',
    };
  }

  try {
    // 先查询该分类下的SPU
    const { data: spuList } = await models.ProductSpus.list({
      filter: {
        where: {
          category: { $eq: categoryId },
          isOnSale: { $eq: true },
        },
        select: {
          _id: true,
          spuId: true,
          name: true,
        },
      },
      pageSize: 100, // 分页大小
      pageNumber: 1, // 第几页
      envType: 'prod',
    });

    if (!spuList.records || spuList.records.length === 0) {
      return {
        code: 200,
        data: {
          products: [],
          skuCount: 0,
          categoryInfo: null,
        },
      };
    }

    const spuIds = spuList.records.map((spu) => spu._id);

    // 构建SKU查询条件
    let skuFilter = {
      where: {
        spuId: { $in: spuIds },
        isOnSale: { $eq: true },
        isShow: { $eq: true }, // 新增：只查询isShow为true的商品
      },
      select: {
        _id: true,
        skuId: true,
        nameCN: true,
        nameEN: true,
        price: true,
        skuMainImages: true,
        spuId: true,
        materialId: true,
        subSeries: true,
        createdAt: true,
      },
    };

    // 查询SKU列表
    const { data: skuList } = await models.ProductSkus.list({
      filter: skuFilter,
      pageSize: pageSize, // 分页大小
      pageNumber: page, // 第几页
      envType: 'prod',
    });

    // 获取分类信息
    const { data: categoryInfo } = await models.Categories.get({
      filter: {
        where: { _id: { $eq: categoryId } },
      },
      select: {
        _id: true,
        typeName: true,
        displayImage: true,
      },
      envType: 'prod',
    });

    // 提取子系列ID和材质ID
    const subSeriesIds = [
      ...new Set(skuList.records.map((sku) => sku.subSeries).filter(Boolean)),
    ];
    const materialIds = [
      ...new Set(skuList.records.map((sku) => sku.materialId).filter(Boolean)),
    ];

    // 批量查询子系列和材质信息
    const [{ data: subSeriesList }, { data: materialList }] = await Promise.all(
      [
        models.SubSeries.list({
          filter: {
            where: {
              _id: { $in: subSeriesIds },
            },
            select: {
              _id: true,
              name: true,
            },
          },
          envType: 'prod',
        }),
        models.Materials.list({
          filter: {
            where: {
              _id: { $in: materialIds },
            },
            select: {
              _id: true,
              nameCN: true,
              materialImage: true,
            },
          },
          envType: 'prod',
        }),
      ],
    );

    // 构建映射
    const subSeriesMap = new Map();
    if (subSeriesList.records) {
      subSeriesList.records.forEach((subSeries) => {
        subSeriesMap.set(subSeries._id, subSeries);
      });
    }

    const materialMap = new Map();
    if (materialList.records) {
      materialList.records.forEach((material) => {
        materialMap.set(material._id, material);
      });
    }

    const spuMap = new Map();
    if (spuList.records) {
      spuList.records.forEach((spu) => {
        spuMap.set(spu._id, spu);
      });
    }

    // 组合商品数据
    let products = skuList.records.map((sku) => {
      const spu = spuMap.get(sku.spuId);
      const material = materialMap.get(sku.materialId);
      const subSeries = subSeriesMap.get(sku.subSeries);

      return {
        _id: sku._id,
        skuId: sku.skuId,
        spuId: spu ? spu._id : null,
        spuName: spu ? spu.name : '',
        nameCN: sku.nameCN,
        nameEN: sku.nameEN,
        price: sku.price,
        skuMainImages: sku.skuMainImages || [],
        subSeriesName: subSeries ? subSeries.name : '',
        materialName: material ? material.nameCN : '',
        materialImage: material ? material.materialImage : '',
        createdAt: sku.createdAt,
      };
    });

    // 根据排序方式处理商品顺序
    if (sortBy === 'price_asc') {
      // 价格升序：直接按价格排序
      products.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      // 价格降序：直接按价格排序
      products.sort((a, b) => b.price - a.price);
    } else {
      // 默认排序：相同SPU的商品相邻展示
      products = groupProductsBySpu(products);
    }

    // 分页处理
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedProducts = products.slice(startIndex, endIndex);

    return {
      code: 200,
      data: {
        products: paginatedProducts,
        skuCount: products.length,
        categoryInfo: categoryInfo,
        pagination: {
          page,
          pageSize,
          total: products.length,
          totalPages: Math.ceil(products.length / pageSize),
        },
      },
    };
  } catch (error) {
    console.error('获取分类商品失败:', error);
    return {
      code: 500,
      message: '获取分类商品失败: ' + error.message,
    };
  }
}

// 获取材质商品列表
async function getProductsByMaterial(data) {
  const { materialId, sortBy = 'default', page = 1, pageSize = 20 } = data;

  if (!materialId) {
    return {
      code: 400,
      message: '缺少必要参数: materialId',
    };
  }

  try {
    // 构建SKU查询条件
    let skuFilter = {
      where: {
        materialId: { $eq: materialId },
        isOnSale: { $eq: true },
        isShow: { $eq: true }, // 新增：只查询isShow为true的商品
      },
      select: {
        _id: true,
        skuId: true,
        nameCN: true,
        nameEN: true,
        price: true,
        skuMainImages: true,
        spuId: true,
        materialId: true,
        subSeries: true,
        createdAt: true,
      },
    };

    // 查询SKU列表
    const { data: skuList } = await models.ProductSkus.list({
      filter: skuFilter,
      pageSize: pageSize, // 分页大小
      pageNumber: page, // 第几页
      envType: 'prod',
    });

    if (!skuList.records || skuList.records.length === 0) {
      return {
        code: 200,
        data: {
          products: [],
          skuCount: 0,
          materialInfo: null,
        },
      };
    }

    // 获取材质信息
    const { data: materialInfo } = await models.Materials.get({
      filter: {
        where: { _id: { $eq: materialId } },
      },
      select: {
        _id: true,
        nameCN: true,
        materialImage: true,
        //description: true
      },
      envType: 'prod',
    });

    // 提取SPU ID列表和子系列ID列表
    const spuIds = [...new Set(skuList.records.map((sku) => sku.spuId))];
    const subSeriesIds = [
      ...new Set(skuList.records.map((sku) => sku.subSeries).filter(Boolean)),
    ];

    // 批量查询SPU和子系列信息
    const [{ data: spuList }, { data: subSeriesList }] = await Promise.all([
      models.ProductSpus.list({
        filter: {
          where: {
            _id: { $in: spuIds },
          },
          select: {
            _id: true,
            spuId: true,
            name: true,
          },
        },
        envType: 'prod',
      }),
      models.SubSeries.list({
        filter: {
          where: {
            _id: { $in: subSeriesIds },
          },
          select: {
            _id: true,
            name: true,
          },
        },
        envType: 'prod',
      }),
    ]);

    // 构建映射
    const spuMap = new Map();
    if (spuList.records) {
      spuList.records.forEach((spu) => {
        spuMap.set(spu._id, spu);
      });
    }

    const subSeriesMap = new Map();
    if (subSeriesList.records) {
      subSeriesList.records.forEach((subSeries) => {
        subSeriesMap.set(subSeries._id, subSeries);
      });
    }

    // 组合商品数据
    let products = skuList.records.map((sku) => {
      const spu = spuMap.get(sku.spuId);
      const subSeries = subSeriesMap.get(sku.subSeries);

      return {
        _id: sku._id,
        skuId: sku.skuId,
        spuId: spu ? spu._id : null,
        spuName: spu ? spu.name : '',
        nameCN: sku.nameCN,
        nameEN: sku.nameEN,
        price: sku.price,
        skuMainImages: sku.skuMainImages || [],
        subSeriesName: subSeries ? subSeries.name : '',
        materialName: materialInfo ? materialInfo.nameCN : '',
        materialImage: materialInfo ? materialInfo.materialImage : '',
        createdAt: sku.createdAt,
      };
    });

    // 根据排序方式处理商品顺序
    if (sortBy === 'price_asc') {
      // 价格升序：直接按价格排序
      products.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      // 价格降序：直接按价格排序
      products.sort((a, b) => b.price - a.price);
    } else {
      // 默认排序：相同SPU的商品相邻展示
      products = groupProductsBySpu(products);
    }

    // 分页处理
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedProducts = products.slice(startIndex, endIndex);

    return {
      code: 200,
      data: {
        products: paginatedProducts,
        skuCount: products.length,
        materialInfo: materialInfo,
        pagination: {
          page,
          pageSize,
          total: products.length,
          totalPages: Math.ceil(products.length / pageSize),
        },
      },
    };
  } catch (error) {
    console.error('获取材质商品失败:', error);
    return {
      code: 500,
      message: '获取材质商品失败: ' + error.message,
    };
  }
}

// 多条件筛选商品
async function getProductsByFilter(data) {
  const {
    subSeriesIds = [],
    materialIds = [],
    categoryIds = [],
    priceRange = {},
    sortBy = 'default',
    page = 1,
    pageSize = 20,
    forAdmin = false, // 新增：后台管理标识，默认为 false（小程序端使用）
  } = data;

  try {
    // 构建基础查询条件
    let baseFilter = {
      isOnSale: { $eq: true },
    };

    // 只有非后台管理时才检查 isShow（小程序端需要检查，后台管理不需要）
    if (!forAdmin) {
      baseFilter.isShow = { $eq: true };
    }

    // 添加子系列条件
    if (subSeriesIds.length > 0) {
      baseFilter.subSeries = { $in: subSeriesIds };
    }

    // 添加材质条件
    if (materialIds.length > 0) {
      baseFilter.materialId = { $in: materialIds };
    }

    // 添加价格范围条件
    if (priceRange.min !== undefined || priceRange.max !== undefined) {
      baseFilter.price = {};
      if (priceRange.min !== undefined) {
        baseFilter.price.$gte = priceRange.min;
      }
      if (priceRange.max !== undefined) {
        baseFilter.price.$lte = priceRange.max;
      }
    }

    // 如果指定了分类，需要先查询分类下的SPU
    let spuIds = [];
    if (categoryIds.length > 0) {
      const { data: spuList } = await models.ProductSpus.list({
        filter: {
          where: {
            category: { $in: categoryIds },
            isOnSale: { $eq: true },
          },
          select: {
            _id: true,
          },
        },
        pageSize: 100, // 分页大小
        pageNumber: 1, // 第几页
        envType: 'prod',
      });

      if (spuList.records && spuList.records.length > 0) {
        spuIds = spuList.records.map((spu) => spu._id);
        baseFilter.spuId = { $in: spuIds };
      } else {
        // 如果分类下没有商品，直接返回空
        return {
          code: 200,
          data: {
            products: [],
            skuCount: 0,
            filterInfo: {
              subSeriesIds,
              materialIds,
              categoryIds,
              priceRange,
            },
          },
        };
      }
    }

    // 构建SKU查询条件
    let skuFilter = {
      where: baseFilter,
      select: {
        _id: true,
        skuId: true,
        nameCN: true,
        nameEN: true,
        price: true,
        skuMainImages: true,
        skuDetailImages: true,
        spuId: true,
        materialId: true,
        subSeries: true,
        createdAt: true,
      },
    };

    // 查询SKU列表
    const { data: skuList } = await models.ProductSkus.list({
      filter: skuFilter,
      pageSize: pageSize, // 分页大小
      pageNumber: page, // 第几页
      envType: 'prod',
    });

    if (!skuList.records || skuList.records.length === 0) {
      return {
        code: 200,
        data: {
          products: [],
          skuCount: 0,
          filterInfo: {
            subSeriesIds,
            materialIds,
            categoryIds,
            priceRange,
          },
        },
      };
    }

    // 批量查询关联数据
    const spuIdsFromSkus = [
      ...new Set(skuList.records.map((sku) => sku.spuId._id)),
    ];
    const materialIdsFromSkus = [
      ...new Set(
        skuList.records.map((sku) => sku.materialId._id).filter(Boolean),
      ),
    ];
    const subSeriesIdsFromSkus = [
      ...new Set(
        skuList.records.map((sku) => sku.subSeries._id).filter(Boolean),
      ),
    ];

    const [{ data: spuList }, { data: materialList }, { data: subSeriesList }] =
      await Promise.all([
        models.ProductSpus.list({
          filter: {
            where: {
              _id: { $in: spuIdsFromSkus },
            },
            select: {
              _id: true,
              spuId: true,
              name: true,
            },
          },
          envType: 'prod',
        }),
        models.Materials.list({
          filter: {
            where: {
              _id: { $in: materialIdsFromSkus },
            },
            select: {
              _id: true,
              nameCN: true,
              materialImage: true,
            },
          },
          envType: 'prod',
        }),
        models.SubSeries.list({
          filter: {
            where: {
              _id: { $in: subSeriesIdsFromSkus },
            },
            select: {
              _id: true,
              name: true,
            },
          },
          envType: 'prod',
        }),
      ]);

    // 构建映射
    const spuMap = new Map();
    if (spuList.records) {
      spuList.records.forEach((spu) => {
        spuMap.set(spu._id, spu);
      });
    }

    const materialMap = new Map();
    if (materialList.records) {
      materialList.records.forEach((material) => {
        materialMap.set(material._id, material);
      });
    }

    const subSeriesMap = new Map();
    if (subSeriesList.records) {
      subSeriesList.records.forEach((subSeries) => {
        subSeriesMap.set(subSeries._id, subSeries);
      });
    }

    // 组合商品数据
    let products = skuList.records.map((sku) => {
      const spu = spuMap.get(sku.spuId._id);
      const material = materialMap.get(sku.materialId._id);
      const subSeries = subSeriesMap.get(sku.subSeries._id);

      return {
        _id: sku._id,
        skuId: sku.skuId,
        spuId: spu ? spu._id : null,
        spuName: spu ? spu.name : '',
        nameCN: sku.nameCN,
        nameEN: sku.nameEN,
        price: sku.price,
        skuMainImages: sku.skuMainImages || [],
        subSeriesName: subSeries ? subSeries.name : '',
        materialName: material ? material.nameCN : '',
        materialImage: material ? material.materialImage : '',
        createdAt: sku.createdAt,
      };
    });

    // 根据排序方式处理商品顺序
    if (sortBy === 'price_asc') {
      // 价格升序：直接按价格排序
      products.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      // 价格降序：直接按价格排序
      products.sort((a, b) => b.price - a.price);
    } else {
      // 默认排序：相同SPU的商品相邻展示
      products = groupProductsBySpu(products);
    }

    // 分页处理
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedProducts = products.slice(startIndex, endIndex);

    return {
      code: 200,
      data: {
        products: paginatedProducts,
        skuCount: products.length,
        filterInfo: {
          subSeriesIds,
          materialIds,
          categoryIds,
          priceRange,
        },
        pagination: {
          page,
          pageSize,
          total: products.length,
          totalPages: Math.ceil(products.length / pageSize),
        },
      },
    };
  } catch (error) {
    console.error('多条件筛选商品失败:', error);
    return {
      code: 500,
      message: '多条件筛选商品失败: ' + error.message,
    };
  }
}

// 按SPU分组并排序商品的辅助函数
function groupProductsBySpu(products) {
  // 按SPU分组
  const spuGroups = {};
  products.forEach((product) => {
    const spuId = product.spuId;
    if (!spuGroups[spuId]) {
      spuGroups[spuId] = [];
    }
    spuGroups[spuId].push(product);
  });

  // 对每个SPU组内的商品按创建时间排序（最新的在前）
  Object.keys(spuGroups).forEach((spuId) => {
    spuGroups[spuId].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  });

  // 将分组后的商品展平为数组
  const groupedProducts = [];
  Object.keys(spuGroups).forEach((spuId) => {
    groupedProducts.push(...spuGroups[spuId]);
  });

  return groupedProducts;
}
//========================
// 获取商品详情
async function getProductDetail(data) {
  const { _skuId } = data;

  if (!_skuId) {
    return {
      code: 400,
      message: '获取商品详情失败: 缺少必要参数: _skuId',
    };
  }

  try {
    // 查询SKU详情 - 只选择必要字段
    // 注意：获取商品详情时不添加isShow条件，因为可能需要在后台查看不显示的商品
    const { data: sku } = await models.ProductSkus.get({
      filter: {
        where: { _id: { $eq: _skuId } },
      },
      select: {
        _id: true,
        skuId: true,
        nameCN: true,
        nameEN: true,
        price: true,
        skuMainImages: true,
        skuDetailImages: true,
        spuId: true,
        materialId: true,
        sizeId: true,
        subSeries: true,
        stock: true,
        isOnSale: true,
      },
      envType: 'prod',
    });

    if (!sku._id) {
      return {
        code: 404,
        message: '商品不存在',
      };
    }

    // 批量查询关联信息
    const queryPromises = [];

    // 查询当前SKU的材质信息
    if (sku.materialId && sku.materialId._id) {
      queryPromises.push(
        models.Materials.get({
          filter: {
            where: { _id: { $eq: sku.materialId._id } },
          },
          select: {
            _id: true,
            nameCN: true,
          },
          envType: 'prod',
        }),
      );
    } else {
      queryPromises.push(Promise.resolve({ data: null }));
    }

    // 查询尺寸信息
    if (sku.sizeId && sku.sizeId._id) {
      queryPromises.push(
        models.ProductSizes.get({
          filter: {
            where: { _id: { $eq: sku.sizeId._id } },
          },
          select: {
            _id: true,
            value: true,
            sizeNum: true,
          },
          envType: 'prod',
        }),
      );
    } else {
      queryPromises.push(Promise.resolve({ data: null }));
    }

    // 查询子系列信息
    if (sku.subSeries && sku.subSeries._id) {
      queryPromises.push(
        models.SubSeries.get({
          filter: {
            where: { _id: { $eq: sku.subSeries._id } },
          },
          select: {
            _id: true,
            name: true,
          },
          envType: 'prod',
        }),
      );
    } else {
      queryPromises.push(Promise.resolve({ data: null }));
    }

    // 查询同SPU的其他SKU
    // 注意：这里只需要isOnSale条件，不需要isShow条件
    // 因为用户已经在详情页了，同材质的其他尺寸即使不在列表页显示，也应该允许切换查看
    queryPromises.push(
      models.ProductSkus.list({
        filter: {
          where: {
            spuId: { $eq: sku.spuId._id },
            _id: { $ne: _skuId },
            isOnSale: { $eq: true },
            // 移除 isShow 条件，只要上架就可以在详情页切换
          },
          select: {
            _id: true,
            skuId: true,
            skuMainImages: true,
            materialId: true,
            sizeId: true,
            price: true,
            stock: true,
          },
        },
        envType: 'prod',
      }),
    );

    // 执行所有查询
    const [
      { data: currentMaterial },
      { data: sizeInfo },
      { data: subSeriesInfo },
      { data: otherSkus },
    ] = await Promise.all(queryPromises);

    // 处理同SPU的其他SKU数据
    const sameMaterialSkus = []; // 同一材质不同尺寸的SKU
    const otherMaterialSkus = []; // 不同材质的SKU（每个材质只取一个与当前商品尺寸一致的代表）

    if (otherSkus.records && otherSkus.records.length > 0) {
      // 提取所有材质ID和尺寸ID
      const materialIds = [
        ...new Set(
          otherSkus.records.map((sku) => sku.materialId).filter(Boolean),
        ),
      ];
      const sizeIds = [
        ...new Set(otherSkus.records.map((sku) => sku.sizeId).filter(Boolean)),
      ];

      // 批量查询材质和尺寸信息
      const [materialsQuery, sizesQuery] = await Promise.all([
        materialIds.length > 0
          ? models.Materials.list({
              filter: {
                where: {
                  _id: { $in: materialIds },
                },
                select: {
                  _id: true,
                  nameCN: true,
                },
              },
              envType: 'prod',
            })
          : Promise.resolve({ data: { records: [] } }),

        sizeIds.length > 0
          ? models.ProductSizes.list({
              filter: {
                where: {
                  _id: { $in: sizeIds },
                },
                select: {
                  _id: true,
                  value: true,
                  sizeNum: true,
                },
              },
              envType: 'prod',
            })
          : Promise.resolve({ data: { records: [] } }),
      ]);

      // 构建材质和尺寸映射
      const materialMap = new Map();
      if (materialsQuery.data.records) {
        materialsQuery.data.records.forEach((material) => {
          materialMap.set(material._id, material);
        });
      }

      const sizeMap = new Map();
      if (sizesQuery.data.records) {
        sizesQuery.data.records.forEach((size) => {
          sizeMap.set(size._id, size);
        });
      }

      // 获取当前SKU的材质ID和尺寸ID
      const currentMaterialId = sku.materialId;
      const currentSizeId = sku.sizeId;

      // 按材质分组存储SKU
      const materialGroupMap = new Map();

      // 分类处理其他SKU
      otherSkus.records.forEach((sku) => {
        const materialId = sku.materialId;
        const sizeId = sku.sizeId;

        const material = materialMap.get(materialId);
        const size = sizeMap.get(sizeId);

        const skuInfo = {
          skuId: sku.skuId,
          _id: sku._id,
          skuMainImages: sku.skuMainImages || [],
          price: sku.price,
          stock: sku.stock,
          sizeValue: size ? size.value : '',
          sizeNum: size ? size.sizeNum : '',
          sizeId: sizeId || '',
          materialName: material ? material.nameCN : '',
          materialId: materialId || '',
        };

        // 如果是同一材质，添加到同一材质SKU列表
        if (materialId === currentMaterialId._id) {
          sameMaterialSkus.push(skuInfo);
        } else {
          // 将不同材质的SKU按材质分组
          if (!materialGroupMap.has(materialId)) {
            materialGroupMap.set(materialId, []);
          }
          materialGroupMap.get(materialId).push(skuInfo);
        }
      });

      // 对于每个不同材质，优先选择与当前商品尺寸一致的SKU作为代表
      materialGroupMap.forEach((skus, materialId) => {
        if (skus.length > 0) {
          // 优先查找与当前商品尺寸一致的SKU
          let representativeSku = skus.find(
            (sku) => currentSizeId && sku.sizeId === currentSizeId._id,
          );

          // 如果没有找到相同尺寸的SKU，则选择第一个SKU作为代表
          if (!representativeSku) {
            representativeSku = skus[0];
          }

          otherMaterialSkus.push(representativeSku);
        }
      });
    }

    // 构建分类后的相关SKU数据
    const relatedSkus = {
      // 同一材质不同尺寸的SKU
      sameMaterial: {
        materialId: sku.materialId ? sku.materialId._id : '',
        materialName: currentMaterial ? currentMaterial.nameCN : '',
        sizes: sameMaterialSkus,
      },
      // 不同材质的SKU（每个材质只取一个与当前商品尺寸一致的代表）
      otherMaterials: otherMaterialSkus,
    };

    // 组合精简的商品展示数据
    const productShow = {
      // 当前SKU基本信息
      currentSku: {
        skuId: sku.skuId,
        _spuId: sku.spuId._id,
        _id: sku._id,
        nameCN: sku.nameCN,
        nameEN: sku.nameEN,
        price: sku.price,
        stock: sku.stock,
        isOnSale: sku.isOnSale,
        skuMainImages: sku.skuMainImages || [],
        skuDetailImages: sku.skuDetailImages || [],
        subSeriesName: subSeriesInfo ? subSeriesInfo.name : '',
        subSeries: sku.subSeries ? { _id: sku.subSeries._id } : null,
        sizeValue: sizeInfo ? sizeInfo.value : '',
        sizeNum: sizeInfo ? sizeInfo.sizeNum : '',
        materialName: currentMaterial ? currentMaterial.nameCN : '',
        materialId: sku.materialId ? sku.materialId._id : '',
        sizeId: sku.sizeId ? sku.sizeId._id : '',
      },
      // 同SPU的其他SKU（分类展示）
      relatedSkus: relatedSkus,
    };

    return {
      code: 200,
      data: productShow,
    };
  } catch (error) {
    console.error('获取商品详情失败:', error);
    return {
      code: 500,
      message: '获取商品详情失败: ' + error.message,
    };
  }
}
// 根据多个SKU ID获取模特展示数据（最后一张图片 + nameCN后两个字）
async function getModelShowData(data) {
  const { skuIds } = data;

  if (!skuIds || !Array.isArray(skuIds) || skuIds.length === 0) {
    return {
      code: 400,
      message: '缺少必要参数: skuIds (数组)',
    };
  }

  try {
    // 批量查询SKU，获取 skuMainImages 和 nameCN 字段
    const { data: skuList } = await models.ProductSkus.list({
      filter: {
        where: {
          _id: { $in: skuIds },
        },
        select: {
          _id: true,
          nameCN: true,
          skuMainImages: true,
        },
      },
      pageSize: skuIds.length,
      pageNumber: 1,
      envType: 'prod',
    });

    if (!skuList.records || skuList.records.length === 0) {
      return {
        code: 200,
        data: { modelShowList: [] },
      };
    }

    // 按传入的 skuIds 顺序排序结果
    const skuMap = new Map();
    skuList.records.forEach((sku) => {
      skuMap.set(sku._id, sku);
    });

    // 提取每个SKU的最后一张图片和nameCN后两个字
    const modelShowList = skuIds
      .map((id) => {
        const sku = skuMap.get(id);
        if (!sku) return null;

        const images = sku.skuMainImages || [];
        const lastImage = images.length > 0 ? images[images.length - 1] : '';
        const nameCN = sku.nameCN || '';
        const tabName = nameCN.length >= 2 ? nameCN.slice(-2) : nameCN;

        return {
          _id: sku._id,
          tabName: tabName,
          image: lastImage,
        };
      })
      .filter(Boolean);

    return {
      code: 200,
      data: {
        modelShowList: modelShowList,
      },
    };
  } catch (error) {
    console.error('获取模特展示数据失败:', error);
    return {
      code: 500,
      message: '获取模特展示数据失败: ' + error.message,
    };
  }
}

// 主函数
exports.main = async (event, context) => {
  const { action, data } = event;

  try {
    switch (action) {
      // 获取子系列商品
      case 'getProductsBySubSeries':
        return await getProductsBySubSeries(data);
      // 获取分类商品
      case 'getProductsByCategory':
        return await getProductsByCategory(data);
      // 获取材质商品
      case 'getProductsByMaterial':
        return await getProductsByMaterial(data);
      // 多条件筛选商品
      case 'getProductsByFilter':
        return await getProductsByFilter(data);
      // 获取商品详情
      case 'getProductDetail':
        return await getProductDetail(data);
      // 获取模特展示数据
      case 'getModelShowData':
        return await getModelShowData(data);

      default:
        return {
          code: 400,
          message: '未知操作',
        };
    }
  } catch (err) {
    return handleError(err, event);
  }
};
