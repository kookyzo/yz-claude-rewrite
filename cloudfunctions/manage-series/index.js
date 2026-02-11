const { init } = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database()
const client = init(cloud);
const models = client.models;

// 允许更新的系列字段
const ALLOWED_SERIES_FIELDS = [
  'name', 'introduction', 'seriesId'
];

exports.main = async (event, context) => {
  const { action, data } = event;
  const { _seriesId, seriesId, name } = data || {};

  const handleError = (err) => {
    console.error('Error:', err);
    return { code: 500, message: err.message };
  };

  try {
    switch (action) {
      case 'add':
        return await addSeries(data);

      case 'remove':
        return await removeSeries(_seriesId);

      case 'update':
        return await updateSeries(data);

      case 'get':
        return await getSeries(_seriesId);

      case 'list':
        return await getSeriesList(data?.filterEnabled);

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

// 添加系列
async function addSeries(seriesData) {
  if (!seriesData) {
    return {
      code: 400,
      message: "缺少系列数据"
    };
  }

  // 必填字段验证
  const requiredFields = ['name', 'seriesId'];
  for (const field of requiredFields) {
    if (!seriesData[field]) {
      return {
        code: 400,
        message: `缺少必填字段: ${field}`
      };
    }
  }

  // 检查seriesId是否已存在
  const { data: existingSeriesById } = await models.Series.list({
    filter: {
      where: {
        seriesId: { $eq: seriesData.seriesId.trim() }
      }
    },
    envType: "prod"
  });

  if (existingSeriesById.records && existingSeriesById.records.length > 0) {
    return {
      code: 400,
      message: "系列ID已存在"
    };
  }

  // 检查name是否已存在
  const { data: existingSeriesByName } = await models.Series.list({
    filter: {
      where: {
        name: { $eq: seriesData.name.trim() }
      }
    },
    envType: "prod"
  });

  if (existingSeriesByName.records && existingSeriesByName.records.length > 0) {
    return {
      code: 400,
      message: "系列名称已存在"
    };
  }

  // 设置默认值
  const defaultSeriesData = {
    introduction: seriesData.introduction || ''
  };

  const finalSeriesData = {
    ...defaultSeriesData,
    name: seriesData.name.trim(),
    seriesId: seriesData.seriesId.trim(),
    introduction: seriesData.introduction ? seriesData.introduction.trim() : ''
  };

  const result = await models.Series.create({
    data: finalSeriesData,
    envType: "prod"
  });

  return {
    code: 200,
    message: "系列创建成功",
    _seriesId: result.data.id
  };
}

// 删除系列
async function removeSeries(_seriesId) {
  if (!_seriesId) {
    return {
      code: 400,
      message: "缺少必要参数: _seriesId"
    };
  }

  // 检查是否有子系列关联此系列
  const { data: relatedSubSeries } = await models.SubSeries.list({
    filter: {
      where: {
        parentSeriesId: { $eq: _seriesId }
      }
    },
    envType: "prod"
  });

  if (relatedSubSeries.records && relatedSubSeries.records.length > 0) {
    return {
      code: 409,
      message: "该系列下存在子系列，无法删除"
    };
  }

  const { data: deletedSeries } = await models.Series.delete({
    filter: {
      where: {
        _id: { $eq: _seriesId }
      }
    },
    envType: "prod"
  });

  if (!deletedSeries) {
    return {
      code: 404,
      message: "系列不存在"
    };
  }

  return {
    code: 200,
    message: "系列删除成功",
    data: deletedSeries
  };
}

// 更新系列
async function updateSeries(data) {
  const {
    _seriesId,
    updateData
  } = data;

  if (!_seriesId) {
    return {
      code: 400,
      message: "缺少必要参数: _seriesId"
    };
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    return {
      code: 400,
      message: "更新数据不能为空"
    };
  }

  // 如果更新了seriesId或name，检查是否重复
  if (updateData.seriesId || updateData.name) {
    const { data: currentSeries } = await models.Series.get({
      filter: {
        where: { _id: { $eq: _seriesId } }
      },
      envType: "prod"
    });

    if (!currentSeries) {
      return {
        code: 404,
        message: "系列不存在"
      };
    }

    const seriesId = updateData.seriesId ? updateData.seriesId.trim() : currentSeries.seriesId;
    const name = updateData.name ? updateData.name.trim() : currentSeries.name;

    // 检查seriesId是否与其他系列重复
    if (updateData.seriesId && seriesId !== currentSeries.seriesId) {
      const { data: existingSeriesById } = await models.Series.list({
        filter: {
          where: {
            seriesId: { $eq: seriesId },
            _id: { $ne: _seriesId }
          }
        },
        envType: "prod"
      });

      if (existingSeriesById.records && existingSeriesById.records.length > 0) {
        return {
          code: 400,
          message: "系列ID已存在"
        };
      }
    }

    // 检查name是否与其他系列重复
    if (updateData.name && name !== currentSeries.name) {
      const { data: existingSeriesByName } = await models.Series.list({
        filter: {
          where: {
            name: { $eq: name },
            _id: { $ne: _seriesId }
          }
        },
        envType: "prod"
      });

      if (existingSeriesByName.records && existingSeriesByName.records.length > 0) {
        return {
          code: 400,
          message: "系列名称已存在"
        };
      }
    }
  }

  // 构建安全的更新数据
  const safeUpdateData = buildSafeUpdateData(updateData, ALLOWED_SERIES_FIELDS);

  // 检查是否有有效字段需要更新
  if (Object.keys(safeUpdateData).length < 1) {
    return {
      code: 400,
      message: "没有有效的字段需要更新"
    };
  }

  // 处理文本字段的trim
  if (safeUpdateData.name) {
    safeUpdateData.name = safeUpdateData.name.trim();
  }
  if (safeUpdateData.seriesId) {
    safeUpdateData.seriesId = safeUpdateData.seriesId.trim();
  }
  if (safeUpdateData.introduction) {
    safeUpdateData.introduction = safeUpdateData.introduction.trim();
  }

  // 执行更新
  const { data: updateResult } = await models.Series.update({
    data: {
      ...safeUpdateData,
    },
    filter: {
      where: {
        _id: { $eq: _seriesId }
      }
    },
    envType: "prod"
  });

  if (updateResult.count === 0) {
    return {
      code: 500,
      message: '系列更新失败，未修改任何记录'
    };
  }

  // 获取更新后的系列信息
  const { data: updatedSeries } = await models.Series.list({
    filter: {
      where: {
        _id: { $eq: _seriesId }
      }
    },
    envType: "prod"
  });

  // 返回更新后的系列信息
  const seriesData = updatedSeries.records[0];

  return {
    code: 200,
    message: "系列更新成功",
    data: seriesData
  };
}

// 获取单个系列
async function getSeries(_seriesId) {
  if (!_seriesId) {
    return {
      code: 400,
      message: "缺少必要参数: _seriesId"
    };
  }

  const { data: series } = await models.Series.get({
    filter: {
      where: { _id: { $eq: _seriesId } }
    },
    envType: "prod"
  });

  if (!series) {
    return {
      code: 404,
      message: "系列不存在"
    };
  }

  return {
    code: 200,
    message: "获取系列成功",
    data: series
  };
}

// 获取系列列表
async function getSeriesList(filterEnabled = false) {
  let filter = {
    orderBy: {
      createdAt: 'desc'
    }
  };

  if (filterEnabled) {
    filter.where = {
      isEnabled: { $eq: true }
    };
  }

  const { data: seriesList } = await models.Series.list({
    filter,
    envType: "prod"
  });

  return {
    code: 200,
    message: "获取系列列表成功",
    data: {
      series: seriesList.records || [],
      total: seriesList.records ? seriesList.records.length : 0
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

