// Run: node --test lib/importProducts.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseProductRows } from "./importProducts.ts";

test("parses headers in any case/order, MRP, stock words and blank rows", () => {
  const { rows, errors } = parseProductRows([
    ["Category", "NAME", "MRP", "Price", "In stock", "Description"],
    ["Rockets", "Lunik Rocket", "₹250", 180, "yes", "Whistle up"],
    [null, null, null, null, null, null],
    ["Bombs", "Hydro Bomb", "", "150", "no", ""],
  ]);
  assert.deepEqual(errors, []);
  assert.deepEqual(rows[0], { name: "Lunik Rocket", category: "Rockets", price: 180, mrp: 250, description: "Whistle up", in_stock: true, sort: 2 });
  assert.equal(rows[1].mrp, null);
  assert.equal(rows[1].in_stock, false);
});

test("reports row-numbered errors and missing columns", () => {
  assert.match(parseProductRows([["Name", "Price"]]).errors[0], /category/);
  const { errors } = parseProductRows([["Name", "Category", "Price", "MRP"], ["A", "X", "12.5", ""], ["B", "X", 100, 80]]);
  assert.deepEqual(errors, ["Row 2: price must be a whole number", "Row 3: MRP (80) is lower than the price (100)"]);
});
