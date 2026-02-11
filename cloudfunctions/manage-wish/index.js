const { init } = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database()
const client = init(cloud);
const models = client.models;

// 允许更新的心愿单字段
const ALLOWED_WISH_FIELDS = [
  'userId', 'spuId', 'skuId'
];

exports.main = async (event, context) => {
  const { action, data } = event;
  const { _wishId, userId } = data || {};

  const handleError = (err) => {
    console.error('Error:', err);
    return { code: 500, message: err.message };
  };

  try {
    switch (action) {
      case 'add':
        return await addToWishlist(data);

      case 'remove':
        return await removeFromWishlist(_wishId);

      case 'update':
        return await updateWishlistItem(data);

      case 'get':
        return await getWishlistItem(_wishId);

      case 'list':
        return await getWishlist(userId);

      case 'check':
        return await checkInWishlist(data);

      default:
        return {
          code: 400,
          message: '未知的操作类型'
        };
    }
  } catch (err) {
    return handleError(err);
  }
};

// 添加到心愿单
async function addToWishlist(wishData) {
  if (!wishData) {
    return {
      code: 400,
      message: "缺少心愿单数据"
    };
  }

  // 必填字段验证
  const requiredFields = ['userId', 'spuId'];
  for (const field of requiredFields) {
    if (!wishData[field]) {
      return {
        code: 400,
        message: `缺少必填字段: ${field}`
      };
    }
  }

  // 检查用户是否存在
  const { data: user } = await models.Users.get({
    filter: {
      where: { _id: { $eq: wishData.userId._id } }
    },
    envType: "prod"
  });

  if (!user) {
    return {
      code: 404,
      message: "用户不存在"
    };
  }

  // 检查SPU是否存在
  const { data: spu } = await models.ProductSpus.get({
    filter: {
      where: { _id: { $eq: wishData.spuId._id } }
    },
    envType: "prod"
  });

  if (!spu) {
    return {
      code: 404,
      message: "商品不存在"
    };
  }

  // 如果指定了SKU，检查SKU是否存在且属于该SPU
  if (wishData.skuId) {
    const { data: sku } = await models.ProductSkus.get({
      filter: {
        where: {
          _id: { $eq: wishData.skuId._id },
          spuId: { $eq: spu.spuId._id }
        }
      },
      envType: "prod"
    });

    if (!sku) {
      return {
        code: 404,
        message: "商品规格不存在或不属于该商品"
      };
    }
  }

  // 检查是否已经存在相同的心愿单记录
  const existingWishFilter = {
    where: {
      userId: { $eq: wishData.userId._id },
      spuId: { $eq: wishData.spuId._id }
    }
  };

  if (wishData.skuId) {
    existingWishFilter.where.skuId = { $eq: wishData.skuId._id };
  } else {
    existingWishFilter.where.skuId = { $eq: null };
  }

  const { data: existingWishes } = await models.Wishes.list({
    filter: existingWishFilter,
    envType: "prod"
  });

  if (existingWishes.records && existingWishes.records.length > 0) {
    return {
      code: 400,
      message: "该商品已在心愿单中"
    };
  }

  const result = await models.Wishes.create({
    data: wishData,
    envType: "prod"
  });

  return {
    code: 200,
    message: "添加至心愿单成功",
    _wishId: result.data.id
  };
}

// 从心愿单移除
async function removeFromWishlist(_wishId) {
  if (!_wishId) {
    return {
      code: 400,
      message: "缺少必要参数: _wishId"
    };
  }

  const { data: deletedWish } = await models.Wishes.delete({
    filter: {
      where: {
        _id: { $eq: _wishId }
      }
    },
    envType: "prod"
  });

  if (!deletedWish) {
    return {
      code: 404,
      message: "心愿单记录不存在"
    };
  }

  return {
    code: 200,
    message: "从心愿单移除成功",
    data: deletedWish
  };
}

