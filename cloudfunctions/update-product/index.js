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

// 允许更新的SPU字段
const ALLOWED_SPU_FIELDS = [
  'name', 'description', 'referencePrice', 'mainImages', 'detailImages',
  'tags', 'seriesId', 'category', 'materialOptions', 'isOnSale'
];

// 允许更新的SKU字段
const ALLOWED_SKU_FIELDS = [
  'nameCN', 'nameEN', 'presaleFlag', 'subSeries', 'materialId', 'sizeId', 
  'size', 'price', 'introduction', 'skuMainImages', 'skuDetailImages', 'isOnSale'
];

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

// 更新SPU信息
async function updateSpu(data) {
  const {
    _spuId,
    updateData
  } = data;

  if (!_spuId) {
    return {
      code: 400,
      message: "缺少必要参数: _spuId"
    };
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    return {
      code: 400,
      message: "更新数据不能为空"
    };
  }

  // 构建安全的更新数据
  const safeUpdateData = buildSafeUpdateData(updateData, ALLOWED_SPU_FIELDS);

  // 检查是否有有效字段需要更新
  if (Object.keys(safeUpdateData).length < 1) { 
    return {
      code: 400,
      message: "没有有效的字段需要更新"
    };
  }

  // 查找SPU
  const { data: spuList } = await models.ProductSpus.list({
    filter: {
      where: {
        _id: { $eq: _spuId }
      }
    },
    envType: "prod"
  });

  if (!spuList.records || spuList.records.length === 0) {
    return {
      code: 404,
      message: "未找到对应的SPU"
    };
  }

  const spuDoc = spuList.records[0];

  // 如果更新了材质ID列表，需要验证材质是否存在
  if (safeUpdateData.materialOptions && Array.isArray(safeUpdateData.materialOptions)) {
    // 验证材质ID是否存在
    for (const materialId of safeUpdateData.materialOptions) {
      const { data: material } = await models.Materials.get({
        filter: {
          where: { _id: { $eq: materialId } }
        },
        envType: "prod"
      });
      
      if (!material._id) {
        return {
          code: 404,
          message: `材质ID ${materialId} 不存在`
        };
      }
    }
  }

  // 执行更新
  const { data: updateResult } = await models.ProductSpus.update({
    data: {
      ...safeUpdateData,
    },
    filter: {
      where: {
        _id: { $eq: spuDoc._id }
      }
    },
    envType: "prod"
  });

  if (updateResult.count === 0) {
    return {
      code: 500,
      message: '更新失败，未修改任何记录'
    };
  }

  // 获取更新后的SPU信息
  const { data: updatedSpu } = await models.ProductSpus.list({
    filter: {
      where: {
        _id: { $eq: spuDoc._id }
      }
    },
    envType: "prod"
  });

  // 返回更新后的SPU信息
  const spuData = updatedSpu.records[0];

  return {
    code: 200,
    message: "SPU更新成功",
    data: spuData
  };
}

