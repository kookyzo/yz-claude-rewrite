import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Popup, Rate, TextArea } from '@nutui/nutui-react-taro'
import styles from './index.module.scss'

interface ReviewRating {
  description: number
  logistics: number
  service: number
}

interface ReviewPopupProps {
  visible: boolean
  productImage: string
  productName: string
  productNameEN?: string
  onSubmit: (data: {
    ratings: ReviewRating
    content: string
    images: string[]
  }) => void
  onClose: () => void
}

const RATING_LABELS = ['非常差', '差', '一般', '好', '非常好']

type RatingKey = keyof ReviewRating

const RATING_DIMENSIONS: { key: RatingKey; label: string }[] = [
  { key: 'description', label: '描述相符' },
  { key: 'logistics', label: '物流服务' },
  { key: 'service', label: '服务态度' },
]

export default function ReviewPopup({
  visible,
  productImage,
  productName,
  productNameEN,
  onSubmit,
  onClose,
}: ReviewPopupProps) {
  const [ratings, setRatings] = useState<ReviewRating>({
    description: 5,
    logistics: 5,
    service: 5,
  })
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])

  const handleRatingChange = (key: RatingKey, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }))
  }

  const handleChooseImage = () => {
    const remaining = 9 - images.length
    if (remaining <= 0) return
    Taro.chooseImage({
      count: remaining,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        setImages((prev) => [...prev, ...res.tempFilePaths])
      },
    })
  }

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    onSubmit({ ratings, content, images })
  }

  return (
    <Popup
      visible={visible}
      position='bottom'
      overlay
      closeOnOverlayClick
      onClose={onClose}
      style={{ height: '1250rpx', borderRadius: '20rpx 20rpx 0 0' }}
    >
      <View className={styles.container}>
        {/* 商品信息 */}
        <View className={styles.productInfo}>
          <Image className={styles.productImg} src={productImage} mode='aspectFill' />
          <View className={styles.productText}>
            <Text className={styles.productName}>{productName}</Text>
            {productNameEN && (
              <Text className={styles.productNameEN}>{productNameEN}</Text>
            )}
          </View>
        </View>

        {/* 星级评分 */}
        {RATING_DIMENSIONS.map(({ key, label }) => (
          <View className={styles.ratingRow} key={key}>
            <Text className={styles.ratingLabel}>{label}</Text>
            <Rate
              value={ratings[key]}
              count={5}
              onChange={(val) => handleRatingChange(key, val)}
            />
            <Text className={styles.ratingText}>
              {RATING_LABELS[ratings[key] - 1]}
            </Text>
          </View>
        ))}

        {/* 文字评价 */}
        <View className={styles.textareaWrap}>
          <TextArea
            value={content}
            maxLength={500}
            placeholder='请输入您的评价...'
            onChange={(val) => setContent(val)}
          />
          <Text className={styles.charCount}>{content.length}/500</Text>
        </View>

        {/* 图片上传 */}
        <View className={styles.imageList}>
          {images.map((img, idx) => (
            <View className={styles.imageItem} key={img}>
              <Image className={styles.uploadedImg} src={img} mode='aspectFill' />
              <Text className={styles.removeBtn} onClick={() => handleRemoveImage(idx)}>×</Text>
            </View>
          ))}
          {images.length < 9 && (
            <View className={styles.addImageBtn} onClick={handleChooseImage}>
              <Text className={styles.addIcon}>+</Text>
            </View>
          )}
        </View>

        {/* 发布按钮 */}
        <View className={styles.submitBtn} onClick={handleSubmit}>
          <Text className={styles.submitBtnText}>发布评价</Text>
        </View>
      </View>
    </Popup>
  )
}
