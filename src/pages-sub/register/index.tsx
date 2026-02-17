import { useState } from "react";
import { View, Text, Input, Image, Button, Picker } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import TopBarWithBack from "@/components/TopBarWithBack";
import { useSystemInfo } from "@/hooks/useSystemInfo";
import { useUserStore } from "@/stores/useUserStore";
import * as userService from "@/services/user.service";
import selectedIcon from "@/assets/icons/selected.png";
import notSelectedIcon from "@/assets/icons/not_selected.png";
import styles from "./index.module.scss";

type GenderType = "mr" | "ms" | "other";

const GENDER_MAP: Record<GenderType, string> = {
  mr: "先生",
  ms: "女士",
  other: "其他",
};

function checkAge(birthday: string): boolean {
  const birth = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 18;
}

export default function Register() {
  const { statusBarHeight, navBarHeight } = useSystemInfo();
  const topOffset = statusBarHeight + navBarHeight;

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [gender, setGender] = useState<GenderType>("mr");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [birthday, setBirthday] = useState("");
  const [maxDate, setMaxDate] = useState("");
  const [phoneBtnDisabled, setPhoneBtnDisabled] = useState(false);
  const [agreements, setAgreements] = useState({
    privacy: false,
    marketing: false,
    analysis: false,
  });
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [errors, setErrors] = useState({
    lastName: false,
    firstName: false,
    phone: false,
    birthday: false,
    privacy: false,
  });
  const [submitting, setSubmitting] = useState(false);

  useLoad(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    setMaxDate(`${year}-${month}-${day}`);
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
  };

  const handlePhoneInput = (e) => {
    const value = (e.detail.value || "").replace(/\D/g, "").slice(0, 11);
    setPhone(value);
    setErrors((prev) => ({ ...prev, phone: false }));
    setPhoneBtnDisabled(false);
  };

  const handleGetPhone = async (e) => {
    if (e.detail.errMsg !== "getPhoneNumber:ok") {
      Taro.showToast({ title: "获取手机号失败", icon: "none", duration: 2000 });
      return;
    }

    const { code } = e.detail;
    if (!code) {
      Taro.showToast({ title: "获取授权码失败", icon: "none", duration: 2000 });
      return;
    }

    try {
      Taro.showLoading({ title: "获取手机号中..." });
      const res = await userService.bindPhone(code);
      Taro.hideLoading();

      if (res.code === 200 && res.data?.phoneNumber) {
        setPhone(res.data.phoneNumber);
        setErrors((prev) => ({ ...prev, phone: false }));
        setPhoneBtnDisabled(true);
        Taro.showToast({
          title: "手机号获取成功",
          icon: "success",
          duration: 1500,
        });
      } else {
        Taro.showToast({
          title: res.message || "获取手机号失败",
          icon: "none",
          duration: 2000,
        });
      }
    } catch {
      Taro.hideLoading();
      Taro.showToast({
        title: "网络错误，请重试",
        icon: "none",
        duration: 2000,
      });
    }
  };

  const handleBirthdayChange = (e) => {
    setBirthday(e.detail.value);
    setErrors((prev) => ({ ...prev, birthday: false }));
  };

  const handleAgreementChange = (key: keyof typeof agreements) => {
    const newAgreements = { ...agreements, [key]: !agreements[key] };
    setAgreements(newAgreements);
    setIsAllSelected(Object.values(newAgreements).every(Boolean));
    setErrors((prev) => ({ ...prev, privacy: false }));
  };

  const handleSelectAll = () => {
    const newState = !isAllSelected;
    setAgreements({
      privacy: newState,
      marketing: newState,
      analysis: newState,
    });
    setIsAllSelected(newState);
    setErrors((prev) => ({ ...prev, privacy: false }));
  };

  const handleSubmit = async () => {
    if (submitting) return;

    // Validate
    const newErrors = {
      lastName: !lastName.trim(),
      firstName: !firstName.trim(),
      phone: !phone.trim() || !/^1\d{10}$/.test(phone),
      birthday: !birthday,
      privacy: !agreements.privacy,
    };
    setErrors(newErrors);

    if (Object.values(newErrors).some(Boolean)) {
      Taro.showToast({ title: "请完善必填信息", icon: "none", duration: 2000 });
      return;
    }

    if (!checkAge(birthday)) {
      Taro.showToast({
        title: "您必须年满18周岁才能注册",
        icon: "none",
        duration: 2000,
      });
      return;
    }

    setSubmitting(true);
    try {
      const title = GENDER_MAP[gender];
      const finalNickname =
        nickname.trim() || `${lastName}${firstName}`.trim() || "微信用户";

      const res = await userService.register({
        gender,
        title,
        nickname: finalNickname,
        phone: phone.trim(),
        birthday,
        region: "",
        mail: "",
      });

      if (res.code === 200) {
        await useUserStore.getState().fetchUserInfo();
        Taro.showToast({ title: "注册成功", icon: "success", duration: 2000 });
        setTimeout(() => Taro.navigateBack(), 2000);
      } else if (res.code === 409) {
        Taro.showToast({ title: "用户已注册", icon: "none", duration: 2000 });
      } else {
        Taro.showToast({
          title: res.message || "注册失败",
          icon: "none",
          duration: 2000,
        });
      }
    } catch {
      Taro.showToast({
        title: "注册失败，请重试",
        icon: "none",
        duration: 2000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className={styles.registerContainer}>
      <TopBarWithBack title="注册新会员" />

      <View
        className={styles.registerContent}
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
        <View className={styles.phoneSection}>
          <Text className={styles.formLabel}>昵称</Text>
          <View className={styles.phoneInputWrapper}>
            <Input
              className={styles.phoneInput}
              type="text"
              placeholder="请填写昵称"
              value={nickname}
              onInput={handleNicknameInput}
            />
          </View>
        </View>

        {/* 电话 */}
        <View className={styles.phoneSection}>
          <Text className={styles.formLabel}>电话</Text>
          <View
            className={`${styles.phoneInputWrapper} ${errors.phone ? styles.error : ""}`}
          >
            <Text className={styles.requiredStar}>*</Text>
            <Input
              className={styles.phoneInput}
              type="number"
              placeholder="请填写手机号或点击获取"
              value={phone}
              onInput={handlePhoneInput}
              maxlength={11}
            />
            <Button
              className={styles.getPhoneBtn}
              openType="getPhoneNumber"
              onGetPhoneNumber={handleGetPhone}
              disabled={phoneBtnDisabled}
              size="mini"
            >
              {phoneBtnDisabled ? "已获取" : "一键授权手机号"}
            </Button>
          </View>
        </View>

        {/* 生日 */}
        <View className={styles.birthdaySection}>
          <Text className={styles.formLabel}>生日</Text>
          <Picker
            mode="date"
            value={birthday}
            start="1900-01-01"
            end={maxDate}
            onChange={handleBirthdayChange}
          >
            <View
              className={`${styles.birthdayPicker} ${errors.birthday ? styles.error : ""}`}
            >
              <View className={styles.pickerDisplay}>
                <Text className={styles.pickerRequiredStar}>*</Text>
                {birthday ? (
                  <Text className={styles.pickerText}>{birthday}</Text>
                ) : (
                  <Text className={styles.pickerPlaceholder}>请选择</Text>
                )}
                <Text className={styles.pickerArrow}>⌵</Text>
              </View>
            </View>
          </Picker>
        </View>

        {/* 条款列表 */}
        <View className={styles.agreementsSection}>
          {/* 隐私声明（必选） */}
          <View
            className={styles.agreementItem}
            onClick={() => handleAgreementChange("privacy")}
          >
            <View className={styles.agreementCheckbox}>
              <Image
                className={styles.agreementCheckboxIcon}
                src={agreements.privacy ? selectedIcon : notSelectedIcon}
                mode="aspectFit"
              />
            </View>
            <View className={styles.agreementText}>
              <Text className={styles.requiredStar}>* </Text>
              <Text>
                我同意 Y.ZHENG
                依照隐私声明使用收集我的个人信息，亦允许第三方依此存储和处理相同内容。
              </Text>
              <Text className={styles.requiredText}>(必选)</Text>
            </View>
          </View>

          {/* 营销信息 */}
          <View
            className={styles.agreementItem}
            onClick={() => handleAgreementChange("marketing")}
          >
            <View className={styles.agreementCheckbox}>
              <Image
                className={styles.agreementCheckboxIcon}
                src={agreements.marketing ? selectedIcon : notSelectedIcon}
                mode="aspectFit"
              />
            </View>
            <View className={styles.agreementText}>
              <Text>
                我同意收取微信，短彩信，电话，邮寄，电邮等一般营销信息。我了解
                Y.ZHENG 隐私权中心可提供设置协助。
              </Text>
            </View>
          </View>

          {/* 分析个人信息 */}
          <View
            className={styles.agreementItem}
            onClick={() => handleAgreementChange("analysis")}
          >
            <View className={styles.agreementCheckbox}>
              <Image
                className={styles.agreementCheckboxIcon}
                src={agreements.analysis ? selectedIcon : notSelectedIcon}
                mode="aspectFit"
              />
            </View>
            <View className={styles.agreementText}>
              <Text>
                我同意 Y.ZHENG
                依照隐私声明使用分析个人信息，以此建立个人档案与个性化互动营销。
              </Text>
            </View>
          </View>

          {/* 全选按钮 */}
          <View className={styles.selectAllItem} onClick={handleSelectAll}>
            <View className={styles.agreementCheckbox}>
              <Image
                className={styles.agreementCheckboxIcon}
                src={isAllSelected ? selectedIcon : notSelectedIcon}
                mode="aspectFit"
              />
            </View>
            <Text className={styles.selectAllText}>以上全选</Text>
          </View>
        </View>
      </View>

      {/* 底部按钮 */}
      <Button
        className={`${styles.submitBtn} ${agreements.privacy ? styles.enabled : styles.disabled}`}
        onClick={handleSubmit}
        disabled={!agreements.privacy}
      >
        我已满18周岁，自愿选择并同意以上内容
      </Button>
    </View>
  );
}
