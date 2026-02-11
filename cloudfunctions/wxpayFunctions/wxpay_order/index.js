const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 生成唯一订单号
function generateOrderNo() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

  return `${year}${month}${day}${hours}${minutes}${seconds}${random}`;
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { _orderId, orderNo, description, isRetry = false } = event;

  try {
    // 1. 从数据库查询订单信息
    const orderResult = await db.collection('Order').doc(_orderId).get();
    const order = orderResult.data;
    const realAmount = order.actualAmount;

    let finalOrderNo = orderNo;
    let needUpdateOrder = false;

    // 2. 如果是重新支付，检查原订单号状态并决定是否生成新订单号
    if (isRetry) {
      console.log('重新支付流程，检查订单状态');

      try {
        // 查询微信支付订单状态
        const queryResult = await cloud.callFunction({
          name: 'cloudbase_module',
          data: {
            name: 'wxpay_query_order_by_out_trade_no',
            data: {
              out_trade_no: orderNo,
            },
          },
        });

        if (queryResult.result && queryResult.result.data.trade_state) {
          const tradeState = queryResult.result.data.trade_state;

          if (tradeState === 'NOTPAY') {
            console.log('原订单未支付，尝试关闭后重新生成');

            // 尝试关闭原订单
            try {
              await cloud.callFunction({
                name: 'cloudbase_module',
                data: {
                  name: 'wxpay_close_order',
                  data: {
                    out_trade_no: orderNo,
                  },
                },
              });
              console.log('原订单关闭成功');
            } catch (closeError) {
              console.log('关闭订单失败，可能已超时自动关闭:', closeError.message);
            }

            // 生成新订单号
            finalOrderNo = generateOrderNo();
            needUpdateOrder = true;

          } else if (tradeState === 'SUCCESS') {
            return {
              code: 400,
              message: '订单已支付成功，无需重新支付'
            };
          }
        }
      } catch (queryError) {
        console.log('查询订单失败，生成新订单号:', queryError.message);
        // 查询失败时生成新订单号
        finalOrderNo = generateOrderNo();
        needUpdateOrder = true;
      }
    }

    // 3. 如果需要更新订单号，先更新数据库
    if (needUpdateOrder) {
      console.log('更新订单号:', orderNo, '->', finalOrderNo);

      await db.collection('Order').doc(_orderId).update({
        data: {
          orderNo: finalOrderNo,
        }
      });

    }

    // 4. 调用微信支付统一下单
    console.log('使用订单号:', finalOrderNo, '金额(分):', Math.round(realAmount * 100));

    const res = await cloud.callFunction({
      name: 'cloudbase_module',
      data: {
        name: 'wxpay_order',
        data: {
          description: description || '商品购买',
          amount: {
            total: Math.round(realAmount * 100), // 使用实际订单金额（元转分），微信支付最小金额1分
            currency: 'CNY',
          },
          out_trade_no: finalOrderNo,
          payer: {
            openid: wxContext.OPENID,
          },
        },
      },
    });

    // 5. 返回结果，包含新的订单号（如果生成了的话）
    const result = { ...res.result };
    if (finalOrderNo !== orderNo) {
      result.newOrderNo = finalOrderNo;
      result.message = '已生成新订单号重新支付';
    }

    return result;
  } catch (error) {
    console.error('微信支付下单异常:', error);
    return {
      code: 500,
      message: '支付下单失败: ' + error.message
    };
  }
};