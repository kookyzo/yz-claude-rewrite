const { init } = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database()
const client = init(cloud);
const models = client.models;

// 允许更新的用户字段
const ALLOWED_USER_FIELDS = [
  'lastName', 'firstName', 'phone', 'title', 
  'birthday', 'region', 'openId', 'userId'
];

// 用于后台管理的用户列表查询字段（更详细）
const ADMIN_USER_FIELDS = [
  '_id', 'userId', 'lastName', 'firstName', 'phone', 
  'title', 'birthday', 'region', 'openId', 
  'phoneUpdateAt', 'lastLogin', 'regionUpdateAt', 
];

exports.main = async (event, context) => {
  const { action, data } = event;
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  const handleError = (err) => {
    console.error('Error:', err);
    return { code: 500, message: err.message };
  };

  try {
    switch (action) {
      case 'add':
        return await addUser(data);
      
      case 'remove':
        return await removeUser(data._id);
      
      case 'update':
        return await updateUser(data);
      
      case 'get':
        return await getUser(data._id);
      
      case 'list':
        return await getUserList(data);
      
      case 'updatePhone':
        return await updateUserPhone(data);
      
      case 'updateRegion':
        return await updateUserRegion(data);
      
      case 'adminList':
        return await getAdminUserList(data);
      
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

// 添加用户
async function addUser(userData) {
  if (!userData) {
    return {
      code: 400,
      message: "缺少用户数据"
    };
  }

  // 必填字段验证
  const requiredFields = ['lastName', 'firstName', 'phone','title','birthday'];
  for (const field of requiredFields) { 
    if (!userData[field]) {
      return {
        code: 400,
        message: `缺少必填字段: ${field}`
      };
    }
  }

  // 检查手机号是否已存在
  const { data: existingUser } = await models.Users.list({
    filter: {
      where: {
        phone: { $eq: userData.phone }
      }
    },
    envType: "prod"
  });

  if (existingUser.records && existingUser.records.length > 0) {
    return {
      code: 400,
      message: "该手机号已存在"
    };
  }

  // 处理生日字段，转换为时间戳格式
  const processedUserData = processBirthdayField(userData);

  // 验证生日格式
  if (!isValidBirthday(processedUserData.birthday)) {
    return {
      code: 400,
      message: "生日格式不正确，应为时间戳数字或YYYY-MM-DD格式"
    };
  }

  // 生成顺序userId
  let nextUserId;
  try {
    // 获取所有现有用户，按userId降序排列
    const { data: allUsers } = await models.Users.list({
      orderBy: [{ userId: 'desc' }],
      select: {
        userId: true
      },
      envType: "prod"
    });

    if (allUsers.records && allUsers.records.length > 0) {
      // 找到最大的userId
      const maxUserId = allUsers.records[0].userId;
      
      // 提取数字部分并加1
      const maxNumber = parseInt(maxUserId.replace('U', ''), 10);
      const nextNumber = maxNumber + 1;
      
      // 格式化为U+五位数字
      nextUserId = 'U' + nextNumber.toString().padStart(5, '0');
    } else {
      // 如果没有现有用户，从U10001开始
      nextUserId = 'U10001';
    }
  } catch (error) {
    console.error('生成userId失败:', error);
    // 如果查询失败，使用时间戳作为备选方案
    nextUserId = 'U' + Date.now().toString().slice(-5);
  }

  // 设置当前时间戳
  const now = new Date().getTime();
  
  // 设置默认值
  const defaultUserData = {
    //openId:openid,
    userId: nextUserId,
    phoneUpdateAt: now,
    lastLogin: now,
    regionUpdateAt: now,
  };

  const finalUserData = {
    ...defaultUserData,
    ...processedUserData
  };

  const result = await models.Users.create({
    data: finalUserData,
    envType: "prod"
  });

  return {
    code: 200,
    message: "用户创建成功",
    _id: result.data.id,
    userId: nextUserId
  };
}

// 删除用户
async function removeUser(_id) {
  if (!_id) {
    return {
      code: 400,
      message: "缺少必要参数: _id"
    };
  }

  // 检查用户是否存在
  const { data: user } = await models.Users.get({
    filter: {
      where: { _id: { $eq: _id } }
    },
    envType: "prod"
  });

  if (!user) {
    return {
      code: 404,
      message: "用户不存在"
    };
  }

  // 注意：这里可以根据业务需求添加额外的检查
  // 例如：检查用户是否有未完成的订单等

  const { data: deletedUser } = await models.Users.delete({
    filter: {
      where: { 
        _id: { $eq: _id }
      }
    },
    envType: "prod"
  });

  if (!deletedUser) {
    return {
      code: 500,
      message: "用户删除失败"
    };
  }

  return {
    code: 200,
    message: "用户删除成功",
    data: {
      _id: deletedUser._id,
      userId: deletedUser.userId,
      lastName: deletedUser.lastName,
      firstName: deletedUser.firstName
    }
  };
}

// 更新用户信息
async function updateUser(data) {
  const {
    _id,
    updateData
  } = data;

  if (!_id) {
    return {
      code: 400,
      message: "缺少必要参数: _id"
    };
  }

  if (!updateData || Object.keys(updateData).length === 0) {
    return {
      code: 400,
      message: "更新数据不能为空"
    };
  }

  // 检查用户是否存在
  const { data: currentUser } = await models.Users.get({
    filter: {
      where: { _id: { $eq: _id } }
    },
    envType: "prod"
  });

  if (!currentUser) {
    return {
      code: 404,
      message: "用户不存在"
    };
  }

  // 如果更新了手机号，检查是否重复
  if (updateData.phone && updateData.phone !== currentUser.phone) {
    const { data: existingUser } = await models.Users.list({
      filter: {
        where: {
          phone: { $eq: updateData.phone },
          _id: { $ne: _id }
        }
      },
      envType: "prod"
    });

    if (existingUser.records && existingUser.records.length > 0) {
      return {
        code: 400,
        message: "该手机号已被其他用户使用"
      };
    }
  }

  // 处理生日字段，如果需要的话
  if (updateData.birthday !== undefined) {
    const processedUpdateData = processBirthdayField(updateData);
    
    // 验证生日格式
    if (!isValidBirthday(processedUpdateData.birthday)) {
      return {
        code: 400,
        message: "生日格式不正确，应为时间戳数字或YYYY-MM-DD格式"
      };
    }
    
    // 将处理后的生日数据合并回updateData
    Object.assign(updateData, processedUpdateData);
  }

  // 构建安全的更新数据
  const safeUpdateData = buildSafeUpdateData(updateData, ALLOWED_USER_FIELDS);
  
  // 检查是否有有效字段需要更新
  if (Object.keys(safeUpdateData).length < 1) {
    return {
      code: 400,
      message: "没有有效的字段需要更新"
    };
  }

  // 执行更新
  const { data: updateResult } = await models.Users.update({
    data: safeUpdateData,
    filter: {
      where: {
        _id: { $eq: _id }
      }
    },
    envType: "prod"
  });

  if (updateResult.count === 0) {
    return {
      code: 500,
      message: '用户更新失败，未修改任何记录'
    };
  }

  // 获取更新后的用户信息
  const { data: updatedUser } = await models.Users.get({
    filter: {
      where: {
        _id: { $eq: _id }
      }
    },
    envType: "prod"
  });

  return {
    code: 200,
    message: "用户信息更新成功",
    data: updatedUser
  };
}

// 获取单个用户
async function getUser(_id) {
  if (!_id) {
    return {
      code: 400,
      message: "缺少必要参数: _id"
    };
  }

  const { data: user } = await models.Users.get({
    filter: {
      where: { _id: { $eq: _id } }
    },
    envType: "prod"
  });

  if (!user) {
    return {
      code: 404,
      message: "用户不存在"
    };
  }

  return {
    code: 200,
    message: "获取用户成功",
    data: user
  };
}

// 获取用户列表（基础版）
async function getUserList(filterParams = {}) {
  const {
    phone,
    lastName,
    firstName,
    region,
    page = 1,
    pageSize = 20
  } = filterParams;

  // 构建查询条件
  let filter = {
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      _id: true,
      userId: true,
      lastName: true,
      firstName: true,
      phone: true,
      title: true,
      region: true,
      lastLogin: true,
      birthday: true // 添加生日字段到查询
    }
  };

  // 构建查询条件
  if (phone || lastName || firstName || region) {
    filter.where = {};
    
    if (phone) {
      // 使用 $regex 进行模糊查询
      filter.where.phone = { $regex: phone};
    }
    
    if (lastName) {
      // 使用 $regex 进行模糊查询
      filter.where.lastName = { $regex: lastName };
    }
    
    if (firstName) {
      // 使用 $regex 进行模糊查询
      filter.where.firstName = { $regex: firstName };
    }
    
    if (region) {
      // 使用 $regex 进行模糊查询
      filter.where.region = { $regex: region };
    }
  }

  // 执行查询
  const { data: users } = await models.Users.list({
    filter,
    pageSize,
    pageNumber: page,
    envType: "prod"
  });

  // 如果需要，可以在这里格式化生日字段用于显示
  const formattedUsers = users.records ? users.records.map(user => ({
    ...user,
    birthdayFormatted: user.birthday ? formatBirthdayForDisplay(user.birthday) : null
  })) : [];

  return {
    code: 200,
    message: "获取用户列表成功",
    data: {
      users: formattedUsers,
      total: users.records ? users.records.length : 0,
      pagination: {
        page,
        pageSize,
        total: users.records ? users.records.length : 0
      }
    }
  };
}

// 更新用户手机号
async function updateUserPhone(data) {
  const {
    _id,
    phone
  } = data;

  if (!_id) {
    return {
      code: 400,
      message: "缺少必要参数: _id"
    };
  }

  if (!phone) {
    return {
      code: 400,
      message: "缺少必要参数: phone"
    };
  }

  // 验证手机号格式
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return {
      code: 400,
      message: "手机号格式不正确"
    };
  }

  // 检查手机号是否已被其他用户使用
  const { data: existingUser } = await models.Users.list({
    filter: {
      where: {
        phone: { $eq: phone },
        _id: { $ne: _id }
      }
    },
    envType: "prod"
  });

  if (existingUser.records && existingUser.records.length > 0) {
    return {
      code: 400,
      message: "该手机号已被其他用户使用"
    };
  }

  const now = new Date().getTime();
  
  // 执行更新
  const { data: updateResult } = await models.Users.update({
    data: {
      phone,
      phoneUpdateAt: now,
    },
    filter: {
      where: {
        _id: { $eq: _id }
      }
    },
    envType: "prod"
  });

  if (updateResult.count === 0) {
    return {
      code: 404,
      message: "用户不存在或更新失败"
    };
  }

  return {
    code: 200,
    message: "手机号更新成功",
    data: {
      phone,
      phoneUpdateAt: now
    }
  };
}

// 更新用户地理位置
async function updateUserRegion(data) {
  const {
    _id,
    region
  } = data;

  if (!_id) {
    return {
      code: 400,
      message: "缺少必要参数: _id"
    };
  }

  if (!region) {
    return {
      code: 400,
      message: "缺少必要参数: region"
    };
  }

  const now = new Date().getTime();
  
  // 执行更新
  const { data: updateResult } = await models.Users.update({
    data: {
      region,
      regionUpdateAt: now,
    },
    filter: {
      where: {
        _id: { $eq: _id }
      }
    },
    envType: "prod"
  });

  if (updateResult.count === 0) {
    return {
      code: 404,
      message: "用户不存在或更新失败"
    };
  }

  return {
    code: 200,
    message: "地理位置更新成功",
    data: {
      region,
      regionUpdateAt: now
    }
  };
}

// 后台使用的获取所有用户列表（详细信息）
async function getAdminUserList(filterParams = {}) {
  const {
    phone,
    lastName,
    firstName,
    region,
    startDate,
    endDate,
    page = 1,
    pageSize = 50
  } = filterParams;

  // 构建查询条件
  let filter = {
    orderBy: {
      createdAt: 'desc'
    },
    select: ADMIN_USER_FIELDS
  };

  // 构建查询条件
  if (phone || lastName || firstName || region || startDate || endDate) {
    filter.where = {};
    
    if (phone) {
      // 使用 $regex 进行模糊查询
      filter.where.phone = { $regex: phone, $options: 'i' };
    }
    
    if (lastName) {
      // 使用 $regex 进行模糊查询
      filter.where.lastName = { $regex: lastName, $options: 'i' };
    }
    
    if (firstName) {
      // 使用 $regex 进行模糊查询
      filter.where.firstName = { $regex: firstName, $options: 'i' };
    }
    
    if (region) {
      // 使用 $regex 进行模糊查询
      filter.where.region = { $regex: region, $options: 'i' };
    }
    
    // 日期范围查询
    if (startDate || endDate) {
      filter.where.createdAt = {};
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.where.createdAt.$gte = start.getTime();
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.where.createdAt.$lte = end.getTime();
      }
    }
  }

  // 执行查询
  const { data: users } = await models.Users.list({
    filter,
    pageSize,
    pageNumber: page,
    envType: "prod"
  });

  // 格式化生日字段，方便前端显示
  const formattedUsers = users.records ? users.records.map(user => ({
    ...user,
    birthdayFormatted: user.birthday ? formatBirthdayForDisplay(user.birthday) : null
  })) : [];

  return {
    code: 200,
    message: "获取用户列表成功",
    data: {
      users: formattedUsers,
      total: users.records ? users.records.length : 0,
      pagination: {
        page,
        pageSize,
        total: users.records ? users.records.length : 0,
        totalPages: Math.ceil((users.records ? users.records.length : 0) / pageSize)
      }
    }
  };
}

