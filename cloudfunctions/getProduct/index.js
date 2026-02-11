const {
  init
} = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const db = cloud.database()
const client = init(cloud);
const models = client.models;
// 通用错误处理函数
const handleError = (err, event) => {
  console.error('Error:', err, 'Event:', event);
  return {
    code: 500,
    message: err.message
  };
};

exports.main = async (event, context) => {
  const {
    action,
    dataSearch
  } = event;

  try {
    switch (action) {
      //  获取分类项
      case 'getCategories': {
        try {
          // 查询状态为true的分类项
          const {
            data: categoriesData
          } = await models.Categories.list({
            envType: "prod",
            status: true // 添加状态过滤条件
          });

          console.log('[getProduct] Categories原始数据:', categoriesData.records);
          console.log('[getProduct] 第一个分类的完整字段:', categoriesData.records[0]);

          // 检查categoryId字段类型和值
          console.log('[getProduct] categoryId类型检查:',
            categoriesData.records.map(item => ({
              categoryId: item.categoryId,
              type: typeof item.categoryId,
              isNull: item.categoryId === null,
              isUndefined: item.categoryId === undefined
            }))
          );

          console.log('[getProduct] categoryId值列表:',
            categoriesData.records.map(item => item.categoryId)
          );

          // 返回分类名称列表（不排序，由前端处理）
          return {
            code: 200,
            message: "获取分类成功",
            data: categoriesData.records.map(Categories => ({
              categoryName: Categories.categoryName, // 返回分类名称
              categoryId: Categories._id, //主键查询id
              _rawCategoryId: Categories.categoryId, // 原始categoryId字段（如果存在）
            }))
          };
        } catch (err) {
          // 调用通用错误处理函数
          return handleError(err, event);
        }
      }

      // 获取所有分类项（包括已禁用的，用于后台管理）
      case 'getAllCategories': {
        try {
          // 查询所有分类项（不过滤状态）
          const {
            data: categoriesData
          } = await models.Categories.list({
            envType: "prod"
            // 不添加 status 过滤条件，返回所有分类
          });

          console.log('[getProduct] getAllCategories 原始数据:', categoriesData.records);

          // 返回所有分类的完整信息
          return {
            code: 200,
            message: "获取所有分类成功",
            data: categoriesData.records.map(category => ({
              categoryName: category.categoryName, // 分类名称
              categoryId: category.categoryId, // 业务 categoryId
              _id: category._id, // 数据库 ID
              _rawCategoryId: category.categoryId, // 原始 categoryId（兼容前端）
              status: category.status !== undefined ? category.status : true, // 状态
              description: category.description || '', // 描述
              sortOrder: category.sortOrder || 0, // 排序
              _createTime: category._createTime || 0, // 创建时间
              _updateTime: category._updateTime || 0 // 更新时间
            }))
          };
        } catch (err) {
          // 调用通用错误处理函数
          return handleError(err, event);
        }
      }

      //获取分类下SPU列表
      case 'getSpuByCategory': {
        try {
          const {
            _categoryId,
            isSKU,
            page = 1,
            pageSize = 10
          } = dataSearch;

          console.log('[getProduct] getSpuByCategory 参数:', { _categoryId, isSKU, page, pageSize });

          // 验证必要参数
          if (!_categoryId) {
            return {
              code: 400,
              message: "缺少必要参数: _categoryId"
            };
          }

          let filterCondition;

          // 如果是'ALL'分类，获取所有上架商品
          if (_categoryId === 'ALL') {
            console.log('[getProduct] 检测到ALL分类，获取所有上架商品');
            filterCondition = {
              where: {
                isOnSale: {
                  $eq: true
                }
              }
            };
          } else {
            // 获取指定分类下上架的SPU列表
            console.log('[getProduct] 获取指定分类商品:', _categoryId);
            filterCondition = {
              where: {
                category: {
                  $eq: _categoryId
                },
                isOnSale: {
                  $eq: true
                }
              }
            };
          }

          // 获取SPU列表
          const {
            data: spuData
          } = await models.ProductSpus.list({
            filter: filterCondition,
            select: {
              _id: true,
              spuId: true,
              mainImages: true,
              referencePrice: true,
              description: true, // 添加description字段
            },
            skip: (page - 1) * pageSize,
            limit: pageSize,
            getCount: true,
            envType: "prod"
          });

          console.log('[getProduct] 云函数查询结果:', spuData);
          console.log('[getProduct] SPU记录数量:', spuData.records ? spuData.records.length : 0);

          // 如果不需获取SKU信息，直接返回SPU列表
          if (!isSKU) {
            return {
              code: 200,
              message: "获取分类下SPU成功",
              data: {
                list: spuData.records,
                total: spuData.total,
                page,
                pageSize
              }
            };
          }

          // 提取SPU ID列表用于批量查询SKU
          const spuIds = spuData.records.map(ProductSpus => ProductSpus.spuId);
          console.log('[getProduct] 提取的SPU ID列表:', spuIds);

          if (spuIds.length === 0) {
            return {
              code: 200,
              message: "获取成功",
              data: {
                list: [],
                total: spuData.total,
                page,
                pageSize
              }
            };
          }

          // 批量查询关联的上架SKU
          console.log('[getProduct] 开始查询SKU，查询条件:', {
            spuId: { $in: spuIds },
            isOnSale: { $eq: true }
          });

          const {
            data: skuData
          } = await models.ProductSkus.list({
            filter: {
              where: {
                spuId: {
                  $in: spuIds
                },
                isOnSale: {
                  $eq: true
                }
              }
            },
            select: {
              _id: true,
              skuId: true,
              nameCN: true,
              nameEN: true,
              material: true,
              price: true,
              size: true,
              skuMainImages: true, // 添加SKU主图字段
              introduction: true,  // 添加SKU介绍字段
              spuId: true // 需要此字段用于关联SPU
            },
            limit: 1000, // 设置一个较大的限制，确保获取所有SKU
            envType: "prod"
          });

          console.log('[getProduct] SKU查询结果:', skuData);
          console.log('[getProduct] SKU记录数量:', skuData.records ? skuData.records.length : 0);

          // 按SPU ID分组SKU
          const skusBySpu = {};
          skuData.records.forEach(ProductSkus => {
            console.log('[getProduct] 处理SKU:', { spuId: ProductSkus.spuId, skuId: ProductSkus.skuId });
            if (!skusBySpu[ProductSkus.spuId]) {
              skusBySpu[ProductSkus.spuId] = [];
            } //初始化
            skusBySpu[ProductSkus.spuId].push({
              _id: ProductSkus._id,
              skuId: ProductSkus.skuId,
              nameCN: ProductSkus.nameCN,
              nameEN: ProductSkus.nameEN,
              material: ProductSkus.material,
              price: ProductSkus.price,
              size: ProductSkus.size,
              skuMainImages: ProductSkus.skuMainImages, // 添加SKU主图
              introduction: ProductSkus.introduction     // 添加SKU介绍
            });
          });

          console.log('[getProduct] SKU分组结果:', skusBySpu);

          // 将SKU信息合并到SPU中
          const enrichedSpus = spuData.records.map(spu => ({
            ...spu,
            skus: skusBySpu[spu.spuId] || [] // 若无SKU则返回空数组
          }));

          return {
            code: 0,
            message: "获取分类下SPU及SKU成功",
            data: {
              list: enrichedSpus,
              total: spuData.total,
              page,
              pageSize
            }
          };

        } catch (err) {
          return handleError(err, event);
        }
      }
      //模糊搜索
      case 'getSkuByName': {
        try {
          const {
            name,
            page = 1,
            pageSize = 20
          } = dataSearch;

          // 验证必要参数
          if (!name || name.trim() === '') {
            return {
              code: 400,
              message: "搜索关键词不能为空"
            };
          }

          // 
          const {
            data: skuData
          } = await models.ProductSkus.list({
            filter: {
              where: {
                nameCN: {
                  $search: name
                },
                isOnSale: {
                  $eq: true
                }
              }
            },
            select: {
              _id: true,
              skuId: true,
              nameCN: true,
              nameEN: true,
              skuMainImages: true, // 注意字段名与模型定义一致
              price: true // 通常搜索也需要显示价格
            },
            skip: (page - 1) * pageSize,
            limit: pageSize,
            getCount: true,
            envType: "prod"
          });

          return {
            code: 200,
            message: "搜索商品成功",
            data: {
              list: skuData.records,
              total: skuData.total,
              page,
              pageSize
            }
          };

        } catch (err) {
          return handleError(err, event);
        }
      }

      // 按价格和时间排序获取SKU列表
      case 'getSkuByPriceAndTimeSort': {
        try {
          const {
            sortType = 'both', // 排序类型：'price'(仅价格), 'time'(仅时间), 'both'(两者复合)
            priceOrder = 'asc', // 价格排序方向：asc(升序)或desc(降序)
            timeOrder = 'desc', // 时间排序方向：asc(升序)或desc(降序)
            page = 1,
            pageSize = 10
          } = dataSearch;

          // 验证参数
          const validSortTypes = ['price', 'time', 'both', 'undefined'];
          const validOrders = ['asc', 'desc'];

          if (!validSortTypes.includes(sortType)) {
            return {
              code: 400,
              message: "无效的排序类型，请使用 'price', 'time'，undefined 或 'both'"
            };
          }

          if (!validOrders.includes(priceOrder)) {
            return {
              code: 400,
              message: "无效的价格排序方向，请使用 'asc' 或 'desc'"
            };
          }

          if (!validOrders.includes(timeOrder)) {
            return {
              code: 400,
              message: "无效的时间排序方向，请使用 'asc' 或 'desc'"
            };
          }

          // 根据排序类型构建排序对象
          let sortOptions = [];

          if (sortType === 'price') {
            // 仅按价格排序
            sortOptions = [{
              price: priceOrder
            }];
          } else if (sortType === 'time') {
            // 仅按时间排序
            sortOptions = [{
              createdAt: timeOrder
            }];
          } else if (sortType === 'both') {
            // 复合排序：先按时间，再按价格
            sortOptions = [{
              price: priceOrder
            },
            {
              createdAt: timeOrder
            }
            ];
          }

          // 查询ProductSkus表
          const {
            data: skuData
          } = await models.ProductSkus.list({
            filter: {
              where: {
                isOnSale: {
                  $eq: true
                }
              }
            },
            orderBy: sortOptions.length > 0 ? sortOptions : undefined,
            select: {
              _id: true,
              skuId: true,
              nameCN: true,
              nameEN: true,
              skuMainImages: true,
              price: true,
              _createTime: true
            },
            skip: (page - 1) * pageSize,
            limit: pageSize,
            getCount: true,
            envType: "prod"
          });

          return {
            code: 200,
            message: `按${sortType === 'both' ? '价格和时间复合' : sortType}排序获取SKU成功`,
            data: {
              list: skuData.records,
              total: skuData.total,
              page,
              pageSize
            }
          };

        } catch (err) {
          return handleError(err, event);
        }
      }

      // 根据筛选条件获取SKU列表
      // 筛选条件：价格范围，Tags标签，材质，类别，系列
      case 'getSkuByFilter': {
        try {
          const {
            // 筛选条件
            minPrice, // 最低价格
            maxPrice, // 最高价格
            tags, // 标签数组（枚举类型）
            materials, // 材质数组
            _categoryId, // 分类ID
            _seriesId, // 系列ID

            // 分页和排序
            page = 1,
            pageSize = 10,
            sortType = null, // 排序字段
            priceOrder = 'asc', // 价格排序方向：asc(升序)或desc(降序)
            timeOrder = 'desc', // 时间排序方向：asc(升序)或desc(降序)
          } = dataSearch;


          // 构建动态条件数组
          const baseConditions = [{
            isOnSale: {
              $eq: true
            }
          } // 固定条件
          ];

          // 添加价格条件
          if (minPrice !== undefined && !isNaN(minPrice)) {
            baseConditions.push({
              price: {
                $gte: Number(minPrice)
              }
            });
          }
          if (maxPrice !== undefined && !isNaN(maxPrice)) {
            baseConditions.push({
              price: {
                $lte: Number(maxPrice)
              }
            });
          }

          // 添加材质条件
          if (materials?.length > 0) {
            const validMaterials = materials.filter(m => m.trim());
            if (validMaterials.length) {
              baseConditions.push({
                material: {
                  $in: validMaterials
                }
              });
            }
          }
          // Sku标签筛选
          if (tags?.length > 0) {
            baseConditions.push({
              tags: {
                $in: ["1"]
              }
            });
          }

          // 最终构造 filter
          const filterConditions = {
            where: {
              $and: baseConditions
            }, // 所有条件统一置于 $and
            relateWhere: {} // 关键初始化
          };

          // 构建关联过滤条件（关联模型：ProductSpu）
          const spuWhere = {};
          let hasRelateCondition = false;

          //标签筛选
          if (tags?.length > 0) {
            spuWhere.tags = {
              $in: tags
            };
            hasRelateCondition = true;
          }

          // 分类筛选
          if (_categoryId) {
            spuWhere.categoryId = {
              $eq: _categoryId
            };
            hasRelateCondition = true;
          }

          // 系列筛选
          if (_seriesId) {
            spuWhere.seriesId = {
              $eq: _seriesId
            };
            hasRelateCondition = true;
          }

          // 添加关联条件（修复子查询结构）
          if (hasRelateCondition) {
            filterConditions.relateWhere.spuId = {
              where: spuWhere
            };
          }


          // 验证排序参数
          const validSortTypes = ['price', 'time', 'both', null, undefined];
          const validOrders = ['asc', 'desc'];

          if (!validSortTypes.includes(sortType)) {
            return {
              code: 400,
              message: "无效的排序类型，请使用 'price', 'time', 'both' 或不指定"
            };
          }

          if (!validOrders.includes(priceOrder)) {
            return {
              code: 400,
              message: "无效的价格排序方向，请使用 'asc' 或 'desc'"
            };
          }

          if (!validOrders.includes(timeOrder)) {
            return {
              code: 400,
              message: "无效的时间排序方向，请使用 'asc' 或 'desc'"
            };
          }

          // 构建排序选项
          let sortOptions = [];
          if (sortType === 'price') {
            sortOptions = [{
              price: priceOrder
            }];
          } else if (sortType === 'time') {
            sortOptions = [{
              createdAt: timeOrder
            }];
          } else if (sortType === 'both') {
            sortOptions = [{
              createdAt: timeOrder
            },
            {
              price: priceOrder
            }
            ];
          }
          console.log(filterConditions);
          // 查询符合条件的SKU（使用文档规范参数）[7](@ref)
          const {
            data: skuData
          } = await models.ProductSkus.list({
            filter: filterConditions,
            orderBy: sortOptions.length > 0 ? sortOptions : undefined,
            select: {
              _id: true,          // 正确：使用 true 表示包含字段
              skuId: true,
              nameCN: true,
              nameEN: true,
              skuMainImages: true,
              price: true,
              material: true,
              spuId: true
            },
            pageNumber: page,
            pageSize: pageSize,
            getCount: true,
            envType: "prod"
          });

          return {
            code: 200,
            message: "筛选获取SKU成功",
            data: {
              list: skuData.records,
              total: skuData.total,
              page,
              pageSize
            }
          };

        } catch (err) {
          return handleError(err, event);
        }
      }
      // 测试功能：直接查询SKU数据
      case 'testSkuQuery': {
        try {
          const { spuId } = dataSearch;
          console.log('[getProduct] ==================== 开始查询 ====================');
          console.log('[getProduct] 1. 接收到的spuId参数:', spuId, '类型:', typeof spuId);

          // 第一步：根据spuId查找SPU，获取其_id
          console.log('[getProduct] 2. 开始查询SPU，查找spuId为', spuId, '的SPU记录');
          const {
            data: spuData
          } = await models.ProductSpus.list({
            filter: {
              where: {
                spuId: {
                  $eq: spuId
                },
                isOnSale: {
                  $eq: true
                }
              }
            },
            select: {
              _id: true,
              spuId: true,
              mainImages: true,
              referencePrice: true,
              description: true
            },
            limit: 100, // 设置限制，确保能查询到SPU
            envType: "prod"
          });

          console.log('[getProduct] 3. SPU查询结果数量:', spuData.records ? spuData.records.length : 0);
          console.log('[getProduct] 4. SPU查询结果:', spuData.records);

          if (!spuData.records || spuData.records.length === 0) {
            console.log('[getProduct] ✗ 错误：未找到spuId为', spuId, '的SPU');
            return {
              code: 404,
              message: "未找到对应的SPU",
              data: {
                allSkus: [],
                filteredSkus: [],
                spuId: spuId,
                error: "SPU not found"
              }
            };
          }

          const targetSpu = spuData.records[0];
          const spuDbId = targetSpu._id;  // SPU的数据库_id
          console.log('[getProduct] 5. ✓ 找到SPU，数据库_id:', spuDbId, 'spuId:', targetSpu.spuId);

          // 第二步：查询所有SKU
          console.log('[getProduct] 6. 开始查询所有SKU');
          const {
            data: allSkuData
          } = await models.ProductSkus.list({
            filter: {
              where: {
                isOnSale: {
                  $eq: true
                }
              }
            },
            select: {
              _id: true,
              skuId: true,
              spuId: true,  // 关联字段会返回 {_id: "xxx"} 格式
              nameCN: true,
              nameEN: true,
              material: true,
              price: true,
              size: true,
              skuMainImages: true,
              introduction: true
            },
            limit: 1000, // 设置一个较大的限制，确保获取所有SKU
            envType: "prod"
          });

          console.log('[getProduct] 7. 所有SKU数据数量:', allSkuData.records ? allSkuData.records.length : 0);
          console.log('[getProduct] 8. 目标SPU的_id:', spuDbId, '用于匹配SKU的spuId关联字段');

          // 第三步：筛选匹配的SKU（使用SPU的_id进行匹配）
          let filteredSkus = allSkuData.records || [];
          if (spuDbId && allSkuData.records && allSkuData.records.length > 0) {
            console.log('[getProduct] 9. 开始筛选SKU，目标SPU的_id:', spuDbId);
            console.log('[getProduct] 10. 所有SKU的spuId关联字段详情:');

            allSkuData.records.forEach((sku, index) => {
              const spuIdObj = sku.spuId;
              const spuIdType = typeof spuIdObj;
              const spuIdValue = (spuIdType === 'object' && spuIdObj !== null) ? spuIdObj._id : spuIdObj;
              console.log(`     [${index}] skuId: ${sku.skuId}`);
              console.log(`          spuId字段: ${JSON.stringify(spuIdObj)}`);
              console.log(`          类型: ${spuIdType}`);
              console.log(`          提取的_id: ${spuIdValue}`);
              console.log(`          匹配结果: ${spuIdValue === spuDbId ? '✓ 匹配' : '✗ 不匹配'}`);
            });

            filteredSkus = allSkuData.records.filter(sku => {
              // 处理关联字段：spuId是对象 {_id: "xxx"}
              let skuSpuDbId = sku.spuId;

              // 如果是对象（关联字段），取_id属性
              if (typeof skuSpuDbId === 'object' && skuSpuDbId !== null) {
                skuSpuDbId = skuSpuDbId._id || skuSpuDbId.id;
              }

              // 使用SPU的数据库_id进行匹配
              const isMatch = skuSpuDbId === spuDbId || String(skuSpuDbId) === String(spuDbId);

              if (isMatch) {
                console.log('[getProduct] 11. ✓ 找到匹配的SKU:', {
                  skuId: sku.skuId,
                  skuSpuDbId: skuSpuDbId,
                  targetSpuDbId: spuDbId,
                  nameCN: sku.nameCN
                });
              }

              return isMatch;
            });

            console.log('[getProduct] 12. 筛选完成，匹配的SKU数量:', filteredSkus.length);
            if (filteredSkus.length > 0) {
              console.log('[getProduct] 13. ✓ 成功筛选出SKU列表');
              filteredSkus.forEach((sku, idx) => {
                console.log(`     [${idx}] ${sku.skuId} - ${sku.nameCN} - ${sku.size}`);
              });
            } else {
              console.log('[getProduct] 13. ✗ 警告：没有筛选出任何SKU');
            }
          } else {
            console.log('[getProduct] 9. 没有spuDbId或没有SKU数据');
          }

          console.log('[getProduct] ==================== 查询结束 ====================');

          return {
            code: 200,
            message: "测试查询SKU成功",
            data: {
              allSkus: allSkuData.records,
              filteredSkus: filteredSkus,
              spuId: spuId
            }
          };
        } catch (err) {
          return handleError(err, event);
        }
      }

      // 获取对应系列下所有商品(SPU)
      case 'getAllSpuBySeries': {
        const {
          _seriesId
        } = dataSearch;

        const {
          data: spuData
        } = await models.ProductSpus.list({
          filter: {
            where: {
              seriesId: {
                $eq: _seriesId
              },
              isOnSale: {
                $eq: true
              }
            }
          },
          limit: 1000, // 设置限制，确保获取系列下所有SPU
          envType: "prod"
        });

        return {
          code: 200,
          message: "获取系列下所有SPU成功",
          data: spuData.records
        };
      }

      case 'getRandomSpu': {
        try {
          console.log('[getProduct] 开始获取随机SPU');

          // 获取所有上架的SPU
          const {
            data: allSpuData
          } = await models.ProductSpus.list({
            filter: {
              where: {
                isOnSale: {
                  $eq: true
                }
              }
            },
            select: {
              _id: true,
              spuId: true,
              mainImages: true,
              referencePrice: true,
              description: true
            },
            limit: 1000, // 设置限制，确保获取所有上架SPU
            envType: "prod"
          });

          console.log('[getProduct] 所有上架SPU数量:', allSpuData.records ? allSpuData.records.length : 0);

          if (!allSpuData.records || allSpuData.records.length === 0) {
            console.log('[getProduct] 没有找到上架的SPU');
            return {
              code: 404,
              message: "没有找到可用的商品",
              data: null
            };
          }

          // 随机选择一个SPU
          const randomIndex = Math.floor(Math.random() * allSpuData.records.length);
          const randomSpu = allSpuData.records[randomIndex];

          console.log('[getProduct] 随机选择的SPU:', {
            index: randomIndex,
            spuId: randomSpu.spuId,
            description: randomSpu.description,
            price: randomSpu.referencePrice
          });

          return {
            code: 200,
            message: "获取随机SPU成功",
            data: randomSpu
          };
        } catch (err) {
          return handleError(err, event);
        }
      }

      default:
        return {
          code: 400, message: "未知操作"
        };
    }
  } catch (error) {
    console.error("商品相关操作错误:", error);
    return {
      code: 500,
      message: "操作失败: " + error.message
    };
  }
};