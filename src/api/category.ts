import api from "./axios";
import type {
  CategoryDto,
  CategoryListResponse,
} from "@/types/api/CategoryDto";

export async function getCategories() {
  const response =
    await api.get<CategoryListResponse>(
      "/v1/categories_management/"
    );

  return response.data.data;
}

export async function createCategory(
  data: Omit<
    CategoryDto,
    | "id"
    | "created_at"
    | "created_by"
    | "updated_at"
    | "updated_by"
  >
) {
  return api.post("/v1/categories_management/", data);
}

export async function updateCategory(
  data: Pick<CategoryDto, "id"> &
    Partial<CategoryDto>
) {
  return api.put("/v1/categories_management/", data);
}

export async function deleteCategory(
  id: number
) {
  return api.delete(
    `/v1/categories_management/?id=${id}`
  );
}