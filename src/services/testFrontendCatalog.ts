import { loadCatalog } from "./catalogService";

export async function testFrontendCatalog() {
    const data = await loadCatalog();

    console.log(data.products);
}