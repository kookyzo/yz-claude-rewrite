const {
  init
} = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const client = init(cloud);
const models = client.models;

// 错误处理函数
const handleError = (err, event) => {
  console.error('Error:', err, 'Event:', event);
  return {
    code: 500,
    message: err.message
  };
};

// 生成推荐ID
function generateRecommendationId() {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `REC${timestamp}${randomStr}`;
}

// 主函数
exports.main = async (event, context) => {
  const { action, data } = event;
  
  try {
    switch (action) {
      // 获取推荐商品（前端调用）
      case 'getRecommendations':
        return await getRecommendations(data);
      
      // 添加人工推荐
      case 'addManual':
        return await addManualRecommendation(data);
      
      // 系统生成推荐（管理后台触发）
      case 'generateSystem':
        return await generateSystemRecommendations(data);
      
      // 删除推荐
      case 'delete':
        return await deleteRecommendation(data);
      
      // 更新推荐
      case 'update':
        return await updateRecommendation(data);
      
      // 获取推荐列表（管理后台用）
      case 'getList':
        return await getRecommendationList(data);
      
      // 批量删除推荐
      case 'batchDelete':
        return await batchDeleteRecommendations(data);
      
      // 切换推荐状态
      case 'toggleActive':
        return await toggleRecommendationActive(data);
      
      default:
        return {
          code: 400,
          message: "未知操作"
        };
    }
  } catch (err) {
    return handleError(err, event);
  }
};


/**
 * 获取推荐商品（前端调用）
 * 逻辑：优先返回数据库中的激活推荐，不足3个时使用系统规则生成
 */
async function getRecommendations(data) {
  const { skuId, limit = 3 } = data;
  
  if (!skuId) {
    return {
      code: 400,
      message: "缺少必要参数: skuId"
    };
  }
  
  try {
    // 1. 从数据库获取激活的推荐
    const { data: dbRecommendations } = await models.Recommend.list({
      filter: {
        where: {
          mainSku: { $eq: skuId },
          isActive: { $eq: true }
        }
      },
      select: {
        _id: true,
        recommendSku: true,
        priority: true,
        ruleType: true,
      },
      relate: {
        recommendSku: {
          _id: true,
          nameCN: true,
          nameEN: true,
          skuMainImages: true,
          materialId: true,
          price: true
        }
      },
      sort: [
        { priority: "asc" },
        { createdAt: "desc" }
      ],
      
      limit: limit,
      envType: "prod"
    });
    
    let recommendations = dbRecommendations.records || [];
    const recommendedIds = new Set(recommendations.map(r => r.recommendSku));

    if (recommendations.length === limit) {
      return {
        code: 200,
        data: {
          recommendations: recommendations.map(rec => ({
            _recommendationId: rec._id,
            _skuId: rec.recommendSku._id,
            nameCN: rec.recommendSku.nameCN,
            nameEN: rec.recommendSku.nameEN,
            image: rec.recommendSku.skuMainImages[0] || [],
            price: rec.recommendSku.price || 0,
            ruleType: rec.ruleType,
          })),
          count: recommendations.length,
          source:  "数据库推荐"
        }
      };
    }

    // 2. 如果数据库推荐不足，使用系统规则生成
    if (recommendations.length < limit) {
      const systemRecommendations = await generateAndSaveRecommendationsByRules(
        skuId, 
        limit - recommendations.length, 
        recommendedIds
      );
      
      // 获取系统推荐的商品详细信息
      const systemSkuIds = systemRecommendations.map(r => r.recommendSku);
      const { data: systemSkus } = await models.ProductSkus.list({
        filter: {
          where: {
            _id: { $in: systemSkuIds },
            isOnSale: { $eq: true }
          }
        },
        select: {
          _id: true,
          nameCN: true,
          nameEN:true,
          skuMainImages: true,
          price: true
        },
        envType: "prod"
      });
      
      // 构建系统推荐结果
      const skuMap = new Map();
      systemSkus.records?.forEach(sku => {
        skuMap.set(sku._id, sku);
      });
      
      const systemResults = systemRecommendations
        .map(rec => {
          const sku = skuMap.get(rec.recommendSku);
          if (!sku) return null;
          
          return {
            _recommendationId: rec._id,
            _skuId: sku._id,
            nameCN: sku.nameCN,
            nameEN: sku.nameEN,
            image: sku.skuMainImages[0] || [],
            price: sku.price || 0,
            ruleType: rec.ruleType,
          };
        })
        .filter(item => item !== null);
      
      // 合并数据库推荐和系统推荐
      const dbResults = recommendations.map(rec => ({
        _recommendationId: rec._id,
        _id: rec.recommendSku._id,
        nameCN: rec.recommendSku.nameCN,
        nameEN: rec.recommendSku.nameEN,
        image: rec.recommendSku.skuMainImages[0]  || [],
        price: rec.recommendSku.price || 0,
        ruleType: rec.ruleType,
      }));
      
      const allRecommendations = [...dbResults, ...systemResults].slice(0, limit);
      
      return {
        code: 200,
        data: {
          recommendations: allRecommendations,
          count: allRecommendations.length,
          source: recommendations.length > 0 ? "数据库推荐+系统生成" : "系统生成"
        }
      };
    }
    
    // 3. 无推荐商品的情况
    return {
      code: 200,
      data: {
        recommendations: [],
        count: 0,
        source: "无推荐商品"
      }
    };
    
  } catch (error) {
    console.error('获取推荐商品失败:', error);
    return {
      code: 500,
      message: "获取推荐商品失败: " + error.message
    };
  }
}

