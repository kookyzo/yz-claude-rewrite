export interface Spu {
  _id: string;
  spuId: string;
  name: string;
  description: string;
  category: string;
  seriesId: string;
  isOnSale: boolean;
  mainImages: string[];
  referencePrice: number;
}

export interface Sku {
  _id: string;
  skuId: string;
  nameCN: string;
  nameEN: string;
  price: number;
  skuMainImages: string[];
  spuId: string;
  materialId: string;
  subSeries: string;
  sizeId?: string;
  stock?: number;
}

export interface Material {
  _id: string;
  nameCN: string;
  description?: string;
  materialImage: string;
  sortNum?: number;
  isEnabled?: boolean;
  childMaterials?: Material[];
}

export interface SubSeries {
  _id: string;
  subSeriesId?: string;
  name: string;
  nameEN?: string;
  displayImage: string;
  introduction?: string;
  parentSeriesId?: string;
  sortNum?: number;
  isEnabled?: boolean;
}

export interface Category {
  _id: string;
  categoryId?: string;
  categoryName?: string;
  typeName: string;
  displayImage?: string;
  status?: boolean;
}

export interface ProductSize {
  _id: string;
  category: { _id: string };
  type: string;
  standard: string;
  sizeNum: number;
  value: string;
  sortNum?: number;
  isEnabled?: boolean;
}