// 更新SKU信息
async function updateSku(data) {
  const {
    _skuId,
    updateData
  } = data;

  if (!_skuId) {
    return {
      code: 400,
      message: "缺少必要参数: _skuId"
    };
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    return {
      code: 400,
      message: "更新数据不能为空"
    };
  }

  // 构建安全的更新数据
  const safeUpdateData = buildSafeUpdateData(updateData, ALLOWED_SKU_FIELDS);

  // 检查是否有有效字段需要更新
  if (Object.keys(safeUpdateData).length < 1) {
    return {
      code: 400,
      message: "没有有效的字段需要更新"
    };
  }

  // 查找SKU
  const { data: skuList } = await models.ProductSkus.list({
    filter: {
      where: {
        _id: { $eq: _skuId }
      }
    },
    select: {
      $master: true,
      spuId: true,
      materialId: true
    },
    envType: "prod"
  });

  if (!skuList.records || skuList.records.length === 0) {
    return {
      code: 404,
      message: "未找到对应的SKU"
    };
  }

  const skuDoc = skuList.records[0];
  const oldMaterialId = skuDoc.materialId; // 保存旧材质ID
  const isMaterialUpdated = safeUpdateData.materialId !== undefined && safeUpdateData.materialId._id !== oldMaterialId._id;

  // 验证关联数据是否存在
  if (safeUpdateData.materialId) {
    const { data: material } = await models.Materials.get({
      filter: {
        where: { _id: { $eq: safeUpdateData.materialId._id } }
      },
      envType: "prod"
    });
    
    if (!material._id) {
      return {
        code: 404,
        message: "指定的材质不存在"
      };
    }
  }

  if (safeUpdateData.sizeId) {
    const { data: size } = await models.ProductSizes.get({
      filter: {
        where: { _id: { $eq: safeUpdateData.sizeId._id } }
      },
      envType: "prod"
    });
    
    if (!size._id) {
      return {
        code: 404,
        message: "指定的尺寸不存在"
      };
    }
  }

  if (safeUpdateData.subSeries) {
    const { data: subSeries } = await models.SubSeries.get({
      filter: {
        where: { _id: { $eq: safeUpdateData.subSeries._id } }
      },
      envType: "prod"
    });
    
    if (!subSeries._id) {
      return {
        code: 404,
        message: "指定的子系列不存在"
      };
    }
  }

  // 执行更新
  const { data: updateResult } = await models.ProductSkus.update({
    data: {
      ...safeUpdateData,
    },
    filter: {
      where: {
        _id: { $eq: skuDoc._id }
      }
    },
    envType: "prod"
  });

  if (updateResult.count === 0) {
    return {
      code: 500,
      message: '更新失败，未修改任何记录'
    };
  }

  // 如果更新了材质ID，需要更新SPU的材质ID列表
  if (isMaterialUpdated) {
    try {
      // 1. 获取当前SPU的所有SKU材质ID
      const { data: allSkus } = await models.ProductSkus.list({
        filter: {
          where: {
            spuId: { $eq: skuDoc.spuId._id }
          }
        },
        select: {
          materialId: true
        },
        envType: "prod"
      });

      // 2. 提取所有不重复的材质ID
      const materialIds = [...new Set(allSkus.records
        .map(sku => sku.materialId._id)
        .filter(Boolean))];

      // 3. 更新SPU的材质ID列表
      await models.ProductSpus.update({
        data: {
          materialIds: materialIds,
        },
        filter: {
          where: {
            _id: { $eq: skuDoc.spuId._id }
          }
        },
        envType: "prod"
      });

      console.log(`SPU材质ID列表更新成功: ${materialIds.join(', ')}`);
    } catch (error) {
      console.error('更新SPU材质ID列表失败:', error);
      // 这里不抛出错误，因为SKU更新已经成功，材质更新是附加操作
    }
  }

  // 获取更新后的SKU信息
  const { data: updatedSku } = await models.ProductSkus.list({
    filter: {
      where: {
        _id: { $eq: skuDoc._id }
      }
    },
    envType: "prod"
  });

  // 返回更新后的SKU信息
  const skuData = updatedSku.records[0];

  return {
    code: 200,
    message: "SKU更新成功" + (isMaterialUpdated ? "，SPU材质ID列表已同步更新" : ""),
    data: {
      ...skuData,
      materialUpdated: isMaterialUpdated
    }
  };
}
//===================================
// 新增SPU
async function createSpu(data) {
  const {
    spuData
  } = data;

  if (!spuData) {
    return {
      code: 400,
      message: "缺少SPU数据"
    };
  }

  // 必填字段验证
  const requiredFields = ['spuId', 'name', 'referencePrice'];
  for (const field of requiredFields) {
    if (!spuData[field]) {
      return {
        code: 400,
        message: `缺少必填字段: ${field}`
      };
    }
  }

  // 验证关联数据是否存在
  if (spuData.category) {
    const { data: category } = await models.Categories.list({
      filter: {
        where: { _id: { $eq: spuData.category._id } }
      },
      envType: "prod"
    });
    
    if (!category.records || category.records.length === 0) {
      return {
        code: 404,
        message: "指定的分类不存在"
      };
    }
  }

  if (spuData.seriesId) {
    const { data: series } = await models.Series.list({
      filter: {
        where: { _id: { $eq: spuData.seriesId._id } }
      },
      envType: "prod"
    });
    
    if (!series.records || series.records.length === 0) {
      return {
        code: 404,
        message: "指定的系列不存在"
      };
    }
  }

  // 验证材质IDs是否存在
  // if (spuData.materialIds && Array.isArray(spuData.materialIds)) {
  //   for (const materialId of spuData.materialIds) {
  //     const { data: material } = await models.Materials.get({
  //       filter: {
  //         where: { _id: { $eq: materialId } }
  //       },
  //       envType: "prod"
  //     });
      
  //     if (!material) {
  //       return {
  //         code: 404,
  //         message: `材质ID ${materialId} 不存在`
  //       };
  //     }
  //   }
  // }

  // 设置默认值
  const defaultSpuData = {
    isOnSale: false,
    mainImages: [],
    detailImages: [],
    tags: [],
    materialIds: []
  };

  const finalSpuData = {
    ...defaultSpuData,
    ...spuData
  };

  const result = await models.ProductSpus.create({
    data: finalSpuData,
    envType: "prod"
  });

  return {
    code: 200,
    message: "SPU创建成功",
    _spuId: result.data.id
  };
}