/**
 * 根据规则生成推荐商品并保存到数据库
 */
async function generateAndSaveRecommendationsByRules(skuId, limit, excludeIds) {
  if (limit <= 0) return [];
  
  // 获取当前SKU信息
  const { data: currentSku } = await models.ProductSkus.get({
    filter: {
      where: { _id: { $eq: skuId } }
    },
    select: {
      _id: true,
      skuId: true,
      spuId: true,
      materialId: true,
      subSeries: true,
      sizeId: true,
      nameCN: true
    },
    envType: "prod"
  });
  
  if (!currentSku) return [];
  
  const recommendations = [];
  const excluded = new Set([...excludeIds, skuId]);
  
  // 规则1：同一产品的不同尺寸
  if (limit > 0 && currentSku.sizeId && currentSku.sizeId._id) {
    const rule1Results = await getSameProductDifferentSize(currentSku, limit, excluded);
    for (const rec of rule1Results) {
      const savedRec = await saveSystemRecommendation({
        mainSkuId: skuId,
        recommendSku: rec._id,
        ruleType: 'same_product_different_size',
        priority: 1,
      });
      if (savedRec) {
        recommendations.push(savedRec);
        excluded.add(rec._id);
        limit--;
      }
    }
  }
  
  // 规则2：同子系列同材质的其他产品
  if (limit > 0 && currentSku.subSeries && currentSku.subSeries._id) {
    const rule2Results = await getSameSubSeriesAndMaterial(currentSku, limit, excluded);
    for (const rec of rule2Results) {
      const savedRec = await saveSystemRecommendation({
        mainSkuId: skuId,
        recommendSku: rec._id,
        ruleType: 'same_subseries_material',
        priority: 2,
      });
      if (savedRec) {
        recommendations.push(savedRec);
        excluded.add(rec._id);
        limit--;
      }
    }
  }
  
  // 规则3：同材质随机产品
  if (limit > 0 && currentSku.materialId && currentSku.materialId._id) {
    const rule3Results = await getSameMaterialRandom(currentSku, limit, excluded);
    for (const rec of rule3Results) {
      const savedRec = await saveSystemRecommendation({
        mainSkuId: skuId,
        recommendSku: rec._id,
        ruleType: 'same_material_random',
        priority: 3,
      });
      if (savedRec) {
        recommendations.push(savedRec);
        excluded.add(rec._id);
        limit--;
      }
    }
  }
  
  return recommendations;
}

/**
 * 保存系统推荐到数据库
 */
