import { loadCatalog } from "../services/catalogService";

export async function testCatalog() {
  try {
    const catalog = await loadCatalog();

    console.log("Catalog Service");

    console.log(catalog);

  } catch (err) {
    console.error(err);
  }
}