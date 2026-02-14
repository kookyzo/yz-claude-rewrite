import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import TopBarWithBack from '@/components/TopBarWithBack'
import { useSystemInfo } from '@/hooks/useSystemInfo'
import {
  addCategory, updateCategory, removeCategory, getCategory, listCategories,
  addMaterial, updateMaterial, removeMaterial, getMaterial, listMaterials,
  addProductSize, updateProductSize, removeProductSize, getProductSize, listProductSizes,
  addSubSeries, updateSubSeries, removeSubSeries, getSubSeries, listSubSeries,
} from '@/services/cms.service'
import styles from './index.module.scss'

type CmsTab = 'categories' | 'materials' | 'productSizes' | 'subSeries'

interface DisplayItem {
  key: string
  value: string
}

const tabs: { key: CmsTab; label: string }[] = [
  { key: 'categories', label: '分类' },
  { key: 'materials', label: '材质' },
  { key: 'productSizes', label: '尺寸' },
  { key: 'subSeries', label: '子系列' },
]

const tabNames: Record<CmsTab, string> = {
  categories: '分类',
  materials: '材质',
  productSizes: '尺寸',
  subSeries: '子系列',
}

const idKeys: Record<CmsTab, string> = {
  categories: 'categoryId',
  materials: 'materialId',
  productSizes: 'productSizeId',
  subSeries: 'subSeriesId',
}

const formatObjectForDisplay = (obj: any): DisplayItem[] => {
  if (!obj) return []
  return Object.entries(obj)
    .filter(([key]) => !['_id', '_createTime', '_updateTime'].includes(key))
    .filter(([, value]) => typeof value !== 'object' || value === null)
    .map(([key, value]) => ({
      key,
      value: value !== null && value !== undefined ? String(value) : '',
    }))
}