async function saveSystemRecommendation(recommendationData) {
  const {
    mainSkuId,
    recommendSku,
    ruleType,
    priority,
  } = recommendationData;
  
  try {
    // 1. 检查是否已存在相同的推荐关系
    const { data: existing } = await models.Recommend.list({
      filter: {
        where: {
          mainSku: { $eq: mainSkuId },
          recommendSku: { $eq: recommendSku }
        }
      },
      limit: 1,
      envType: "prod"
    });
    
    // 如果已存在，返回现有记录
    if (existing.records && existing.records.length > 0) {
      return existing.records[0];
    }
    
    // // 2. 获取SKU名称信息（用于显示）
    // const [mainSku, recommendSkuInfo] = await Promise.all([
    //   models.ProductSkus.get({
    //     filter: { where: { _id: { $eq: mainSkuId } } },
    //     select: { nameCN: true },
    //     envType: "prod"
    //   }),
    //   models.ProductSkus.get({
    //     filter: { where: { _id: { $eq: recommendSku } } },
    //     select: { nameCN: true },
    //     envType: "prod"
    //   })
    // ]);
    
    // 3. 生成推荐ID
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 6).toUpperCase();
    const recommendId = `REC${timestamp}${randomStr}`;
    
    // 4. 创建系统推荐记录
    const { data: newRecommendation } = await models.Recommend.create({
      data: {
        recommendId,
        mainSku:{_id:mainSkuId},
      //  mainSkuName: mainSku.data?.nameCN || '',
       recommendSku:{_id:recommendSku},
//        recommendSkuName: recommendSkuInfo.data?.nameCN || '',
        ruleType,
        priority,
        isActive: true,
      },
      envType: "prod"
    });
    
    console.log('系统推荐已保存:', recommendId, mainSkuId, '->', recommendSku);
    const { data: newdata } = await models.Recommend.get({
      filter: {
        where: { _id: { $eq: newRecommendation.id } }
      },
      envType: "prod"
    });
  
    return newdata;
    
  } catch (error) {
    console.error('保存系统推荐失败:', error);
    return null;
  }
}

// 规则1：同一产品的不同尺寸
async function getSameProductDifferentSize(currentSku, limit, excludedIds) {
  const { data: skuList } = await models.ProductSkus.list({
    filter: {
      where: {
        spuId: { $eq: currentSku.spuId._id },
        materialId: { $eq: currentSku.materialId._id },
        _id: { $nin: Array.from(excludedIds) },
        isOnSale: { $eq: true },
        sizeId: { $ne: currentSku.sizeId._id }
      }
    },
    select: {
      _id: true,
      skuId: true,
      nameCN: true,
      sizeId: true
    },
    relate: {
      sizeId: {
        value: true
      }
    },
    sort: [{ _createTime: "desc" }],
    limit: limit,
    envType: "prod"
  });
  
  return skuList.records || [];
}

// 规则2：同子系列同材质的其他产品
async function getSameSubSeriesAndMaterial(currentSku, limit, excludedIds) {
  const { data: skuList } = await models.ProductSkus.list({
    filter: {
      where: {
        subSeries: { $eq: currentSku.subSeries._id },
        materialId: { $eq: currentSku.materialId._id },
        _id: { $nin: Array.from(excludedIds) },
        spuId: { $ne: currentSku.spuId._id },
        isOnSale: { $eq: true }
      }
    },
    select: {
      _id: true,
      skuId: true,
      spuId: true
    },
    relate: {
      spuId: {
        name: true
      }
    },
    sort: [{ _createTime: "desc" }],
    limit: limit,
    envType: "prod"
  });
  
  return skuList.records || [];
}

// 规则3：同材质随机产品
async function getSameMaterialRandom(currentSku, limit, excludedIds) {
  // 查询所有同材质商品
  const { data: skuList } = await models.ProductSkus.list({
    filter: {
      where: {
        materialId: { $eq: currentSku.materialId._id },
        _id: { $nin: Array.from(excludedIds) },
        isOnSale: { $eq: true }
      }
    },
    select: {
      _id: true,
      skuId: true,
      materialId: true
    },
    relate: {
      materialId: {
        nameCN: true
      }
    },
    sort: [{ _createTime: "desc" }],
    limit: limit * 3, // 多取一些确保数量
    envType: "prod"
  });
  
  const records = skuList.records || [];
  
  // 简单随机选择
  if (records.length <= limit) return records;
  
  const shuffled = [...records];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled.slice(0, limit);
}