// 新增SKU
async function createSku(data) {
  const {
    skuData
  } = data;

  if (!skuData) {
    return {
      code: 400,
      message: "缺少SKU数据"
    };
  }

  // 必填字段验证
  const requiredFields = ['skuId', 'spuId', 'nameCN', 'price', 'materialId'];
  for (const field of requiredFields) {
    if (!skuData[field]) {
      return {
        code: 400,
        message: `缺少必填字段: ${field}`
      };
    }
  }

  // 验证SPU是否存在
  const { data: spuList } = await models.ProductSpus.list({
    filter: {
      where: { _id: { $eq: skuData.spuId._id } }
    },
    envType: "prod"
  });

  if (!spuList.records || spuList.records.length === 0) {
    return {
      code: 404,
      message: "指定的SPU不存在"
    };
  }

  // 验证关联数据是否存在
  if (skuData.materialId) {
    const { data: materialList } = await models.Materials.list({
      filter: {
        where: { _id: { $eq: skuData.materialId._id } }
      },
      envType: "prod"
    });
    
    if (!materialList.records || materialList.records.length === 0) {
      return {
        code: 404,
        message: "指定的材质不存在"
      };
    }
  }

  if (skuData.sizeId) {
    const { data: sizeList } = await models.ProductSizes.list({
      filter: {
        where: { _id: { $eq: skuData.sizeId._id } }
      },
      envType: "prod"
    });
    
    if (!sizeList.records || sizeList.records.length === 0) {
      return {
        code: 404,
        message: "指定的尺寸不存在"
      };
    }
  }

  if (skuData.subSeries) {
    const { data: subSeriesList } = await models.SubSeries.list({
      filter: {
        where: { _id: { $eq: skuData.subSeries._id } }
      },
      envType: "prod"
    });
    
    if (!subSeriesList.records || subSeriesList.records.length === 0) {
      return {
        code: 404,
        message: "指定的子系列不存在"
      };
    }
  }

  // 设置默认值
  const defaultSkuData = {
    isOnSale: false,
    stock: 0,
    skuMainImages: [],
    skuDetailImages: [],
    tags: [],
    nameEN: '',
    presaleFlag: '',
    size: '',
    introduction: ''
  };

  const finalSkuData = {
    ...defaultSkuData,
    ...skuData
  };

  // 创建SKU
  const result = await models.ProductSkus.create({
    data: finalSkuData,
    envType: "prod"
  });

  // 更新SPU的材质ID列表
  try {
    // 1. 获取当前SPU的所有SKU材质ID
    const { data: skuList } = await models.ProductSkus.list({
      filter: {
        where: {
          spuId: { $eq: skuData.spuId._id }
        }
      },
      select: {
        materialId: true,
//        $master:true
      },
      envType: "prod"
    });

    // 2. 提取所有不重复的材质ID
    const materialIds = [...new Set(skuList.records
      .map(sku => sku.materialId._id)
      .filter(Boolean))];

    // 3. 更新SPU的材质ID列表
    await models.ProductSpus.update({
      data: {
        materialOptions: materialIds,
      },
      filter: {
        where: {
          _id: { $eq: skuData.spuId._id }
        }
      },
      envType: "prod"
    });

    console.log(`SPU材质ID列表更新成功: ${materialIds.join(', ')}`);
  } catch (error) {
    console.error('更新SPU材质ID列表失败:', error);
    // 这里不抛出错误，因为SKU创建已经成功，材质更新是附加操作
  }

  return {
    code: 200,
    message: "SKU创建成功",
    data: {
      _skuId: result.data.id,
      materialUpdated: true // 标识材质ID列表已更新
    }
  };
}

