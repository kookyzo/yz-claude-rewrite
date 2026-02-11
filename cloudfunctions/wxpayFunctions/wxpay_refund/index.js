/**
 * 微信支付 - 申请退款
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const {_orderId, transaction_id, out_trade_no, out_refund_no,amount } = event.data;
  const order = await db.collection('Order').doc(_orderId).get();
  const realAmount = order.data.actualAmount; // 从数据库获取真实金额
    const res = await cloud.callFunction({
        name: 'cloudbase_module',
        data: {
            name: 'wxpay_refund',
            data: {
               out_trade_no:out_trade_no,
                transaction_id: transaction_id, // 微信订单号
                out_refund_no: out_refund_no,  // 商户内部退款单号
                reason:'全款',
                amount: {
                    refund: 1, // 退款金额 Math.round(refund_amount * 100),
                    total: 1, // 原订单金额, Math.round(realAmount * 100),
                    currency: 'CNY',
                },
            },
        },
    });
    return res.result;
};


