import { View, Text, ScrollView } from '@tarojs/components'
import TopBarWithBack from '@/components/TopBarWithBack'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import styles from './index.module.scss'

export default function PrivacyPolicy() {
  const { statusBarHeight, navBarHeight } = useSystemInfo()
  const topOffset = statusBarHeight + navBarHeight

  return (
    <View className={styles.page}>
      <TopBarWithBack />

      <ScrollView
        className={styles.scrollView}
        scrollY
        style={{ marginTop: `${topOffset}px`, height: `calc(100vh - ${topOffset}px)` }}
      >
        <View className={styles.contentContainer}>
          <View className={styles.title}>微信小程序用户隐私协议</View>
          <View className={styles.subTitle}>【Y.Zheng悦涧】用户隐私保护指引</View>

          {/* 引言 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>引言</View>
            <View className={styles.paragraph}>
              欢迎您使用【Y.Zheng悦涧】！我们深知个人信息对您的重要性，并庄严承诺保护您的个人信息安全。本《用户隐私保护指引》（以下简称"本指引"）旨在向您清晰说明，在您使用【Y.Zheng悦涧】服务（以下简称"本服务"）时，我们如何收集、使用、存储、共享和保护您的个人信息，以及您如何行使对个人信息的权利。
            </View>
            <View className={styles.paragraph}>
              请您在使用本服务前，仔细阅读并充分理解本指引的全部内容。一旦您开始使用本服务，即表示您已完全同意本指引的内容。如果您不同意本指引的任何内容，请立即停止使用本服务。
            </View>
          </View>

          {/* 一、我们如何收集和使用您的个人信息 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>一、我们如何收集和使用您的个人信息</View>
            <View className={styles.paragraph}>
              个人信息是指以电子或者其他方式记录的能够单独或者与其他信息结合识别特定自然人身份或者反映特定自然人活动情况的各种信息。
            </View>

            <View className={styles.sectionTitle}>1. 为实现核心功能所必需的信息</View>
            <View className={styles.paragraph}>
              为了向您提供本服务的基本功能，我们会收集和使用以下必要信息：
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              当您使用我们的微信小程序访问在线商店并授权登陆时，我们可能通过弹窗获得授权，请您提供您的昵称、头像；如您进一步参与微信小程序中的活动，我们还可能根据活动的具体情况要求您提供一些个人信息。
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              当您于我们的微信小程序创建账户时，您需要向我们提供您的手机号码以便进行实名认证、并提供您的称谓、姓氏、名字（我们收集您的称谓、姓氏、名字是为了方便称呼您）和配送信息。
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              当您于我们的小程序选购商品时，我们将收集您的订单信息（包括您的订单号、购买的商品、数量、价格、购买时间）、配送信息（包括收货人姓名、收货地址、手机号码）和支付信息（包括账单信息、付款类型或方式、计费编号）；如您需要开具发票，我们还可能收集您的个人名称或公司信息（包括公司名称、纳税人识别号、公司地址、公司电话、公司银行账号）。
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              如果您需要进一步处理这些内容（如合并、格式化或翻译），请随时联系客服告知！
            </View>

            <View className={styles.sectionTitle}>2. 为实现特定功能所需的信息</View>
            <View className={styles.paragraph}>
              当您使用以下扩展功能时，我们会根据您的授权，收集和使用相应的信息：
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 位置信息（基于GPS和网络）：当您使用与位置相关的服务（如【签到、附近的人、地理位置打卡】）时，我们会请求您授权获取您的精确或粗略地理位置。您可以在设备设置中随时关闭此授权。
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 相机/相册权限：当您使用【上传头像、扫码、发布图片/视频】功能时，我们会请求您授权访问您的相机和相册。未经您的授权，我们不会访问这些信息。
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 麦克风权限：当您使用【语音输入、语音聊天、视频录制】功能时，我们会请求您授权使用您的麦克风。
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 通讯录权限：当您使用【邀请好友、匹配通讯录朋友】功能时，我们会请求您授权访问您的手机通讯录。我们仅会比对通讯录中的电话号码，不会存储您的通讯录信息。
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 手机号码：当您需要【手机号登录或接收短信验证码】时，我们会请求您授权获取您的本机手机号码。
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 写入剪贴板：当您使用【分享、复制口令/链接】功能时，我们可能会向您的剪贴板写入内容，或读取您剪贴板中的特定内容（如邀请码）。
            </View>
            <View className={styles.paragraph}>
              请注意：您拒绝提供上述非必要信息，不会影响您使用本小程序的核心功能。
            </View>
          </View>

          {/* 二、Cookie */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>二、我们如何使用Cookie和同类技术</View>
            <View className={styles.paragraph}>
              本小程序可能会使用Cookie和类似技术（如本地存储）来维护您的登录状态、记录您的偏好设置、优化页面展示，以提升您的服务体验。您可以根据自己的偏好管理或删除Cookie。
            </View>
          </View>

          {/* 三、共享 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>三、我们如何共享、转让、公开披露您的个人信息</View>
            <View className={styles.paragraph}>
              我们不会将您的个人信息出售给任何第三方。
            </View>
            <View className={styles.paragraph}>
              我们仅在以下情况下，共享您的个人信息：
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 获得您的明确同意后。
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 与授权合作伙伴共享：仅为实现本指引中声明的目的，我们的某些服务将由合作伙伴（如【云服务提供商、数据统计分析服务商、推送服务提供商】）提供。我们会与合作伙伴签署严格的保密协议，要求他们按照我们的指示、本指引以及其他任何相关的保密和安全措施来处理个人信息。
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 法律法规或强制性的政府要求：根据法律、法规、诉讼、或政府机构的强制性要求，我们可能会披露您的个人信息。
            </View>
          </View>

          {/* 四、存储和保护 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>四、我们如何存储和保护您的个人信息</View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 存储地点：我们在中华人民共和国境内运营中收集和产生的个人信息，将存储在中华人民共和国境内。
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 存储期限：我们仅为实现目的所必需的最短时间保留您的个人信息。超出保存期限后，我们将删除或匿名化处理您的个人信息。
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 安全措施：我们采取了多种安全措施，包括技术加密、访问控制、安全审计等，努力保护您的个人信息不被未经授权的访问、使用、修改或泄露。
            </View>
          </View>

          {/* 五、您的权利 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>五、您的权利</View>
            <View className={styles.paragraph}>您有权：</View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 访问、更正、删除您的个人信息：您可以在小程序内的【"我的"-"个人信息"】页面进行相关操作。
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 撤回授权：您可以通过设备操作系统设置，关闭相关权限，以撤回我们对您个人信息的收集和使用。
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 注销账号：您可以通过联系客服申请注销您的账号。注销后，我们将根据法律法规的要求删除您的个人信息或进行匿名化处理。
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 投诉举报：如果您认为您的个人信息权利受到侵害，可以通过本指引末尾的联系方式与我们联系。
            </View>
          </View>

          {/* 六、未成年人 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>六、我们如何处理未成年人的个人信息</View>
            <View className={styles.paragraph}>
              我们非常重视未成年人的个人信息保护。如果您是未满14周岁的未成年人，请在您的监护人陪同下仔细阅读本指引，并在征得监护人同意后使用我们的服务。
            </View>
            <View className={styles.paragraph}>
              如果我们发现自己在未获得监护人同意的情况下收集了未成年人的个人信息，我们会设法尽快删除相关数据。
            </View>
          </View>

          {/* 七、更新 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>七、本指引的更新</View>
            <View className={styles.paragraph}>
              我们可能会适时修订本指引。当条款发生重大变更时，我们会在小程序内以弹窗、公告等显著方式通知您。若您继续使用我们的服务，即表示您同意受修订后的指引约束。
            </View>
          </View>

          {/* 八、联系方式 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>八、如何联系我们</View>
            <View className={styles.paragraph}>
              如果您对本指引或您的个人信息处理有任何疑问、意见或建议，请通过以下方式与我们联系：
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              · 客服邮箱：Yzhengjewelry@163.com
            </View>
            <View className={styles.paragraph}>
              我们将在收到您联系信息后的15个工作日内予以回复。
            </View>
          </View>

          <View className={styles.updateInfo}>
            <Text>更新日期：[2025年12月5日]</Text>
            <View>生效日期：[2025年12月5日]</View>
          </View>
        </View>
      </ScrollView>

      <View className={styles.bottomSpacer} />
    </View>
  )
}
