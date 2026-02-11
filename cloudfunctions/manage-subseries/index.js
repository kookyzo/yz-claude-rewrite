const { init } = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database()
const client = init(cloud);
const models = client.models;

// 允许更新的子系列字段
const ALLOWED_SUBSERIES_FIELDS = [
  'parentSeriesId', 'name', 'displayImage', 'introduction', 'sortNum', 'isEnabled'
];

exports.main = async (event, context) => {
  const { action, data } = event;
  const { _subSeriesId, subSeriesId, parentSeriesId, name, isEnabled, displayImage } = data || {};

  const handleError = (err) => {
    console.error('Error:', err);
    return { code: 500, message: err.message };
  };

  try {
    switch (action) {
      case 'add':
        return await addSubSeries(data);

      case 'remove':
        return await removeSubSeries(_subSeriesId);

      case 'update':
        return await updateSubSeries(data);

      case 'get':
        return await getSubSeries(_subSeriesId);

      case 'list':
        return await getSubSeriesList(data?.parentSeriesId, data?.filterEnabled);

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

// 添加子系列
async function addSubSeries(subSeriesData) {
  if (!subSeriesData) {
    return {
      code: 400,
      message: "缺少子系列数据"
    };
  }

  // 必填字段验证
  const requiredFields = ['parentSeriesId', 'name'];
  for (const field of requiredFields) {
    if (!subSeriesData[field]) {
      return {
        code: 400,
        message: `缺少必填字段: ${field}`
      };
    }
  }

  // 检查父系列是否存在
  const { data: parentSeries } = await models.Series.get({
    filter: {
      where: { _id: { $eq: subSeriesData.parentSeriesId._id } }
    },
    envType: "prod"
  });

  if (!parentSeries) {
    return {
      code: 404,
      message: "关联的父系列不存在"
    };
  }

  // 检查相同父系列下是否已存在相同名称的子系列
  const { data: existingSubSeries } = await models.SubSeries.list({
    filter: {
      where: {
        parentSeriesId: { $eq: subSeriesData.parentSeriesId._id },
        name: { $eq: subSeriesData.name }
      }
    },
    envType: "prod"
  });

  if (existingSubSeries.records && existingSubSeries.records.length > 0) {
    return {
      code: 400,
      message: "该父系列下已存在相同名称的子系列"
    };
  }

  // 生成顺序subSeriesId
  let nextSubSeriesId;
  try {
    // 获取所有现有子系列，按subSeriesId降序排列
    const { data: allSubSeries } = await models.SubSeries.list({
      orderBy: [{ subSeriesId: 'desc' }],
      select: {
        subSeriesId: true
      },
      envType: "prod"
    });

    if (allSubSeries.records && allSubSeries.records.length > 0) {
      // 找到最大的subSeriesId
      const maxSubSeriesId = allSubSeries.records[0].subSeriesId;

      // 提取数字部分并加1
      const maxNumber = parseInt(maxSubSeriesId.replace('SS', ''), 10);
      const nextNumber = maxNumber + 1;

      // 格式化为SS+四位数字
      nextSubSeriesId = 'SS' + nextNumber.toString().padStart(4, '0');
    } else {
      // 如果没有现子系列，从SS1001开始
      nextSubSeriesId = 'SS1001';
    }
  } catch (error) {
    console.error('生成subSeriesId失败:', error);
    // 如果查询失败，使用时间戳作为备选方案
    nextSubSeriesId = 'SS' + Date.now().toString().slice(-4);
  }

  // 设置默认值
  const defaultSubSeriesData = {
    subSeriesId: nextSubSeriesId,
    sortNum: subSeriesData.sortNum || 999,
    isEnabled: subSeriesData.isEnabled !== undefined ? subSeriesData.isEnabled : true,
  };

  const finalSubSeriesData = {
    ...defaultSubSeriesData,
    ...subSeriesData
  };

  const result = await models.SubSeries.create({
    data: finalSubSeriesData,
    envType: "prod"
  });

  return {
    code: 200,
    message: "子系列创建成功",
    _subSeriesId: result.data.id
  };
}

// 删除子系列
async function removeSubSeries(_subSeriesId) {
  if (!_subSeriesId) {
    return {
      code: 400,
      message: "缺少必要参数: _subSeriesId"
    };
  }

  // 检查是否有产品关联此子系列
  const { data: relatedProducts } = await models.ProductSpus.list({
    filter: {
      where: {
        subSeries: { $eq: _subSeriesId }
      }
    },
    envType: "prod"
  });

  if (relatedProducts.records && relatedProducts.records.length > 0) {
    return {
      code: 409,
      message: "该子系列下存在商品，无法删除"
    };
  }

  const { data: deletedSubSeries } = await models.SubSeries.delete({
    filter: {
      where: {
        _id: { $eq: _subSeriesId }
      }
    },
    envType: "prod"
  });

  if (!deletedSubSeries) {
    return {
      code: 404,
      message: "子系列不存在"
    };
  }

  return {
    code: 200,
    message: "子系列删除成功",
    data: deletedSubSeries
  };
}

// 更新子系列
async function updateSubSeries(data) {
  const {
    _subSeriesId,
    updateData
  } = data;

  if (!_subSeriesId) {
    return {
      code: 400,
      message: "缺少必要参数: _subSeriesId"
    };
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    return {
      code: 400,
      message: "更新数据不能为空"
    };
  }

  // 如果更新了父系列或名称，检查是否重复
  if (updateData.parentSeriesId || updateData.name) {
    const { data: currentSubSeries } = await models.SubSeries.get({
      filter: {
        where: { _id: { $eq: _subSeriesId }, }
      },
      select: {
        parentSeriesId: true,
        $master: true
      },
      envType: "prod"
    });

    if (!currentSubSeries) {
      return {
        code: 404,
        message: "子系列不存在"
      };
    }
    console.log(updateData.parentSeriesId);
    console.log(currentSubSeries.parentSeriesId);
    const parentSeriesId = updateData.parentSeriesId || currentSubSeries.parentSeriesId;
    const name = updateData.name || currentSubSeries.name;

    const { data: existingSubSeries } = await models.SubSeries.list({
      filter: {
        where: {
          parentSeriesId: { $eq: parentSeriesId._id },
          name: { $eq: name },
          _id: { $ne: _subSeriesId }
        }
      },
      envType: "prod"
    });

    if (existingSubSeries.records && existingSubSeries.records.length > 0) {
      return {
        code: 400,
        message: "该父系列下已存在相同名称的子系列"
      };
    }
  }

  // 构建安全的更新数据
  const safeUpdateData = buildSafeUpdateData(updateData, ALLOWED_SUBSERIES_FIELDS);

  // 检查是否有有效字段需要更新
  if (Object.keys(safeUpdateData).length < 1) {
    return {
      code: 400,
      message: "没有有效的字段需要更新"
    };
  }

  // 执行更新
  const { data: updateResult } = await models.SubSeries.update({
    data: {
      ...safeUpdateData,
    },
    filter: {
      where: {
        _id: { $eq: _subSeriesId }
      }
    },
    envType: "prod"
  });

  if (updateResult.count === 0) {
    return {
      code: 500,
      message: '子系列更新失败，未修改任何记录'
    };
  }

  // 获取更新后的子系列信息
  const { data: updatedSubSeries } = await models.SubSeries.list({
    filter: {
      where: {
        _id: { $eq: _subSeriesId }
      }
    },
    envType: "prod"
  });

  // 返回更新后的子系列信息
  const subSeriesData = updatedSubSeries.records[0];

  return {
    code: 200,
    message: "子系列更新成功",
    data: subSeriesData
  };
}

// 获取单个子系列
async function getSubSeries(_subSeriesId) {
  if (!_subSeriesId) {
    return {
      code: 400,
      message: "缺少必要参数: _subSeriesId"
    };
  }

  const { data: subSeries } = await models.SubSeries.get({
    filter: {
      where: { _id: { $eq: _subSeriesId } }
    },
    envType: "prod"
  });

  if (!subSeries) {
    return {
      code: 404,
      message: "子系列不存在"
    };
  }

  return {
    code: 200,
    message: "获取子系列成功",
    data: subSeries
  };
}

// 获取子系列列表
async function getSubSeriesList(parentSeriesId = null, filterEnabled = false) {
  let filter = {
    orderBy: {
      sortNum: 'desc'  // 按照 sortNum 降序排列
    }
  };

  if (parentSeriesId) {
    filter.where = {
      parentSeriesId: { $eq: parentSeriesId._id }
    };
  }

  if (filterEnabled) {
    filter.where = {
      ...filter.where,
      isEnabled: { $eq: true }
    };
  }

  const { data: subSeriesList } = await models.SubSeries.list({
    filter,
    envType: "prod"
  });

  return {
    code: 200,
    message: "获取子系列列表成功",
    data: {
      subSeries: subSeriesList.records || [],
      total: subSeriesList.records ? subSeriesList.records.length : 0
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