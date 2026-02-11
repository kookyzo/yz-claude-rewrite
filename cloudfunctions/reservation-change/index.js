// 修改预约云函数
const cloud = require('wx-server-sdk')

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const RESERVATIONS_COLLECTION = 'reservation-easy'; // 定义集合名称

exports.main = async (event, context) => {
    console.log('reservation-change云函数开始执行，接收到的参数：', event)

    const { action, reservationId, name, phone, people, date, selectedTimes } = event
    const { OPENID } = cloud.getWXContext()

    console.log('用户OpenID：', OPENID)
    console.log('操作类型：', action)
    console.log('数据库集合名称：', RESERVATIONS_COLLECTION)

    try {
        switch (action) {
            case 'update':
                return await updateReservation(reservationId, name, phone, people, date, selectedTimes)
            case 'get':
                return await getReservation(reservationId)
            default:
                return {
                    code: 400,
                    message: '未知的操作类型'
                }
        }
    } catch (error) {
        console.error('reservation-change云函数错误：', error)
        return {
            code: 500,
            message: '服务器内部错误',
            error: error.message
        }
    }
}

// 更新预约信息
async function updateReservation(reservationId, name, phone, people, date, selectedTimes) {
    try {
        // 获取当前预约信息
        const reservationRes = await db.collection(RESERVATIONS_COLLECTION).doc(reservationId).get()

        if (!reservationRes.data) {
            return {
                code: 404,
                message: '预约记录不存在'
            }
        }

        const currentReservation = reservationRes.data
        const currentSubmissionCount = currentReservation.submissionCount || 0

        // 检查修改次数限制
        if (currentSubmissionCount >= 2) {
            return {
                code: 403,
                message: '您已修改预约信息2次，无法再次修改'
            }
        }

        // 更新预约信息
        const updateData = {
            name: name,
            phone: phone,
            people: people,
            date: date,
            selectedTimes: selectedTimes || [],
            submissionCount: currentSubmissionCount + 1,
            lastModified: new Date()
        }

        const updateRes = await db.collection(RESERVATIONS_COLLECTION).doc(reservationId).update({
            data: updateData
        })

        if (updateRes.stats.updated > 0) {
            return {
                code: 200,
                message: '修改成功',
                data: {
                    ...currentReservation,
                    ...updateData,
                    _id: reservationId
                }
            }
        } else {
            return {
                code: 500,
                message: '修改失败'
            }
        }
    } catch (error) {
        console.error('更新预约失败：', error)
        return {
            code: 500,
            message: '修改预约失败',
            error: error.message
        }
    }
}

// 获取预约信息
async function getReservation(reservationId) {
    console.log('开始获取预约信息，预约ID：', reservationId)
    console.log('使用的数据库集合：', RESERVATIONS_COLLECTION)

    try {
        const res = await db.collection(RESERVATIONS_COLLECTION).doc(reservationId).get()

        console.log('数据库查询结果：', res)

        if (res.data) {
            console.log('成功获取预约信息：', res.data)
            return {
                code: 200,
                message: '获取成功',
                data: res.data
            }
        } else {
            console.log('预约记录不存在')
            return {
                code: 404,
                message: '预约记录不存在'
            }
        }
    } catch (error) {
        console.error('获取预约失败：', error)
        return {
            code: 500,
            message: '获取预约信息失败',
            error: error.message
        }
    }
}
