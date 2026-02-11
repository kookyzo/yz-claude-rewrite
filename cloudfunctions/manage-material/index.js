const { init } = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database()
const client = init(cloud);
const models = client.models;

// 允许更新的材质字段
const ALLOWED_MATERIAL_FIELDS = [
  'nameCN', 'materialImage', 'sortNum', 'isEnabled', 'description'
];

exports.main = async (event, context) => {
  const { action, data } = event;
  const { _materialId, materialId, nameCN, materialImage, sortNum, isEnabled, description } = data || {};
  
  const handleError = (err) => {
    console.error('Error:', err);
    return { code: 500, message: err.message };
  };

  try {
    switch (action) {
      case 'add':
        return await addMaterial(data);

      case 'remove':
        return await removeMaterial(_materialId);

      case 'update':
        return await updateMaterial(data);

      case 'get':
        return await getMaterial(_materialId);

      case 'list':
        return await getMaterialList(data?.filterEnabled);

      case 'listByIds':
        return await getMaterialListByIds(data);

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

// 添加材质
async function addMaterial(materialData) {
  if (!materialData) {
    return {
      code: 400,
      message: "缺少材质数据"
    };
  }

  // 必填字段验证
  const requiredFields = ['nameCN'];
  for (const field of requiredFields) {
    if (!materialData[field]) {
      return {
        code: 400,
        message: `缺少必填字段: ${field}`
      };
    }
  }

  // 检查材质名称是否已存在
  const { data: existingMaterials } = await models.Materials.list({
    filter: {
      where: {
        nameCN: { $eq: materialData.nameCN }
      }
    },
    envType: "prod"
  });

  if (existingMaterials.records && existingMaterials.records.length > 0) {
    return {
      code: 400,
      message: "材质名称已存在"
    };
  }

  // 生成顺序materialId
  let nextMaterialId;
  try {
    // 获取所有现有材质，按materialId降序排列
    const { data: allMaterials } = await models.Materials.list({
      orderBy: [{ materialId: 'desc' }],
      select: {
        materialId: true
      },
      envType: "prod"
    });

    if (allMaterials.records && allMaterials.records.length > 0) {
      // 找到最大的materialId
      const maxMaterialId = allMaterials.records[0].materialId;
      
      // 提取数字部分并加1
      const maxNumber = parseInt(maxMaterialId.replace('M', ''), 10);
      const nextNumber = maxNumber + 1;
      
      // 格式化为M+四位数字
      nextMaterialId = 'M' + nextNumber.toString().padStart(4, '0');
    } else {
      // 如果没有现有材质，从M1001开始
      nextMaterialId = 'M1001';
    }
  } catch (error) {
    console.error('生成materialId失败:', error);
    // 如果查询失败，使用时间戳作为备选方案
    nextMaterialId = 'M' + Date.now().toString().slice(-4);
  }

  // 设置默认值
  const defaultMaterialData = {
    materialId: nextMaterialId,
    sortNum: materialData.sortNum || 999,
    isEnabled: materialData.isEnabled !== undefined ? materialData.isEnabled : true,
  };

  const finalMaterialData = {
    ...defaultMaterialData,
    ...materialData
  };

  const result = await models.Materials.create({
    data: finalMaterialData,
    envType: "prod"
  });

  return {
    code: 200,
    message: "材质创建成功",
    _materialId: result.data.id
  };
}

// 删除材质
async function removeMaterial(_materialId) {
  if (!_materialId) {
    return {
      code: 400,
      message: "缺少必要参数: _materialId"
    };
  }

  // 检查是否有产品关联此材质
  const { data: relatedProducts } = await models.ProductSkus.list({
    filter: {
      where: {
        materialId: { $eq: _materialId }
      }
    },
    envType: "prod"
  });

  if (relatedProducts.records && relatedProducts.records.length > 0) {
    return {
      code: 409,
      message: "该材质已被商品使用，无法删除"
    };
  }

  const { data: deletedMaterial } = await models.Materials.delete({
    filter: {
      where: { 
        _id: { $eq: _materialId }
      }
    },
    envType: "prod"
  });

  if (!deletedMaterial) {
    return {
      code: 404,
      message: "材质不存在"
    };
  }

  return {
    code: 200,
    message: "材质删除成功",
    data: deletedMaterial
  };
}

// 更新材质
async function updateMaterial(data) {
  const {
    _materialId,
    updateData
  } = data;

  if (!_materialId) {
    return {
      code: 400,
      message: "缺少必要参数: _materialId"
    };
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    return {
      code: 400,
      message: "更新数据不能为空"
    };
  }

  // 如果更新材质名称，检查是否重复
  if (updateData.nameCN) {
    const { data: existingMaterials } = await models.Materials.list({
      filter: {
        where: {
          nameCN: { $eq: updateData.nameCN },
          _id: { $ne: _materialId }
        }
      },
      envType: "prod"
    });

    if (existingMaterials.records && existingMaterials.records.length > 0) {
      return {
        code: 400,
        message: "材质名称已存在"
      };
    }
  }

  // 构建安全的更新数据
  const safeUpdateData = buildSafeUpdateData(updateData, ALLOWED_MATERIAL_FIELDS);

  // 检查是否有有效字段需要更新
  if (Object.keys(safeUpdateData).length < 1) {
    return {
      code: 400,
      message: "没有有效的字段需要更新"
    };
  }

  // 执行更新
  const { data: updateResult } = await models.Materials.update({
    data: {
      ...safeUpdateData,
    },
    filter: {
      where: {
        _id: { $eq: _materialId }
      }
    },
    envType: "prod"
  });

  if (updateResult.count === 0) {
    return {
      code: 500,
      message: '材质更新失败，未修改任何记录'
    };
  }

  // 获取更新后的材质信息
  const { data: updatedMaterial } = await models.Materials.list({
    filter: {
      where: {
        _id: { $eq: _materialId }
      }
    },
    envType: "prod"
  });

  // 返回更新后的材质信息
  const materialData = updatedMaterial.records[0];

  return {
    code: 200,
    message: "材质更新成功",
    data: materialData
  };
}

// 获取单个材质
async function getMaterial(_materialId) {
  if (!_materialId) {
    return {
      code: 400,
      message: "缺少必要参数: _materialId"
    };
  }

  const { data: material } = await models.Materials.get({
    filter: {
      where: { _id: { $eq: _materialId } }
    },
    envType: "prod"
  });

  if (!material) {
    return {
      code: 404,
      message: "材质不存在"
    };
  }

  return {
    code: 200,
    message: "获取材质成功",
    data: material
  };
}

// 获取材质列表
async function getMaterialList(filterEnabled = false) {
  let filter = {
    orderBy: {
      sortNum: 'asc',
      createdAt: 'desc'
    }
  };

  if (filterEnabled) {
    filter.where = {
      isEnabled: { $eq: true }
    };
  }

  const { data: materials } = await models.Materials.list({
    filter,
    envType: "prod"
  });

  return {
    code: 200,
    message: "获取材质列表成功",
    data: {
      materials: materials.records || [],
      total: materials.records ? materials.records.length : 0
    }
  };
}

// 根据ID列表获取材质
async function getMaterialListByIds(data) {
  const { ids } = data;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return {
      code: 400,
      message: '参数错误：ids 必须是非空数组',
      data: null
    };
  }

  const _ = db.command;
  const { data: materials } = await models.Materials.list({
    filter: {
      where: {
        _id: _.in(ids),
        isEnabled: { $eq: true } // 只返回启用的材质
      }
    },
    envType: "prod"
  });

  return {
    code: 200,
    message: '查询成功',
    data: {
      materials: materials.records || []
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