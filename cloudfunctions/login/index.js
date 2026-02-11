const { init} = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const client = init(cloud);
const models = client.models;

const MAX_RETRY = 3; // 最大重试次数

// 生成业务用户ID工具函数
async function generateUserId() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(2); // 取后两位年份
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 补零月份

  // 生成8位随机字符（包含大小写字母和数字）
  const randomPart = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // 带重试机制的ID生成
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    const userId = `user_${year}${month}_${randomPart()}`;

    // 检查是否已存在
    const {
      data: checkRes
    } = await models.Users.list({
      filter: {
        where: {
          userId: {
            $eq: userId
          }
        }
      },
      envType: "prod"
    });

    if (checkRes.records.length === 0) {
      return userId;
    }

    console.warn(`ID冲突重试 ${attempt}/${MAX_RETRY}: ${userId}`);
    if (attempt === MAX_RETRY) {
      throw new Error('生成用户ID重试次数超限');
    }
  }
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    if (!openid) {
      return {
        code: 401,
        message: '未授权访问'
      };
    }

    // 查询用户是否已存在
    const {
      data: userResult
    } = await models.Users.list({
      filter: {
        where: {
          openId: {
            $eq: openid
          }
        }
      },
      envType: "prod"
    });

    let userInfo = null;
    let isNewUser = false;
    const currentTime = Date.now(); // 获取当前时间戳

    // 如果用户不存在，则创建新用户
    if (userResult.records.length === 0) {
      try {
        // 生成业务用户ID
        const userId = await generateUserId();

        // 创建新用户数据 - 修正数据类型问题
        const {
          data: addResult
        } = await models.Users.create({
          data: {
            openId:openid,
            firstName:'',
            lastName:'',
            birthday: 0, // 生日 - 使用数字类型的时间戳
            lastLogin: currentTime, // 上次登录 - 使用数字类型的时间戳
            address: [], // 收货地址
            gender: "", // 性别
            userId: userId, // 用户标识 - 使用生成的userId
            bought: [], // 购买商品
            collection: [], // 心愿收藏
            title: "", // 称谓
            cart: {}, // 购物车
            phoneUpdateAt: 0, // 手机号更新时间 - 使用数字类型的时间戳
            phone: "", // 手机号
            nickname: "微信用户", // 昵称
            region: "", // 地区
          },
          envType: "prod"
        });

        userInfo = addResult;
        isNewUser = true;
        console.log('创建新用户成功，业务ID:', userId);
      } catch (error) {
        console.error('创建新用户失败', error);
        return {
          code: 500,
          message: '用户创建失败',
          error: error.message
        };
      }
    } else {
      // 用户已存在，更新最后登录时间
      userInfo = userResult.records[0];
      isNewUser = false;

      // 更新登录记录 - 使用数字类型的时间戳
      try {
        await models.Users.update({
          data: {
            lastLogin: currentTime
          },
          filter: {
            where: {
              _id: {
                $eq: userInfo._id
              }
            }
          },
          envType: "prod"
        });
        console.log('更新登录信息成功');
      } catch (updateErr) {
        console.error('更新登录信息失败', updateErr);
      }
    }

    return {
      code: 200,
      data: {
        openid: openid,
        _userId:userInfo._id,
        userId: userInfo.userId , // 兼容字段名不一致的情况
        unionid: wxContext.UNIONID || '',
        isNewUser: isNewUser
      },
      message: isNewUser ? '新用户注册成功' : '登录成功'
    };
  } catch (err) {
    console.error('静默登录错误:', err);
    return {
      code: 500,
      message: '服务器错误: ' + err.message
    };
  }
};