// 更新库存
async function updateStock(data) {
  const {
    _skuId,
    stock,
    operation = 'set' // 'set'直接设置, 'increment'增加, 'decrement'减少
  } = data;

  if (!_skuId || stock === undefined || stock === null) {
    return {
      code: 400,
      message: "缺少必要参数: _skuId 或 stock"
    };
  }

  if (operation !== 'set' && operation !== 'increment' && operation !== 'decrement') {
    return {
      code: 400,
      message: "操作类型无效，只能是 'set', 'increment' 或 'decrement'"
    };
  }

  // 查找SKU
  const { data: skuList } = await models.ProductSkus.list({
    filter: {
      where: {
        _id: { $eq: _skuId }
      }
    },
    envType: "prod"
  });

  if (!skuList.records || skuList.records.length === 0) {
    return {
      code: 404,
      message: "未找到对应的SKU"
    };
  }

  const skuDoc = skuList.records[0];
  let newStock = stock;

  if (operation === 'increment') {
    newStock = (skuDoc.stock || 0) + stock;
  } else if (operation === 'decrement') {
    newStock = Math.max(0, (skuDoc.stock || 0) - stock);
  }

  // 确保库存不为负数
  if (newStock < 0) {
    newStock = 0;
  }

  // 执行更新
  const { data: updateResult } = await models.ProductSkus.update({
    data: {
      stock: newStock,
    },
    filter: {
      where: {
        _id: { $eq: skuDoc._id }
      }
    },
    envType: "prod"
  });

  if (updateResult.count === 0) {
    return {
      code: 500,
      message: '库存更新失败，未修改任何记录'
    };
  }

  // 获取更新后的SKU信息
  const { data: updatedSku } = await models.ProductSkus.list({
    filter: {
      where: {
        _id: { $eq: skuDoc._id }
      }
    },
    envType: "prod"
  });

  // 返回更新后的SKU信息
  const skuData = updatedSku.records[0];

  return {
    code: 200,
    message: `库存更新成功，当前库存: ${newStock}`,
    data: {
      previousStock: skuDoc.stock,
      newStock: newStock,
      operation: operation,
      sku: skuData
    }
  };
}

// 新增商品条目（ProductItem）
async function createProductItem(data) {
  const {
    itemData
  } = data;

  if (!itemData) {
    return {
      code: 400,
      message: "缺少商品条目数据"
    };
  }

  // 必填字段验证
  const requiredFields = ['skuId', 'itemId', 'spuId'];
  for (const field of requiredFields) {
    if (!itemData[field]) {
      return {
        code: 400,
        message: `缺少必填字段: ${field}`
      };
    }
  }

  // 验证SKU和SPU是否存在
  const { data: sku } = await models.ProductSkus.get({
    filter: {
      where: { _id: { $eq: itemData.skuId._id } }
    },
    envType: "prod"
  });

  if (!sku._id) {
    return {
      code: 404,
      message: "指定的SKU不存在"
    };
  }

  const { data: spu } = await models.ProductSpus.get({
    filter: {
      where: { _id: { $eq: itemData.spuId._id } }
    },
    envType: "prod"
  });

  if (!spu._id) {
    return {
      code: 404,
      message: "指定的SPU不存在"
    };
  }

  // 设置默认值
  const defaultItemData = {
    status: '在库', // 在库, 售出, 售后, etc.
  };

  const finalItemData = {
    ...defaultItemData,
    ...itemData
  };

  const result = await models.ProductItems.create({
    data: finalItemData,
    envType: "prod"
  });

  // 同时更新SKU库存
  if (finalItemData.status === '在库') {
    try {
      await updateStock({
        _skuId: itemData.skuId,
        stock: 1,
        operation: 'increment'
      });
    } catch (error) {
      console.error('更新SKU库存失败:', error);
      // 这里不抛出错误，因为商品条目创建已经成功，库存更新是附加操作
    }
  }

  return {
    code: 200,
    message: "商品条目创建成功",
    _itemId: result.data.id
  };
}

