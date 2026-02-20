import { useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro, { useLoad, useDidShow } from "@tarojs/taro";
import TopBarWithBack from "@/components/TopBarWithBack";
import FloatPopup from "@/components/FloatPopup";
import { useSystemInfo } from "@/hooks/useSystemInfo";
import { useAuth } from "@/hooks/useAuth";
import * as addressService from "@/services/address.service";
import * as userService from "@/services/user.service";
import type { Address } from "@/types/user";
import styles from "./index.module.scss";

export default function AddressList() {
  const { statusBarHeight, navBarHeight } = useSystemInfo();
  const { ensureLogin } = useAuth();
  const topOffset = statusBarHeight + navBarHeight;

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [defaultAddressId, setDefaultAddressId] = useState("");
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [showFloatPopup, setShowFloatPopup] = useState(false);

  const loadAddressList = useCallback(async () => {
    try {
      const userRes = await userService.getUserInfo();
      if (userRes.code !== 200 || !userRes.data) return;

      const res = await addressService.listAddresses(userRes.data._id);
      if (res.code !== 200 || !res.data) return;

      const list = Array.isArray(res.data)
        ? res.data
        : (res.data as any).items || [];
      setAddresses(list);
      setIsEmpty(list.length === 0);
      const defaultAddr = list.find((a) => a.isDefault);
      setDefaultAddressId(defaultAddr?._id || "");
    } catch {
      Taro.showToast({ title: "地址加载失败，请重试", icon: "none" });
    }
  }, []);

  useLoad((params) => {
    if (params?.select === "1") {
      setIsSelectMode(true);
    }
    ensureLogin().then(() => loadAddressList());
  });

  useDidShow(() => {
    ensureLogin().then(() => loadAddressList());
  });

  useEffect(() => {
    const onAddressChanged = () => {
      loadAddressList();
    };
    Taro.eventCenter.on("address:changed", onAddressChanged);
    return () => {
      Taro.eventCenter.off("address:changed", onAddressChanged);
    };
  }, [loadAddressList]);

  const handleSetDefault = async (addressId: string) => {
    const res = await addressService.setDefaultAddress(addressId);
    if (res.code === 200) {
      Taro.showToast({ title: "设置成功", icon: "success" });
      await loadAddressList();
    }
  };

  const handleDelete = (addressId: string) => {
    Taro.showModal({
      title: "确认删除",
      content: "确定要删除该地址吗？",
      success: async (modalRes) => {
        if (modalRes.confirm) {
          const res = await addressService.deleteAddress(addressId);
          if (res.code === 200) {
            Taro.showToast({ title: "删除成功", icon: "success" });
            await loadAddressList();
          }
        }
      },
    });
  };

  const handleEdit = (addressId: string) => {
    Taro.navigateTo({ url: `/pages-sub/address-edit/index?id=${addressId}` });
  };

  const handleAdd = () => {
    Taro.navigateTo({ url: "/pages-sub/address-edit/index" });
  };

  const handleSelectAddress = (address: Address) => {
    if (!isSelectMode) return;
    Taro.eventCenter.trigger("selectAddress", address);
    Taro.navigateBack();
  };

  return (
    <View className={styles.container}>
      <TopBarWithBack />
      <View style={{ marginTop: `${topOffset + 20}px` }}>
        <View className={styles.title}>地址簿</View>

        {isEmpty ? (
          <View className={styles.emptyState}>
            <View className={styles.addNewAddress} onClick={handleAdd}>
              新增地址
            </View>
          </View>
        ) : (
          <View>
            <ScrollView scrollY className={styles.addressScrollView}>
              {addresses.map((item) => (
                <View key={item._id} className={styles.addressCard}>
                  {defaultAddressId === item._id && (
                    <View className={styles.defaultTag}>默认</View>
                  )}
                  <View
                    className={styles.addressDetailEdit}
                    onClick={() => handleSelectAddress(item)}
                  >
                    <View className={styles.addressContainer}>
                      <View className={styles.namePhone}>
                        <Text className={styles.name}>{item.receiver}</Text>
                        <Text className={styles.phone}>{item.phone}</Text>
                      </View>
                      <View className={styles.provinceCity}>
                        {item.provinceCity}
                      </View>
                      <View className={styles.detailAddress}>
                        {item.detailAddress}
                      </View>
                    </View>

                    <View className={styles.ops}>
                      <View className={styles.editDeleteButtons}>
                        <View
                          className={styles.editBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(item._id);
                          }}
                        >
                          <Text>编辑</Text>
                        </View>
                        <View
                          className={styles.deleteBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item._id);
                          }}
                        >
                          <Text>删除</Text>
                        </View>
                      </View>
                      {defaultAddressId !== item._id && (
                        <View
                          className={styles.setDefault}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetDefault(item._id);
                          }}
                        >
                          <Text>设为默认</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View className={styles.addNewAddress} onClick={handleAdd}>
              新增地址
            </View>
            <View className={styles.bottomSpacer} />
          </View>
        )}
      </View>

      <FloatPopup
        visible={showFloatPopup}
        onClose={() => setShowFloatPopup(false)}
      />
    </View>
  );
}
