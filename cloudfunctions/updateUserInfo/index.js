// 云函数 updateUserInfo
const { init} = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const client = init(cloud);
const models = client.models;

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const { userInfo } = event

    // 验证参数
    if (!openid) {
      return {
        code: 401,
        message: '未授权访问'
      }
    }

    if (!userInfo || Object.keys(userInfo).length === 0) {
      return {
        code: 400,
        message: '缺少用户信息参数'
      }
    }

    // OpenId获取当前用户信息
    const { data: currentUser } = await models.Users.list({
      filter: {
        where: {
          openId: { $eq: openid }
        }
      }
    })

    if (!currentUser.records || currentUser.records.length === 0) {
      return {
        code: 404,
        message: '用户不存在'
      }
    }

    const systemId = currentUser.records[0]._id

    // 构建更新数据对象
    const updateData = {}
    const allowedFields = ['nickname', 'gender', 'region', 'birthday', 'title', 'phone',"email"]

    // 只允许更新指定字段
    allowedFields.forEach(field => {
      if (userInfo[field] !== undefined) {
        updateData[field] = userInfo[field]
      }
    })

    // 特殊字段处理
    if (userInfo.phone) {
      // 添加手机号更新时间
      updateData.phoneUpdateAt = Date.now();
    }

    // 执行更新
    const { data: updateResult } = await models.Users.update({
      data: {
        ...updateData,
      },
      filter: {
        where: {
          _id: { $eq: systemId }
        }
      }
    })

    if (updateResult.count === 0) {
      return {
        code: 500,
        message: '更新失败，未修改任何记录'
      }
    }

    // 获取更新后的用户信息
    const { data: updatedUser } = await models.Users.list({
      filter: {
        where: {
          _id: { $eq: systemId }
        }
      }
    })

    // 返回更新后的用户信息
    const userData = updatedUser.records[0]
    
    return {
      code: 200,
      message: '用户信息更新成功',
      data: userData
    }

  } catch (err) {
    console.error('更新用户信息失败:', err)
    return {
      code: 500,
      message: '服务器错误: ' + err.message
    }
  }
}