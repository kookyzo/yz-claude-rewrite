// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
    console.log('login-easy云函数开始执行，接收到的参数：', event)

    const { action, userInfo } = event
    const { OPENID } = cloud.getWXContext()

    console.log('用户OpenID：', OPENID)
    console.log('操作类型：', action)

    try {
        switch (action) {
            case 'login':
                return await handleLogin(OPENID, userInfo)
            case 'checkLogin':
                return await checkLoginStatus(OPENID)
            default:
                return {
                    code: 400,
                    message: '未知的操作类型'
                }
        }
    } catch (err) {
        console.error('login-easy云函数执行错误：', err)
        return {
            code: 500,
            message: '服务器内部错误'
        }
    }
}

// 处理登录
async function handleLogin(openId, userInfo) {
    console.log('开始处理登录，OpenID：', openId)
    console.log('用户信息：', userInfo)

    try {
        // 检查用户是否已存在
        const userResult = await db.collection('users-easy').where({
            openId: openId
        }).get()

        console.log('查询用户结果：', userResult)

        if (userResult.data.length > 0) {
            // 用户已存在，更新最后登录时间
            const updateResult = await db.collection('users-easy').doc(userResult.data[0]._id).update({
                data: {
                    lastLoginTime: Date.now(),
                }
            })

            console.log('更新用户登录信息：', updateResult)

            return {
                code: 200,
                message: '登录成功',
                data: {
                    ...userResult.data[0],
                    lastLoginTime: Date.now(),
                    loginCount: (userResult.data[0].loginCount || 0) + 1
                },
                isNewUser: false
            }
        } else {
            // 新用户，创建用户记录
            const createResult = await db.collection('users-easy').add({
                data: {
                    openId: openId,
                    nickName: userInfo.nickName || '微信用户',
                    avatarUrl: userInfo.avatarUrl || '',
                    createTime: Date.now(),
                    lastLoginTime: Date.now(),
                }
            })

            console.log('创建新用户：', createResult)

            // 获取创建的用户信息
            const newUserResult = await db.collection('users-easy').doc(createResult._id).get()

            return {
                code: 200,
                message: '注册并登录成功',
                data: newUserResult.data,
                isNewUser: true
            }
        }
    } catch (err) {
        console.error('登录处理错误：', err)
        return {
            code: 500,
            message: '登录失败'
        }
    }
}

// 检查登录状态
async function checkLoginStatus(openId) {
    console.log('检查登录状态，OpenID：', openId)

    try {
        const userResult = await db.collection('users-easy').where({
            openId: openId
        }).get()

        if (userResult.data.length > 0) {
            return {
                code: 200,
                message: '用户已登录',
                data: userResult.data[0],
                isLoggedIn: true
            }
        } else {
            return {
                code: 200,
                message: '用户未登录',
                data: null,
                isLoggedIn: false
            }
        }
    } catch (err) {
        console.error('检查登录状态错误：', err)
        return {
            code: 500,
            message: '检查登录状态失败'
        }
    }
}
