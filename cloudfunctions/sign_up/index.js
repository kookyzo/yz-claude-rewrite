const { init } = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

const client = init(cloud);
const models = client.models;

const MAX_RETRY = 3; // 最大重试次数

// 生成业务用户ID工具函数（参考login云函数）
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

        // 获取注册表单数据
        const { userInfo } = event;

        if (!userInfo) {
            return {
                code: 400,
                message: '用户信息不能为空'
            };
        }

        console.log('开始注册流程，OpenID:', openid);
        console.log('用户信息:', userInfo);

        // 检查用户是否已存在
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

        // 如果用户已存在，返回错误
        if (userResult.records.length > 0) {
            return {
                code: 409,
                message: '用户已存在，请直接登录'
            };
        }

        // 生成业务用户ID
        const userId = await generateUserId();
        const currentTime = Date.now();

        // 处理生日数据
        let birthdayTimestamp = 0;
        if (userInfo.birthday) {
            birthdayTimestamp = new Date(userInfo.birthday).getTime();
        }

        // 创建新用户数据
        const {
            data: addResult
        } = await models.Users.create({
            data: {
                openId: openid,
                birthday: birthdayTimestamp,
                lastLogin: currentTime,
                address: [],
                gender: userInfo.gender || "",
                userId: userId,
                bought: [],
                collection: [],
                title: userInfo.title || "",
                cart: {},
                phoneUpdateAt: currentTime, // 手机号更新时间
                phone: userInfo.phone || "",
                nickname: userInfo.nickname || "微信用户",
                region: userInfo.region || "",
            },
            envType: "prod"
        });

        console.log('用户注册成功，业务ID:', userId);
        console.log('创建的用户数据:', addResult);

        return {
            code: 200,
            data: {
                openid: openid,
                _userId: addResult._id,
                userId: userId,
                unionid: wxContext.UNIONID || '',
                userInfo: addResult
            },
            message: '注册成功'
        };

    } catch (err) {
        console.error('注册错误:', err);
        return {
            code: 500,
            message: '注册失败: ' + err.message
        };
    }
};