export default function ProductCms() {
  const [currentTab, setCurrentTab] = useState<CmsTab>('categories')
  const [result, setResult] = useState('请选择上方的选项卡开始操作...')
  const [currentObject, setCurrentObject] = useState<DisplayItem[] | null>(null)
  const [currentObjectType, setCurrentObjectType] = useState('')
  const [createdIds, setCreatedIds] = useState({
    categoryId: '',
    materialId: '',
    productSizeId: '',
    subSeriesId: '',
  })
  const { statusBarHeight, navBarHeight } = useSystemInfo()
  const topOffset = statusBarHeight + navBarHeight

  const showResult = (text: string, obj?: any) => {
    setResult(text)
    if (obj) {
      setCurrentObject(formatObjectForDisplay(obj))
      setCurrentObjectType(tabNames[currentTab])
    } else {
      setCurrentObject(null)
      setCurrentObjectType('')
    }
  }

  const handleTabChange = (tab: CmsTab) => {
    setCurrentTab(tab)
    setResult('')
    setCurrentObject(null)
    setCurrentObjectType('')
  }

  const getCurrentId = () => createdIds[idKeys[currentTab] as keyof typeof createdIds]

  // ---- Categories ----
  const handleCreateCategory = async () => {
    const res = await addCategory({
      categoryName: '测试分类_' + Date.now(),
      status: true,
      displayImage: '',
    })
    if (res.code === 200) {
      const id = (res as any)._categoryId || (res.data as any)?._id || ''
      setCreatedIds((prev) => ({ ...prev, categoryId: id }))
      showResult(`分类创建成功，ID: ${id}`, res.data)
    } else {
      showResult(`创建失败: ${res.message}`)
    }
  }

  const handleListCategories = async () => {
    const res = await listCategories()
    if (res.code === 200) {
      const list = res.data || []
      showResult(`共 ${Array.isArray(list) ? list.length : (list as any).total || 0} 个分类`)
    } else {
      showResult(`获取列表失败: ${res.message}`)
    }
  }

  const handleGetCategory = async () => {
    if (!createdIds.categoryId) { showResult('请先创建一个分类'); return }
    const res = await getCategory({ _categoryId: createdIds.categoryId })
    if (res.code === 200) {
      showResult('获取详情成功', res.data)
    } else {
      showResult(`获取详情失败: ${res.message}`)
    }
  }

  const handleUpdateCategory = async () => {
    if (!createdIds.categoryId) { showResult('请先创建一个分类'); return }
    const res = await updateCategory({
      _categoryId: createdIds.categoryId,
      updateData: { categoryName: '更新后的分类_' + Date.now() },
    })
    if (res.code === 200) {
      showResult('更新成功', res.data)
    } else {
      showResult(`更新失败: ${res.message}`)
    }
  }

  const handleDeleteCategory = async () => {
    if (!createdIds.categoryId) { showResult('请先创建一个分类'); return }
    const res = await removeCategory({ _categoryId: createdIds.categoryId })
    if (res.code === 200) {
      setCreatedIds((prev) => ({ ...prev, categoryId: '' }))
      showResult('删除成功')
    } else {
      showResult(`删除失败: ${res.message}`)
    }
  }

  // ---- Materials ----
  const handleCreateMaterial = async () => {
    const res = await addMaterial({
      nameCN: '测试材质_' + Date.now(),
      materialImage: '',
    })
    if (res.code === 200) {
      const id = (res as any)._materialId || (res.data as any)?._id || ''
      setCreatedIds((prev) => ({ ...prev, materialId: id }))
      showResult(`材质创建成功，ID: ${id}`, res.data)
    } else {
      showResult(`创建失败: ${res.message}`)
    }
  }

  const handleListMaterials = async () => {
    const res = await listMaterials()
    if (res.code === 200) {
      const list = res.data || []
      showResult(`共 ${Array.isArray(list) ? list.length : (list as any).total || 0} 个材质`)
    } else {
      showResult(`获取列表失败: ${res.message}`)
    }
  }

  const handleGetMaterial = async () => {
    if (!createdIds.materialId) { showResult('请先创建一个材质'); return }
    const res = await getMaterial({ _materialId: createdIds.materialId })
    if (res.code === 200) {
      showResult('获取详情成功', res.data)
    } else {
      showResult(`获取详情失败: ${res.message}`)
    }
  }

  const handleUpdateMaterial = async () => {
    if (!createdIds.materialId) { showResult('请先创建一个材质'); return }
    const res = await updateMaterial({
      _materialId: createdIds.materialId,
      updateData: { nameCN: '更新后的材质_' + Date.now() },
    })
    if (res.code === 200) {
      showResult('更新成功', res.data)
    } else {
      showResult(`更新失败: ${res.message}`)
    }
  }

  const handleDeleteMaterial = async () => {
    if (!createdIds.materialId) { showResult('请先创建一个材质'); return }
    const res = await removeMaterial({ _materialId: createdIds.materialId })
    if (res.code === 200) {
      setCreatedIds((prev) => ({ ...prev, materialId: '' }))
      showResult('删除成功')
    } else {
      showResult(`删除失败: ${res.message}`)
    }
  }

  // ---- ProductSizes ----
  const handleCreateProductSize = async () => {
    const res = await addProductSize({
      category: { _id: 'test' },
      type: '戒指',
      standard: 'CN',
      sizeNum: 10,
      value: '10号',
    })
    if (res.code === 200) {
      const id = (res as any)._sizeId || (res.data as any)?._id || ''
      setCreatedIds((prev) => ({ ...prev, productSizeId: id }))
      showResult(`尺寸创建成功，ID: ${id}`, res.data)
    } else {
      showResult(`创建失败: ${res.message}`)
    }
  }

  const handleListProductSizes = async () => {
    const res = await listProductSizes()
    if (res.code === 200) {
      const list = res.data || []
      showResult(`共 ${Array.isArray(list) ? list.length : (list as any).total || 0} 个尺寸`)
    } else {
      showResult(`获取列表失败: ${res.message}`)
    }
  }

  const handleGetProductSize = async () => {
    if (!createdIds.productSizeId) { showResult('请先创建一个尺寸'); return }
    const res = await getProductSize({ _sizeId: createdIds.productSizeId })
    if (res.code === 200) {
      showResult('获取详情成功', res.data)
    } else {
      showResult(`获取详情失败: ${res.message}`)
    }
  }

  const handleUpdateProductSize = async () => {
    if (!createdIds.productSizeId) { showResult('请先创建一个尺寸'); return }
    const res = await updateProductSize({
      _sizeId: createdIds.productSizeId,
      updateData: { sizeNum: 11 } as any,
    })
    if (res.code === 200) {
      showResult('更新成功', res.data)
    } else {
      showResult(`更新失败: ${res.message}`)
    }
  }

  const handleDeleteProductSize = async () => {
    if (!createdIds.productSizeId) { showResult('请先创建一个尺寸'); return }
    const res = await removeProductSize({ _sizeId: createdIds.productSizeId })
    if (res.code === 200) {
      setCreatedIds((prev) => ({ ...prev, productSizeId: '' }))
      showResult('删除成功')
    } else {
      showResult(`删除失败: ${res.message}`)
    }
  }

  // ---- SubSeries ----
  const handleCreateSubSeries = async () => {
    const res = await addSubSeries({
      name: '测试子系列_' + Date.now(),
      displayImage: '',
    })
    if (res.code === 200) {
      const id = (res as any)._subSeriesId || (res.data as any)?._id || ''
      setCreatedIds((prev) => ({ ...prev, subSeriesId: id }))
      showResult(`子系列创建成功，ID: ${id}`, res.data)
    } else {
      showResult(`创建失败: ${res.message}`)
    }
  }

  const handleListSubSeries = async () => {
    const res = await listSubSeries()
    if (res.code === 200) {
      const list = res.data || []
      showResult(`共 ${Array.isArray(list) ? list.length : (list as any).total || 0} 个子系列`)
    } else {
      showResult(`获取列表失败: ${res.message}`)
    }
  }

  const handleGetSubSeries = async () => {
    if (!createdIds.subSeriesId) { showResult('请先创建一个子系列'); return }
    const res = await getSubSeries({ _subSeriesId: createdIds.subSeriesId })
    if (res.code === 200) {
      showResult('获取详情成功', res.data)
    } else {
      showResult(`获取详情失败: ${res.message}`)
    }
  }

  const handleUpdateSubSeries = async () => {
    if (!createdIds.subSeriesId) { showResult('请先创建一个子系列'); return }
    const res = await updateSubSeries({
      _subSeriesId: createdIds.subSeriesId,
      updateData: { name: '更新后的子系列_' + Date.now() },
    })
    if (res.code === 200) {
      showResult('更新成功', res.data)
    } else {
      showResult(`更新失败: ${res.message}`)
    }
  }

  const handleDeleteSubSeries = async () => {
    if (!createdIds.subSeriesId) { showResult('请先创建一个子系列'); return }
    const res = await removeSubSeries({ _subSeriesId: createdIds.subSeriesId })
    if (res.code === 200) {
      setCreatedIds((prev) => ({ ...prev, subSeriesId: '' }))
      showResult('删除成功')
    } else {
      showResult(`删除失败: ${res.message}`)
    }
  }

  // ---- Operations map ----
  const operations: Record<CmsTab, {
    create: () => void
    list: () => void
    get: () => void
    update: () => void
    delete: () => void
  }> = {
    categories: {
      create: handleCreateCategory,
      list: handleListCategories,
      get: handleGetCategory,
      update: handleUpdateCategory,
      delete: handleDeleteCategory,
    },
    materials: {
      create: handleCreateMaterial,
      list: handleListMaterials,
      get: handleGetMaterial,
      update: handleUpdateMaterial,
      delete: handleDeleteMaterial,
    },
    productSizes: {
      create: handleCreateProductSize,
      list: handleListProductSizes,
      get: handleGetProductSize,
      update: handleUpdateProductSize,
      delete: handleDeleteProductSize,
    },
    subSeries: {
      create: handleCreateSubSeries,
      list: handleListSubSeries,
      get: handleGetSubSeries,
      update: handleUpdateSubSeries,
      delete: handleDeleteSubSeries,
    },
  }

  const currentOps = operations[currentTab]

  return (
    <View className={styles.page}>
      <TopBarWithBack />

      <ScrollView scrollY style={{ marginTop: `${topOffset}px`, height: `calc(100vh - ${topOffset}px)` }}>
        <View className={styles.container}>
          {/* Tab 栏 */}
          <View className={styles.tabs}>
            {tabs.map((t) => (
              <View
                key={t.key}
                className={`${styles.tab} ${currentTab === t.key ? styles.tabActive : ''}`}
                onClick={() => handleTabChange(t.key)}
              >
                {t.label}
              </View>
            ))}
          </View>

          {/* 当前 ID 信息 */}
          <View className={styles.card}>
            <Text className={styles.cardTitle}>当前数据</Text>
            <Text className={styles.infoText}>
              当前{tabNames[currentTab]} ID: {getCurrentId() || '暂无'}
            </Text>
          </View>

          {/* 操作按钮 */}
          <View className={styles.card}>
            <Text className={styles.cardTitle}>{tabNames[currentTab]}管理操作</Text>
            <View className={styles.btnGroup}>
              <View className={styles.btn} onClick={currentOps.create}>新增</View>
              <View className={styles.btn} onClick={currentOps.list}>获取列表</View>
              <View className={styles.btn} onClick={currentOps.get}>获取详情</View>
              <View className={styles.btn} onClick={currentOps.update}>更新</View>
              <View className={`${styles.btn} ${styles.btnDanger}`} onClick={currentOps.delete}>删除</View>
            </View>
          </View>

          {/* 结果区 */}
          <View className={styles.card}>
            <Text className={styles.cardTitle}>操作结果</Text>
            <Text className={styles.resultText}>{result}</Text>

            {currentObject && (
              <View className={styles.objectCard}>
                <Text className={styles.objectTitle}>{currentObjectType}详情</Text>
                {currentObject.map((item) => (
                  <View key={item.key} className={styles.objectRow}>
                    <Text className={styles.objectKey}>{item.key}</Text>
                    <Text className={styles.objectValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
