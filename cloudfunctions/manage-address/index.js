const {
  init
} = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const client = init(cloud);
const models = client.models;

// 地址管理 云函数入口函数
exports.main = async (event, context) => {
  const { action, data } = event;
  const { _userId, _addressId, addressData } = data || {};
  
  // 获取用户OpenID（腾讯云自动注入）
  const { OPENID } = cloud.getWXContext();
  
  // 通用错误处理函数
  const handleError = (err) => {
    console.error('Error:', err);
    return { code: 500, message: err.message };
  };

  try {
    switch (action) {
      case 'add':
        return await addAddress(_userId, addressData, OPENID);
      
      case 'edit':
        return await editAddress(_addressId, addressData, OPENID);
      
      case 'delete':
        return await deleteAddress(_addressId, OPENID);
      
      case 'setDefault':
        return await setDefaultAddress(_addressId, OPENID);
      
      case 'list':
        return await getAddressList(_userId, OPENID);
      
      case 'getDefault':
        return await getDefaultAddress(_userId, OPENID);
      
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

// 添加地址
async function addAddress(userId, addressData, openId) {
  if (!userId || !addressData) {
    return {
      code: 400,
      message: "缺少必要参数: userId 和 addressData"
    };
  }

  const { receiver, phone, provinceCity, detailAddress, isDefault = false } = addressData;

  // 验证必要字段
  if (!receiver || !phone || !provinceCity || !detailAddress) {
    return {
      code: 400,
      message: "缺少必要地址信息: 收件人、电话、省市区或详细地址"
    };
  }

  // 生成业务级地址ID
  const addressId = `addr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 如果设置为默认地址，需要先取消其他默认地址
  if (isDefault) {
    await unsetOtherDefaultAddresses(userId, openId);
  }

  // 创建新地址
  const { data: newAddress } = await models.Addresses.create({
    data: {
      addressId,
      userId:{_id:userId},
      receiver,
      phone,
      provinceCity,
      detailAddress,
      isDefault,
    },
    envType: "prod"
  });

  return {
    code: 200,
    message: "地址添加成功",
    data: newAddress
  };
}

// 编辑地址
async function editAddress(_addressId, addressData, openId) {
  if (!_addressId || !addressData) {
    return {
      code: 400,
      message: "缺少必要参数: _addressId 和 addressData"
    };
  }

  const { receiver, phone, provinceCity, detailAddress, isDefault } = addressData;

  // 获取原地址信息
  const { data: originalAddress } = await models.Addresses.get({
    filter: {
      where: {
        _id: { $eq: _addressId },
       // _owner: { $eq: openId }
      }
    },
    envType: "prod"
  });

  if (!originalAddress) {
    return {
      code: 404,
      message: "地址不存在或无权操作"
    };
  }

  // 如果设置为默认地址，需要先取消其他默认地址
  if (isDefault && !originalAddress.isDefault) {
    await unsetOtherDefaultAddresses(originalAddress.userId, openId);
  }

  // 更新地址
  const updateData = {

  };

  if (receiver !== undefined) updateData.receiver = receiver;
  if (phone !== undefined) updateData.phone = phone;
  if (provinceCity !== undefined) updateData.provinceCity = provinceCity;
  if (detailAddress !== undefined) updateData.detailAddress = detailAddress;
  if (isDefault !== undefined) updateData.isDefault = isDefault;

  const { data: updatedAddress } = await models.Addresses.update({
    filter: {
      where: {
        _id: { $eq: _addressId },
        //_owner: { $eq: openId }
      }
    },
    data: updateData,
    envType: "prod"
  });

  return {
    code: 200,
    message: "地址更新成功",
    data: updatedAddress
  };
}

// 删除地址
async function deleteAddress(_addressId, openId) {
  if (!_addressId) {
    return {
      code: 400,
      message: "缺少必要参数: addressId"
    };
  }

  // 获取地址信息
  const { data: address } = await models.Addresses.get({
    filter: {
      where: {
        _id: { $eq: _addressId },
        //_owner: { $eq: openId }
      }
    },
    envType: "prod"
  });

  if (!address) {
    return {
      code: 404,
      message: "地址不存在或无权操作"
    };
  }

  const isDefault = address.isDefault;

  // 删除地址
  const { data: deletedAddress } = await models.Addresses.delete({
    filter: {
      where: {
        _id: { $eq: _addressId },
        //_owner: { $eq: openId }
      }
    },
    envType: "prod"
  });

  if (!deletedAddress) {
    return {
      code: 404,
      message: "地址删除失败"
    };
  }

  // 如果删除的是默认地址，需要设置一个新的默认地址
  if (isDefault) {
    await setNewDefaultAddress(address.userId, openId);
  }

  return {
    code: 200,
    message: "地址删除成功",
    data: deletedAddress
  };
}

// 设为默认地址
async function setDefaultAddress(_addressId, openId) {
  if (!_addressId) {
    return {
      code: 400,
      message: "缺少必要参数: addressId"
    };
  }

  // 获取地址信息
  const { data: address } = await models.Addresses.get({
    filter: {
      where: {
        _id: { $eq: _addressId },
        //_owner: { $eq: openId }
      }
    },
    envType: "prod"
  });

  if (!address) {
    return {
      code: 404,
      message: "地址不存在或无权操作"
    };
  }

  // 先取消其他默认地址
  await unsetOtherDefaultAddresses(address.userId, openId);

  // 设置当前地址为默认
  const { data: updatedAddress } = await models.Addresses.update({
    filter: {
      where: {
        _id: { $eq: _addressId },
       // _owner: { $eq: openId }
      }
    },
    data: {
      isDefault: true,
    },
    envType: "prod"
  });

  return {
    code: 200,
    message: "默认地址设置成功",
    data: updatedAddress
  };
}

// 获取地址列表
async function getAddressList(_userId, openId) {
  if (!_userId) {
    return {
      code: 400,
      message: "缺少必要参数: userId"
    };
  }

  // 获取用户的所有地址
  const { data: addresses } = await models.Addresses.list({
    filter: {
      where: {
        userId: { $eq: _userId },
       // _owner: { $eq: openId }
      }
    },
    orderBy: [
      { isDefault: "desc" }, // 默认地址排在前面
      { updatedAt: "desc" } // 然后按更新时间倒序
    ],
    envType: "prod"
  });

  return {
    code: 200,
    message: "获取地址列表成功",
    data: {
      items: addresses.records || []
    }
  };
}

// 获取默认地址
async function getDefaultAddress(_userId, openId) {
  if (!_userId) {
    return {
      code: 400,
      message: "缺少必要参数: userId"
    };
  }

  // 获取用户的默认地址
  const { data: addresses } = await models.Addresses.list({
    filter: {
      where: {
        userId: { $eq: _userId },
        isDefault: { $eq: true },
        //_owner: { $eq: openId }
      }
    },
    envType: "prod"
  });

  if (!addresses.records || addresses.records.length === 0) {
    return {
      code: 404,
      message: "未设置默认地址"
    };
  }

  return {
    code: 200,
    message: "获取默认地址成功",
    data: addresses.records[0]
  };
}

// 取消用户的其他默认地址
async function unsetOtherDefaultAddresses(userId, openId) {
  // 获取用户的所有默认地址
  const { data: defaultAddresses } = await models.Addresses.list({
    filter: {
      where: {
        userId: { $eq: userId },
        isDefault: { $eq: true },
        //_owner: { $eq: openId }
      }
    },
    envType: "prod"
  });

  // 取消所有默认地址
  if (defaultAddresses.records && defaultAddresses.records.length > 0) {
    await Promise.all(
      defaultAddresses.records.map(async (address) => {
        await models.Addresses.update({
          filter: {
            where: {
              _id: { $eq: address._id }
            }
          },
          data: {
            isDefault: false,
          },
          envType: "prod"
        });
      })
    );
  }
}

// 设置新的默认地址（当删除默认地址时调用）
async function setNewDefaultAddress(userId, openId) {
  // 获取用户的第一个非默认地址
  const { data: addresses } = await models.Addresses.list({
    filter: {
      where: {
        userId: { $eq: userId },
        isDefault: { $eq: false },
        //_owner: { $eq: openId }
      }
    },
    orderBy: [{ updatedAt: "desc" }],
    limit: 1,
    envType: "prod"
  });

  // 如果有其他地址，设置第一个为默认
  if (addresses.records && addresses.records.length > 0) {
    await models.Addresses.update({
      filter: {
        where: {
          _id: { $eq: addresses.records[0]._id }
        }
      },
      data: {
        isDefault: true,
      },
      envType: "prod"
    });
  }
}