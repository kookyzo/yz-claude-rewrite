const {
  init
} = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const client = init(cloud);
const models = client.models;
const db = cloud.database();
const _ = db.command;

// 订单状态常量
const ORDER_STATUS = {
  PENDING_PAYMENT: 'pending_payment',// 待支付
  PAID: 'paid',// 已支付
  SHIPPING: 'shipping',// 发货中
  SIGNED: 'signed', // 已签收
  CANCELLED: 'cancelled',// 已取消
  REFUNDING: 'refunding',// 退款中
  REFUNDED: 'refunded', // 已退款
  PRESALE_CANCELLED: 'presale_canceled',                 // 预售已取消
  PRESALE_DEPOSIT_PENDING: 'presale_deposit_pending',    // 定金待支付
  PRESALE_DEPOSIT_PAID: 'presale_deposit_paid',          // 定金已支付
  PRESALE_BALANCE_PENDING: 'presale_balance_pending',    // 尾款待支付
  PRESALE_BALANCE_PAID: 'presale_balance_paid',          // 尾款已支付
};

const PRESALE_STATUS = {
  DEPOSIT_PENDING: 'deposit_pending',      // 定金待支付
  DEPOSIT_PAID: 'deposit_paid',            // 定金已支付
  BALANCE_PENDING: 'balance_pending',      // 尾款待支付
  BALANCE_PAID: 'balance_paid',         // 尾款已支付
  CANCELLED: 'canceled',                 // 预售已取消
};

