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


// 允许更新的分类字段
const ALLOWED_CATEGORY_FIELDS = [
  'categoryName', 'status', 'categoryId', 'displayImage',
];

exports.main = async (event, context) => {
  const { action, data } = event;
  const { _categoryId, categoryId, categoryName, status, displayImage } = data || {};
  // 通用错误处理函数
  const handleError = (err) => {
    console.error('Error:', err);
    return { code: 500, message: err.message };
  };

  try {
    switch (action) {
      case 'add':
        return await addCategory(data);

      case 'remove':
        return await removeCategory(_categoryId);

      case 'update':
        return await updateCategory(data);

      case 'get':
        return await getCategory(_categoryId);

      case 'list':
        return await getCategoryList(data);

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

// 添加分类
async function addCategory(categoryData) {
  if (!categoryData) {
    return {
      code: 400,
      message: "缺少分类数据"
    };
  }
  // 必填字段验证
  const requiredFields = ['categoryName', 'displayImage'];
  for (const field of requiredFields) {
    if (!categoryData[field]) {
      return {
        code: 400,
        message: `缺少必填字段: ${field}`
      };
    }
  }

  // 检查分类名是否已存在
  const { data: existingCategories } = await models.Categories.list({
    filter: {
      where: {
        categoryName: { $eq: categoryData.categoryName }
      }
    },
    envType: "prod"
  });

  if (existingCategories.records && existingCategories.records.length > 0) {
    return {
      code: 400,
      message: "分类名称已存在"
    };
  }
  // 生成顺序categoryId（如果用户没有提供）
  let nextCategoryId;
  if (categoryData.categoryId && categoryData.categoryId.trim()) {
    // 如果用户提供了 categoryId，使用用户提供的
    nextCategoryId = categoryData.categoryId.trim();

    // 检查用户提供的 categoryId 是否已存在
    const { data: existingCategories } = await models.Categories.list({
      filter: {
        where: {
          categoryId: { $eq: nextCategoryId }
        }
      },
      envType: "prod"
    });

    if (existingCategories.records && existingCategories.records.length > 0) {
      return {
        code: 400,
        message: "排序ID已存在，请使用其他ID"
      };
    }
  } else {
    // 如果用户没有提供，自动生成
    try {
      // 获取所有现有分类，按categoryId降序排列
      const { data: allCategories } = await models.Categories.list({
        orderBy: [{ categoryId: 'desc' }],
        select: {
          categoryId: true
        },
        envType: "prod"
      });

      if (allCategories.records && allCategories.records.length > 0) {
        // 找到最大的categoryId
        const maxCategoryId = allCategories.records[0].categoryId;

        // 提取数字部分并加1
        const maxNumber = parseInt(maxCategoryId, 10);
        const nextNumber = maxNumber + 1;

        // 格式化为两位数，不足两位前面补0
        nextCategoryId = nextNumber.toString().padStart(2, '0');

        // 如果超过99，使用三位数
        if (nextNumber > 99) {
          nextCategoryId = nextNumber.toString().padStart(3, '0');
        }
      } else {
        // 如果没有现有分类，从01开始
        nextCategoryId = '01';
      }
    } catch (error) {
      console.error('生成categoryId失败:', error);
      // 如果查询失败，使用时间戳作为备选方案
      nextCategoryId = Date.now().toString().slice(-4);
    }
  }

  // 设置默认值
  const defaultCategoryData = {
    categoryId: nextCategoryId,
    status: false,
  };

  const finalCategoryData = {
    ...defaultCategoryData,
    ...categoryData
  };

  const result = await models.Categories.create({
    data: finalCategoryData,
    envType: "prod"
  });

  return {
    code: 200,
    message: "分类创建成功",
    _categoryId: result.data.id
  };
}

// 删除分类
async function removeCategory(_categoryId) {
  if (!_categoryId) {
    return {
      code: 400,
      message: "缺少必要参数: _categoryId"
    };
  }

  // 检查是否有产品关联此分类
  const { data: relatedProducts } = await models.ProductSpus.list({
    filter: {
      where: {
        _id: { $eq: _categoryId }
      }
    },
    envType: "prod"
  });

  if (relatedProducts.records && relatedProducts.records.length > 0) {
    return {
      code: 409,
      message: "该分类下存在商品，无法删除"
    };
  }

  const { data: deletedCategory } = await models.Categories.delete({
    filter: {
      where: {
        _id: { $eq: _categoryId }
      }
    },
    envType: "prod"
  });

  if (!deletedCategory) {
    return {
      code: 404,
      message: "分类不存在"
    };
  }

  return {
    code: 200,
    message: "分类删除成功",
    data: deletedCategory
  };
}

// 更新分类
async function updateCategory(data) {
  const {
    _categoryId,
    updateData
  } = data;

  if (!_categoryId) {
    return {
      code: 400,
      message: "缺少必要参数: categoryId"
    };
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    return {
      code: 400,
      message: "更新数据不能为空"
    };
  }
  // 如果更新分类名称，检查是否重复
  if (updateData.categoryName) {
    // 检查分类名是否已存在（排除当前分类）
    const { data: existingCategories } = await models.Categories.list({
      filter: {
        where: {
          categoryName: { $eq: updateData.categoryName },
          _id: { $ne: _categoryId }  // 排除当前分类
        }
      },
      envType: "prod"
    });

    if (existingCategories.records && existingCategories.records.length > 0) {
      return {
        code: 400,
        message: "分类名称已存在"
      };
    }
  }

  // 如果更新排序ID，检查是否重复
  if (updateData.categoryId) {
    const newCategoryId = updateData.categoryId.trim();
    // 检查排序ID是否已被其他分类使用（排除当前分类）
    const { data: existingCategories } = await models.Categories.list({
      filter: {
        where: {
          categoryId: { $eq: newCategoryId },
          _id: { $ne: _categoryId }  // 排除当前分类
        }
      },
      envType: "prod"
    });

    if (existingCategories.records && existingCategories.records.length > 0) {
      return {
        code: 400,
        message: "排序ID已被其他分类使用"
      };
    }
  }

  // 构建安全的更新数据
  const safeUpdateData = buildSafeUpdateData(updateData, ALLOWED_CATEGORY_FIELDS);

  // 检查是否有有效字段需要更新
  if (Object.keys(safeUpdateData).length < 1) {
    return {
      code: 400,
      message: "没有有效的字段需要更新"
    };
  }

  // 执行更新
  const { data: updateResult } = await models.Categories.update({
    data: {
      ...safeUpdateData,
    },
    filter: {
      where: {
        _id: { $eq: _categoryId }
      }
    },
    envType: "prod"
  });

  if (updateResult.count === 0) {
    return {
      code: 500,
      message: '分类更新失败，未修改任何记录'
    };
  }

  // 获取更新后的分类信息
  const { data: updatedCategory } = await models.Categories.list({
    filter: {
      where: {
        _id: { $eq: _categoryId }
      }
    },
    envType: "prod"
  });

  // 返回更新后的分类信息
  const categoryData = updatedCategory.records[0];

  return {
    code: 200,
    message: "分类更新成功",
    data: categoryData
  };
}

// 获取单个分类
async function getCategory(_categoryId) {
  if (!_categoryId) {
    return {
      code: 400,
      message: "缺少必要参数: _categoryId"
    };
  }

  const { data: category } = await models.Categories.get({
    filter: {
      where: { _id: { $eq: _categoryId } }
    },
    envType: "prod"
  });

  if (!category) {
    return {
      code: 404,
      message: "分类不存在"
    };
  }

  return {
    code: 200,
    message: "获取分类成功",
    data: category
  };
}

// 获取分类列表
async function getCategoryList(data) {
  const { includeDisabled = false } = data || {};
  
  // 构建查询条件
  const filter = {
    orderBy: {
      categoryId: 'asc'  // 按照 categoryId 升序排列
    }
  };
  
  // 如果不需要包含已禁用的分类，添加状态过滤
  if (!includeDisabled) {
    filter.where = {
      status: { $eq: true }  // 只返回 status 为 true 的分类
    };
  }

  const { data: categories } = await models.Categories.list({
    filter: filter,
    envType: "prod"
  });

  return {
    code: 200,
    message: "获取分类列表成功",
    data: {
      categories: categories.records || [],
      total: categories.records ? categories.records.length : 0
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