// 管理后台批量生成系统推荐的函数
async function generateSystemRecommendationsForManagement(data) {
  const { skuId, forceRegenerate = false } = data;
  
  try {
    let targetSkuIds = [];
    
    if (skuId) {
      // 为单个SKU生成推荐
      targetSkuIds = [skuId];
    } else {
      // 为所有上架SKU生成推荐
      const { data: allSkus } = await models.ProductSkus.list({
        filter: {
          where: { isOnSale: { $eq: true } }
        },
        select: { _id: true },
        limit: 100, // 限制数量，避免处理过多
        envType: "prod"
      });
      
      targetSkuIds = (allSkus.records || []).map(sku => sku._id);
    }
    
    const results = {
      total: targetSkuIds.length,
      generated: 0,
      skipped: 0,
      errors: []
    };
    
    // 逐个SKU处理
    for (const targetSkuId of targetSkuIds) {
      try {
        // 检查是否已存在系统推荐
        if (!forceRegenerate) {
          const { data: existing } = await models.Recommend.count({
            filter: {
              where: {
                mainSkuId: { $eq: targetSkuId },
                recommendationType: { $eq: 'system' }
              }
            },
            envType: "prod"
          });
          
          if (existing.total > 0) {
            results.skipped++;
            continue;
          }
        }
        
        // 为当前SKU生成系统推荐
        const systemRecs = await generateAndSaveRecommendationsByRules(targetSkuId, 3, new Set());
        results.generated += systemRecs.length;
        
      } catch (error) {
        results.errors.push({
          skuId: targetSkuId,
          error: error.message
        });
      }
    }
    
    return {
      code: 200,
      message: `系统推荐生成完成`,
      data: results
    };
    
  } catch (error) {
    console.error('系统生成推荐失败:', error);
    return {
      code: 500,
      message: "系统生成推荐失败: " + error.message
    };
  }
}
/**
 * 添加人工推荐
 */
async function addManualRecommendation(data) {
  const {
    mainSkuId,
    recommendedSkuId,
    reason = '人工指定推荐',
    displayOrder = 50,
    isActive = true
  } = data;
  
  if (!mainSkuId || !recommendedSkuId) {
    return {
      code: 400,
      message: "缺少必要参数: mainSkuId 和 recommendedSkuId"
    };
  }
  
  if (mainSkuId === recommendedSkuId) {
    return {
      code: 400,
      message: "不能推荐商品给自己"
    };
  }
  
  try {
    // 1. 验证SKU是否存在
    const [mainSku, recommendedSku] = await Promise.all([
      models.ProductSkus.get({
        filter: { where: { _id: { $eq: mainSkuId } } },
        select: { _id: true, skuId: true, spuId: true, nameCN: true },
        envType: "prod"
      }),
      models.ProductSkus.get({
        filter: { where: { _id: { $eq: recommendedSkuId } } },
        select: { _id: true, skuId: true, spuId: true, nameCN: true },
        envType: "prod"
      })
    ]);
    
    if (!mainSku.data || !recommendedSku.data) {
      return {
        code: 404,
        message: "指定的SKU不存在"
      };
    }
    
    // 2. 检查是否已存在相同推荐
    const { data: existing } = await models.Recommend.list({
      filter: {
        where: {
          mainSkuId: { $eq: mainSkuId },
          recommendedSkuId: { $eq: recommendedSkuId }
        }
      },
      limit: 1,
      envType: "prod"
    });
    
    if (existing.records && existing.records.length > 0) {
      return {
        code: 400,
        message: "已存在相同的推荐关系"
      };
    }
    
    // 3. 创建推荐关系
    const now = new Date();
    const recommendationId = generateRecommendationId();
    
    const { data: newRecommendation } = await models.Recommend.create({
      data: {
        recommendationId,
        mainSkuId,
        mainSkuName: mainSku.data.nameCN,
        mainSpuId: mainSku.data.spuId?._id || '',
        recommendedSkuId,
        recommendedSkuName: recommendedSku.data.nameCN,
        recommendedSpuId: recommendedSku.data.spuId?._id || '',
        recommendationType: 'manual',
        ruleType: 'manual_specified',
        reason,
        displayOrder,
        isActive,
        priority: 1, // 人工推荐优先级最高
        createdAt: now,
        updatedAt: now
      },
      envType: "prod"
    });
    
    return {
      code: 200,
      message: "人工推荐添加成功",
      data: newRecommendation
    };
    
  } catch (error) {
    console.error('添加人工推荐失败:', error);
    return {
      code: 500,
      message: "添加人工推荐失败: " + error.message
    };
  }
}

/**
 * 系统生成推荐（管理后台触发）
 * 可以为单个SKU或所有SKU生成推荐
 */