// 订单管理云函数入口函数
exports.main = async (event, context) => {
  const { action, data } = event;
  const {
    _userId,
    _addressId,
    _orderId,
    newStatus,
    payMethod,
    logisticsNo,
    refundReason,
    refundAmount,
    skuId,
    quantity,
    updateData
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
      // 从购物车创建订单
      case 'createOrderFromCart':
        return await createOrderFromCart(_userId, _addressId, OPENID);

      // 直接购买创建订单
      case 'createDirectOrder':
        return await createDirectOrder(data, OPENID);

      // 更新订单状态
      case 'updateOrderStatus':
        return await updateOrderStatus(updateData._orderId, updateData.newStatus,
          updateData.payMethod,
          updateData._userId,
          updateData.transactionId,
          updateData.payTime,
          OPENID,
          updateData.logisticsNo,);

      // 获取订单详情
      case 'getOrderDetail':
        return await getOrderDetail(_orderId, _userId, OPENID);

      // 获取用户订单列表
      case 'getUserOrders':
        return await getUserOrders(_userId, data.status, OPENID);

      // 申请退款
      case 'applyRefund':
        return await applyRefund(_orderId, _userId, refundReason, refundAmount, OPENID);

      // 取消订单
      case 'cancelOrder':
        return await cancelOrder(_orderId, _userId, OPENID);

      // 确认收货
      case 'confirmReceipt':
        return await confirmReceipt(_orderId, _userId, OPENID);

      // 支付尾款（预售订单）
      case 'payBalance':
        return await payBalance(_orderId, _userId, OPENID);

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
 * 从购物车选中的商品创建订单
 * 自动根据SKU的预售标识判断订单类型
 */
async function createOrderFromCart(userId, addressId, openId) {

  if (!userId || !addressId) {
    return {
      code: 400,
      message: "缺少必要参数: userId 或 addressId"
    };
  }

  // 1. 获取用户的购物车和选中的商品
  const { data: cartData } = await models.Carts.list({
    filter: {
      where: {
        userId: { $eq: userId }
      }
    },
    envType: "prod"
  });

  if (!cartData.records || cartData.records.length === 0) {
    return {
      code: 400,
      message: "用户购物车不存在"
    };
  }

  const cart = cartData.records[0];

  // 获取购物车中选中的商品
  const { data: selectedItems } = await models.CartItems.list({
    select: {
      $master: true,
      cartItem_Spu: true,
      cartItem_Sku: true,
    },
    filter: {
      where: {
        cartId: { $eq: cart._id },
        status: { $eq: true }
      }
    },
    envType: "prod"
  });

  if (!selectedItems.records || selectedItems.records.length === 0) {
    return {
      code: 400,
      message: "购物车内无选中商品"
    };
  }

  // 2. 验证地址是否存在
  const { data: address } = await models.Addresses.get({
    filter: {
      where: {
        _id: { $eq: addressId },
        userId: { $eq: userId }
      }
    },
    envType: "prod"
  });

  if (!address) {
    return {
      code: 404,
      message: "收货地址不存在或无权使用"
    };
  }

  // 3. 计算总金额并获取商品详情
  let totalAmount = 0;
  let isPresaleOrder = false;
  let presaleType = null;
  const orderItemsData = [];
  const skuStockMap = new Map();

  // 检查购物车中商品的预售状态
  for (const item of selectedItems.records) {
    if (!item.cartItem_Sku) {
      return {
        code: 400,
        message: `购物车商品${item._id}缺少规格信息`
      };
    }

    const { data: skuInfo } = await models.ProductSkus.get({
      filter: {
        where: {
          _id: { $eq: item.cartItem_Sku._id },
          isOnSale: { $eq: true }
        }
      },
      envType: "prod"
    });

    if (!skuInfo) {
      return {
        code: 404,
        message: `商品规格不存在或已下架: ${item.cartItem_Sku._id}`
      };
    }

    // 检查SKU的预售信息
    if (skuInfo.presaleFlag) {
      isPresaleOrder = true;
      if (!presaleType) {
        presaleType = skuInfo.presaleType || 'deposit';
      }

      // 预售商品限购检查
      const limitCheckResult = await checkPresaleLimit(userId, [item]);
      if (limitCheckResult.code !== 200) {
        return limitCheckResult;
      }
    } else {
      // 普通商品检查库存
      const stockResult = await checkAndDeductStock(skuInfo._id, item.quantity);
      if (stockResult.code !== 200) {
        return stockResult;
      }
    }

    // 获取SPU信息
    const { data: spuInfo } = await models.ProductSpus.get({
      filter: {
        where: {
          _id: { $eq: item.cartItem_Spu._id }
        }
      },
      envType: "prod"
    });

    if (!spuInfo) {
      return {
        code: 404,
        message: `商品不存在或已下架: ${skuInfo.spuId}`
      };
    }

    // 计算小计
    const itemSubtotal = item.quantity * item.unitPrice;
    totalAmount += itemSubtotal;

    // 保存SKU库存信息用于后续可能的回滚
    if (!skuInfo.presaleFlag) {
      skuStockMap.set(skuInfo._id, {
        skuId: skuInfo._id,
        originalStock: skuInfo.stock,
        quantity: item.quantity
      });
    }

    // 准备订单项数据
    const orderItemData = {
      skuId: { _id: skuInfo._id },
      itemId: null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: itemSubtotal,
      presaleFlag: skuInfo.presaleFlag || false
    };

    // 如果是预售商品，添加预售信息
    if (skuInfo.presaleFlag) {
      orderItemData.presaleType = skuInfo.presaleType;
      orderItemData.presaleUnitDeposit = skuInfo.depositAmount || 0;
      orderItemData.presaleUnitBalance = skuInfo.balanceAmount || 0;
    }

    orderItemsData.push(orderItemData);
  }

  // 4. 根据预售类型计算实际支付金额
  let actualAmount = totalAmount;
  let depositAmount = 0;
  let balanceAmount = 0;

  if (isPresaleOrder) {
    if (presaleType === 'full') {
      // 全款预售：支付全额
      depositAmount = totalAmount;
      balanceAmount = 0;
      actualAmount = totalAmount;
    } else {
      // 定金预售：只支付定金
      // 计算所有预售商品的总定金
      depositAmount = orderItemsData
        .filter(item => item.presaleFlag)
        .reduce((sum, item) => sum + (item.presaleUnitDeposit * item.quantity), 0);

      balanceAmount = totalAmount - depositAmount;
      actualAmount = depositAmount;
    }
  }

  // 5. 生成订单号
  const orderNo = generateOrderNo();
  const orderId = `order${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // 6. 确定订单状态
  let orderStatus = ORDER_STATUS.PENDING_PAYMENT;
  let presaleStatus = null;

  if (isPresaleOrder) {
    if (presaleType === 'full') {
      orderStatus = ORDER_STATUS.PRESALE_DEPOSIT_PENDING;
      presaleStatus = PRESALE_STATUS.DEPOSIT_PENDING;
    } else {
      orderStatus = ORDER_STATUS.PRESALE_DEPOSIT_PENDING;
      presaleStatus = PRESALE_STATUS.DEPOSIT_PENDING;
    }
  }

  // 7. 创建订单（使用事务确保原子性）
  const transaction = await db.startTransaction();
  try {
    // 创建订单记录
    const orderData = {
      orderId,
      orderNo,
      userId: { _id: userId },
      totalAmount: totalAmount,
      actualAmount: actualAmount,
      status: orderStatus,
      addressId: { _id: addressId },
      _owner: openId,
      version: 0,
      presaleFlag: isPresaleOrder
    };

    // 添加预售相关字段
    if (isPresaleOrder) {
      orderData.presaleType = presaleType;
      orderData.depositAmount = depositAmount;
      orderData.balanceAmount = balanceAmount;
      orderData.presaleStatus = presaleStatus;

      // 如果是定金预售，添加尾款时间
      if (presaleType === 'deposit') {
        // 从第一个预售商品获取尾款时间
        const firstPresaleItem = orderItemsData.find(item => item.presaleFlag);
        if (firstPresaleItem) {
          const { data: presaleSku } = await models.ProductSkus.get({
            filter: { where: { _id: { $eq: firstPresaleItem.skuId._id } } },
            envType: "prod"
          });

          if (presaleSku && presaleSku.balanceStartTime && presaleSku.balanceEndTime) {
            // 确保时间字段是数字（时间戳）
            orderData.balanceStartTime = typeof presaleSku.balanceStartTime === 'string'
              ? new Date(presaleSku.balanceStartTime).getTime()
              : presaleSku.balanceStartTime;

            orderData.balanceEndTime = typeof presaleSku.balanceEndTime === 'string'
              ? new Date(presaleSku.balanceEndTime).getTime()
              : presaleSku.balanceEndTime;
          }
        }
      }
    }

    const { data: newOrder } = await models.Order.create({
      data: orderData,
      envType: "prod"
    });

    if (!newOrder) {
      throw new Error("创建订单失败");
    }

    // 创建订单项
    const orderItems = [];
    for (const itemData of orderItemsData) {
      const { data: newOrderItem } = await models.OrderItems.create({
        data: {
          ...itemData,
          orderId: { _id: newOrder.id }
        },
        envType: "prod"
      });

      if (!newOrderItem) {
        throw new Error("创建订单项失败");
      }

      orderItems.push(newOrderItem);
    }

    // 清空购物车中已购买的商品
    const cartItemIds = selectedItems.records.map(item => item._id);
    await models.CartItems.deleteMany({
      filter: {
        where: {
          _id: { $in: cartItemIds }
        }
      },
      envType: "prod"
    });

    // 提交事务
    await transaction.commit();

    return {
      code: 200,
      message: "订单创建成功",
      data: {
        order: newOrder,
        orderItems,
        orderNo,
        totalAmount,
        actualAmount,
        isPresale: isPresaleOrder,
        presaleType: presaleType
      }
    };
  } catch (err) {
    // 回滚事务
    await transaction.rollback();

    // 回滚库存（普通商品）
    if (!isPresaleOrder) {
      await rollbackStock(skuStockMap);
    }

    return {
      code: 500,
      message: err.message || "创建订单失败，已回滚操作"
    };
  }
}



/**
 * 直接购买创建订单
 * 自动根据SKU的预售标识判断订单类型
 */
async function createDirectOrder(orderData, openId) {
  const {
    _userId,
    _addressId,
    _skuId,
    quantity
  } = orderData;

  // 验证参数
  if (!_userId || !_addressId || !_skuId || !quantity) {
    return {
      code: 400,
      message: "缺少必要参数: userId, addressId, skuId 或 quantity"
    };
  }

  // 获取SKU信息
  const { data: skuInfo } = await models.ProductSkus.get({
    filter: {
      where: {
        _id: { $eq: _skuId },
        isOnSale: { $eq: true }
      }
    },
    envType: "prod"
  });

  if (!skuInfo) {
    return {
      code: 404,
      message: "商品不存在或已下架"
    };
  }

  // 验证地址
  const { data: address } = await models.Addresses.get({
    filter: {
      where: {
        _id: { $eq: _addressId },
        userId: { $eq: _userId }
      }
    },
    envType: "prod"
  });

  if (!address) {
    return {
      code: 404,
      message: "收货地址不存在或无权使用"
    };
  }

  const isPresale = skuInfo.presaleFlag || false;
  const presaleType = skuInfo.presaleType || 'deposit';

  // 预售商品限购检查
  if (isPresale) {
    const limitCheckResult = await checkPresaleLimit(_userId, [{ cartItem_Sku: { _id: _skuId }, quantity }]);
    if (limitCheckResult.code !== 200) {
      return limitCheckResult;
    }
  } else {
    // 普通商品检查库存
    const stockResult = await checkAndDeductStock(_skuId, quantity);
    if (stockResult.code !== 200) {
      return stockResult;
    }
  }

  // 计算金额
  const unitPrice = skuInfo.price || skuInfo.unitPrice;
  const totalAmount = unitPrice * quantity;

  // 根据预售类型计算实际支付金额
  let actualAmount = totalAmount;
  let depositAmount = 0;
  let balanceAmount = 0;

  if (isPresale) {
    if (presaleType === 'full') {
      // 全款预售：支付全额
      depositAmount = totalAmount;
      balanceAmount = 0;
      actualAmount = totalAmount;
    } else {
      // 定金预售：只支付定金
      depositAmount = skuInfo.depositAmount || (totalAmount * 0.1); // 默认10%定金
      balanceAmount = totalAmount - depositAmount;
      actualAmount = depositAmount;
    }
  }

  // 确定订单状态
  let orderStatus = ORDER_STATUS.PENDING_PAYMENT;
  let presaleStatus = null;

  if (isPresale) {
    if (presaleType === 'full') {
      orderStatus = ORDER_STATUS.PRESALE_DEPOSIT_PENDING;
      presaleStatus = PRESALE_STATUS.DEPOSIT_PENDING;
    } else {
      orderStatus = ORDER_STATUS.PRESALE_DEPOSIT_PENDING;
      presaleStatus = PRESALE_STATUS.DEPOSIT_PENDING;
    }
  }

  // 生成订单
  const orderNo = generateOrderNo();
  const orderId = `order${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // 使用事务确保数据一致性
  const transaction = await db.startTransaction();
  try {
    // 创建订单数据
    const orderDataToCreate = {
      orderId,
      orderNo,
      userId: { _id: _userId },
      totalAmount: totalAmount,
      actualAmount: actualAmount,
      status: orderStatus,
      addressId: { _id: _addressId },
      _owner: openId,
      presaleFlag: isPresale,
      version: 0,
    };

    // 添加预售相关字段
    if (isPresale) {
      orderDataToCreate.presaleType = presaleType;
      orderDataToCreate.depositAmount = depositAmount;
      orderDataToCreate.balanceAmount = balanceAmount;
      orderDataToCreate.presaleStatus = presaleStatus;

      if (presaleType === 'deposit') {
        if (skuInfo.balanceStartTime && skuInfo.balanceEndTime) {
          orderDataToCreate.balanceStartTime = typeof skuInfo.balanceStartTime === 'string'
            ? new Date(skuInfo.balanceStartTime).getTime()
            : skuInfo.balanceStartTime;

          orderDataToCreate.balanceEndTime = typeof skuInfo.balanceEndTime === 'string'
            ? new Date(skuInfo.balanceEndTime).getTime()
            : skuInfo.balanceEndTime;
        } else {
          return {
            code: 400,
            message: "定金预售商品必须设置尾款支付时间"
          };
        }
      }
    }

    const { data: newOrder } = await models.Order.create({
      data: orderDataToCreate,
      envType: "prod"
    });

    if (!newOrder) {
      throw new Error("创建订单失败");
    }

    // 创建订单项
    const orderItemData = {
      skuId: { _id: _skuId },
      itemId: null,
      quantity,
      unitPrice,
      subtotal: totalAmount,
      actualAmount,
      presaleFlag: isPresale
    };

    // 添加预售信息到订单项
    if (isPresale) {
      orderItemData.presaleType = presaleType;
      orderItemData.presaleUnitDeposit = depositAmount / quantity;
      orderItemData.presaleUnitBalance = balanceAmount / quantity;
    }

    const { data: newOrderItem } = await models.OrderItems.create({
      data: {
        ...orderItemData,
        orderId: { _id: newOrder.id }
      },
      envType: "prod"
    });

    if (!newOrderItem) {
      throw new Error("创建订单项失败");
    }

    // 提交事务
    await transaction.commit();

    return {
      code: 200,
      message: "订单创建成功",
      data: {
        order: newOrder,
        orderItem: newOrderItem,
        orderNo,
        totalAmount,
        isPresale: isPresale,
        presaleType: presaleType
      }
    };
  } catch (err) {
    // 回滚事务
    await transaction.rollback();

    // 回滚库存（普通商品）
    if (!isPresale) {
      await restoreSkuStock(_skuId, quantity);
    }

    return {
      code: 500,
      message: "创建订单失败: " + err.message
    };
  }
}

/**
 * 更新订单状态（支持支付信息完善）
 */
async function updateOrderStatus(orderId, newStatus, payMethod, userId, transactionId, payTime, OPENID, logisticsNo) {
  if (!orderId || !newStatus) {
    return {
      code: 400,
      message: "缺少必要参数: orderId 或 newStatus"
    };
  }

  // 验证订单是否存在且属于当前用户
  const { data: order } = await models.Order.get({
    filter: {
      where: {
        _id: { $eq: orderId },
        userId: { $eq: userId }
      }
    },
    envType: "prod"
  });

  if (!order) {
    return {
      code: 404,
      message: "订单不存在或无权操作"
    };
  }

  // 验证状态流转是否合法
  const validTransitions = getValidStatusTransitions(order.status);
  if (!validTransitions.includes(newStatus)) {
    return {
      code: 400,
      message: `不允许从 ${order.status} 状态转换到 ${newStatus} 状态`
    };
  }

  // 准备更新数据
  const updateData = {
    status: newStatus,
    _updateTime: new Date(),
    version: order.version + 1
  };

  // 根据新状态添加额外字段
  switch (newStatus) {
    case ORDER_STATUS.PAID:
    case ORDER_STATUS.PRESALE_DEPOSIT_PAID:
      updateData.payTime = payTime ? new Date(payTime).getTime() : new Date().getTime();
      updateData.payMethod = payMethod || order.payMethod;

      // 微信支付相关信息
      if (transactionId) {
        updateData.transactionId = transactionId;
      }
      // if ( bankType) {
      //   updateData.bankType =  bankType;
      // }
      // if ( actualPayAmount) {
      //   updateData.actualPayAmount =  actualPayAmount;
      // }
      break;

    case ORDER_STATUS.PRESALE_BALANCE_PAID:
      updateData.balancePayTime = new Date();
      updateData.totalAmount = order.depositAmount + order.balanceAmount;
      updateData.presaleStatus = PRESALE_STATUS.BALANCE_PAID;
      break;

    case ORDER_STATUS.SHIPPING:
      updateData.shipTime = new Date();
      updateData.logisticsNo = logisticsNo;
      break;

    case ORDER_STATUS.SIGNED:
      updateData.signTime = new Date();
      break;

    case ORDER_STATUS.CANCELLED:
    case ORDER_STATUS.PRESALE_CANCELLED:
      updateData.cancelTime = new Date();
      updateData.cancelReason = cancelReason || '用户取消';
      // 取消订单时恢复库存（普通商品）
      if (!order.presaleFlag) {
        await restoreStockAfterCancel(order._id);
      }
      break;

    case ORDER_STATUS.REFUNDED:
      updateData.refundTime = new Date();
      // 退款成功时恢复库存（普通商品）
      if (!order.presaleFlag) {
        await restoreStockAfterCancel(order._id);
      }
      break;
  }

  // 更新订单（带乐观锁条件）
  const { data: updatedOrder } = await models.Order.update({
    filter: {
      where: {
        _id: { $eq: orderId },
        version: { $eq: order.version }
      }
    },
    data: updateData,
    envType: "prod"
  });

  if (!updatedOrder) {
    return {
      code: 409,
      message: "订单状态已被其他操作更新，请刷新后重试"
    };
  }

  // 如果是预售订单支付了定金，更新预售状态
  if (order.presaleFlag && newStatus === ORDER_STATUS.PRESALE_DEPOSIT_PAID) {
    await models.Order.update({
      filter: {
        where: { _id: { $eq: orderId } }
      },
      data: {
        presaleStatus: PRESALE_STATUS.DEPOSIT_PAID
      },
      envType: "prod"
    });
  }

  return {
    code: 200,
    message: "订单状态已更新",
    data: updatedOrder
  };
}
/**
 * 获取订单详情
 */
async function getOrderDetail(orderId, userId, openId) {
  if (!orderId || !userId) {
    return {
      code: 400,
      message: "缺少必要参数: orderId 或 userId"
    };
  }

  // 获取订单信息
  const { data: order } = await models.Order.get({
    filter: {
      where: {
        _id: { $eq: orderId },
        userId: { $eq: userId }
      }
    },
    select: {
      $master: true,
      addressId: true,
    },
    envType: "prod"
  });

  if (!order) {
    return {
      code: 404,
      message: "订单不存在或无权查看"
    };
  }

  // 获取订单项
  const { data: orderItems } = await models.OrderItems.list({
    filter: {
      where: {
        orderId: { $eq: order._id }
      }
    },
    envType: "prod"
  });

  // 获取订单项关联的SKU信息
  const itemsWithDetails = await Promise.all(
    orderItems.records.map(async (item) => {
      const { data: skuData } = await models.ProductSkus.get({
        filter: {
          where: {
            _id: { $eq: item.skuId }
          }
        },
        envType: "prod"
      });

      // 获取SPU信息用于商品名称和图片
      let spuInfo = null;
      if (skuData && skuData.spuId) {
        const { data: spuData } = await models.ProductSpus.get({
          filter: {
            where: {
              _id: { $eq: skuData.spuId }
            }
          },
          envType: "prod"
        });
        spuInfo = spuData;
      }

      return {
        ...item,
        skuInfo: skuData ? {
          nameCN: skuData.nameCN,
          nameEN: skuData.nameEN,
          skuMainImages: skuData.skuMainImages,
          material: skuData.material,
          size: skuData.size,
          price: skuData.price,
          spuInfo: spuInfo ? {
            mainImages: spuInfo.mainImages
          } : null,
        } : null
      };
    })
  );

  // 获取收货地址信息
  const { data: address } = await models.Addresses.get({
    filter: {
      where: {
        _id: { $eq: order.addressId._id }
      }
    },
    envType: "prod"
  });

  return {
    code: 200,
    message: "获取订单详情成功",
    data: {
      order,
      orderItems: itemsWithDetails,
      address
    }
  };
}

/**
 * 获取用户订单列表
 */
async function getUserOrders(userId, status, openId) {
  if (!userId) {
    return {
      code: 400,
      message: "缺少必要参数: userId"
    };
  }

  // 构建查询条件
  const whereCondition = {
    userId: { $eq: userId }
  };

  // 如果指定了状态，添加状态过滤
  if (status) {
    whereCondition.status = { $eq: status };
  }

  // 获取订单列表
  const { data: orders } = await models.Order.list({
    filter: {
      where: whereCondition,
      order: [['_createTime', 'desc']] // 按创建时间倒序
    },
    envType: "prod",
    getCount: true, // 开启用来获取总数
  });

  // 为每个订单获取简要的订单项信息
  const ordersWithItems = await Promise.all(
    orders.records.map(async (order) => {
      const { data: items } = await models.OrderItems.list({
        filter: {
          where: {
            orderId: { $eq: order._id }
          },
          limit: 3 // 最多取3个用于展示
        },
        envType: "prod"
      });

      // 获取商品图片信息
      const itemsWithImages = await Promise.all(
        items.records.map(async (item) => {
          const { data: skuData } = await models.ProductSkus.get({
            filter: {
              where: {
                _id: { $eq: item.skuId }
              }
            },
            envType: "prod"
          });

          return {
            ...item,
            skuImage: skuData ? skuData.skuMainImages : null,
            skuNameCN: skuData ? skuData.nameCN : null,
            skuNameEN: skuData ? skuData.nameEN : null,
          };
        })
      );

      return {
        ...order,
        itemCount: items.totalCount, // 订单商品总数
        items: itemsWithImages
      };
    })
  );

  return {
    code: 200,
    message: "获取订单列表成功",
    data: {
      orders: ordersWithItems,
      totalCount: orders.total
    }
  };
}

/**
 * 申请退款
 */
async function applyRefund(orderId, userId, refundReason, refundAmount, openId) {
  if (!orderId || !userId) {
    return {
      code: 400,
      message: "缺少必要参数: orderId 或 userId"
    };
  }

  // 获取订单信息
  const { data: order } = await models.Order.get({
    filter: {
      where: {
        _id: { $eq: orderId },
        userId: { $eq: userId }
      }
    },
    envType: "prod"
  });

  if (!order) {
    return {
      code: 404,
      message: "订单不存在或无权操作"
    };
  }

  // 检查订单状态是否允许退款
  const canRefund = [
    ORDER_STATUS.PAID,
    ORDER_STATUS.SHIPPING,
    ORDER_STATUS.PRESALE_DEPOSIT_PAID,
    ORDER_STATUS.PRESALE_BALANCE_PAID
  ].includes(order.status);

  if (!canRefund) {
    return {
      code: 400,
      message: "当前订单状态不允许退款"
    };
  }

  // 验证退款金额
  const maxRefundAmount = order.presaleFlag ?
    (order.status === ORDER_STATUS.PRESALE_DEPOSIT_PAID ? order.depositAmount : order.totalAmount)
    : order.totalAmount;

  if (refundAmount > maxRefundAmount) {
    return {
      code: 400,
      message: `退款金额不能超过订单金额，最大可退金额: ${maxRefundAmount}`
    };
  }

  // 更新订单状态为退款中（使用乐观锁）
  const { data: updatedOrder } = await models.Order.update({
    filter: {
      where: {
        _id: { $eq: orderId },
        version: { $eq: order.version }
      }
    },
    data: {
      status: ORDER_STATUS.REFUNDING,
      refundReason,
      refundAmount,
      refundApplyTime: new Date(),
      version: order.version + 1
    },
    envType: "prod"
  });

  if (!updatedOrder) {
    return {
      code: 409,
      message: "订单状态已被更新，请重试"
    };
  }

  // 调用微信退款API
  try {
    const refundResult = await cloud.callFunction({
      name: 'wxpay',
      data: {
        type: 'wxpay_refund',
        data: {
          out_trade_no: order.orderNo,
          out_refund_no: `RF${order.orderNo}`,
          amount: {
            refund: Math.round(refundAmount * 100), // 转换为分
            total: Math.round(order.totalAmount * 100),
            currency: 'CNY'
          }
        }
      }
    });

    return {
      code: 200,
      message: "退款申请已提交",
      data: {
        order: updatedOrder,
        refundInfo: refundResult
      }
    };
  } catch (err) {
    // 退款申请失败，回滚订单状态
    await models.Order.update({
      filter: { where: { _id: { $eq: orderId } } },
      data: {
        status: order.status,
        version: order.version + 1
      },
      envType: "prod"
    });

    return {
      code: 500,
      message: "退款申请失败: " + err.message
    };
  }
}

/**
 * 取消订单
 */
async function cancelOrder(orderId, userId, openId) {
  if (!orderId || !userId) {
    return {
      code: 400,
      message: "缺少必要参数: orderId 或 userId"
    };
  }

  // 获取订单信息
  const { data: order } = await models.Order.get({
    filter: {
      where: {
        _id: { $eq: orderId },
        userId: { $eq: userId }
      }
    },
    envType: "prod"
  });

  if (!order) {
    return {
      code: 404,
      message: "订单不存在或无权操作"
    };
  }

  // 检查订单状态是否允许取消
  const canCancel = [
    ORDER_STATUS.PENDING_PAYMENT,
    ORDER_STATUS.PRESALE_DEPOSIT_PENDING
  ].includes(order.status);

  if (!canCancel) {
    return {
      code: 400,
      message: "当前订单状态不允许取消"
    };
  }

  // 更新订单状态为取消
  const newStatus = order.presaleFlag ? ORDER_STATUS.PRESALE_CANCELLED : ORDER_STATUS.CANCELLED;

  const { data: updatedOrder } = await models.Order.update({
    filter: {
      where: {
        _id: { $eq: orderId },
        version: { $eq: order.version }
      }
    },
    data: {
      status: newStatus,
      cancelTime: new Date(),
      version: order.version + 1
    },
    envType: "prod"
  });

  if (!updatedOrder) {
    return {
      code: 409,
      message: "订单状态已被更新，请重试"
    };
  }

  // 恢复库存（普通商品）
  if (!order.presaleFlag) {
    await restoreStockAfterCancel(orderId);
  }

  return {
    code: 200,
    message: "订单取消成功",
    data: updatedOrder
  };
}

/**
 * 确认收货
 */
async function confirmReceipt(orderId, userId, openId) {
  if (!orderId || !userId) {
    return {
      code: 400,
      message: "缺少必要参数: orderId 或 userId"
    };
  }

  // 获取订单信息
  const { data: order } = await models.Order.get({
    filter: {
      where: {
        _id: { $eq: orderId },
        userId: { $eq: userId }
      }
    },
    envType: "prod"
  });

  if (!order) {
    return {
      code: 404,
      message: "订单不存在或无权操作"
    };
  }

  // 检查订单状态是否允许确认收货
  if (order.status !== ORDER_STATUS.SHIPPING) {
    return {
      code: 400,
      message: "只有已发货的订单才能确认收货"
    };
  }

  // 更新订单状态为已签收
  const { data: updatedOrder } = await models.Order.update({
    filter: {
      where: {
        _id: { $eq: orderId },
        version: { $eq: order.version }
      }
    },
    data: {
      status: ORDER_STATUS.SIGNED,
      signTime: new Date(),
      version: order.version + 1
    },
    envType: "prod"
  });

  if (!updatedOrder) {
    return {
      code: 409,
      message: "订单状态已被更新，请重试"
    };
  }

  return {
    code: 200,
    message: "确认收货成功",
    data: updatedOrder
  };
}

/**
 * 支付尾款（预售订单）
 */
async function payBalance(orderId, userId, openId) {
  if (!orderId || !userId) {
    return {
      code: 400,
      message: "缺少必要参数: orderId 或 userId"
    };
  }

  // 获取订单信息
  const { data: order } = await models.Order.get({
    filter: {
      where: {
        _id: { $eq: orderId },
        userId: { $eq: userId }
      }
    },
    envType: "prod"
  });

  if (!order) {
    return {
      code: 404,
      message: "订单不存在或无权操作"
    };
  }

  // 检查是否为预售订单且处于待支付尾款状态
  if (!order.presaleFlag || order.status !== ORDER_STATUS.PRESALE_BALANCE_PENDING) {
    return {
      code: 400,
      message: "当前订单不支持支付尾款"
    };
  }

  // 检查尾款支付时间
  // const now = new Date();
  // if (now < order.balanceStartTime) {
  //   return { 
  //     code: 400, 
  //     message: "尾款支付尚未开始" 
  //   };
  // }

  // if (now > order.balanceEndTime) {
  //   return { 
  //     code: 400, 
  //     message: "尾款支付已结束" 
  //   };
  // }

  // 更新订单状态为尾款待支付（实际支付由前端调用支付API完成）
  return {
    code: 200,
    message: "可以支付尾款",
    data: {
      order,
      balanceAmount: order.balanceAmount
    }
  };
}

// ========== 工具函数 ==========

/**
 * 生成唯一订单号
 */
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

/**
 * 获取合法的状态转换
 */
function getValidStatusTransitions(currentStatus) {
  const transitions = {
    // 普通订单状态流转
    [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PAID]: [ORDER_STATUS.SHIPPING, ORDER_STATUS.REFUNDING, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.SHIPPING]: [ORDER_STATUS.SIGNED, ORDER_STATUS.REFUNDING],
    [ORDER_STATUS.SIGNED]: [ORDER_STATUS.REFUNDING],
    [ORDER_STATUS.REFUNDING]: [ORDER_STATUS.REFUNDED],
    [ORDER_STATUS.REFUNDED]: [],
    [ORDER_STATUS.CANCELLED]: [],

    // 预售订单状态流转
    [ORDER_STATUS.PRESALE_DEPOSIT_PENDING]: [ORDER_STATUS.PRESALE_DEPOSIT_PAID, ORDER_STATUS.PRESALE_CANCELLED],
    [ORDER_STATUS.PRESALE_DEPOSIT_PAID]: [ORDER_STATUS.PRESALE_BALANCE_PENDING, ORDER_STATUS.REFUNDING],
    [ORDER_STATUS.PRESALE_BALANCE_PENDING]: [ORDER_STATUS.PRESALE_BALANCE_PAID, ORDER_STATUS.REFUNDING],
    [ORDER_STATUS.PRESALE_BALANCE_PAID]: [ORDER_STATUS.SHIPPING, ORDER_STATUS.REFUNDING],
    [ORDER_STATUS.PRESALE_CANCELLED]: []
  };

  return transitions[currentStatus] || [];
}

/**
 * 检查并扣减库存（原子操作）
 */
async function checkAndDeductStock(skuId, quantity) {
  // 查询当前库存
  const { data: skuList } = await models.ProductSkus.list({
    filter: {
      where: {
        _id: { $eq: skuId },
        isOnSale: { $eq: true },
        stock: { $gte: quantity } // 库存充足条件
      }
    },
    envType: "prod"
  });

  if (!skuList.records || skuList.records.length === 0) {
    // 库存不足
    const { data: actualSku } = await models.ProductSkus.get({
      filter: { where: { _id: { $eq: skuId } } },
      envType: "prod"
    });

    const actualStock = actualSku ? actualSku.stock : 0;
    return {
      code: 400,
      message: `商品库存不足，当前库存: ${actualStock}，请求购买: ${quantity}`
    };
  }

  // 获取当前精确库存值
  const { data: currentSku } = await models.ProductSkus.get({
    filter: { where: { _id: { $eq: skuId } } },
    envType: "prod"
  });

  if (!currentSku || currentSku.stock < quantity) {
    return {
      code: 400,
      message: `库存已被占用，当前剩余库存: ${currentSku ? currentSku.stock : 0}`
    };
  }

  // 扣减库存：直接使用计算后的数值，避免使用 _.inc
  const newStock = currentSku.stock - quantity;
  const { data: updatedSku } = await models.ProductSkus.update({
    filter: {
      where: {
        _id: { $eq: skuId }
      }
    },
    data: {
      stock: newStock, // 直接传递数字，而不是操作符对象
      _updateTime: new Date()
    },
    envType: "prod"
  });

  if (!updatedSku) {
    return {
      code: 409,
      message: '库存扣减失败，请重试'
    };
  }

  return { code: 200, message: '库存扣减成功' };
}

/**
 * 改进的分布式锁实现
 */
// async function withLock(key, callback, options = {}) {
//   const {
//     timeout = 10000,        // 锁超时时间（毫秒）
//     retryInterval = 100,    // 重试间隔（毫秒）
//     maxRetries = 10         // 最大重试次数
//   } = options;

//   const lockKey = `lock:${key}`;
//   const lockValue = Date.now().toString();
//   const lockExpire = Date.now() + timeout;

//   const cache = db.collection('system_cache');

//   let acquired = false;
//   let retryCount = 0;

//   // 尝试获取锁（带重试机制）
//   while (!acquired && retryCount < maxRetries) {
//     try {
//       const { id } = await cache.add({
//         data: {
//           _id: lockKey,
//           value: lockValue,
//           expire: lockExpire,
//           _createTime: new Date()
//         }
//       });

//       if (id) {
//         acquired = true;
//         break;
//       }
//     } catch (err) {
//       // 如果是锁已存在，检查是否过期
//       if (err.message.includes('duplicate key')) {
//         const { data: existingLock } = await cache.get({
//           filter: { where: { _id: { $eq: lockKey } } }
//         });

//         if (existingLock && existingLock.expire < Date.now()) {
//           // 锁已过期，删除并重试
//           await cache.delete({
//             filter: { where: { _id: { $eq: lockKey } } }
//           });
//           continue;
//         }

//         // 锁被其他进程持有，等待后重试
//         if (retryCount < maxRetries - 1) {
//           await new Promise(resolve => setTimeout(resolve, retryInterval));
//           retryCount++;
//           continue;
//         }
//       }

//       throw new Error(`获取锁失败: ${err.message}`);
//     }
//   }

//   if (!acquired) {
//     throw new Error('获取锁失败，请稍后重试');
//   }

//   let result;
//   try {
//     // 执行受保护的代码
//     result = await callback();
//     return result;
//   } finally {
//     // 确保释放锁
//     try {
//       await cache.delete({
//         filter: {
//           where: {
//             _id: { $eq: lockKey },
//             value: { $eq: lockValue }
//           }
//         }
//       });
//     } catch (err) {
//       console.log('释放锁失败，锁可能已自动过期:', err.message);
//     }
//   }
// }

/**
 * 预售商品限购检查
 */
async function checkPresaleLimit(userId, cartItems) {
  const maxPerUser = 100; // 单用户限购100件
  const skuIds = cartItems.map(item => item.cartItem_Sku._id);

  // 查询用户已购买的预售商品数量
  const { data: userOrders } = await models.Order.list({
    filter: {
      where: {
        userId: { $eq: userId },
        presaleFlag: { $eq: true },
        status: { $nin: [ORDER_STATUS.CANCELLED, ORDER_STATUS.PRESALE_CANCELLED] }
      }
    },
    envType: "prod"
  });

  if (userOrders.records && userOrders.records.length > 0) {
    const orderIds = userOrders.records.map(order => order._id);

    // 查询这些订单中的商品数量
    const { data: orderItems } = await models.OrderItems.list({
      filter: {
        where: {
          orderId: { $in: orderIds },
          skuId: { $in: skuIds }
        }
      },
      envType: "prod"
    });

    const existingQuantity = orderItems.records.reduce((sum, item) => sum + item.quantity, 0);
    const newQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    if (existingQuantity + newQuantity > maxPerUser) {
      return {
        code: 400,
        message: `预售商品限购${maxPerUser}件，您已购买${existingQuantity}件，还可购买${maxPerUser - existingQuantity}件`
      };
    }
  }

  return { code: 200 };
}

/**
 * 订单取消后恢复库存
 */
async function restoreStockAfterCancel(orderId) {
  // 获取订单所有商品
  const { data: orderItems } = await models.OrderItems.list({
    filter: {
      where: {
        orderId: { $eq: orderId }
      }
    },
    envType: "prod"
  });

  // 批量恢复库存
  for (const item of orderItems.records) {
    await restoreSkuStock(item.skuId, item.quantity);
  }
}

/**
 * 恢复单个SKU库存
 */
async function restoreSkuStock(skuId, quantity) {
  await models.ProductSkus.update({
    filter: {
      where: {
        _id: { $eq: skuId }
      }
    },
    data: {
      stock: _.inc(quantity), // 原子操作：库存增加
      _updateTime: new Date()
    },
    envType: "prod"
  });
}

/**
 * 库存回滚（订单创建失败时）
 */
async function rollbackStock(skuStockMap) {
  for (const [skuId, stockInfo] of skuStockMap.entries()) {
    await models.ProductSkus.update({
      filter: {
        where: {
          _id: { $eq: skuId }
        }
      },
      data: {
        stock: stockInfo.originalStock,
        _updateTime: new Date()
      },
      envType: "prod"
    });
  }
}

// // ========== 微信支付相关函数 ==========

// /**
//  * 微信支付 - 下单
//  */
// async function makeWxpayOrder(event, context) {
//   const wxContext = cloud.getWXContext();

//   // 从事件参数中获取订单信息
//   const { orderNo, description, totalAmount } = event.data;

//   const res = await cloud.callFunction({
//     name: 'cloudbase_module',
//     data: {
//       name: 'wxpay_order',
//       data: {
//         description: description || '商品购买',
//         amount: {
//           total: Math.round(totalAmount * 100), // 转换为分
//           currency: 'CNY',
//         },
//         out_trade_no: orderNo,
//         payer: {
//           openid: wxContext.OPENID,
//         },
//       },
//     },
//   });
//   return res.result;
// }

// /**
//  * 微信支付 - 根据商户订单号查询订单
//  */
// async function queryOrderByOutTradeNo(event, context) {
//   const { out_trade_no } = event.data;

//   const res = await cloud.callFunction({
//     name: 'cloudbase_module',
//     data: {
//       name: 'wxpay_query_order_by_out_trade_no',
//       data: {
//         out_trade_no: out_trade_no,
//       },
//     },
//   });
//   return res.result;
// }

// /**
//  * 微信支付 - 微信支付订单号查询订单
//  */
// async function queryOrderByTransactionId(event, context) {
//   const { transaction_id } = event.data;

//   const res = await cloud.callFunction({
//     name: 'cloudbase_module',
//     data: {
//       name: 'wxpay_query_order_by_transaction_id',
//       data: {
//         transaction_id: transaction_id,
//       },
//     },
//   });
//   return res.result;
// }

// /**
//  * 微信支付 - 申请退款
//  */
// async function wxpayRefund(event, context) {
//   const { out_trade_no, out_refund_no, refund_amount, total_amount } = event.data;

//   const res = await cloud.callFunction({
//     name: 'cloudbase_module',
//     data: {
//       name: 'wxpay_refund',
//       data: {
//         out_trade_no: out_trade_no,
//         out_refund_no: out_refund_no,
//         amount: {
//           refund: Math.round(refund_amount * 100),
//           total: Math.round(total_amount * 100),
//           currency: 'CNY',
//         },
//       },
//     },
//   });
//   return res.result;
// }

// /**
//  * 微信支付 - 退款查询
//  */
// async function wxpayRefundQuery(event, context) {
//   const { out_refund_no } = event.data;

//   const res = await cloud.callFunction({
//     name: 'cloudbase_module',
//     data: {
//       name: 'wxpay_refund_query',
//       data: {
//         out_refund_no: out_refund_no,
//       },
//     },
//   });
//   return res.result;
// }

// // 微信支付云函数入口
// exports.wxpay = async (event, context) => {
//   switch (event.type) {
//     case 'wxpay_order':
//       return await makeWxpayOrder(event, context);
//     case 'wxpay_query_order_by_out_trade_no':
//       return await queryOrderByOutTradeNo(event, context);
//     case 'wxpay_query_order_by_transaction_id':
//       return await queryOrderByTransactionId(event, context);
//     case 'wxpay_refund':
//       return await wxpayRefund(event, context);
//     case 'wxpay_refund_query':
//       return await wxpayRefundQuery(event, context);
//     default:
//       return {
//         code: -1,
//         msg: 'Unimplemented method'
//       };
//   }
// };

// ========== 定时任务函数 ==========

/**
 * 自动取消超时未支付订单
 */
exports.autoCancelOrders = async (event, context) => {
  const now = new Date();
  const timeoutThreshold = new Date(now.getTime() - 30 * 60 * 1000); // 30分钟前

  try {
    // 查找超时未支付的订单
    const { data: timeoutOrders } = await models.Order.list({
      filter: {
        where: {
          status: { $in: [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PRESALE_DEPOSIT_PENDING] },
          _createTime: { $lt: timeoutThreshold }
        }
      },
      envType: "prod"
    });

    let successCount = 0;
    let failCount = 0;

    // 批量取消订单
    for (const order of timeoutOrders.records) {
      try {
        const cancelResult = await cancelOrder(order._id, order.userId, order._owner);
        if (cancelResult.code === 200) {
          successCount++;
        } else {
          failCount++;
          console.error(`取消订单失败: ${order._id}`, cancelResult.message);
        }
      } catch (err) {
        failCount++;
        console.error(`取消订单异常: ${order._id}`, err);
      }
    }

    return {
      code: 200,
      message: `自动取消订单完成，成功: ${successCount}, 失败: ${failCount}`,
      data: {
        successCount,
        failCount,
        total: timeoutOrders.totalCount
      }
    };
  } catch (err) {
    console.error('自动取消订单任务失败:', err);
    return {
      code: 500,
      message: '自动取消订单任务失败: ' + err.message
    };
  }
};

/**
 * 自动处理预售尾款开始
 */
exports.autoStartBalancePayment = async (event, context) => {
  const now = new Date();

  try {
    // 查找需要开始支付尾款的预售订单
    const { data: balanceOrders } = await models.Order.list({
      filter: {
        where: {
          presaleFlag: { $eq: true },
          status: { $eq: ORDER_STATUS.PRESALE_DEPOSIT_PAID },
          balanceStartTime: { $lte: now },
          balanceEndTime: { $gte: now }
        }
      },
      envType: "prod"
    });

    let updatedCount = 0;

    // 批量更新订单状态
    for (const order of balanceOrders.records) {
      try {
        const { data: updatedOrder } = await models.Order.update({
          filter: {
            where: {
              _id: { $eq: order._id },
              version: { $eq: order.version }
            }
          },
          data: {
            status: ORDER_STATUS.PRESALE_BALANCE_PENDING,
            presaleStatus: PRESALE_STATUS.BALANCE_PENDING,
            version: order.version + 1
          },
          envType: "prod"
        });

        if (updatedOrder) {
          updatedCount++;
        }
      } catch (err) {
        console.error(`更新预售订单状态失败: ${order._id}`, err);
      }
    }

    return {
      code: 200,
      message: `预售尾款开始处理完成，更新订单: ${updatedCount}`,
      data: {
        updatedCount,
        total: balanceOrders.totalCount
      }
    };
  } catch (err) {
    console.error('预售尾款开始处理任务失败:', err);
    return {
      code: 500,
      message: '预售尾款开始处理任务失败: ' + err.message
    };
  }
};