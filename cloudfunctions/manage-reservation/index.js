const {
  init
} = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const client = init(cloud);
const models = client.models;



// 活动预约管理云函数
exports.main = async (event, context) => {
  const { action, data } = event;
  const { _reservationId, _activityId, reservationData } = data || {};
  
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
        return await addReservation(_activityId, reservationData, OPENID);
      
      case 'edit':
        return await editReservation(_reservationId, reservationData, OPENID);
      
      case 'delete':
        return await deleteReservation(_reservationId, OPENID);
      
      case 'getList':
        return await getReservationList(data, OPENID);
      
      case 'getOne':
        return await getReservation(_reservationId, OPENID);
      
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

// 添加预约
async function addReservation(_activityId, reservationData, openId) {
  if (!_activityId || !reservationData) {
    return {
      code: 400,
      message: "缺少必要参数: activityId 和 reservationData"
    };
  }

  const { _userId,title, phone, people, arriveTime, leaveTime } = reservationData;

  // 验证必要字段
  if (!title || !phone || !people || !arriveTime) {
    return {
      code: 400,
      message: "缺少必要预约信息: 称谓、电话、人数、到达时间等"
    };
  }

  // 获取活动信息
  const { data: activity } = await models.Activities.get({
    filter: {
      where: {
        _id: { $eq: _activityId },
        status: { $eq: true }, // 只允许预约启用状态的活动
        endTime: { $gte: new Date().getTime() } // 只允许预约未结束的活动
      }
    },
    envType: "prod"
  });

  if (!activity) {
    return {
      code: 404,
      message: "活动不存在或已结束"
    };
  }

  // 检查是否已经预约过该活动
  const { data: existingReservations } = await models.Reservations.list({
    filter: {
      where: {
        activityId: { $eq: activity._id }, // 使用系统ID
       // _owner: { $eq: openId }
      }
    },
    envType: "prod"
  });

  if (existingReservations.records && existingReservations.records.length > 0) {
    return {
      code: 400,
      message: "您已经预约过该活动"
    };
  }

  // 创建新预约
  const { data: newReservation } = await models.Reservations.create({
    data: {
      activityId:{_id:_activityId} , // 使用系统ID
      userId:{_id:_userId},// 使用openId作为用户ID
      title,
      phone,
      people,
      arriveTime: new Date(arriveTime).getTime(),
      leaveTime: leaveTime ? new Date(leaveTime).getTime() : null,
    },
    envType: "prod"
  });

  return {
    code: 200,
    message: "活动预约成功",
    data: newReservation
  };
}

// 编辑预约
async function editReservation(reservationId, reservationData, openId) {
  if (!reservationId || !reservationData) {
    return {
      code: 400,
      message: "缺少必要参数: reservationId 和 reservationData"
    };
  }

  // 获取原预约信息
  const { data: originalReservation } = await models.Reservations.get({
    filter: {
      where: {
        _id: { $eq: reservationId },
      }
    },
    envType: "prod"
  });

  if (!originalReservation) {
    return {
      code: 404,
      message: "预约不存在或无权操作"
    };
  }

  // 检查关联的活动是否还存在且未结束
  const { data: activity } = await models.Activities.get({
    filter: {
      where: {
        _id: { $eq: originalReservation.activityId },
        status: { $eq: true },
        endTime: { $gte: new Date().getTime() }
      }
    },
    envType: "prod"
  });

  if (!activity) {
    return {
      code: 400,
      message: "关联的活动已结束或不存在，无法修改预约"
    };
  }

  // 更新预约
  const updateData = {
  };

  const fields = ['title', 'phone', 'people', 'arriveTime', 'leaveTime'];
  
  fields.forEach(field => {
    if (reservationData[field] !== undefined) {
      if (field === 'arriveTime' || field === 'leaveTime') {
        updateData[field] = new Date(reservationData[field]).getTime();
      } else {
        updateData[field] = reservationData[field];
      }
    }
  });

  const { data: updatedReservation } = await models.Reservations.update({
    filter: {
      where: {
        _id: { $eq: reservationId },
      }
    },
    data: updateData,
    envType: "prod"
  });

  return {
    code: 200,
    message: "预约更新成功",
    data: updatedReservation
  };
}

// 删除预约
async function deleteReservation(reservationId, openId) {
  if (!reservationId) {
    return {
      code: 400,
      message: "缺少必要参数: reservationId"
    };
  }

  // 获取预约信息
  const { data: reservation } = await models.Reservations.get({
    filter: {
      where: {
        _id: { $eq: reservationId },
      }
    },
    envType: "prod"
  });

  if (!reservation) {
    return {
      code: 404,
      message: "预约不存在或无权操作"
    };
  }

  // 删除预约
  const { data: deletedReservation } = await models.Reservations.delete({
    filter: {
      where: {
        _id: { $eq: reservationId },
      }
    },
    envType: "prod"
  });

  return {
    code: 200,
    message: "预约删除成功",
    data: deletedReservation
  };
}

// 获取预约列表
async function getReservationList(data, openId) {
  const { _userId,page = 1, pageSize = 10, _activityId, } = data || {};

  // 构建过滤条件
  const filterConditions = {
    userId: { $eq: _userId },// 只获取当前用户的预约
  };

  // 如果指定了活动ID，添加活动过滤条件
  if (_activityId) {
    // 先获取活动的系统ID
    const { data: activity } = await models.Activities.get({
      filter: {
        where: {
          _id: { $eq: _activityId }
        }
      },
      envType: "prod"
    });

    if (activity) {
      filterConditions.activityId = { $eq: activity._id };
    }
  }

  const { data: reservations } = await models.Reservations.list({
    filter: {
      where: filterConditions,
      relateWhere: {
        Activities: {
          where: {
            status: { $eq: true }
          }
        }
      },
    },
  
    select: {
      _id: true,
      //Activities: true,
      title: true,
      phone: true,
      people: true,
      arriveTime: true,
      leaveTime: true,
      createdAt: true,
      Activities: {
        _id: true,
        activityId: true,
        name: true,
        // startTime: true,
        // endTime: true,
        // provinceLocation: true,
        // detailLocation: true
      }
    },
    sort: [{ _createTime: "desc" }],
    skip: (page - 1) * pageSize,
    limit: pageSize,
    getCount: true,
    envType: "prod"
  });

  return {
    code: 200,
    message: "获取预约列表成功",
    data: {
      items: reservations.records || [],
      total: reservations.total,
      page,
      pageSize
    }
  };
}

// 获取单个预约详情
async function getReservation(reservationId, openId) {
  if (!reservationId) {
    return {
      code: 400,
      message: "缺少必要参数: reservationId"
    };
  }

  // 获取预约信息
  const { data: reservation } = await models.Reservations.get({
    filter: {
      where: {
        _id: { $eq: reservationId },
      },
      relateWhere: {
        Activities: {
          where: {
            status: { $eq: true }
          }
        }
      },
    },
 
    select: {
      _id: true,
      activityId: true,
      title: true,
      phone: true,
      people: true,
      arriveTime: true,
      leaveTime: true,
      createdAt: true,
      Activities: {
        _id: true,
        activityId: true,
        name: true,
        // timePeriod: true,
        // images: true,
        // startTime: true,
        // endTime: true,
        // provinceLocation: true,
        // detailLocation: true,
        // location: true,
        // description: true
      }
    },
    envType: "prod"
  });

  if (!reservation) {
    return {
      code: 404,
      message: "预约不存在或无权操作"
    };
  }

  return {
    code: 200,
    message: "获取预约成功",
    data: reservation
  };
}