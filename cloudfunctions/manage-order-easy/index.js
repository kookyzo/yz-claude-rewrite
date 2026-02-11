const {
  init
} = require('@cloudbase/wx-cloud-client-sdk');
const { STATUS_CODES } = require('http');
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
  PENDING_PAYMENT: 'pending_payment',    // 待支付
  PAID: 'paid',                          // 已支付
  SHIPPING: 'shipping',                  // 发货中
  SIGNED: 'signed',                      // 已签收
  CANCELLED: 'cancelled',                // 已取消
  REFUNDING: 'refunding',                // 退款中
  PARTIAL_REFUNDED: 'partial_refunded',  // 部分退款
  REFUNDED: 'refunded',                  // 已退款
};

// 订单管理云函数入口函数
exports.main = async (event, context) => {
  const { action, data } = event;
  const {
    _userId,
    _addressId,
    _orderId,
    _refundId,
    newStatus,
    payMethod,
    logisticsNo,
    refundReason,
    refundAmount,
    refundItems,
    skuId,
    quantity,
    updateData
  } = data || {};

  // 获取用户OpenID
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
        return await updateOrderStatus(
          updateData._orderId,
          updateData.newStatus,
          updateData.payMethod,
          updateData._userId,
          updateData.transactionId,
          updateData.payTime,
          OPENID,
          updateData.logisticsNo
        );

      // 获取订单详情
      case 'getOrderDetail':
        return await getOrderDetail(_orderId, _userId, OPENID);

      // 获取用户订单列表
      case 'getUserOrders':
        return await getUserOrders(_userId, data.status, OPENID);
      // 获取所有订单（管理员使用）
      case 'getAllOrders':
        return await getAllOrders(data.status, OPENID);

      // 通过地址ID获取地址信息（管理后台使用）
      case 'getAddressById':
        return await getAddressById(data.addressId, OPENID);

      // 管理后台更新订单状态（新增专用方法）
      case 'adminUpdateOrderStatus':
        return await adminUpdateOrderStatus(event.orderId, event.newStatus, event.logisticsNo, OPENID);

      //// 申请退款 - 仅创建退款记录，不调用微信退款
      case 'applyRefund':
        return await applyRefund(_orderId, _userId, refundReason, refundAmount, OPENID, refundItems);

      // 执行退款 - 后台管理人员调用
      case 'processRefund':
        return await processRefund(_refundId, OPENID);
      // 取消订单
      case 'cancelOrder':
        return await cancelOrder(_orderId, _userId, OPENID);

      // 确认收货
      case 'confirmReceipt':
        return await confirmReceipt(_orderId, _userId, OPENID);

      // // 自动取消过期订单
      // case 'autoCancelExpiredOrders':
      //   return await autoCancelExpiredOrders(OPENID);
      //申请退款
      case 'queryRefundStatus':
        return await queryRefundStatus(_orderId, _userId, OPENID);
      //获取退款记录
      case 'getRefundDetail':
        return await getRefundDetail(_refundId, _userId, OPENID);
      // 取消所有失效订单
      case 'manualCancelExpiredOrders':
        return await autoCancelExpiredOrders(OPENID);
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
 * 从购物车创建订单（保留预售标志）
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
  let hasPresaleItem = false;
  const orderItemsData = [];
  const skuStockMap = new Map();

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

    // 检查是否为预售商品
    if (skuInfo.presaleFlag) {
      hasPresaleItem = true;

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

    // 保存SKU库存信息用于后续可能的回滚（仅普通商品）
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

    orderItemsData.push(orderItemData);
  }

  // 4. 生成订单号
  const orderNo = generateOrderNo();
  const orderId = `order${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // 5. 创建订单（使用事务确保原子性）
  const transaction = await db.startTransaction();
  try {
    // 创建订单记录
    const orderData = {
      orderId,
      orderNo,
      userId: { _id: userId },
      totalAmount: totalAmount,
      actualAmount: totalAmount, // 全款支付，实际金额等于总金额
      status: ORDER_STATUS.PENDING_PAYMENT,
      addressId: { _id: addressId },
      _owner: openId,
      version: 0,
      presaleFlag: hasPresaleItem // 设置预售标志
    };

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
        actualAmount: totalAmount,
        isPresale: hasPresaleItem
      }
    };
  } catch (err) {
    // 回滚事务
    await transaction.rollback();

    // 回滚库存（仅普通商品）
    await rollbackStock(skuStockMap);

    return {
      code: 500,
      message: err.message || "创建订单失败，已回滚操作"
    };
  }
}

/**
 * 直接购买创建订单（保留预售标志）
 */
async function createDirectOrder(orderData, openId) {
  const {
    _userId,
    _addressId,
    _skuId,
    quantity
  } = orderData;

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
      actualAmount: totalAmount,
      status: ORDER_STATUS.PENDING_PAYMENT,
      addressId: { _id: _addressId },
      _owner: openId,
      version: 0,
      presaleFlag: isPresale // 设置预售标志
    };

    const { data: newOrder } = await models.Order.create({
      data: orderDataToCreate,
      envType: "prod"
    });

    if (!newOrder) {
      throw new Error("创建订单失败");
    }
    const { data: currentOrder } = await models.Order.get({
      filter: {
        where: {
          _id: { $eq: newOrder.id },
          userId: { $eq: _userId }
        }
      },
      envType: "prod"
    });
    // 创建订单项
    const orderItemData = {
      skuId: { _id: _skuId },
      itemId: null,
      quantity,
      unitPrice,
      subtotal: totalAmount,
      presaleFlag: isPresale // 设置预售标志
    };

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
        order: currentOrder,
        orderItem: newOrderItem,
        orderNo,
        totalAmount,
        isPresale: isPresale
      }
    };
  } catch (err) {
    // 回滚事务
    await transaction.rollback();

    // 回滚库存（仅普通商品）
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
 * 更新订单状态
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
    version: order.version + 1
  };

  // 根据新状态添加额外字段
  switch (newStatus) {
    case ORDER_STATUS.PAID:
      updateData.payTime = payTime ? new Date(payTime).getTime() : new Date().getTime();
      updateData.payMethod = payMethod || order.payMethod;

      // 微信支付相关信息
      if (transactionId) {
        updateData.transaction_id = transactionId;
      }
      break;

    case ORDER_STATUS.SHIPPING:
      updateData.shipTime = new Date().getTime();
      updateData.logisticsNo = logisticsNo;
      break;

    case ORDER_STATUS.SIGNED:
      updateData.signTime = new Date().getTime();
      break;

    case ORDER_STATUS.CANCELLED:
      updateData.cancelTime = new Date().getTime();
      updateData.cancelReason = '用户取消';
      // 取消订单时恢复库存（仅普通商品）
      if (!order.presaleFlag) {
        await restoreStockAfterCancel(order._id);
      }
      break;

    case ORDER_STATUS.REFUNDED:
    case ORDER_STATUS.PARTIAL_REFUNDED:
      updateData.refundTime = new Date().getTime();
      // 退款成功时恢复库存（仅普通商品）
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
  const { data: currentOrder } = await models.Order.get({
    filter: {
      where: {
        _id: { $eq: orderId },
        userId: { $eq: userId }
      }
    },
    envType: "prod"
  });

  return {
    code: 200,
    message: "订单状态已更新",
    data: currentOrder
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
    select: {
      $master: true,
      skuId: true,
    },
    envType: "prod"
  });

  // 获取订单项关联的SKU信息
  const itemsWithDetails = await Promise.all(
    orderItems.records.map(async (item) => {
      const { data: skuData } = await models.ProductSkus.get({
        filter: {
          where: {
            _id: { $eq: item.skuId._id }
          }
        },
        select: {
          $master: true,
          spuId: true,
        },
        envType: "prod"
      });

      // 获取SPU信息用于商品名称和图片
      let spuInfo = null;
      if (skuData && skuData.spuId) {
        const { data: spuData } = await models.ProductSpus.get({
          filter: {
            where: {
              _id: { $eq: skuData.spuId._id }
            }
          },
          envType: "prod"
        });
        spuInfo = spuData;
      }

      return {
        ...item,
        skuInfo: skuData ? {
          _id: skuData._id,
          nameCN: skuData.nameCN,
          nameEN: skuData.nameEN,
          skuMainImages: skuData.skuMainImages,
          material: skuData.material,
          size: skuData.size,
          price: skuData.price,
          presaleFlag: skuData.presaleFlag, // 保留预售标志
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
    getCount: true,
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
            presaleFlag: skuData ? skuData.presaleFlag : false,
          };
        })
      );

      return {
        ...order,
        itemCount: items.totalCount,
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

// 退款状态常量
const REFUND_STATUS = {
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  CLOSED: 'closed',
  PENDING: 'pending'
};
/**
 * 申请退款 - 仅创建退款记录，不调用微信退款接口
 */
async function applyRefund(orderId, userId, refundReason, refundAmount, openId, refundItems = null) {
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
    'paid',
    'shipping',
    'signed',
  ].includes(order.status);

  if (!canRefund) {
    return {
      code: 400,
      message: "当前订单状态不允许退款"
    };
  }

  let finalRefundAmount = refundAmount;
  let refundItemsData = refundItems;

  // 如果是部分商品退款，验证退款商品信息
  if (refundItems && refundItems.length > 0) {
    // 获取订单项信息
    const { data: orderItems } = await models.OrderItems.list({
      filter: {
        where: {
          orderId: { $eq: orderId }
        }
      },
      envType: "prod"
    });

    // 验证退款商品是否属于该订单
    const validRefundItems = [];
    let calculatedRefundAmount = 0;

    for (const refundItem of refundItems) {
      const orderItem = orderItems.records.find(item => item._id === refundItem.orderItemId);

      if (!orderItem) {
        return {
          code: 400,
          message: `退款商品不存在: ${refundItem.orderItemId}`
        };
      }

      // 验证退款数量不超过购买数量
      if (refundItem.quantity > orderItem.quantity) {
        return {
          code: 400,
          message: `退款数量超过购买数量: 商品 ${orderItem.skuId}`
        };
      }

      // 检查是否已经退款
      const refundedQuantity = orderItem.refundedQuantity || 0;
      const availableQuantity = orderItem.quantity - refundedQuantity;

      if (refundItem.quantity > availableQuantity) {
        return {
          code: 400,
          message: `商品可退款数量不足，已退款: ${refundedQuantity}，可退款: ${availableQuantity}`
        };
      }

      // 计算退款金额（按比例）
      const itemRefundAmount = (refundItem.quantity / orderItem.quantity) * orderItem.subtotal;
      calculatedRefundAmount += itemRefundAmount;

      validRefundItems.push({
        orderItemId: { _id: refundItem.orderItemId },
        skuId: { _id: orderItem.skuId },
        quantity: refundItem.quantity,
        refundAmount: itemRefundAmount,
        unitPrice: orderItem.unitPrice,
        itemSubtotal: orderItem.subtotal
      });
    }

    // 使用计算出的退款金额
    finalRefundAmount = calculatedRefundAmount;
    refundItemsData = validRefundItems;
  }

  // 验证退款金额
  if (finalRefundAmount > order.totalAmount) {
    return {
      code: 400,
      message: `退款金额不能超过订单金额，最大可退金额: ${order.totalAmount}`
    };
  }

  // 生成退款单号
  const outRefundNo = `RF${order.orderNo}${Date.now().toString().slice(-6)}`;

  try {
    // 1. 创建退款记录
    const { data: refundRecord } = await models.RefundRecord.create({
      data: {
        outRefundNo,
        refund_order: { _id: orderId },
        refund_user: { _id: userId },
        refundReason,
        totalRefundAmount: finalRefundAmount,
        originalOrderAmount: order.totalAmount,
        refundItems: refundItemsData,
        status: REFUND_STATUS.PENDING, // 改为待处理状态
        applyTime: new Date().getTime(),
        _owner: openId
      },
      envType: "prod"
    });

    // 2. 更新订单状态为退款中
    const updateData = {
      status: ORDER_STATUS.REFUNDING,
      out_refund_no: outRefundNo,
      version: order.version + 1
    };

    // 如果是部分商品退款，标记为部分退款
    if (refundItemsData && refundItemsData.length > 0) {
      updateData.isPartialRefund = true;
    }

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
      throw new Error("订单状态更新失败");
    }

    // 3. 更新订单项退款状态（如果是部分商品退款）
    if (refundItemsData && refundItemsData.length > 0) {
      for (const refundItem of refundItemsData) {
        // 获取当前订单项信息
        const { data: orderItem } = await models.OrderItems.get({
          filter: {
            where: {
              _id: { $eq: refundItem.orderItemId._id }
            }
          },
          envType: "prod"
        });

        if (orderItem) {
          const currentRefundedQuantity = orderItem.refundedQuantity || 0;
          const currentRefundedAmount = orderItem.refundedAmount || 0;

          // 更新订单项退款信息
          await models.OrderItems.update({
            filter: {
              where: {
                _id: { $eq: refundItem.orderItemId._id }
              }
            },
            data: {
              refundedQuantity: currentRefundedQuantity + refundItem.quantity,
              refundedAmount: currentRefundedAmount + refundItem.refundAmount,
            },
            envType: "prod"
          });
        }
      }
    }

    return {
      code: 200,
      message: "退款申请已提交，等待管理员处理",
      data: {
        _refundRecordID: refundRecord.id,
        refundNo: outRefundNo,
        refundItems: refundItemsData,
        totalRefundAmount: finalRefundAmount
      }
    };

  } catch (error) {
    return {
      code: 500,
      message: "退款申请失败: " + error.message
    };
  }
}
/**
 * 执行退款 - 后台管理人员调用微信退款接口
 */
async function processRefund(refundId, operatorId) {
  if (!refundId) {
    return {
      code: 400,
      message: "缺少必要参数: refundId"
    };
  }

  try {
    // 1. 获取退款记录信息
    const { data: refundRecord } = await models.RefundRecord.get({
      filter: {
        where: {
          _id: { $eq: refundId }
        }
      },
      envType: "prod"
    });

    if (!refundRecord) {
      return {
        code: 404,
        message: "退款记录不存在"
      };
    }

    // 2. 检查退款记录状态
    if (refundRecord.status !== REFUND_STATUS.PENDING) {
      return {
        code: 400,
        message: `退款记录状态不允许处理，当前状态: ${refundRecord.status}`
      };
    }

    // 3. 获取关联的订单信息
    const { data: order } = await models.Order.get({
      filter: {
        where: {
          _id: { $eq: refundRecord.refund_order._id }
        }
      },
      envType: "prod"
    });

    if (!order) {
      return {
        code: 404,
        message: "关联订单不存在"
      };
    }

    // 4. 更新退款记录状态为处理中
    await models.RefundRecord.update({
      filter: {
        where: {
          _id: { $eq: refundId }
        }
      },
      data: {
        status: REFUND_STATUS.PROCESSING,
        operator: { _id: operatorId },
        processTime: new Date().getTime()
      },
      envType: "prod"
    });

    // 5. 调用微信退款API
    const refundResult = await cloud.callFunction({
      name: 'wxpayFunctions',
      data: {
        type: 'wxpay_refund',
        data: {
          _orderId: order._id,
          out_trade_no: order.orderNo,
          transaction_id: order.transaction_id, // 微信订单号
          out_refund_no: refundRecord.outRefundNo,
          amount: {
            refund: Math.round(refundRecord.totalRefundAmount * 100),
            total: Math.round(order.totalAmount * 100),
            currency: 'CNY'
          }
        }
      }
    });

    // 6. 根据微信退款结果更新退款记录和订单状态
    if (refundResult.result && refundResult.result.code === 0) {
      // 微信退款成功
      const finalOrderStatus = refundRecord.totalRefundAmount < order.totalAmount ?
        ORDER_STATUS.PARTIAL_REFUNDED : ORDER_STATUS.REFUNDED;

      // 更新退款记录状态
      await models.RefundRecord.update({
        filter: {
          where: {
            _id: { $eq: refundId }
          }
        },
        data: {
          status: REFUND_STATUS.SUCCESS,
          refund_id: refundResult.result.refund_id,
          successTime: new Date().getTime(),
        },
        envType: "prod"
      });

      // 更新订单状态
      await models.Order.update({
        filter: {
          where: {
            _id: { $eq: order._id }
          }
        },
        data: {
          status: finalOrderStatus,
          version: order.version + 1
        },
        envType: "prod"
      });

      return {
        code: 200,
        message: "退款处理成功",
        data: {
          refundRecord: {
            ...refundRecord,
            status: REFUND_STATUS.SUCCESS,
            refund_id: refundResult.result.refund_id,
            successTime: new Date().getTime()
          },
          orderStatus: finalOrderStatus
        }
      };

    } else {
      // 微信退款失败
      await handleRefundFailure(refundId, order._id, refundResult.result);
      return {
        code: 500,
        message: `微信退款失败: ${refundResult.result.message}`
      };
    }

  } catch (error) {
    // 处理过程中的异常
    await handleRefundFailure(refundId, null, error);
    return {
      code: 500,
      message: "退款处理失败: " + error.message
    };
  }
}

/**
 * 处理退款失败
 */
async function handleRefundFailure(refundRecordId, orderId, error) {
  try {
    // 更新退款记录状态为失败
    await models.RefundRecord.update({
      filter: {
        where: {
          _id: { $eq: refundRecordId }
        }
      },
      data: {
        status: REFUND_STATUS.FAILED,
        errorMessage: error.message || '微信退款调用失败',
      },
      envType: "prod"
    });

    // 回滚订单状态（这里可以根据业务需求决定是否回滚）
    // 通常我们会保持订单在退款中状态，让用户重新尝试或联系客服
    console.log(`退款失败，订单 ${orderId} 保持在退款中状态`);

  } catch (updateError) {
    console.error('更新退款记录状态失败:', updateError);
  }
}

/**
 * 查询退款状态
 */
async function queryRefundStatus(orderId, userId, openId) {
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

  if (!order.out_refund_no) {
    return {
      code: 400,
      message: "该订单没有退款记录"
    };
  }

  try {
    // 1. 查询微信退款状态
    const refundResult = await cloud.callFunction({
      name: 'wxpayFunctions',
      data: {
        type: 'wxpay_refund_query',
        data: {
          out_refund_no: order.out_refund_no
        }
      }
    });

    // 2. 查询退款记录
    const { data: refundRecords } = await models.RefundRecord.list({
      filter: {
        where: {
          orderId: { $eq: orderId }
        },
        order: [['applyTime', 'desc']]
      },
      envType: "prod"
    });

    let refundStatus = 'UNKNOWN';
    let statusText = '未知状态';

    if (refundResult.result && refundResult.result.code === 0) {
      refundStatus = refundResult.result.status;

      switch (refundStatus) {
        case 'SUCCESS':
          statusText = '退款成功';
          break;
        case 'REFUNDCLOSE':
          statusText = '退款关闭';
          break;
        case 'PROCESSING':
          statusText = '退款处理中';
          break;
        case 'CHANGE':
          statusText = '退款异常';
          break;
        default:
          statusText = refundStatus;
      }
    }

    return {
      code: 200,
      message: "退款状态查询成功",
      data: {
        refundStatus: refundStatus,
        statusText: statusText,
        refundNo: order.refundNo,
        refundAmount: order.totalRefundedAmount,
        refundRecords: refundRecords.records,
        wxRefundInfo: refundResult.result
      }
    };
  } catch (err) {
    return {
      code: 500,
      message: "退款状态查询异常: " + err.message
    };
  }
}

/**
 * 获取退款记录详情
 */
async function getRefundDetail(refundId, userId, openId) {
  if (!refundId) {
    return {
      code: 400,
      message: "缺少必要参数: refundId"
    };
  }

  try {
    const { data: refundRecord } = await models.RefundRecord.get({
      filter: {
        where: {
          _id: { $eq: refundId },
          userId: { $eq: userId }
        }
      },
      select: {
        $master: true,
        orderId: true,
        refundItems: true
      },
      envType: "prod"
    });

    if (!refundRecord) {
      return {
        code: 404,
        message: "退款记录不存在"
      };
    }

    // 获取关联的订单信息
    const { data: order } = await models.Order.get({
      filter: {
        where: {
          _id: { $eq: refundRecord.orderId._id }
        }
      },
      envType: "prod"
    });

    // 获取退款商品详情
    const refundItemsWithDetails = await Promise.all(
      (refundRecord.refundItems || []).map(async (item) => {
        const { data: skuData } = await models.ProductSkus.get({
          filter: {
            where: {
              _id: { $eq: item.skuId._id }
            }
          },
          envType: "prod"
        });

        return {
          ...item,
          skuInfo: skuData
        };
      })
    );

    return {
      code: 200,
      message: "获取退款详情成功",
      data: {
        refundRecord: refundRecord,
        order: order,
        refundItems: refundItemsWithDetails
      }
    };
  } catch (error) {
    return {
      code: 500,
      message: "获取退款详情失败: " + error.message
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
  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
    return {
      code: 400,
      message: "只有待支付的订单才能取消"
    };
  }

  // 更新订单状态为取消
  const { data: updatedOrder } = await models.Order.update({
    filter: {
      where: {
        _id: { $eq: orderId },
        version: { $eq: order.version }
      }
    },
    data: {
      status: ORDER_STATUS.CANCELLED,
      cancelTime: new Date().getTime(),
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

  // 恢复库存（仅普通商品）
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
      signTime: new Date().getTime(),
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
    [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PAID]: [ORDER_STATUS.SHIPPING, ORDER_STATUS.REFUNDING, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.SHIPPING]: [ORDER_STATUS.SIGNED, ORDER_STATUS.REFUNDING],
    [ORDER_STATUS.SIGNED]: [ORDER_STATUS.REFUNDING],
    [ORDER_STATUS.REFUNDING]: [ORDER_STATUS.REFUNDED, ORDER_STATUS.PARTIAL_REFUNDED],
    [ORDER_STATUS.REFUNDED]: [],
    [ORDER_STATUS.PARTIAL_REFUNDED]: [],
    [ORDER_STATUS.CANCELLED]: []
  };

  return transitions[currentStatus] || [];
}

/**
 * 检查并扣减库存（仅普通商品）
 */
async function checkAndDeductStock(skuId, quantity) {
  // 查询当前库存
  const { data: skuList } = await models.ProductSkus.list({
    filter: {
      where: {
        _id: { $eq: skuId },
        isOnSale: { $eq: true },
        stock: { $gte: quantity }
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

  // 扣减库存
  const newStock = currentSku.stock - quantity;
  const { data: updatedSku } = await models.ProductSkus.update({
    filter: {
      where: {
        _id: { $eq: skuId }
      }
    },
    data: {
      stock: newStock,
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
        status: { $nin: [ORDER_STATUS.CANCELLED] }
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
 * 订单取消后恢复库存（仅普通商品）
 */
async function restoreStockAfterCancel(orderId) {
  // 获取订单所有商品
  const { data: orderItems } = await models.OrderItems.list({
    filter: {
      where: {
        orderId: { $eq: orderId }
      }
    },
    select: {
      $master: true,
      skuId: true,
    },
    envType: "prod"
  });

  // 批量恢复库存（仅普通商品）
  for (const item of orderItems.records) {
    if (!item.skuId.presaleFlag) {
      await restoreSkuStock(item.skuId._id, item.quantity, item.skuId.stock);
    }

  }
}

/**
 * 恢复单个SKU库存
 */
async function restoreSkuStock(skuId, quantity, currentStock) {
  await models.ProductSkus.update({
    filter: {
      where: {
        _id: { $eq: skuId }
      }
    },
    data: {
      stock: currentStock + quantity,
    },
    envType: "prod"
  });
}

/**
 * 库存回滚（订单创建失败时，仅普通商品）
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

/**
 * 自动取消过期订单（定时任务调用）
 */
async function autoCancelExpiredOrders(openId) {
  const now = new Date();
  // 设置为16分钟前，与支付超时时间一致
  const expireTime = new Date(now.getTime() - 15 * 60 * 1000);

  try {
    // 查找超时未支付的订单
    const { data: expiredOrders } = await models.Order.list({
      filter: {
        where: {
          status: { $eq: ORDER_STATUS.PENDING_PAYMENT },
          createdAt: { $lt: expireTime.getTime() }
        }
      },
      select: {
        $master: true,
        // userId: true,
        // orderNo: true,
        // version: true
      },
      envType: "prod"
    });

    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;

    console.log(`发现 ${expiredOrders.records.length} 个过期订单需要处理`);

    for (const order of expiredOrders.records) {
      try {
        // 在取消前再次检查订单状态，避免重复取消
        const { data: currentOrder } = await models.Order.get({
          filter: {
            where: {
              _id: { $eq: order._id }
            }
          },
          envType: "prod"
        });

        // 如果订单状态已经不是待支付，跳过
        if (!currentOrder || currentOrder.status !== ORDER_STATUS.PENDING_PAYMENT) {
          console.log(`订单 ${order.orderNo} 状态已更新为 ${currentOrder?.status}，跳过取消`);
          skipCount++;
          continue;
        }

        // 调用取消订单逻辑
        const result = await cancelExpiredOrder(order, openId);
        if (result.success) {
          successCount++;
          console.log(`成功取消订单: ${order.orderNo}`);
        } else {
          failCount++;
          console.error(`取消订单失败: ${order.orderNo}`, result.error);
        }
      } catch (error) {
        failCount++;
        console.error(`处理订单 ${order._id} 异常:`, error);
      }
    }

    return {
      code: 200,
      message: `自动取消订单完成: 成功 ${successCount}, 失败 ${failCount}, 跳过 ${skipCount}`,
      data: {
        successCount,
        failCount,
        skipCount,
        total: expiredOrders.records.length
      }
    };
  } catch (error) {
    console.error('自动取消订单任务失败:', error);
    return {
      code: 500,
      message: '自动取消订单任务失败: ' + error.message
    };
  }
}

/**
 * 取消过期订单的具体逻辑
 */
async function cancelExpiredOrder(order, openId) {
  const transaction = await db.startTransaction();

  try {
    // 1. 更新订单状态为已取消（使用乐观锁）
    const { data: updatedOrder } = await models.Order.update({
      filter: {
        where: {
          _id: { $eq: order._id },
          version: { $eq: order.version }
        }
      },
      data: {
        status: ORDER_STATUS.CANCELLED,
        cancelTime: new Date().getTime(),
        version: order.version + 1
      },
      envType: "prod"
    });

    if (!updatedOrder) {
      await transaction.rollback();
      return {
        success: false,
        error: '订单状态已被其他操作更新'
      };
    }

    // 2. 恢复库存（仅普通商品）
    if (!order.presaleFlag) {
      await restoreStockAfterCancel(order._id);
    }

    // 3. 如果订单有微信支付预下单，尝试关闭微信支付订单
    try {
      await closeWxpayOrder(order.orderNo);
    } catch (wxError) {
      console.warn(`关闭微信支付订单失败 ${order.orderNo}:`, wxError.message);
      // 微信订单关闭失败不影响主流程，记录日志即可
    }

    await transaction.commit();

    return {
      success: true,
      order: updatedOrder
    };
  } catch (error) {
    await transaction.rollback();
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 关闭微信支付订单
 */
async function closeWxpayOrder(orderNo) {
  try {
    const result = await cloud.callFunction({
      name: 'cloudbase_module',
      data: {
        type: 'wxpay_close_order',
        data: {
          out_trade_no: orderNo
        }
      }
    });

    return result;
  } catch (error) {
    throw new Error(`关闭微信支付订单失败: ${error.message}`);
  }
}

/**
 * 获取所有订单（管理员使用）- 不限制userId
 */
async function getAllOrders(status, openId) {
  try {
    // 构建查询条件（不添加userId限制）
    const whereCondition = {};

    // 如果指定了状态，添加状态过滤
    if (status) {
      whereCondition.status = { $eq: status };
    }

    // 获取订单列表（获取所有订单）
    const { data: orders } = await models.Order.list({
      filter: {
        where: whereCondition,
        order: [['_createTime', 'desc']], // 按创建时间倒序
        limit: 1000 // 设置较大的limit以获取所有订单
      },
      envType: "prod",
      getCount: true,
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
              presaleFlag: skuData ? skuData.presaleFlag : false,
            };
          })
        );

        return {
          ...order,
          _createTime: order.createdAt || order._createTime, // 将 createdAt 映射为 _createTime
          itemCount: items.totalCount,
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
  } catch (err) {
    console.error('获取订单列表失败:', err);
    return {
      code: 500,
      message: '获取订单列表失败: ' + err.message
    };
  }
}

/**
 * 通过地址ID获取地址信息（管理后台专用）
 */
async function getAddressById(addressId, openId) {
  try {
    if (!addressId) {
      return {
        code: 400,
        message: "缺少必要参数: addressId"
      };
    }

    // 查询地址信息
    const { data: address } = await models.Addresses.get({
      filter: {
        where: {
          _id: { $eq: addressId }
        }
      },
      envType: "prod"
    });

    if (!address) {
      return {
        code: 404,
        message: "地址不存在"
      };
    }

    // 格式化返回数据（使用数据库实际字段名）
    const formattedAddress = {
      receiver: address.receiver || '',           // 收货人
      phone: address.phone || '',                 // 电话
      provinceCity: address.provinceCity || '',   // 省市区
      detailAddress: address.detailAddress || '', // 详细地址
      fullAddress: `${address.provinceCity || ''}${address.detailAddress || ''}` // 完整地址
    };

    console.log('获取地址成功:', formattedAddress);

    return {
      code: 200,
      message: "获取地址信息成功",
      data: formattedAddress
    };
  } catch (err) {
    console.error('获取地址信息失败:', err);
    return {
      code: 500,
      message: '获取地址信息失败: ' + err.message
    };
  }
}

/**
 * 管理后台更新订单状态（专用方法）
 */
async function adminUpdateOrderStatus(orderId, newStatus, logisticsNo, openId) {
  try {
    console.log('管理后台更新订单状态:', { orderId, newStatus, logisticsNo });

    if (!orderId || !newStatus) {
      return {
        code: 400,
        message: "缺少必要参数: orderId 或 newStatus"
      };
    }

    // 查询订单是否存在（管理后台不需要验证用户权限）
    const { data: order } = await models.Order.get({
      filter: {
        where: {
          _id: { $eq: orderId }
        }
      },
      envType: "prod"
    });

    if (!order) {
      return {
        code: 404,
        message: "订单不存在"
      };
    }

    console.log('当前订单状态:', order.status);

    // 验证状态流转是否合法
    const validTransitions = getValidStatusTransitions(order.status);
    console.log('允许的状态转换:', validTransitions);

    if (!validTransitions.includes(newStatus)) {
      return {
        code: 400,
        message: `不允许从 ${order.status} 状态转换到 ${newStatus} 状态`
      };
    }

    // 如果是发货状态，必须提供物流单号
    if (newStatus === ORDER_STATUS.SHIPPING && !logisticsNo) {
      return {
        code: 400,
        message: "发货状态必须提供物流单号"
      };
    }

    // 准备更新数据
    const updateData = {
      status: newStatus,
      version: order.version + 1
    };

    // 根据新状态添加额外字段
    switch (newStatus) {
      case ORDER_STATUS.PAID:
        updateData.payTime = new Date().getTime();
        break;

      case ORDER_STATUS.SHIPPING:
        updateData.shipTime = new Date().getTime();
        updateData.logisticsNo = logisticsNo;
        break;

      case ORDER_STATUS.SIGNED:
        updateData.signTime = new Date().getTime();
        break;

      case ORDER_STATUS.CANCELLED:
        updateData.cancelTime = new Date().getTime();
        updateData.cancelReason = '管理员取消';
        // 取消订单时恢复库存（仅普通商品）
        if (!order.presaleFlag) {
          await restoreStockAfterCancel(order._id);
        }
        break;

      case ORDER_STATUS.REFUNDED:
      case ORDER_STATUS.PARTIAL_REFUNDED:
        updateData.refundTime = new Date().getTime();
        // 退款成功时恢复库存（仅普通商品）
        if (!order.presaleFlag) {
          await restoreStockAfterCancel(order._id);
        }
        break;

      case ORDER_STATUS.REFUNDING:
        // 退款中状态不需要额外字段
        break;
    }

    console.log('准备更新的数据:', updateData);

    // 更新订单（带乐观锁条件）
    const { data: updateResult } = await models.Order.update({
      filter: {
        where: {
          _id: { $eq: orderId },
          version: { $eq: order.version }
        }
      },
      data: updateData,
      envType: "prod"
    });

    console.log('更新结果:', updateResult);

    if (!updateResult || updateResult.count === 0) {
      return {
        code: 409,
        message: "订单状态已被其他操作更新，请刷新后重试"
      };
    }

    // 获取更新后的订单信息
    const { data: updatedOrder } = await models.Order.get({
      filter: {
        where: {
          _id: { $eq: orderId }
        }
      },
      envType: "prod"
    });

    console.log('订单状态更新成功:', updatedOrder.status);

    return {
      code: 200,
      message: "订单状态更新成功",
      data: updatedOrder
    };
  } catch (err) {
    console.error('更新订单状态失败:', err);
    return {
      code: 500,
      message: '更新订单状态失败: ' + err.message
    };
  }
}