// 更新心愿单
async function updateWishlistItem(data) {
  const {
    _wishId,
    updateData
  } = data;

  if (!_wishId) {
    return {
      code: 400,
      message: "缺少必要参数: _wishId"
    };
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    return {
      code: 400,
      message: "更新数据不能为空"
    };
  }

  // 检查心愿单记录是否存在
  const { data: currentWish } = await models.Wishes.get({
    filter: {
      where: { _id: { $eq: _wishId } }
    },
    envType: "prod"
  });

  if (!currentWish) {
    return {
      code: 404,
      message: "心愿单记录不存在"
    };
  }

  // 如果更新了SKU，检查SKU是否存在且属于该SPU
  if (updateData.skuId) {
    const { data: sku } = await models.ProductSkus.get({
      filter: {
        where: {
          _id: { $eq: updateData.skuId._id },
          spuId: { $eq: currentWish.spuId._id }
        }
      },
      envType: "prod"
    });

    if (!sku) {
      return {
        code: 404,
        message: "商品规格不存在或不属于该商品"
      };
    }
  }

  // 检查是否会产生重复记录
  if (updateData.spuId || updateData.skuId) {
    const spuId = updateData.spuId || currentWish.spuId;
    const skuId = updateData.skuId || currentWish.skuId;

    const { data: existingWishes } = await models.Wishes.list({
      filter: {
        where: {
          userId: { $eq: currentWish.userId._id },
          spuId: { $eq: spuId._id },
          skuId: { $eq: skuId._id || null },
          _id: { $ne: _wishId }
        }
      },
      envType: "prod"
    });

    if (existingWishes.records && existingWishes.records.length > 0) {
      return {
        code: 400,
        message: "该商品已在心愿单中"
      };
    }
  }

  // 构建安全的更新数据
  const safeUpdateData = buildSafeUpdateData(updateData, ALLOWED_WISH_FIELDS);

  // 检查是否有有效字段需要更新
  if (Object.keys(safeUpdateData).length < 1) {
    return {
      code: 400,
      message: "没有有效的字段需要更新"
    };
  }

  // 执行更新
  const { data: updateResult } = await models.Wishes.update({
    data: safeUpdateData,
    filter: {
      where: {
        _id: { $eq: _wishId }
      }
    },
    envType: "prod"
  });

  if (updateResult.count === 0) {
    return {
      code: 500,
      message: '心愿单更新失败，未修改任何记录'
    };
  }

  // 获取更新后的心愿单信息
  const { data: updatedWish } = await models.Wishes.list({
    filter: {
      where: {
        _id: { $eq: _wishId }
      }
    },
    envType: "prod"
  });

  // 返回更新后的心愿单信息
  const wishData = updatedWish.records[0];

  return {
    code: 200,
    message: "心愿单更新成功",
    data: wishData
  };
}

// 获取单个心愿单记录
async function getWishlistItem(_wishId) {
  if (!_wishId) {
    return {
      code: 400,
      message: "缺少必要参数: _wishId"
    };
  }

  const { data: wish } = await models.Wishes.get({
    filter: {
      where: { _id: { $eq: _wishId } }
    },
    envType: "prod"
  });

  if (!wish) {
    return {
      code: 404,
      message: "心愿单记录不存在"
    };
  }

  // 关联查询商品信息
  const wishWithDetails = await populateWishWithProductDetails(wish);

  return {
    code: 200,
    message: "获取心愿单记录成功",
    data: wishWithDetails
  };
}

// 获取用户心愿单列表
async function getWishlist(userId) {
  if (!userId) {
    return {
      code: 400,
      message: "缺少必要参数: userId"
    };
  }

  // 检查用户是否存在
  const { data: user } = await models.Users.get({
    filter: {
      where: { _id: { $eq: userId._id } }
    },
    envType: "prod"
  });

  if (!user) {
    return {
      code: 404,
      message: "用户不存在"
    };
  }

  const { data: wishes } = await models.Wishes.list({
    filter: {
      where: {
        userId: { $eq: userId._id }
      },
      orderBy: {
        createdAt: 'desc'
      }
    },
    envType: "prod"
  });

  // 为每个心愿单记录关联商品详情
  const wishesWithDetails = await Promise.all(
    (wishes.records || []).map(wish => populateWishWithProductDetails(wish))
  );

  return {
    code: 200,
    message: "获取心愿单列表成功",
    data: {
      wishes: wishesWithDetails,
      total: wishesWithDetails.length
    }
  };
}

