// 云函数 bindPhoneNumber update
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

exports.main = async (event) => {
  try {
    const {
      code
    } = event

    // 验证参数
    if (!code) {
      return {
        code: 400,
        message: '缺少必要参数'
      }
    }

    // 获取手机号
    const result = await cloud.openapi.phonenumber.getPhoneNumber({
      code: code
    })

    // 处理错误响应
    if (result.errCode !== 0) {
      console.error('获取手机号失败:', result)
      return {
        code: result.errCode,
        message: result.errMsg || '获取手机号失败'
      }
    }

    const phoneInfo = result.phoneInfo
    const fullPhone = phoneInfo.phoneNumber

    // 返回给前端的掩码版本
    const maskedPhone = fullPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')

    // 安全存储到数据库
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    // 更新手机号
    const { data: updateResult } = await models.Users.update({
      data: {
        phone: fullPhone,  // 修复：使用 fullPhone 而不是未定义的 phoneNumber
        phoneUpdateAt: Date.now(),  // 修复：Date.now() 已经是时间戳，不需要 .getTime()
      },
      filter: {
        where: {
          openId: { $eq: openid }
        }
      }
    })

    //console.log('手机号更新结果:', updateResult)

    // 返回成功响应
    return {
      code: 200,
      message: '手机号授权成功',
      data: {
        phoneNumber: fullPhone
      }
    }
  } catch (err) {
    console.error('云函数执行错误:', err)
    return {
      code: 500,
      message: '服务器错误: ' + err.message
    }
  }
}