async function generateSystemRecommendations(data) {
  const { skuId, forceRegenerate = false } = data;
  
  try {
    let targetSkuIds = [];
    
    if (skuId) {
      // 为单个SKU生成推荐
      targetSkuIds = [skuId];
    } else {
      // 为所有上架SKU生成推荐
      const { data: allSkus } = await models.ProductSkus.list({
        filter: {
          where: { isOnSale: { $eq: true } }
        },
        select: { _id: true },
        limit: 100, // 限制数量，避免处理过多
        envType: "prod"
      });
      
      targetSkuIds = (allSkus.records || []).map(sku => sku._id);
    }
    
    const results = {
      total: targetSkuIds.length,
      generated: 0,
      skipped: 0,
      errors: []
    };
    
    // 逐个SKU处理
    for (const targetSkuId of targetSkuIds) {
      try {
        // 检查是否已存在系统推荐
        if (!forceRegenerate) {
          const { data: existing } = await models.Recommend.count({
            filter: {
              where: {
                mainSkuId: { $eq: targetSkuId },
                recommendationType: { $eq: 'system' }
              }
            },
            envType: "prod"
          });
          
          if (existing.total > 0) {
            results.skipped++;
            continue;
          }
        }
        
        // 为当前SKU生成系统推荐
        const systemRecs = await generateRecommendationsByRules(targetSkuId, 3, new Set());
        
        // 保存到数据库
        const now = new Date();
        for (const rec of systemRecs) {
          const recommendationId = generateRecommendationId();
          
          // 获取SKU名称
          const { data: mainSku } = await models.ProductSkus.get({
            filter: { where: { _id: { $eq: targetSkuId } } },
            select: { nameCN: true, spuId: true },
            envType: "prod"
          });
          
          const { data: recSku } = await models.ProductSkus.get({
            filter: { where: { _id: { $eq: rec.recommendedSkuId } } },
            select: { nameCN: true, spuId: true },
            envType: "prod"
          });
          
          await models.Recommend.create({
            data: {
              ...rec,
              recommendationId,
              mainSkuId: targetSkuId,
              mainSkuName: mainSku?.nameCN || '',
              mainSpuId: mainSku?.spuId?._id || '',
              recommendedSkuName: recSku?.nameCN || '',
              recommendedSpuId: recSku?.spuId?._id || '',
              isActive: true,
              createdAt: now,
              updatedAt: now
            },
            envType: "prod"
          });
        }
        
        results.generated++;
        
      } catch (error) {
        results.errors.push({
          skuId: targetSkuId,
          error: error.message
        });
      }
    }
    
    return {
      code: 200,
      message: `系统推荐生成完成`,
      data: results
    };
    
  } catch (error) {
    console.error('系统生成推荐失败:', error);
    return {
      code: 500,
      message: "系统生成推荐失败: " + error.message
    };
  }
}

/**
 * 删除推荐
 */
async function deleteRecommendation(data) {
  const { recommendationId } = data;
  
  if (!recommendationId) {
    return {
      code: 400,
      message: "缺少必要参数: recommendationId"
    };
  }
  
  try {
    // 检查推荐是否存在
    const { data: recommendation } = await models.Recommend.get({
      filter: {
        where: { _id: { $eq: recommendationId } }
      },
      envType: "prod"
    });
    
    if (!recommendation) {
      return {
        code: 404,
        message: "推荐关系不存在"
      };
    }
    
    // 删除推荐
    await models.Recommend.delete({
      filter: {
        where: { _id: { $eq: recommendationId } }
      },
      envType: "prod"
    });
    
    return {
      code: 200,
      message: "推荐关系删除成功",
      data: { recommendationId }
    };
    
  } catch (error) {
    console.error('删除推荐失败:', error);
    return {
      code: 500,
      message: "删除推荐失败: " + error.message
    };
  }
}

/**
 * 更新推荐
 */
async function updateRecommendation(data) {
  const {
    recommendationId,
    reason,
    displayOrder,
    isActive,
    priority
  } = data;
  
  if (!recommendationId) {
    return {
      code: 400,
      message: "缺少必要参数: recommendationId"
    };
  }
  
  try {
    // 构建更新数据
    const updateData = {
      updatedAt: new Date()
    };
    
    if (reason !== undefined) updateData.reason = reason;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (priority !== undefined) updateData.priority = priority;
    
    // 更新推荐
    const { data: updated } = await models.Recommend.update({
      filter: {
        where: { _id: { $eq: recommendationId } }
      },
      data: updateData,
      envType: "prod"
    });
    
    if (!updated) {
      return {
        code: 404,
        message: "推荐关系不存在"
      };
    }
    
    return {
      code: 200,
      message: "推荐关系更新成功",
      data: updated
    };
    
  } catch (error) {
    console.error('更新推荐失败:', error);
    return {
      code: 500,
      message: "更新推荐失败: " + error.message
    };
  }
}

