// 云函数 getUserInfo
const {
  init
} = require('@cloudbase/wx-cloud-client-sdk');
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

    if (!openid) {
      return { code: 401, message: '未授权访问' }
    }


    const { data } = await models.Users.list({
      filter: {
        where: {
          $and: [
            {
              openId: {
                $eq: openid, // 推荐传入_id数据标识进行操作
              },
            },
          ]
        }
      },
      pageSize: 10, // 分页大小，建议指定，如需设置为其它值，需要和 pageNumber 配合使用，两者同时指定才会生效
      pageNumber: 1, // 第几页
      getCount: true, // 开启用来获取总数
      // envType: pre 体验环境， prod 正式环境
      envType: "prod",
    });

    // 返回查询到的数据列表 records 和 总数 total
    console.log(data);
    userResult = data.records[0];
    // 处理查询结果
    if (userResult) {
      // 对手机号进行掩码处理
      if (userResult.phone) {
        userResult.phone = userResult.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
      }
      return {
        code: 200,
        data: userResult,
        message: '获取成功'
      }
    } else {
      return {
        code: 404,
        data: userResult,
        message: '用户未注册'
      }
    }
  } catch (err) {
    console.error('获取用户信息失败:', err)
    return {
      code: 500,
      message: '服务器错误: ' + err.message
    }
  }
}