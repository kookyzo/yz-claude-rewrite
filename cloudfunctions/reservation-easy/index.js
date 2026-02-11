// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const RESERVATIONS_COLLECTION = 'reservation-easy'; // 定义集合名称

// 云函数入口函数
exports.main = async (event, context) => {
    console.log('reservation-easy云函数开始执行，接收到的参数：', event)

    const { action, name, phone, people, date, selectedTimes, submissionCount } = event
    const { OPENID } = cloud.getWXContext()

    console.log('用户OpenID：', OPENID)
    console.log('操作类型：', action)

    try {
        switch (action) {
            case 'add':
                return await addReservation(OPENID, { name, phone, people, date, selectedTimes, submissionCount })
            case 'get':
                return await getReservation(OPENID, event.reservationId)
            case 'list':
                return await listReservations(OPENID)
            case 'delete':
                return await deleteReservation(OPENID, event.reservationId)
            default:
                return {
                    code: 400,
                    message: '未知的操作类型'
                }
        }
    } catch (err) {
        console.error('reservation-easy云函数执行错误：', err)
        return {
            code: 500,
            message: '服务器内部错误'
        }
    }
}

// 添加预约
async function addReservation(openId, reservationData) {
    console.log('开始处理预约，OpenID：', openId)
    console.log('预约数据：', reservationData)

    const { name, phone, people, date, selectedTimes, submissionCount } = reservationData

    // 验证必要字段
    if (!name || !phone || !people || !date) {
        return {
            code: 400,
            message: '缺少必要预约信息: 姓名、电话、人数、预约时间'
        }
    }

    try {
        // 检查用户是否已经预约过（避免重复预约）
        const existingReservation = await db.collection(RESERVATIONS_COLLECTION).where({
            openId: openId
        }).get()

        console.log('查询现有预约结果：', existingReservation)

        if (existingReservation.data.length > 0) {
            return {
                code: 400,
                message: '您已预约过，请勿重复预约'
            }
        }

        // 创建预约记录
        const createResult = await db.collection(RESERVATIONS_COLLECTION).add({
            data: {
                openId: openId,
                name: name,
                phone: phone,
                people: people,
                date: date,
                selectedTimes: selectedTimes || [],
                submissionCount: submissionCount || 0,
                createTime: Date.now(),
                status: 'confirmed' // 预约状态：confirmed, cancelled
            }
        })

        console.log('创建预约记录：', createResult)

        // 获取创建的预约信息
        const newReservationResult = await db.collection(RESERVATIONS_COLLECTION).doc(createResult._id).get()

        return {
            code: 200,
            message: '预约成功',
            data: {
                _id: createResult._id,
                ...newReservationResult.data
            }
        }
    } catch (err) {
        console.error('预约处理错误：', err)
        return {
            code: 500,
            message: '预约失败'
        }
    }
}

// 获取预约详情
async function getReservation(openId, reservationId) {
    console.log('获取预约详情，OpenID：', openId, '预约ID：', reservationId)

    if (!reservationId) {
        return {
            code: 400,
            message: '缺少必要参数: reservationId'
        }
    }

    try {
        const reservation = await db.collection(RESERVATIONS_COLLECTION).where({
            _id: reservationId,
            openId: openId // 确保只能获取自己的预约
        }).get()

        if (reservation.data.length === 0) {
            return {
                code: 404,
                message: '预约不存在或无权访问'
            }
        }

        return {
            code: 200,
            message: '获取预约成功',
            data: reservation.data[0]
        }
    } catch (err) {
        console.error('获取预约详情错误：', err)
        return {
            code: 500,
            message: '获取预约详情失败'
        }
    }
}

// 列出用户所有预约
async function listReservations(openId) {
    console.log('列出用户预约，OpenID：', openId)

    try {
        const reservations = await db.collection(RESERVATIONS_COLLECTION).where({
            openId: openId
        }).orderBy('createTime', 'desc').get()

        return {
            code: 200,
            message: '获取预约列表成功',
            data: reservations.data
        }
    } catch (err) {
        console.error('获取预约列表错误：', err)
        return {
            code: 500,
            message: '获取预约列表失败'
        }
    }
}

// 删除预约
async function deleteReservation(openId, reservationId) {
    console.log('删除预约，OpenID：', openId, '预约ID：', reservationId)

    if (!reservationId) {
        return {
            code: 400,
            message: '缺少必要参数: reservationId'
        }
    }

    try {
        const deleteResult = await db.collection(RESERVATIONS_COLLECTION).where({
            _id: reservationId,
            openId: openId // 确保只能删除自己的预约
        }).remove()

        if (deleteResult.stats.removed === 0) {
            return {
                code: 404,
                message: '预约不存在或删除失败'
            }
        }

        return {
            code: 200,
            message: '预约删除成功'
        }
    } catch (err) {
        console.error('删除预约错误：', err)
        return {
            code: 500,
            message: '删除预约失败'
        }
    }
}