// 删除SPU
async function deleteSpu(data) {
  const {
    _spuId
  } = data;

  if (!_spuId) {
    return {
      code: 400,
      message: "缺少必要参数: _spuId"
    };
  }

  // 检查SPU是否存在
  const { data: spuList } = await models.ProductSpus.list({
    filter: {
      where: {
        _id: { $eq: _spuId }
      }
    },
    envType: "prod"
  });

  if (!spuList.records || spuList.records.length === 0) {
    return {
      code: 404,
      message: "未找到对应的SPU"
    };
  }

  const spuDoc = spuList.records[0];

  // 检查是否有SKU关联此SPU
  const { data: relatedSkus } = await models.ProductSkus.list({
    filter: {
      where: {
        spuId: { $eq: _spuId }
      }
    },
    envType: "prod"
  });

  if (relatedSkus.records && relatedSkus.records.length > 0) {
    return {
      code: 409,
      message: "该SPU下存在SKU，无法删除",
      data: {
        skuCount: relatedSkus.records.length
      }
    };
  }

  // 执行删除
  const { data: deletedSpu } = await models.ProductSpus.delete({
    filter: {
      where: { 
        _id: { $eq: spuDoc._id }
      }
    },
    envType: "prod"
  });

  if (!deletedSpu) {
    return {
      code: 500,
      message: "SPU删除失败"
    };
  }

  return {
    code: 200,
    message: "SPU删除成功",
    data: deletedSpu
  };
}

// 删除SKU
async function deleteSku(data) {
  const {
    _skuId
  } = data;

  if (!_skuId) {
    return {
      code: 400,
      message: "缺少必要参数: _skuId"
    };
  }

  // 检查SKU是否存在
  const { data: skuList } = await models.ProductSkus.list({
    filter: {
      where: {
        _id: { $eq: _skuId }
      }
    },
    envType: "prod"
  });

  if (!skuList.records || skuList.records.length === 0) {
    return {
      code: 404,
      message: "未找到对应的SKU"
    };
  }

  const skuDoc = skuList.records[0];

  // 检查是否有商品条目关联此SKU
  const { data: relatedItems } = await models.ProductItems.list({
    filter: {
      where: {
        skuId: { $eq: _skuId }
      }
    },
    envType: "prod"
  });

  if (relatedItems.records && relatedItems.records.length > 0) {
    return {
      code: 409,
      message: "该SKU下存在商品条目，无法删除",
      data: {
        itemCount: relatedItems.records.length
      }
    };
  }

  // 执行删除
  const { data: deletedSku } = await models.ProductSkus.delete({
    filter: {
      where: { 
        _id: { $eq: _skuId }
      }
    },
    envType: "prod"
  });

  if (!deletedSku) {
    return {
      code: 500,
      message: "SKU删除失败"
    };
  }

  // 更新SPU的材质ID列表
  try {
    const { data: allSkus } = await models.ProductSkus.list({
      filter: {
        where: {
          spuId: { $eq: skuDoc.spuId._id }
        }
      },
      select: {
        materialId: true
      },
      envType: "prod"
    });

    const materialIds = [...new Set(allSkus.records
      .map(sku => sku.materialId)
      .filter(Boolean))];

    await models.ProductSpus.update({
      data: {
        materialIds: materialIds,
      },
      filter: {
        where: {
          _id: { $eq: skuDoc.spuId._id }
        }
      },
      envType: "prod"
    });

    console.log(`SPU材质ID列表更新成功: ${materialIds.join(', ')}`);
  } catch (error) {
    console.error('更新SPU材质ID列表失败:', error);
  }

  return {
    code: 200,
    message: "SKU删除成功",
    data: deletedSku
  };
}

// 批量操作：上下架商品
async function batchUpdateSaleStatus(data) {
  const {
    _spuIds,
    _skuIds,
    isOnSale
  } = data;

  if ((!_spuIds || _spuIds.length === 0) && (!_skuIds || _skuIds.length === 0)) {
    return {
      code: 400,
      message: "缺少商品ID列表"
    };
  }

  let updatedSpuCount = 0;
  let updatedSkuCount = 0;

  // 批量更新SPU
  if (_spuIds && _spuIds.length > 0) {
    for (const _spuId of _spuIds) {
      try {
        const { data: spuList } = await models.ProductSpus.list({
          filter: {
            where: {
              _id: { $eq: _spuId }
            }
          },
          envType: "prod"
        });

        if (spuList.records && spuList.records.length > 0) {
          const spuDoc = spuList.records[0];
          const { data: updateResult } = await models.ProductSpus.update({
            data: {
              isOnSale: isOnSale,
            },
            filter: {
              where: {
                _id: { $eq: spuDoc._id }
              }
            },
            envType: "prod"
          });

          if (updateResult.count > 0) {
            updatedSpuCount++;
          }
        }
      } catch (err) {
        console.error(`更新SPU ${_spuId} 失败:`, err);
      }
    }
  }

  // 批量更新SKU
  if (_skuIds && _skuIds.length > 0) {
    for (const _skuId of _skuIds) {
      try {
        const { data: skuList } = await models.ProductSkus.list({
          filter: {
            where: {
              _id: { $eq: _skuId }
            }
          },
          envType: "prod"
        });

        if (skuList.records && skuList.records.length > 0) {
          const skuDoc = skuList.records[0];
          const { data: updateResult } = await models.ProductSkus.update({
            data: {
              isOnSale: isOnSale,
            },
            filter: {
              where: {
                _id: { $eq: skuDoc._id }
              }
            },
            envType: "prod"
          });

          if (updateResult.count > 0) {
            updatedSkuCount++;
          }
        }
      } catch (err) {
        console.error(`更新SKU ${_skuId} 失败:`, err);
      }
    }
  }

  return {
    code: 200,
    message: `批量${isOnSale ? '上架' : '下架'}操作完成`,
    data: {
      updatedSpuCount,
      updatedSkuCount
    }
  };
}

