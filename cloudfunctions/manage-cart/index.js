const {
  init
} = require('@cloudbase/wx-cloud-client-sdk');
const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});
const client = init(cloud);
const models = client.models;

// 购物车管理 云函数入口函数
exports.main = async (event, context) => {
  const { action, data } = event;
  const { _userId, _skuId, _spuId, quantity, _cartItemId, selected, useSpecification } = data || {};

  // 获取用户OpenID（腾讯云自动注入）
  const { OPENID } = cloud.getWXContext();

  // 通用错误处理函数
  const handleError = (err) => {
    console.error('Error:', err);
    return { code: 500, message: err.message };
  };

  try {
    switch (action) {
      case 'add':
        return await addToCart(_userId, _skuId, _spuId, quantity, useSpecification, OPENID);

      case 'update':
        return await updateCartItemNumber(_cartItemId, quantity, OPENID);

      case 'selected':
        return await updateCartItemSelected(_cartItemId, selected, OPENID);
      case 'selectedAll':
        return await updateCartItemSelectedAll(_userId, selected, OPENID);

      case 'remove':
        return await removeFromCart(_cartItemId, OPENID);

      case 'list':
        return await getCartList(_userId, OPENID);

      case 'clear':
        return await clearCart(_userId, OPENID);

      case 'updateSpecification':
        return await updateCartItemSpecification(_cartItemId, _skuId, useSpecification, OPENID);

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

// 添加商品到购物车
async function addToCart(userId, skuId, spuId, quantity = 1, useSpecification = true, openId) {
  if (!userId) {
    return {
      code: 400,
      message: "缺少必要参数: userId"
    };
  }

  // 如果useSpecification为true，必须有skuId
  if (useSpecification && !skuId) {
    return {
      code: 400,
      message: "使用规格时需要提供skuId"
    };
  }

  let skuInfo = null;
  let spuInfo = null;
  let materialInfo = null;
  let sizeInfo = null;

  // 获取SKU或SPU信息
  if (useSpecification && skuId) {
    // 获取SKU信息
    const { data: skuData } = await models.ProductSkus.get({
      filter: {
        where: {
          _id: { $eq: skuId },
          isOnSale: { $eq: true }
        }
      },
      envType: "prod"
    });

    if (!skuData) {
      return {
        code: 404,
        message: "商品不存在或已下架"
      };
    }

    skuInfo = skuData;

    // 获取SPU信息
    const { data: spuData } = await models.ProductSpus.get({
      filter: {
        where: {
          _id: { $eq: skuData.spuId._id },
          isOnSale: { $eq: true }
        }
      },
      envType: "prod"
    });

    spuInfo = spuData;

    // 查询材质信息
    if (skuData.materialId) {
      const { data: materialData } = await models.Materials.get({
        filter: {
          where: {
            _id: { $eq: skuData.materialId }
          }
        },
        envType: "prod"
      });
      materialInfo = materialData;
    }

    // 查询尺寸信息
    if (skuData.sizeId) {
      const { data: sizeData } = await models.ProductSizes.get({
        filter: {
          where: {
            _id: { $eq: skuData.sizeId }
          }
        },
        envType: "prod"
      });
      sizeInfo = sizeData;
    }
  } else if (spuId) {
    // 获取SPU信息
    const { data: spuData } = await models.ProductSpus.get({
      filter: {
        where: {
          _id: { $eq: spuId },
          isOnSale: { $eq: true }
        }
      },
      envType: "prod"
    });

    spuInfo = spuData;
  } else {
    return {
      code: 400,
      message: "需要提供skuId或spuId参数"
    };
  }

  if (!spuInfo) {
    return {
      code: 404,
      message: "商品SPU不存在或已下架"
    };
  }

  // 获取或创建用户的购物车
  let cart = await getOrCreateCart(userId, openId);

  // 根据是否使用规格确定查询条件
  let queryCondition;
  if (useSpecification) {
    // 使用规格，按SKU ID查询
    queryCondition = {
      cartId: { $eq: cart._id },
      cartItem_Sku: { $eq: skuId },
      cartItem_Spu: { $eq: spuInfo._id }
    };
  } else {
    // 不使用规格，按SPU ID查询
    queryCondition = {
      cartId: { $eq: cart._id },
      cartItem_Spu: { $eq: spuInfo._id },
      cartItem_Sku: { $eq: null } // 确保没有关联SKU
    };
  }

  // 检查购物车中是否已有该商品
  const { data: existingItems } = await models.CartItems.list({
    filter: {
      where: queryCondition
    },
    envType: "prod"
  });

  if (existingItems.records && existingItems.records.length > 0) {
    // 如果已存在，更新数量
    const existingItem = existingItems.records[0];
    const { data: updatedItem } = await models.CartItems.update({
      filter: {
        where: { _id: { $eq: existingItem._id } }
      },
      data: {
        quantity: existingItem.quantity + quantity,
      },
      envType: "prod"
    });

    return {
      code: 200,
      message: "购物车商品数量已更新",
      data: updatedItem
    };
  } else {
    // 如果不存在，创建新项
    const itemData = {
      cartId: { _id: cart._id },
      cartItem_Spu: { _id: spuInfo._id },
      quantity,
      status: true, // 默认选中
      unitPrice: useSpecification ? skuInfo.price : spuInfo.referencePrice,
    };

    // 如果使用规格，添加SKU关联和材质尺寸信息
    if (useSpecification) {
      itemData.cartItem_Sku = { _id: skuInfo._id };
      itemData.materialId = skuInfo.materialId ? { _id: skuInfo.materialId } : null;
      itemData.sizeId = skuInfo.sizeId ? { _id: skuInfo.sizeId } : null;
      itemData.material = materialInfo ? materialInfo.nameCN : '';
      itemData.size = sizeInfo ? sizeInfo.value : '';
    }

    const { data: newItem } = await models.CartItems.create({
      data: itemData,
      envType: "prod"
    });
    const { data: cartItem } = await models.CartItems.get({
      filter: {
        where: {
          _id: { $eq: newItem.id }
        }
      },
      select: {
        cartItem_Spu: true,
        cartItem_Sku: true,
        materialId: true,
        sizeId: true,
        material: true,
        size: true,
        unitPrice: true,
        status: true,
        quantity: true,
      },
      envType: "prod"
    });

    return {
      code: 200,
      message: "商品已添加到购物车",
      data: cartItem
    };
  }
}

// 获取或创建用户的购物车
async function getOrCreateCart(_userId, openId) {
  // 查找用户的购物车
  const { data: cartData } = await models.Carts.list({
    filter: {
      where: {
        userId: { $eq: _userId }
      }
    },
    envType: "prod"
  });

  if (cartData.records && cartData.records.length > 0) {
    return cartData.records[0];
  }

  // 如果没有找到，创建新的购物车
  const { data: newCart } = await models.Carts.create({
    data: {
      cartId: "cart" + _userId,
      userId: { _id: _userId },
    },
    envType: "prod"
  });

  return newCart;
}

// 更新购物车商品数量
async function updateCartItemNumber(cartItemId, quantity, openId) {
  if (!cartItemId || quantity === undefined) {
    return {
      code: 400,
      message: "缺少必要参数: cartItemId 和 quantity"
    };
  }

  if (quantity < 1) {
    return {
      code: 400,
      message: "数量不能小于1"
    };
  }

  const { data: updatedItem } = await models.CartItems.update({
    filter: {
      where: {
        _id: { $eq: cartItemId },
      }
    },
    data: {
      quantity: quantity
    },
    envType: "prod"
  });

  if (!updatedItem) {
    return {
      code: 404,
      message: "购物车项不存在或无权操作"
    };
  }

  return {
    code: 200,
    message: "购物车商品数量已更新",
    data: updatedItem
  };
}

// 更新购物车商品规格
async function updateCartItemSpecification(cartItemId, newSkuId, useSpecification, openId) {
  if (!cartItemId) {
    return {
      code: 400,
      message: "缺少必要参数: cartItemId"
    };
  }

  // 获取原来的购物车项
  const { data: cartItem } = await models.CartItems.get({
    filter: {
      where: {
        _id: { $eq: cartItemId },
      }
    },
    envType: "prod"
  });

  if (!cartItem) {
    return {
      code: 404,
      message: "购物车项不存在或无权操作"
    };
  }

  let skuInfo = null;
  let spuInfo = null;
  let materialInfo = null;
  let sizeInfo = null;

  // 获取新的SKU或SPU信息
  if (useSpecification && newSkuId) {
    // 获取SKU信息
    const { data: skuData } = await models.ProductSkus.get({
      filter: {
        where: {
          _id: { $eq: newSkuId },
          isOnSale: { $eq: true }
        }
      },
      envType: "prod"
    });

    if (!skuData) {
      return {
        code: 404,
        message: "新的商品规格不存在或已下架"
      };
    }

    skuInfo = skuData;

    // 获取SPU信息
    const { data: spuData } = await models.ProductSpus.get({
      filter: {
        where: {
          _id: { $eq: skuData.spuId._id },
          isOnSale: { $eq: true }
        }
      },
      envType: "prod"
    });

    spuInfo = spuData;

    // 查询材质信息
    if (skuData.materialId) {
      const { data: materialData } = await models.Materials.get({
        filter: {
          where: {
            _id: { $eq: skuData.materialId }
          }
        },
        envType: "prod"
      });
      materialInfo = materialData;
    }

    // 查询尺寸信息
    if (skuData.sizeId && skuData.sizeId) {
      const { data: sizeData } = await models.ProductSizes.get({
        filter: {
          where: {
            _id: { $eq: skuData.sizeId }
          }
        },
        envType: "prod"
      });
      sizeInfo = sizeData;
    }
  } else if (cartItem.cartItem_Spu) {
    // 如果不使用规格，使用原来的SPU信息
    const { data: spuData } = await models.ProductSpus.get({
      filter: {
        where: {
          _id: { $eq: cartItem.cartItem_Spu },
          isOnSale: { $eq: true }
        }
      },
      envType: "prod"
    });

    spuInfo = spuData;
  } else {
    return {
      code: 400,
      message: "无法确定商品信息"
    };
  }

  if (!spuInfo) {
    return {
      code: 404,
      message: "商品SPU不存在或已下架"
    };
  }

  // 构建更新数据
  const updateData = {
    unitPrice: useSpecification ? skuInfo.price : spuInfo.referencePrice,
  };

  if (useSpecification) {
    updateData.cartItem_Sku = { _id: skuInfo._id };
    updateData.materialId = skuInfo.materialId ? { _id: skuInfo.materialId } : null;
    updateData.sizeId = skuInfo.sizeId ? { _id: skuInfo.sizeId } : null;
    updateData.material = materialInfo ? materialInfo.nameCN : '';
    updateData.size = sizeInfo ? sizeInfo.value : '';
  } else {
    updateData.cartItem_Sku = null;
    updateData.materialId = null;
    updateData.sizeId = null;
    updateData.material = null;
    updateData.size = null;
  }

  const { data: updatedItem } = await models.CartItems.update({
    filter: {
      where: { _id: { $eq: cartItemId } }
    },
    data: updateData,
    envType: "prod"
  });

  return {
    code: 200,
    message: "商品规格已更新",
    data: updatedItem
  };
}

// 更新购物车商品选中状态
async function updateCartItemSelected(cartItemId, selected, openId) {
  if (!cartItemId || selected === undefined) {
    return {
      code: 400,
      message: "缺少必要参数: cartItemId 和 selected"
    };
  }

  const { data: updatedItem } = await models.CartItems.update({
    filter: {
      where: {
        _id: { $eq: cartItemId },
      }
    },
    data: {
      status: selected,
    },
    envType: "prod"
  });

  if (!updatedItem) {
    return {
      code: 404,
      message: "购物车项不存在或无权操作"
    };
  }

  return {
    code: 200,
    message: "购物车商品选中状态已更新",
    data: updatedItem
  };
}

// 更新购物车商品全部选中状态
async function updateCartItemSelectedAll(userId, selected, openId) {
  if (!userId || selected === undefined) {
    return {
      code: 400,
      message: "缺少必要参数: userId 和 selected"
    };
  }

  // 获取用户的购物车
  const { data: cartData } = await models.Carts.list({
    filter: {
      where: {
        userId: { $eq: userId },
      }
    },
    envType: "prod"
  });

  if (!cartData.records || cartData.records.length === 0) {
    return {
      code: 200,
      message: "购物车为空",
      data: {
        cart: null,
        items: []
      }
    };
  }

  const cart = cartData.records[0];

  const { data: updatedItem } = await models.CartItems.updateMany({
    filter: {
      where: {
        cartId: { $eq: cart._id },
      }
    },
    data: {
      status: selected,
    },
    envType: "prod"
  });

  if (!updatedItem) {
    return {
      code: 404,
      message: "更新失败，购物车项不存在或无权操作"
    };
  }

  return {
    code: 200,
    message: "购物车商品选中状态已更新",
    data: updatedItem
  };
}

// 从购物车删除商品
async function removeFromCart(cartItemId, openId) {
  if (!cartItemId) {
    return {
      code: 400,
      message: "缺少必要参数: cartItemId"
    };
  }

  const { data: deletedItem } = await models.CartItems.delete({
    filter: {
      where: {
        _id: { $eq: cartItemId },
      }
    },
    envType: "prod"
  });

  if (!deletedItem) {
    return {
      code: 404,
      message: "购物车项不存在或无权操作"
    };
  }

  return {
    code: 200,
    message: "商品已从购物车删除",
    data: deletedItem
  };
}

// 获取购物车列表
async function getCartList(userId, openId) {
  if (!userId) {
    return {
      code: 400,
      message: "缺少必要参数: userId"
    };
  }

  // 获取用户的购物车
  const { data: cartData } = await models.Carts.list({
    filter: {
      where: {
        userId: { $eq: userId },
      }
    },
    envType: "prod"
  });

  if (!cartData.records || cartData.records.length === 0) {
    return {
      code: 200,
      message: "购物车为空",
      data: {
        cart: null,
        items: []
      }
    };
  }

  const cart = cartData.records[0];

  // 获取购物车中的所有项
  const { data: cartItems } = await models.CartItems.list({
    filter: {
      where: {
        cartId: { $eq: cart._id }
      }
    },
    select: {
      $master: true,
      cartItem_Spu: true,
      cartItem_Sku: true,
      materialId: true,
      sizeId: true,
      material: true,
      size: true,
      status: true,      // 添加选中状态字段
      quantity: true     // 添加数量字段
    },
    envType: "prod"
  });

  // 处理购物车项，为有关联SKU的项获取SKU信息，为关联SPU的项获取SPU信息
  const itemsWithDetails = await Promise.all(
    cartItems.records.map(async (item) => {
      try {
        const result = {
          ...item,
          skuInfo: null,
          spuInfo: null,
          materialInfo: null,
          sizeInfo: null
        };

        // 获取SPU信息
        if (item.cartItem_Spu && item.cartItem_Spu._id) {
          const { data: spuData } = await models.ProductSpus.get({
            filter: {
              where: {
                _id: { $eq: item.cartItem_Spu._id },
                isOnSale: { $eq: true }
              }
            },
            envType: "prod"
          });

          if (spuData) {
            result.spuInfo = {
              _id: spuData._id,
              spuId: spuData.spuId,
              name: spuData.name,
              mainImages: spuData.mainImages || [],
              referencePrice: spuData.referencePrice,
              isOnSale: spuData.isOnSale
            };
          }
        }

        // 如果有关联SKU，获取SKU信息
        if (item.cartItem_Sku) {
          // 处理 cartItem_Sku 可能是对象（包含 _id）或直接 ID 的情况
          const skuIdValue = item.cartItem_Sku?._id || item.cartItem_Sku;

          if (skuIdValue) {
            const { data: skuData } = await models.ProductSkus.get({
              filter: {
                where: {
                  _id: { $eq: skuIdValue },
                  isOnSale: { $eq: true }
                }
              },
              select: {
                _id: true,
                skuId: true,
                nameCN: true,
                nameEN: true,
                skuMainImages: true,
                price: true,
                stock: true,
                size: true,
                isOnSale: true
              },
              envType: "prod"
            });

            if (skuData) {
              result.skuInfo = {
                _id: skuData._id,
                skuId: skuData.skuId,
                nameCN: skuData.nameCN,
                nameEN: skuData.nameEN,
                skuMainImages: skuData.skuMainImages || [],
                price: skuData.price,
                stock: skuData.stock,
                size: skuData.size,
                isOnSale: skuData.isOnSale
              };
            }
          }
        }

        // 获取材质信息
        if (item.materialId) {
          // 处理 materialId 可能是对象（包含 _id）或直接 ID 的情况
          const materialIdValue = item.materialId?._id || item.materialId;

          if (materialIdValue) {
            const { data: materialData } = await models.Materials.get({
              filter: {
                where: {
                  _id: { $eq: materialIdValue }
                }
              },
              select: {
                _id: true,
                nameCN: true
              },
              envType: "prod"
            });
            if (materialData) {
              result.materialInfo = {
                _id: materialData._id,
                nameCN: materialData.nameCN
              };
            }
          }
        }

        // 获取尺寸信息
        if (item.sizeId) {
          // 处理 sizeId 可能是对象（包含 _id）或直接 ID 的情况
          const sizeIdValue = item.sizeId?._id || item.sizeId;

          if (sizeIdValue) {
            const { data: sizeData } = await models.ProductSizes.get({
              filter: {
                where: {
                  _id: { $eq: sizeIdValue }
                }
              },
              select: {
                _id: true,
                value: true
              },
              envType: "prod"
            });
            if (sizeData) {
              result.sizeInfo = {
                _id: sizeData._id,
                value: sizeData.value
              };
            }
          }
        }

        return result;
      } catch (error) {
        console.error("获取商品信息失败:", error);
        return {
          ...item,
          spuInfo: null,
          skuInfo: null,
          materialInfo: null,
          sizeInfo: null,
          error: "获取商品信息失败"
        };
      }
    })
  );

  return {
    code: 200,
    message: "获取购物车成功",
    data: {
      cart,
      items: itemsWithDetails
    }
  };
}

// 清空购物车
async function clearCart(userId, openId) {
  if (!userId) {
    return {
      code: 400,
      message: "缺少必要参数: userId"
    };
  }

  // 获取用户的购物车
  const { data: cartData } = await models.Carts.list({
    filter: {
      where: {
        userId: { $eq: userId },
      }
    },
    envType: "prod"
  });

  if (!cartData.records || cartData.records.length === 0) {
    return {
      code: 200,
      message: "购物车已为空"
    };
  }

  const cart = cartData.records[0];

  // 删除购物车中的所有项
  const { data: deletedItems } = await models.CartItems.deleteMany({
    filter: {
      where: {
        cartId: { $eq: cart._id },
      }
    },
    envType: "prod"
  });

  return {
    code: 200,
    message: "购物车已清空",
    data: {
      deletedCount: deletedItems.deletedCount
    }
  };
}