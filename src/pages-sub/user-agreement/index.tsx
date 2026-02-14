import { View, ScrollView } from '@tarojs/components'
import TopBarWithBack from '@/components/TopBarWithBack'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import styles from './index.module.scss'

export default function UserAgreement() {
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
          <View className={styles.title}>销售条款</View>

          {/* 1. 一般条件 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>1.1.</View>
            <View className={styles.paragraph}>
              本销售条款和条件（下称"本一般条件"）适用于所有通过"Y.ZHENG 悦涧"微信小程序（下称"本小程序"）完成的Y.ZHENG 悦涧珠宝作品（下称"珠宝作品"）的远程销售。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>1.2.</View>
            <View className={styles.paragraph}>
              根据本一般条件所远程销售的珠宝作品仅面向年满18周岁、具有签订任何形式的协议的具有完全行为能力、且非以贸易、商业行业和营利为目的行事的自然人消费者（下称"客户"）。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>1.3.</View>
            <View className={styles.paragraph}>
              客户应仔细阅读本一般条件，本一般条件均公布在小程序上以便客户确认、存储和复制。Y.ZHENG 悦涧将在适用法律规定的保留期内保存Y.ZHENG 悦涧与客户订立的销售合同。
            </View>
          </View>

          {/* 2. 卖方信息 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>2.1.</View>
            <View className={styles.paragraph}>
              卖方为广州市言几珠宝有限公司，注册地址位于广州市天河区黄埔大道西76号1607房。
            </View>
          </View>

          {/* 3. 珠宝作品信息 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>3.1.</View>
            <View className={styles.paragraph}>
              珠宝作品信息（及相关珠宝作品编码）和相关价格请见本小程序。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>3.2.</View>
            <View className={styles.paragraph}>
              Y.ZHENG 悦涧有权在任何时间限制小程序所供应珠宝作品的数量及/或种类。Y.ZHENG 悦涧有权在不经通知的情况下变更小程序所描述的珠宝作品种类、型号和材质。在订单生效后，若订购珠宝作品无货，Y.ZHENG 悦涧有权取消订单，如客户已完成支付的，Y.ZHENG 悦涧将尽快退还已支付货款。Y.ZHENG 悦涧不因珠宝作品无货向客户承担任何责任。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>3.3.</View>
            <View className={styles.paragraph}>
              Y.ZHENG 悦涧不对因客户无法连接到小程序而产生的任何错误承担任何责任。
            </View>
          </View>

          {/* 4. 价格 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>4.1.</View>
            <View className={styles.paragraph}>
              小程序显示的珠宝作品价格以人民币（元）计算，并已包含全部适用税费。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>4.2.</View>
            <View className={styles.paragraph}>
              Y.ZHENG 悦涧会定期核查小程序显示的珠宝作品价格是否正确，但Y.ZHENG 悦涧不保证杜绝任何错误。若发现珠宝作品定价错误，Y.ZHENG 悦涧有权与客户协商，以正确价格购买珠宝作品，协商不成的Y.ZHENG 悦涧有权取消订单。
            </View>
          </View>

          {/* 5. 订单 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>5.1.</View>
            <View className={styles.paragraph}>
              客户在通过本小程序提交订单之前，应仔细阅读本一般条件和购物过程中提供的所有指引，以及运费、订单取消、合同终止、无理由退货条件及隐私政策等相关指引。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>5.2.</View>
            <View className={styles.paragraph}>
              购买珠宝作品时，客户可以通过以下步骤完成选购
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (i)选择珠宝作品后点击立即购买按钮
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (ii)填写订单相关信息
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (iii)接受小程序隐私政策和销售条款
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (iv)通过本小程序向Y.ZHENG 悦涧提交订单后并在线付款。
            </View>
            <View className={styles.paragraph}>
              购买珠宝作品时，客户亦可通过以下步骤完成选购
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (i)选择珠宝作品后点击加入购物袋按钮
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (ii)进入购物袋页面可继续购物或者删除作品
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (iii)在购物袋页面，点击去结算按钮，进入填写订单相关信息
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (iv)接受小程序隐私政策和销售条款
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (v)通过本小程序向Y.ZHENG 悦涧提交订单后并在线付款。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>5.3.</View>
            <View className={styles.paragraph}>
              客户填写订单相关信息并支付选定订购的珠宝作品价款后订单生效。如客户未完成支付珠宝作品价款，订单将被视为自始无效。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>5.4.</View>
            <View className={styles.paragraph}>
              客户按照本小程序规定程序完成支付选定订购的珠宝作品价款后，客户在小程序菜单栏点击"我的"按钮，可查看到该订单信息，该订单构成Y.ZHENG 悦涧和客户之间的买卖合同。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>5.5.</View>
            <View className={styles.paragraph}>
              尽管有第5.4条的规定，若发生如下任一情况，Y.ZHENG 悦涧有权通过本小程序或客户在订单中提交的联系方式通知客户立即终止全部或部分订单，不承担任何违约责任:
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (i)订购珠宝作品缺货(不影响第3.2条的规定);在此情况下Y.ZHENG 悦涧将退还缺货珠宝作品的价款;
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (ii)珠宝作品价格错误，在此情况下，Y.ZHENG 悦涧将退还该珠宝作品的价款(不影响第4.2条的规定);
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (ii)客户被举报或怀疑存在欺诈或非法行为，包括但不限于被怀疑出于营利或其他商业目的购买珠宝作品的，Y.ZHENG 悦涧将退还该珠宝作品的价款；
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (iv)客户尚未履行其先前与Y.ZHENG 悦涧签订的合同所产生的义务。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>5.6.</View>
            <View className={styles.paragraph}>
              客户可通过本小程序查询订单的信息，包括购买的珠宝作品的基本特征概述、价格及物流单号。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>5.7.</View>
            <View className={styles.paragraph}>
              珠宝作品的所有权自Y.ZHENG 悦涧收到全部珠宝作品价款且珠宝作品交付至客户(或客户在订单中指定的第三方，承运人除外)之时转移至客户。珠宝作品的灭失或损害风险自珠宝作品交付至客户(或客户在订单中指定的第三方，承运人除外)之时转移至客户。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>5.8.</View>
            <View className={styles.paragraph}>
              一般情况下，Y.ZHENG 悦涧根据本第5条向客户发出的所有通知均将通过本小程序或客户在相关订单中提交的联系方式发出。
            </View>
          </View>

          {/* 6. 支付 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>6.1.</View>
            <View className={styles.paragraph}>
              客户可以按照本第6条的规定自行或委托第三方通过微信支付方式支付订单中的珠宝作品价款。为本一般条件的目的，"微信支付"指由腾讯通过微信平台提供的用于用户转移款项的支付工具和服务。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>6.2.</View>
            <View className={styles.paragraph}>
              由腾讯、银行或其他金融机构因客户以微信支付方式收取的全部转账相关费用及支出（以实际情况为准）均由客户自行承担。
            </View>
          </View>

          {/* 7. 交付 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>7.1.</View>
            <View className={styles.paragraph}>
              珠宝作品应交付至客户在订单中列明的配送地址。交付时，需由客户（或客户在订单中指定的第三方，承运人除外）收。Y.ZHENG悦涧 拒绝以任何货运代理人的邮政信箱或地址作为交付地址。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>7.2.</View>
            <View className={styles.paragraph}>
              客户可通过本小程序查阅相关订单的订单详情。客户可在Y.ZHENG 悦涧向客户交付珠宝作品后（在珠宝作品分批交付的情形下则从最后一批珠宝作品的交付时间起算）通过电话19988266351或小程序在线客服联系Y.ZHENG 悦涧申请已交付珠宝作品（不包括任何退货）的相应税务发票。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>7.3.</View>
            <View className={styles.paragraph}>
              购买的珠宝作品由Y.ZHENG 悦涧选定的快递服务提供商（下称"快递"）送货。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>7.4.</View>
            <View className={styles.paragraph}>
              快递交付珠宝作品时，客户（或客户指定的第三方）应核实：
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (i)交付的珠宝作品数量与相关订单所列数量相同;
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (ii) 交付的珠宝作品与相关订单项下珠宝作品的作品编号、尺寸及其他规格一致，且无明显瑕疵，客户可通过本小程序查阅该等相关订单的前述详情；及
            </View>
            <View className={`${styles.paragraph} ${styles.indent}`}>
              (ii) 包装及其封签完整、未损坏、未受潮或有任何形式的变化。
            </View>
            <View className={styles.paragraph}>
              凡出现任何包装和/或珠宝作品损坏，或珠宝作品与订单不一致或存在任何明显瑕疵，或珠宝作品数量不符，客户必须立即在快递的快递单上作出书面说明并拒收。一旦客户签署快递单且没有提出任何异议，除根据第9条提出出厂瑕疵外，将视为客户就交付的珠宝作品完成验收且没有任何异议。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>7.5.</View>
            <View className={styles.paragraph}>
              珠宝作品发货后，客户将收到物流单号，客户可至物流服务商平台查询递送进度，物流信息及交付情况应以实际事实为准，Y.ZHENG 悦涧不对此承担责任。
            </View>
          </View>

          {/* 8. 退货 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>8.1.</View>
            <View className={styles.paragraph}>
              因Y.ZHENG 悦涧销售商品的性质，如有尺寸修改、刻字等定制行为，客户确认向Y.ZHENG 悦涧购买的珠宝作品属于不宜退货的商品，不适用七日无理由退货规定。
            </View>
          </View>

          {/* 9. 瑕疵 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>9.1.</View>
            <View className={styles.paragraph}>
              若Y.ZHENG 悦涧出售的珠宝作品存在出厂瑕疵（不包括与订单确认不符或明显瑕疵，该等不符或明显瑕疵应根据上文第7.4条处理），客户必须立即通过电话19988266351或本小程序联系Y.ZHENG 悦涧的客服人员。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>9.2.</View>
            <View className={styles.paragraph}>
              由客户任何原因造成的珠宝作品损坏，不视为瑕疵或不合格（包括但不限于非由Y.ZHENG 悦涧作出的尺寸修改、经常长时间佩戴或使用、存放不当、自然磨损等）。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>9.3.</View>
            <View className={styles.paragraph}>
              若客户根据本第9条因出厂瑕疵申请维修、更换或退回珠宝作品，Y.ZHENG 悦涧应承担维修、更换或退回珠宝作品的退货运费，以及向客户交付经维修的珠宝作品或替换珠宝作品的任何相关费用。
            </View>
          </View>

          {/* 10. 隐私政策 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>10.1.</View>
            <View className={styles.paragraph}>
              Y.ZHENG 悦涧会严格按照隐私政策收集和使用客户的个人数据。在通过小程序购物前，客户应首先接受隐私政策。
            </View>
          </View>

          {/* 11. 责任限制 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>11.1.</View>
            <View className={styles.paragraph}>
              Y.ZHENG 悦涧不对客户接受本一般条件时客户或Y.ZHENG 悦涧无法合理预见的任何损害或损失承担责任，包括因Y.ZHENG 悦涧违约产生的任何无法预见的损害或损失。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>11.2.</View>
            <View className={styles.paragraph}>
              若Y.ZHENG 悦涧因无法合理控制的任何事件不能履行或必须延迟履行Y.ZHENG 悦涧在本一般条件项下的义务，Y.ZHENG 悦涧不对因此产生的任何损害承担责任。该等无法合理控制的事件包括但不限于任何基础设施故障、政府干涉、战争、社会动荡、劫持、水灾、风暴、事故、罢工、停工、恐怖袭击、疫情、交通或出行管控、或影响Y.ZHENG 悦涧或Y.ZHENG 悦涧的供应商的其他原因。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>11.3.</View>
            <View className={styles.paragraph}>
              若客户未作为消费者接受本一般条件，Y.ZHENG 悦涧不对由Y.ZHENG 悦涧导致的任何损失或损害承担责任。客户提交订单视为客户已仔细阅读并同意本一般条件及小程序上公布的隐私政策。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>12.4.</View>
            <View className={styles.paragraph}>
              在法律允许的最大范围内，本小程序、小程序的内容和服务依"现状"及"现有"的基础提供。Y.ZHENG 悦涧不就本小程序、小程序的内容或服务提供任何担保或保证，包括，例如总是可用且不存在功能中断或错误，或适于任何特定目的。Y.ZHENG 悦涧明确否认任何该等保证。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>11.5.</View>
            <View className={styles.paragraph}>
              Y.ZHENG 悦涧致力于确保小程序提供的信息准确及时。但Y.ZHENG 悦涧不保证该等信息的准确性或该等信息不存在错误或遗漏，且Y.ZHENG 悦涧不就此作出任何担保也不承担相应的责任。Y.ZHENG 悦涧有权在任何时间更新及/或纠正小程序内容，无需发出通知和承担任何责任。
            </View>
          </View>

          {/* 12. 保证和知识产权 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>12.1.</View>
            <View className={styles.paragraph}>
              Y.ZHENG 悦涧保证您在本小程序购买的所有珠宝作品均为正品。
            </View>
          </View>

          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>12.2.</View>
            <View className={styles.paragraph}>
              珠宝作品、相关附属品及/或包装、以及构成商品形状的标志上所带的"Y.ZHENG"及/或"Y.ZHENG 悦涧"商标、以及一系列抽象和非抽象商标、服务标记，不论是否注册，连同受版权保护的所有说明、图像及地方，以及更广泛地，珠宝作品的所有知识产权，属于Y.ZHENG 悦涧关联公司所有。
            </View>
          </View>

          {/* 13. 适用法律 */}
          <View className={styles.chapter}>
            <View className={styles.chapterTitle}>13.1</View>
            <View className={styles.paragraph}>
              本一般条件及Y.ZHENG 悦涧与客户签订的合同受中华人民共和国法律管辖并依其解释。
            </View>
          </View>
        </View>
      </ScrollView>

      <View className={styles.bottomSpacer} />
    </View>
  )
}