// 强制删除SPU（包含所有关联的SKU和商品条目）
async function forceDeleteSpu(data) {
  const {
    _spuId
  } = data;

  if (!_spuId) {
    return {
      code: 400,
      message: "缺少必要参数: _spuId"
    };
  }

  // 检查SPU是否存在
  const { data: spuList } = await models.ProductSpus.list({
    filter: {
      where: {
        _id: { $eq: _spuId }
      }
    },
    envType: "prod"
  });

  if (!spuList.records || spuList.records.length === 0) {
    return {
      code: 404,
      message: "未找到对应的SPU"
    };
  }

  const spuDoc = spuList.records[0];

  // 获取所有关联的SKU
  const { data: relatedSkus } = await models.ProductSkus.list({
    filter: {
      where: {
        spuId: { $eq: _spuId }
      }
    },
    envType: "prod"
  });

  let deletedSkuCount = 0;
  let deletedItemCount = 0;

  // 删除所有关联的SKU和商品条目
  if (relatedSkus.records && relatedSkus.records.length > 0) {
    for (const sku of relatedSkus.records) {
      try {
        // 删除关联的商品条目
        const { data: relatedItems } = await models.ProductItems.list({
          filter: {
            where: {
              skuId: { $eq: sku._id }
            }
          },
          envType: "prod"
        });

        if (relatedItems.records && relatedItems.records.length > 0) {
          for (const item of relatedItems.records) {
            await models.ProductItems.delete({
              filter: {
                where: { 
                  _id: { $eq: item._id }
                }
              },
              envType: "prod"
            });
            deletedItemCount++;
          }
        }

        // 删除SKU
        await models.ProductSkus.delete({
          filter: {
            where: { 
              _id: { $eq: sku._id }
            }
          },
          envType: "prod"
        });
        deletedSkuCount++;

      } catch (error) {
        console.error(`删除SKU ${sku._id} 失败:`, error);
      }
    }
  }

  // 删除SPU
  const { data: deletedSpu } = await models.ProductSpus.delete({
    filter: {
      where: { 
        _id: { $eq: _spuId }
      }
    },
    envType: "prod"
  });

  if (!deletedSpu) {
    return {
      code: 500,
      message: "SPU删除失败"
    };
  }

  return {
    code: 200,
    message: "SPU及关联数据强制删除成功",
    data: {
      deletedSpu: deletedSpu,
      deletedSkuCount: deletedSkuCount,
      deletedItemCount: deletedItemCount
    }
  };
}

// 主函数
exports.main = async (event, context) => {
  const {
    action,
    data
  } = event;

  try {
    switch (action) {
      // 更新SPU
      case 'updateSpu':
        return await updateSpu(data);
      // 更新SKU
      case 'updateSku':
        return await updateSku(data);
      // 新增SPU
      case 'createSpu':
        return await createSpu(data);
      // 新增SKU
      case 'createSku':
        return await createSku(data);
      // 更新库存
      case 'updateStock':
        return await updateStock(data);
      // 新增Item
      case 'createProductItem':
        return await createProductItem(data);
      // 删除SPU
      case 'deleteSpu':
        return await deleteSpu(data);
      // 删除SKU
      case 'deleteSku':
        return await deleteSku(data);
      // 强制删除SPU（包含所有关联数据）
      case 'forceDeleteSpu':
        return await forceDeleteSpu(data);
      // 批量操作：上下架商品
      case 'batchUpdateSaleStatus':
        return await batchUpdateSaleStatus(data);

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