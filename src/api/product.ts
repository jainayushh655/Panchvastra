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

export async function getProducts() {
  const response = await api.get<ProductListResponse>(
    "/v1/products_management/"
  );

  return response.data.data;
}

export async function getProductById(id: string | number) {
  const response = await api.get<ProductDetailResponse>(
    `/v1/products_management/?id=${id}`
  );

  return response.data.data;
}