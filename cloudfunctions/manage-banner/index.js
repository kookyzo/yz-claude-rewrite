const { init } = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database()
const client = init(cloud);
const models = client.models;

// 允许更新的Banner字段
const ALLOWED_BANNER_FIELDS = [
  'content', 'isEnabled', 'imgUrl', 'jumpUrl', 'sort'
];

exports.main = async (event, context) => {
  const { action, data } = event;
  const { _bannerId, bannerId, content, isEnabled, imgUrl, jumpUrl, sort } = data || {};
  
  const handleError = (err) => {
    console.error('Error:', err);
    return { code: 500, message: err.message };
  };

  try {
    switch (action) {
      case 'add':
        return await addBanner(data);
      
      case 'remove':
        return await removeBanner(_bannerId);
      
      case 'update':
        return await updateBanner(data);
      
      case 'get':
        return await getBanner(_bannerId);
      
      case 'list':
        return await getBannerList(data?.filterEnabled);
      
      case 'batchUpdateStatus':
        return await batchUpdateBannerStatus(data);
      
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

// 添加Banner
async function addBanner(bannerData) {
  if (!bannerData) {
    return {
      code: 400,
      message: "缺少Banner数据"
    };
  }

  // 必填字段验证
  const requiredFields = ['imgUrl'];
  for (const field of requiredFields) {
    if (!bannerData[field]) {
      return {
        code: 400,
        message: `缺少必填字段: ${field}`
      };
    }
  }

  // 检查图片URL是否已存在（可选，根据业务需求）
  const { data: existingBanners } = await models.Banner.list({
    filter: {
      where: {
        imgUrl: { $eq: bannerData.imgUrl }
      }
    },
    envType: "prod"
  });

  if (existingBanners.records && existingBanners.records.length > 0) {
    return {
      code: 400,
      message: "该图片URL已存在"
    };
  }

  // 生成顺序bannerId
  let nextBannerId;
  try {
    // 获取所有现有Banner，按bannerId降序排列
    const { data: allBanners } = await models.Banner.list({
      orderBy: [{ bannerId: 'desc' }],
      select: {
        bannerId: true
      },
      envType: "prod"
    });

    if (allBanners.records && allBanners.records.length > 0) {
      // 找到最大的bannerId
      const maxBannerId = allBanners.records[0].bannerId;
      
      // 提取数字部分并加1
      const maxNumber = parseInt(maxBannerId.replace('B', ''), 10);
      const nextNumber = maxNumber + 1;
      
      // 格式化为B+四位数字
      nextBannerId = 'B' + nextNumber.toString().padStart(4, '0');
    } else {
      // 如果没有现有Banner，从B1001开始
      nextBannerId = 'B1001';
    }
  } catch (error) {
    console.error('生成bannerId失败:', error);
    // 如果查询失败，使用时间戳作为备选方案
    nextBannerId = 'B' + Date.now().toString().slice(-4);
  }

  // 设置默认值
  const defaultBannerData = {
    bannerId: nextBannerId,
    sort: bannerData.sort || 999,
    isEnabled: bannerData.isEnabled !== undefined ? bannerData.isEnabled : true,
    content: bannerData.content || '',
    jumpUrl: bannerData.jumpUrl || '',
    imgUrl: bannerData.imgUrl
  };

  const finalBannerData = {
    ...defaultBannerData,
    ...bannerData
  };

  const result = await models.Banner.create({
    data: finalBannerData,
    envType: "prod"
  });

  return {
    code: 200,
    message: "Banner创建成功",
    _bannerId: result.data.id
  };
}

// 删除Banner
async function removeBanner(_bannerId) {
  if (!_bannerId) {
    return {
      code: 400,
      message: "缺少必要参数: _bannerId"
    };
  }

  // 检查Banner是否存在
  const { data: existingBanner } = await models.Banner.get({
    filter: {
      where: { _id: { $eq: _bannerId } }
    },
    envType: "prod"
  });

  if (!existingBanner) {
    return {
      code: 404,
      message: "Banner不存在"
    };
  }

  const { data: deletedBanner } = await models.Banner.delete({
    filter: {
      where: { 
        _id: { $eq: _bannerId }
      }
    },
    envType: "prod"
  });

  if (!deletedBanner) {
    return {
      code: 500,
      message: "Banner删除失败"
    };
  }

  return {
    code: 200,
    message: "Banner删除成功",
    data: deletedBanner
  };
}

// 更新Banner
async function updateBanner(data) {
  const {
    _bannerId,
    updateData
  } = data;

  if (!_bannerId) {
    return {
      code: 400,
      message: "缺少必要参数: _bannerId"
    };
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    return {
      code: 400,
      message: "更新数据不能为空"
    };
  }

  // 如果更新图片URL，检查是否重复
  if (updateData.imgUrl) {
    const { data: existingBanners } = await models.Banner.list({
      filter: {
        where: {
          imgUrl: { $eq: updateData.imgUrl },
          _id: { $ne: _bannerId }
        }
      },
      envType: "prod"
    });

    if (existingBanners.records && existingBanners.records.length > 0) {
      return {
        code: 400,
        message: "该图片URL已存在"
      };
    }
  }

  // 构建安全的更新数据
  const safeUpdateData = buildSafeUpdateData(updateData, ALLOWED_BANNER_FIELDS);

  // 检查是否有有效字段需要更新
  if (Object.keys(safeUpdateData).length < 1) {
    return {
      code: 400,
      message: "没有有效的字段需要更新"
    };
  }

  // 执行更新
  const { data: updateResult } = await models.Banner.update({
    data: {
      ...safeUpdateData,
    },
    filter: {
      where: {
        _id: { $eq: _bannerId }
      }
    },
    envType: "prod"
  });

  if (updateResult.count === 0) {
    return {
      code: 500,
      message: 'Banner更新失败，未修改任何记录'
    };
  }

  // 获取更新后的Banner信息
  const { data: updatedBanner } = await models.Banner.list({
    filter: {
      where: {
        _id: { $eq: _bannerId }
      }
    },
    envType: "prod"
  });

  // 返回更新后的Banner信息
  const bannerData = updatedBanner.records[0];

  return {
    code: 200,
    message: "Banner更新成功",
    data: bannerData
  };
}

// 获取单个Banner
async function getBanner(_bannerId) {
  if (!_bannerId) {
    return {
      code: 400,
      message: "缺少必要参数: _bannerId"
    };
  }

  const { data: banner } = await models.Banner.get({
    filter: {
      where: { _id: { $eq: _bannerId } }
    },
    envType: "prod"
  });

  if (!banner) {
    return {
      code: 404,
      message: "Banner不存在"
    };
  }

  return {
    code: 200,
    message: "获取Banner成功",
    data: banner
  };
}

// 获取Banner列表
async function getBannerList(filterEnabled = false) {
  let filter = {
    orderBy: {
      sort: 'asc',
      createdAt: 'desc'
    }
  };

  if (filterEnabled) {
    filter.where = {
      isEnabled: { $eq: true }
    };
  }

  const { data: banners } = await models.Banner.list({
    filter,
    envType: "prod"
  });

  return {
    code: 200,
    message: "获取Banner列表成功",
    data: {
      banners: banners.records || [],
      total: banners.records ? banners.records.length : 0
    }
  };
}

// 批量更新Banner状态
async function batchUpdateBannerStatus(data) {
  const { bannerIds, isEnabled } = data;

  if (!bannerIds || !Array.isArray(bannerIds) || bannerIds.length === 0) {
    return {
      code: 400,
      message: "缺少必要参数: bannerIds（必须为数组）"
    };
  }

  if (isEnabled === undefined) {
    return {
      code: 400,
      message: "缺少必要参数: isEnabled"
    };
  }

  try {
    // 批量更新状态
    const { data: updateResult } = await models.Banner.update({
      data: {
        isEnabled: isEnabled
      },
      filter: {
        where: {
          _id: { $in: bannerIds }
        }
      },
      envType: "prod"
    });

    if (updateResult.count === 0) {
      return {
        code: 500,
        message: '批量更新Banner状态失败，未修改任何记录'
      };
    }

    return {
      code: 200,
      message: `批量${isEnabled ? '启用' : '禁用'}Banner成功`,
      data: {
        updatedCount: updateResult.count,
        bannerIds: bannerIds
      }
    };
  } catch (error) {
    console.error('批量更新Banner状态失败:', error);
    return {
      code: 500,
      message: '批量更新Banner状态失败: ' + error.message
    };
  }
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