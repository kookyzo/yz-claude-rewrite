const { init } = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database()
const client = init(cloud);
const models = client.models;

// 允许更新的尺寸字段
const ALLOWED_SIZE_FIELDS = [
  'category', 'type', 'standard', 'value', 'sizeNum', 'sortNum', 'isEnabled'
];

exports.main = async (event, context) => {
  const { action, data } = event;
  const { _sizeId, sizeId, category, type, standard, value, isEnabled } = data || {};

  const handleError = (err) => {
    console.error('Error:', err);
    return { code: 500, message: err.message };
  };

  try {
    switch (action) {
      case 'add':
        return await addProductSize(data);

      case 'remove':
        return await removeProductSize(_sizeId);

      case 'update':
        return await updateProductSize(data);

      case 'get':
        return await getProductSize(_sizeId);

      case 'list':
        return await getProductSizeList(data?.categoryId, data?.filterEnabled);

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

// 添加尺寸
async function addProductSize(sizeData) {
  if (!sizeData) {
    return {
      code: 400,
      message: "缺少尺寸数据"
    };
  }

  // 必填字段验证
  const requiredFields = ['category', 'type', 'standard', 'sizeNum', 'value'];
  for (const field of requiredFields) {
    if (!sizeData[field]) {
      return {
        code: 400,
        message: `缺少必填字段: ${field}`
      };
    }
  }

  // 检查分类是否存在
  const { data: category } = await models.Categories.get({
    filter: {
      where: { _id: { $eq: sizeData.category._id } }
    },
    envType: "prod"
  });

  if (!category) {
    return {
      code: 404,
      message: "关联的分类不存在"
    };
  }

  // 检查相同分类下是否已存在相同类型和值的尺寸
  const { data: existingSizes } = await models.ProductSizes.list({
    filter: {
      where: {
        'category._id': { $eq: sizeData.category._id },
        type: { $eq: sizeData.type },
        sizeNum: { $eq: sizeData.sizeNum },
        value: { $eq: sizeData.value }
      }
    },
    envType: "prod"
  });

  if (existingSizes.records && existingSizes.records.length > 0) {
    return {
      code: 400,
      message: "该分类下已存在相同类型和值的尺寸"
    };
  }

  // 生成顺序sizeId
  let nextSizeId;
  try {
    // 获取所有现有尺寸，按sizeId降序排列
    const { data: allSizes } = await models.ProductSizes.list({
      orderBy: [{ sizeId: 'desc' }],
      select: {
        sizeId: true
      },
      envType: "prod"
    });

    if (allSizes.records && allSizes.records.length > 0) {
      // 找到最大的sizeId
      const maxSizeId = allSizes.records[0].sizeId;

      // 提取数字部分并加1
      const maxNumber = parseInt(maxSizeId.replace('S', ''), 10);
      const nextNumber = maxNumber + 1;

      // 格式化为S+四位数字
      nextSizeId = 'S' + nextNumber.toString().padStart(4, '0');
    } else {
      // 如果没有现有尺寸，从S1001开始
      nextSizeId = 'S1001';
    }
  } catch (error) {
    console.error('生成sizeId失败:', error);
    // 如果查询失败，使用时间戳作为备选方案
    nextSizeId = 'S' + Date.now().toString().slice(-4);
  }

  // 设置默认值
  const defaultSizeData = {
    sizeId: nextSizeId,
    sortNum: sizeData.sortNum || 999,
    isEnabled: sizeData.isEnabled !== undefined ? sizeData.isEnabled : true,
  };

  const finalSizeData = {
    ...defaultSizeData,
    ...sizeData
  };

  const result = await models.ProductSizes.create({
    data: finalSizeData,
    envType: "prod"
  });

  return {
    code: 200,
    message: "尺寸创建成功",
    _sizeId: result.data.id
  };
}

// 删除尺寸
async function removeProductSize(_sizeId) {
  if (!_sizeId) {
    return {
      code: 400,
      message: "缺少必要参数: _sizeId"
    };
  }

  // 检查是否有产品关联此尺寸
  const { data: relatedProducts } = await models.ProductSkus.list({
    filter: {
      where: {
        sizeId: { $eq: _sizeId }
      }
    },
    envType: "prod"
  });

  if (relatedProducts.records && relatedProducts.records.length > 0) {
    return {
      code: 409,
      message: "该尺寸已被商品使用，无法删除"
    };
  }

  const { data: deletedSize } = await models.ProductSizes.delete({
    filter: {
      where: {
        _id: { $eq: _sizeId }
      }
    },
    envType: "prod"
  });

  if (!deletedSize) {
    return {
      code: 404,
      message: "尺寸不存在"
    };
  }

  return {
    code: 200,
    message: "尺寸删除成功",
    data: deletedSize
  };
}

// 更新尺寸
async function updateProductSize(data) {
  const {
    _sizeId,
    updateData
  } = data;

  if (!_sizeId) {
    return {
      code: 400,
      message: "缺少必要参数: _sizeId"
    };
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    return {
      code: 400,
      message: "更新数据不能为空"
    };
  }

  // 如果更新了分类、类型或值，检查是否重复
  if (updateData.category || updateData.type || updateData.sizeNum) {
    const { data: currentSize } = await models.ProductSizes.get({
      filter: {
        where: { _id: { $eq: _sizeId } }
      },
      envType: "prod"
    });

    if (!currentSize) {
      return {
        code: 404,
        message: "尺寸不存在"
      };
    }

    const category = updateData.category || currentSize.category;
    const type = updateData.type || currentSize.type;
    const sizeNum = updateData.sizeNum || currentSize.sizeNum;
    //  const value =updateData.value || currentSize.value;

    // 提取分类ID（支持对象格式 { _id: "xxx" } 或字符串格式）
    const categoryId = typeof category === 'string' ? category : (category?._id || null);

    const { data: existingSizes } = await models.ProductSizes.list({
      filter: {
        where: {
          category: { $eq: categoryId },
          type: { $eq: type },
          sizeNum: { $eq: sizeNum },
          // value: { $eq: value },
          _id: { $ne: _sizeId }
        }
      },
      envType: "prod"
    });

    if (existingSizes.records && existingSizes.records.length > 0) {
      return {
        code: 400,
        message: "该分类下已存在相同类型和值的尺寸"
      };
    }
  }

  // 构建安全的更新数据
  const safeUpdateData = buildSafeUpdateData(updateData, ALLOWED_SIZE_FIELDS);

  // 检查是否有有效字段需要更新
  if (Object.keys(safeUpdateData).length < 1) {
    return {
      code: 400,
      message: "没有有效的字段需要更新"
    };
  }

  // 执行更新
  const { data: updateResult } = await models.ProductSizes.update({
    data: {
      ...safeUpdateData,
    },
    filter: {
      where: {
        _id: { $eq: _sizeId }
      }
    },
    envType: "prod"
  });

  if (updateResult.count === 0) {
    return {
      code: 500,
      message: '尺寸更新失败，未修改任何记录'
    };
  }

  // 获取更新后的尺寸信息
  const { data: updatedSize } = await models.ProductSizes.list({
    filter: {
      where: {
        _id: { $eq: _sizeId }
      }
    },
    envType: "prod"
  });

  // 返回更新后的尺寸信息
  const sizeData = updatedSize.records[0];

  return {
    code: 200,
    message: "尺寸更新成功",
    data: sizeData
  };
}

// 获取单个尺寸
async function getProductSize(_sizeId) {
  if (!_sizeId) {
    return {
      code: 400,
      message: "缺少必要参数: _sizeId"
    };
  }

  const { data: size } = await models.ProductSizes.get({
    filter: {
      where: { _id: { $eq: _sizeId } }
    },
    envType: "prod"
  });

  if (!size) {
    return {
      code: 404,
      message: "尺寸不存在"
    };
  }

  return {
    code: 200,
    message: "获取尺寸成功",
    data: size
  };
}

// 获取尺寸列表
async function getProductSizeList(category = null, filterEnabled = false) {
  let filter = {
    orderBy: {
      sortNum: 'asc',
      createdAt: 'desc'
    }
  };

  if (category) {
    // 支持两种格式：字符串ID 或 对象（有 _id 属性）
    const categoryId = typeof category === 'string' ? category : (category._id || null);
    if (categoryId) {
      filter.where = {
        'category._id': { $eq: categoryId }
      };
    }
  }

  if (filterEnabled) {
    filter.where = {
      ...filter.where,
      isEnabled: { $eq: true }
    };
  }

  const { data: sizes } = await models.ProductSizes.list({
    filter,
    envType: "prod"
  });

  return {
    code: 200,
    message: "获取尺寸列表成功",
    data: {
      sizes: sizes.records || [],
      total: sizes.records ? sizes.records.length : 0
    }
  };
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