/**
 * 获取推荐列表（管理后台用）
 */
async function getRecommendationList(data) {
  const {
    mainSkuId,
    recommendationType,
    ruleType,
    isActive,
    page = 1,
    pageSize = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = data;
  
  try {
    // 构建查询条件
    const whereConditions = {};
    
    if (mainSkuId) whereConditions.mainSkuId = { $eq: mainSkuId };
    if (recommendationType) whereConditions.recommendationType = { $eq: recommendationType };
    if (ruleType) whereConditions.ruleType = { $eq: ruleType };
    if (isActive !== undefined) whereConditions.isActive = { $eq: isActive };
    
    // 查询推荐列表
    const { data: recommendations } = await models.Recommend.list({
      filter: {
        where: whereConditions
      },
      select: {
        _id: true,
        recommendId: true,
        mainSkuId: true,
        recommendSku: true,
        ruleType: true,
        priority: true,
        isActive: true,
      },
      sort: [{ [sortBy]: sortOrder }],
      skip: (page - 1) * pageSize,
      limit: pageSize,
      getCount: true,
      envType: "prod"
    });
    
    // 获取总数
    const { data: countData } = await models.Recommend.count({
      filter: {
        where: whereConditions
      },
      envType: "prod"
    });
    
    return {
      code: 200,
      data: {
        items: recommendations.records || [],
        total: countData.total || 0,
        page,
        pageSize,
        totalPages: Math.ceil((countData.total || 0) / pageSize)
      }
    };
    
  } catch (error) {
    console.error('获取推荐列表失败:', error);
    return {
      code: 500,
      message: "获取推荐列表失败: " + error.message
    };
  }
}

/**
 * 批量删除推荐
 */
async function batchDeleteRecommendations(data) {
  const { recommendationIds } = data;
  
  if (!Array.isArray(recommendationIds) || recommendationIds.length === 0) {
    return {
      code: 400,
      message: "缺少推荐ID列表"
    };
  }
  
  try {
    const results = {
      total: recommendationIds.length,
      success: 0,
      failed: 0,
      errors: []
    };
    
    for (const id of recommendationIds) {
      try {
        await models.Recommend.delete({
          filter: {
            where: { _id: { $eq: id } }
          },
          envType: "prod"
        });
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          recommendationId: id,
          error: error.message
        });
      }
    }
    
    return {
      code: 200,
      message: `批量删除完成，成功 ${results.success} 条，失败 ${results.failed} 条`,
      data: results
    };
    
  } catch (error) {
    console.error('批量删除推荐失败:', error);
    return {
      code: 500,
      message: "批量删除推荐失败: " + error.message
    };
  }
}

/**
 * 切换推荐激活状态
 */
async function toggleRecommendationActive(data) {
  const { recommendationId } = data;
  
  if (!recommendationId) {
    return {
      code: 400,
      message: "缺少必要参数: recommendationId"
    };
  }
  
  try {
    // 获取当前状态
    const { data: recommendation } = await models.Recommend.get({
      filter: {
        where: { _id: { $eq: recommendationId } }
      },
      select: { isActive: true },
      envType: "prod"
    });
    
    if (!recommendation) {
      return {
        code: 404,
        message: "推荐关系不存在"
      };
    }
    
    const newActive = !recommendation.isActive;
    
    // 更新状态
    const { data: updated } = await models.Recommend.update({
      filter: {
        where: { _id: { $eq: recommendationId } }
      },
      data: {
        isActive: newActive,
        updatedAt: new Date()
      },
      envType: "prod"
    });
    
    return {
      code: 200,
      message: `推荐已${newActive ? '激活' : '停用'}`,
      data: updated
    };
    
  } catch (error) {
    console.error('切换推荐状态失败:', error);
    return {
      code: 500,
      message: "切换推荐状态失败: " + error.message
    };
  }
}