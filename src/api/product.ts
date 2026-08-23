import api from "./axios";

import type { ProductDto } from "@/types/api/ProductDto";
import type { ProductDetailDto } from "@/types/api/ProductDetailDto";

interface ProductListResponse {
  success: boolean;
  message: string;
  data: ProductDto[];
}

interface ProductDetailResponse {
  success: boolean;
  message: string;
  data: ProductDetailDto;
}

/**
 * Verified-real server-side filters on `/v1/products_management/` (confirmed
 * against the live backend — see category_id/sub_category_id SQL error leak,
 * and empty-vs-nonempty diffing for size/search). Price and sort are NOT
 * supported server-side (params are silently ignored), so those stay
 * client-side.
 */
export interface ProductQueryParams {
  category_id?: number;
  sub_category_id?: number;
  size?: string;
  search?: string;
}

export async function getProducts(params?: ProductQueryParams) {
  const response = await api.get<ProductListResponse>(
    "/v1/products_management/",
    params && Object.keys(params).length ? { params } : undefined
  );

  return response.data.data;
}

export async function getProductById(id: string | number) {
  const response = await api.get<ProductDetailResponse>(
    `/v1/products_management/?id=${id}`
  );

  return response.data.data;
}