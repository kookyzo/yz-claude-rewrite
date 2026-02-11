// cloudfunctions/refund/index.js
const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 退款申请云函数入口函数
exports.main = async (event, context) => {
    const { action, data } = event;
    const {
        _userId,
        orderId,
        description,
        phone,
        createTime
    } = data || {};

    // 获取用户OpenID（腾讯云自动注入）
    const { OPENID } = cloud.getWXContext();

    // 通用错误处理函数
    const handleError = (err) => {
        console.error('Error:', err);
        return { code: 500, message: err.message || '操作失败' };
    };

    try {
        switch (action) {
            case 'create':
                return await createRefundApplication(_userId, orderId, description, phone, createTime, OPENID);

            case 'list':
                return await getRefundList(_userId, OPENID);

            case 'detail':
                return await getRefundDetail(data.refundId, _userId, OPENID);

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

/**
 * 创建退款申请
 */
async function createRefundApplication(userId, orderId, description, phone, createTime, openId) {
    // 参数验证
    if (!userId || !orderId || !description || !phone) {
        return {
            code: 400,
            message: "缺少必要参数: userId, orderId, description 或 phone"
        };
    }

    // 验证手机号格式
    const phoneReg = /^1[3-9]\d{9}$/;
    if (!phoneReg.test(phone)) {
        return {
            code: 400,
            message: "手机号格式不正确"
        };
    }

    try {
        // 生成退款申请ID
        const refundId = `refund_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        // 创建退款申请数据
        const refundData = {
            refundId,
            userId: { _id: userId },
            orderId: orderId.trim(),
            description: description.trim(),
            phone: phone.trim(),
            status: 'pending', // 待处理
            createTime: createTime || new Date().toISOString(),
            updateTime: new Date().toISOString(),
            _openid: openId
        };

        // 保存到数据库
        const result = await db.collection('refund_applications').add({
            data: refundData
        });

        if (!result._id) {
            throw new Error("创建退款申请失败");
        }

        const newRefund = {
            _id: result._id,
            ...refundData
        };

        console.log('[Refund] 退款申请创建成功:', newRefund);

        return {
            code: 200,
            message: "退款申请提交成功",
            data: {
                refundId: newRefund.refundId,
                status: newRefund.status,
                createTime: newRefund.createTime
            }
        };

    } catch (err) {
        console.error('[Refund] 创建退款申请失败:', err);
        return {
            code: 500,
            message: "创建退款申请失败: " + err.message
        };
    }
}

/**
 * 获取用户退款申请列表
 */
async function getRefundList(userId, openId) {
    if (!userId) {
        return {
            code: 400,
            message: "缺少必要参数: userId"
        };
    }

    try {
        const result = await db.collection('refund_applications')
            .where({
                'userId._id': userId
            })
            .orderBy('_createTime', 'desc')
            .get();

        return {
            code: 200,
            message: "获取退款申请列表成功",
            data: {
                refunds: result.data || [],
                totalCount: result.data.length
            }
        };

    } catch (err) {
        console.error('[Refund] 获取退款申请列表失败:', err);
        return {
            code: 500,
            message: "获取退款申请列表失败: " + err.message
        };
    }
}

/**
 * 获取退款申请详情
 */
async function getRefundDetail(refundId, userId, openId) {
    if (!refundId || !userId) {
        return {
            code: 400,
            message: "缺少必要参数: refundId 或 userId"
        };
    }

    try {
        const result = await db.collection('refund_applications')
            .where({
                refundId: refundId,
                'userId._id': userId
            })
            .get();

        if (!result.data || result.data.length === 0) {
            return {
                code: 404,
                message: "退款申请不存在或无权查看"
            };
        }

        return {
            code: 200,
            message: "获取退款申请详情成功",
            data: result.data[0]
        };

    } catch (err) {
        console.error('[Refund] 获取退款申请详情失败:', err);
        return {
            code: 500,
            message: "获取退款申请详情失败: " + err.message
        };
    }
}