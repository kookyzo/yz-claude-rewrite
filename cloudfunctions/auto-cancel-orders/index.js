// auto-cancel-orders/index.js

// "triggers": [
//   {
//     "name": "autoCancelOrders",
//     "type": "timer",
//     "config": "0 */5 * * * * *"  
//   }
// ]

const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

exports.main = async (event, context) => {
  try {
    const result = await cloud.callFunction({
      name: 'manage-order',
      data: {
        action: 'autoCancelExpiredOrders'
      }
    });
    
    console.log('自动取消订单任务执行结果:', result);
    return result;
  } catch (error) {
    console.error('自动取消订单任务异常:', error);
    return {
      code: 500,
      message: '任务执行异常: ' + error.message
    };
  }
};