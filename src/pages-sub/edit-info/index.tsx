import { useState } from "react";
import { View, Text, Input, Image, Button, Picker } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import TopBarWithBack from "@/components/TopBarWithBack";
import { useSystemInfo } from "@/hooks/useSystemInfo";
import { useUserStore } from "@/stores/useUserStore";
import * as userService from "@/services/user.service";
import { isValidEmail, isNotEmpty } from "@/utils/validate";
import selectedIcon from "@/assets/icons/selected.png";
import notSelectedIcon from "@/assets/icons/not_selected.png";
import styles from "./index.module.scss";

type GenderType = "mr" | "ms" | "other";

const GENDER_MAP: Record<GenderType, string> = {
  mr: "先生",
  ms: "女士",
  other: "其他",
};

/** 从 API 返回的 title 反查 GenderType */
function titleToGender(title?: string): GenderType {
  if (title === "女士") return "ms";
  if (title === "其他") return "other";
  return "mr";
}

export default function EditInfo() {
  const { statusBarHeight, navBarHeight } = useSystemInfo();
  const topOffset = statusBarHeight + navBarHeight;

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [gender, setGender] = useState<GenderType>("mr");
  const [nickname, setNickname] = useState("");
  const [birthday, setBirthday] = useState("");
  const [phone, setPhone] = useState("");
  const [mail, setMail] = useState("");
  const [region, setRegion] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [errors, setErrors] = useState({
    lastName: false,
    firstName: false,
    nickname: false,
    phone: false,
    mail: false,
  });

  useLoad(async () => {
    try {
      const res = await userService.getUserInfo();
      if (res.code === 200 && res.data) {
        const p = res.data;
        if (p.lastName) setLastName(p.lastName);
        if (p.firstName) setFirstName(p.firstName);
        setGender(titleToGender(p.title));
        if (p.nickname) setNickname(p.nickname);
        if (p.birthday) {
          const date = new Date(
            typeof p.birthday === "number" ? p.birthday : Number(p.birthday),
          );
          if (!isNaN(date.getTime())) {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, "0");
            const d = String(date.getDate()).padStart(2, "0");
            setBirthday(`${y}-${m}-${d}`);
          }
        }
        if (p.phone && !p.phone.includes("*")) setPhone(p.phone);
        const mailVal = p.mail || "";
        if (mailVal) setMail(mailVal);
        if (Array.isArray(p.region) && p.region.length === 3) {
          setRegion(p.region);
        }
      }
    } catch {
      // silent
    }
  });

  const handleLastNameInput = (e) => {
    setLastName(e.detail.value);
    setErrors((prev) => ({ ...prev, lastName: false }));
  };

  const handleFirstNameInput = (e) => {
    setFirstName(e.detail.value);
    setErrors((prev) => ({ ...prev, firstName: false }));
  };

  const handleNicknameInput = (e) => {
    setNickname(e.detail.value);
    setErrors((prev) => ({ ...prev, nickname: false }));
  };

  const handlePhoneInput = (e) => {
    const value = (e.detail.value || "").replace(/\D/g, "").slice(0, 11);
    setPhone(value);
    setErrors((prev) => ({ ...prev, phone: false }));
  };

  const handleMailInput = (e) => {
    setMail(e.detail.value);
    setErrors((prev) => ({ ...prev, mail: false }));
  };

  const handleBirthdayChange = (e) => {
    setBirthday(e.detail.value);
  };

  const handleRegionChange = (e) => {
    setRegion(e.detail.value);
  };

  const handleEditAddress = () => {
    Taro.navigateTo({ url: "/pages-sub/address-list/index" });
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const phoneReg = /^1\d{10}$/;
    const newErrors = {
      lastName: !isNotEmpty(lastName),
      firstName: !isNotEmpty(firstName),
      nickname: !isNotEmpty(nickname),
      phone: !phoneReg.test(phone || ""),
      mail: mail && mail.trim() !== "" ? !isValidEmail(mail) : false,
    };
    setErrors(newErrors);

    if (Object.values(newErrors).some(Boolean)) {
      Taro.showToast({ title: "请完善必填信息", icon: "none", duration: 2000 });
      return;
    }

    setSubmitting(true);
    try {
      const title = GENDER_MAP[gender];
      const autoNickname = `${lastName}${firstName}`.trim() || nickname;
      const userId = useUserStore.getState().userInfo?._id;

      if (!userId) {
        Taro.showToast({ title: "用户信息异常，请重新登录", icon: "none" });
        setSubmitting(false);
        return;
      }

      const res = await userService.updateUser(userId, {
        firstName,
        lastName,
        gender,
        title,
        nickname: nickname || autoNickname,
        birthday,
        phone,
        mail: mail || "",
        region: Array.isArray(region) ? region.join("/") : "",
      });

      if (res.code !== 200) {
        Taro.showToast({ title: res.message || "保存失败", icon: "none" });
        setSubmitting(false);
        return;
      }

      await useUserStore.getState().fetchUserInfo();
      Taro.showToast({ title: "保存成功", icon: "success" });
      setTimeout(() => Taro.navigateBack(), 400);
    } catch {
      Taro.showToast({ title: "保存失败，请稍后重试", icon: "none" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className={styles.editContainer}>
      <TopBarWithBack title="个人信息编辑" />

      <View
        className={styles.editContent}
        style={{ marginTop: `${topOffset}px` }}
      >
        {/* Section Title */}
        <View className={styles.sectionTitle}>
          <Text className={styles.sectionTitleText}>个人信息</Text>
        </View>

        {/* 姓名（两列布局） */}
        <View className={styles.nameRow}>
          <View className={styles.nameItem}>
            <Text className={styles.formLabel}>姓</Text>
            <View
              className={`${styles.inputWrapper} ${errors.lastName ? styles.error : ""}`}
            >
              <Input
                className={styles.formInput}
                type="text"
                placeholder="请填写姓"
                value={lastName}
                onInput={handleLastNameInput}
              />
              <Text className={styles.requiredStar}>*</Text>
            </View>
          </View>
          <View className={styles.nameItem}>
            <Text className={styles.formLabel}>名</Text>
            <View
              className={`${styles.inputWrapper} ${errors.firstName ? styles.error : ""}`}
            >
              <Input
                className={styles.formInput}
                type="text"
                placeholder="请填写名"
                value={firstName}
                onInput={handleFirstNameInput}
              />
              <Text className={styles.requiredStar}>*</Text>
            </View>
          </View>
        </View>

        {/* 称谓 */}
        <View className={styles.genderSection}>
          <View className={styles.genderSectionRow}>
            <Text className={`${styles.formLabel} ${styles.genderLabelInline}`}>
              称谓
            </Text>
            <View className={styles.genderOptions}>
              {(["mr", "ms"] as GenderType[]).map((g) => (
                <View
                  key={g}
                  className={styles.genderOption}
                  onClick={() => setGender(g)}
                >
                  <View className={styles.genderCheckbox}>
                    <Image
                      className={styles.genderCheckboxIcon}
                      src={gender === g ? selectedIcon : notSelectedIcon}
                      mode="aspectFit"
                    />
                  </View>
                  <Text className={styles.genderLabel}>{GENDER_MAP[g]}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* 昵称 */}
        <View className={styles.formSection}>
          <Text className={styles.formLabel}>昵称</Text>
          <View
            className={`${styles.inputWrapperFull} ${errors.nickname ? styles.error : ""}`}
          >
            <Input
              className={styles.formInput}
              type="text"
              placeholder="请填写昵称"
              value={nickname}
              onInput={handleNicknameInput}
            />
            <Text className={styles.requiredStar}>*</Text>
          </View>
        </View>

        {/* 生日 */}
        <View className={styles.formSection}>
          <Text className={styles.formLabel}>生日</Text>
          <Picker
            mode="date"
            value={birthday}
            start="1900-01-01"
            end="2100-12-31"
            onChange={handleBirthdayChange}
          >
            <View className={styles.birthdayPicker}>
              <View className={styles.pickerDisplay}>
                {birthday ? (
                  <Text className={styles.pickerText}>{birthday}</Text>
                ) : (
                  <Text className={styles.pickerPlaceholder}>请选择生日</Text>
                )}
                <Text className={styles.pickerArrow}>⌵</Text>
              </View>
            </View>
          </Picker>
        </View>

        {/* 电话 */}
        <View className={styles.formSection}>
          <Text className={styles.formLabel}>电话</Text>
          <View
            className={`${styles.inputWrapperFull} ${errors.phone ? styles.error : ""}`}
          >
            <Input
              className={styles.formInput}
              type="number"
              placeholder="请填写联系电话"
              value={phone}
              onInput={handlePhoneInput}
              maxlength={11}
            />
            <Text className={styles.requiredStar}>*</Text>
          </View>
        </View>

        {/* 邮箱 */}
        <View className={styles.formSection}>
          <Text className={styles.formLabel}>邮箱</Text>
          <View
            className={`${styles.inputWrapperFull} ${errors.mail ? styles.error : ""}`}
          >
            <Input
              className={styles.formInput}
              type="text"
              placeholder="请填写邮箱"
              value={mail}
              onInput={handleMailInput}
            />
          </View>
        </View>

        {/* 地区 */}
        <View className={styles.formSection}>
          <Text className={styles.formLabel}>地区</Text>
          <Picker mode="region" value={region} onChange={handleRegionChange}>
            <View className={styles.regionPicker}>
              <View className={styles.pickerDisplay}>
                {region.length === 3 ? (
                  <Text className={styles.pickerText}>
                    {region[0]} - {region[1]} - {region[2]}
                  </Text>
                ) : (
                  <Text className={styles.pickerPlaceholder}>请选择地区</Text>
                )}
                <Text className={styles.pickerArrow}>⌵</Text>
              </View>
            </View>
          </Picker>
        </View>

        {/* 前往编辑地址信息 */}
        <View className={styles.editAddressBtn} onClick={handleEditAddress}>
          前往编辑地址信息
        </View>
      </View>

      {/* 底部提交按钮 */}
      <Button className={styles.submitBtn} onClick={handleSubmit}>
        保存
      </Button>
    </View>
  );
}