// ==================== 辅助函数 ====================

// 处理生日字段，转换为时间戳格式
function processBirthdayField(userData) {
  if (!userData.birthday) return userData;
  
  const processedData = { ...userData };
  
  // 如果已经是数字时间戳，直接使用
  if (typeof processedData.birthday === 'number') {
    return processedData;
  }
  
  // 如果是字符串，尝试解析
  if (typeof processedData.birthday === 'string') {
    // 尝试解析ISO格式或YYYY-MM-DD格式
    const date = new Date(processedData.birthday);
    
    // 检查日期是否有效
    if (!isNaN(date.getTime())) {
      // 设置为当天0点的时间戳
      date.setHours(0, 0, 0, 0);
      processedData.birthday = date.getTime();
    } else {
      // 如果无法解析，设置为null
      processedData.birthday = null;
    }
  }
  
  return processedData;
}

// 验证生日格式是否有效
function isValidBirthday(birthday) {
  if (birthday === undefined || birthday === null) return true; // 允许不设置生日
  
  // 检查是否为数字（时间戳格式）
  if (typeof birthday === 'number') {
    // 时间戳应该在合理范围内（1900年到现在）
    const minTimestamp = new Date('1900-01-01').getTime();
    const maxTimestamp = Date.now();
    
    return birthday >= minTimestamp && birthday <= maxTimestamp;
  }
  
  // 如果是字符串，尝试解析
  if (typeof birthday === 'string') {
    const date = new Date(birthday);
    return !isNaN(date.getTime());
  }
  
  return false;
}

// 格式化生日用于显示
function formatBirthdayForDisplay(birthdayTimestamp) {
  if (!birthdayTimestamp) return null;
  
  try {
    const date = new Date(birthdayTimestamp);
    if (isNaN(date.getTime())) return null;
    
    // 格式化为YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('格式化生日失败:', error);
    return null;
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