// 检查商品是否在心愿单中
async function checkInWishlist(data) {
  const { userId, spuId, skuId } = data;

  if (!userId || !spuId) {
    return {
      code: 400,
      message: "缺少必要参数: userId 或 spuId"
    };
  }

  const filter = {
    where: {
      userId: { $eq: userId._id },
      spuId: { $eq: spuId._id }
    }
  };

  if (skuId) {
    filter.where.skuId = { $eq: skuId._id };
  } else {
    filter.where.skuId = { $eq: null };
  }

  const { data: wishes } = await models.Wishes.list({
    filter,
    envType: "prod"
  });

  const isInWishlist = wishes.records && wishes.records.length > 0;
  const wishItem = isInWishlist ? wishes.records[0] : null;

  return {
    code: 200,
    message: "检查成功",
    data: {
      isInWishlist,
      wishItem
    }
  };
}

// 为心愿单记录关联商品详情
async function populateWishWithProductDetails(wish) {
  const result = { ...wish };

  try {
    // 获取SPU信息 - 只选择必要字段
    const { data: spu } = await models.ProductSpus.get({
      filter: {
        where: { _id: { $eq: wish.spuId } }
      },
      select: {
        _id: true,
        name: true,
        referencePrice: true,
        mainImages: true
      },
      envType: "prod"
    });

    if (spu) {
      result.spuInfo = spu;
    }

    // 如果指定了SKU，获取SKU信息 - 只选择必要字段
    if (wish.skuId) {
      const { data: sku } = await models.ProductSkus.get({
        filter: {
          where: { _id: { $eq: wish.skuId } }
        },
        select: {
          _id: true,
          nameCN: true,
          nameEN: true, // 添加英文名
          price: true,
          skuMainImages: true,
          subSeries: true,
          materialId: true // 添加材质ID
        },
        envType: "prod"
      });

      if (sku) {
        // 如果SKU有子系列，查询子系列名称
        if (sku.subSeries && sku.subSeries._id) {
          const { data: subSeries } = await models.SubSeries.get({
            filter: {
              where: { _id: { $eq: sku.subSeries._id } }
            },
            select: {
              _id: true,
              name: true,
              nameEN: true,
            },
            envType: "prod"
          });

          if (subSeries) {
            sku.subSeriesInfo = {
              _id: subSeries._id,
              name: subSeries.name,
              nameEN: subSeries.nameEN
            };
          }
        }

        // 构建 skuInfo 对象（不包含 materialId，因为材质信息单独返回）
        result.skuInfo = {
          _id: sku._id,
          skuId: sku.skuId,
          nameCN: sku.nameCN,
          nameEN: sku.nameEN,
          price: sku.price,
          skuMainImages: sku.skuMainImages || [],
          subSeriesInfo: sku.subSeriesInfo
        };

        // 如果SKU有材质ID，单独查询材质信息（参考购物车的实现方式）
        if (sku.materialId) {
          const materialIdValue = sku.materialId._id || sku.materialId;
          if (materialIdValue) {
            const { data: materialData } = await models.Materials.get({
              filter: {
                where: { _id: { $eq: materialIdValue } }
              },
              select: {
                _id: true,
                nameCN: true
              },
              envType: "prod"
            });

            if (materialData) {
              result.materialInfo = {
                _id: materialData._id,
                nameCN: materialData.nameCN
              };
            }
          }
        }
      }
    }

    // 获取用户信息（可选）- 只选择必要字段
    // const { data: user } = await models.Users.get({
    //   filter: {
    //     where: { _id: { $eq: wish.userId } }
    //   },
    //   select: {
    //     _id: true,
    //     lastName: true,
    //     firstName: true
    //   },
    //   envType: "prod"
    // });

    // if (user) {
    //   result.userInfo = {
    //     _id: user._id,
    //     lastName: user.lastName,
    //     firstName: user.firstName
    //   };
    // }
  } catch (error) {
    console.error('关联商品详情失败:', error);
  }

  return result;
}
// 构建安全的更新数据
function buildSafeUpdateData(inputData, allowedFields) {
  const updateData = {};

  allowedFields.forEach(field => {
    if (inputData[field] !== undefined) {
      updateData[field] = inputData[field];
    }
  });

  return updateData;
}