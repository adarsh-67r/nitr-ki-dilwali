import type { Product } from "./order.ts";

export type ImportRow = Omit<Product, "id" | "image_url">;
type Cell = unknown;

const HEADERS: Record<string, keyof ImportRow> = {
  name: "name", category: "category", description: "description",
  mrp: "mrp", price: "price", "selling price": "price", "in stock": "in_stock", stock: "in_stock", sort: "sort", order: "sort",
};

const toInt = (v: Cell) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[₹,\s]/g, ""));
  return Number.isInteger(n) && n >= 0 ? n : NaN;
};

/** Turns a sheet (first row = headers) into product rows, or a list of row-numbered errors. */
export function parseProductRows(sheet: readonly (readonly Cell[])[]): { rows: ImportRow[]; errors: string[] } {
  const [head = [], ...body] = sheet;
  const cols = head.map((h) => HEADERS[String(h ?? "").trim().toLowerCase()]);
  for (const need of ["name", "category", "price"] as const)
    if (!cols.includes(need)) return { rows: [], errors: [`Missing a "${need}" column in the first row`] };

  const rows: ImportRow[] = [];
  const errors: string[] = [];
  body.forEach((cells, i) => {
    const line = i + 2;
    const get = (k: keyof ImportRow) => cells[cols.indexOf(k)];
    if (cells.every((c) => c === null || c === undefined || String(c).trim() === "")) return;
    const name = String(get("name") ?? "").trim();
    const category = String(get("category") ?? "").trim();
    const price = toInt(get("price"));
    const mrp = cols.includes("mrp") ? toInt(get("mrp")) : null;
    const sort = cols.includes("sort") ? toInt(get("sort")) : null;
    const stock = String(get("in_stock") ?? "yes").trim().toLowerCase();

    if (!name || name.length > 80) return errors.push(`Row ${line}: name is required (max 80 characters)`);
    if (!category) return errors.push(`Row ${line}: category is required`);
    if (price === null || Number.isNaN(price)) return errors.push(`Row ${line}: price must be a whole number`);
    if (Number.isNaN(mrp)) return errors.push(`Row ${line}: MRP must be a whole number`);
    if (mrp !== null && mrp < price) return errors.push(`Row ${line}: MRP (${mrp}) is lower than the price (${price})`);
    if (Number.isNaN(sort)) return errors.push(`Row ${line}: sort must be a whole number`);

    rows.push({
      name, category, price, mrp,
      description: String(get("description") ?? "").trim() || null,
      in_stock: !["no", "n", "false", "0", "out", "sold out"].includes(stock),
      sort: sort ?? line,
    });
  });
  return { rows, errors };
}
