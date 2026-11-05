// Run: node --test lib/order.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { bestPercent, cartTotals, filterProducts, isMobile, nextOffer, split, whatsappMessage, whatsappUrl, type Product } from "./order.ts";

const p = (id: number, price: number): Product =>
  ({ id, name: `P${id}`, category: "X", description: null, price, mrp: null, image_url: null, in_stock: true, sort: 0 });

test("cartTotals applies floor discount and counts items", () => {
  const t = cartTotals({ 1: 2, 2: 1 }, [p(1, 45), p(2, 99)], 10);
  assert.deepEqual(t, { subtotal: 189, discount: 18, total: 171, count: 3 });
});

test("whatsapp message has id, items, coupon line and total", () => {
  const msg = whatsappMessage(
    { id: "DW-1001", items: [{ id: 1, name: "Rocket", price: 100, qty: 2 }], subtotal: 200, discount: 20, percent: 10, coupon: "DIWALI10", total: 180 },
    { name: "Asha", phone: "9876543210", address: "KMS 214", payment: "UPI" },
  );
  for (const s of ["DW-1001", "Rocket × 2 = ₹200", "DIWALI10 (-10%)", "*Total: ₹180*", "KMS 214", "advance): ₹90*", "Pay after you receive your crackers (50%): ₹90"]) assert.ok(msg.includes(s), s);
  assert.deepEqual(split(171), { advance: 86, balance: 85 });
  assert.ok(whatsappUrl("919999999999", "a b&c").endsWith("?text=a%20b%26c"));
});

test("bestPercent honours code minimums and picks the better of code vs auto offer", () => {
  const offers = [{ percent: 5, min_amount: 500 }, { percent: 10, min_amount: 1000 }];
  assert.deepEqual(bestPercent(400, { percent: 15, min_amount: 300 }, offers), { percent: 15, auto: false });
  assert.deepEqual(bestPercent(200, { percent: 15, min_amount: 300 }, offers), { percent: 0, auto: false });
  assert.deepEqual(bestPercent(1200, { percent: 8, min_amount: 0 }, offers), { percent: 10, auto: true });
  assert.deepEqual(nextOffer(700, offers), { percent: 10, min_amount: 1000, short: 300 });
  assert.equal(nextOffer(1500, offers), null);
});

test("whatsapp message shows an auto offer without a code", () => {
  const msg = whatsappMessage(
    { id: "DW-2", items: [{ id: 1, name: "Rocket", price: 600, qty: 1 }], subtotal: 600, discount: 30, percent: 5, coupon: null, total: 570 },
    { name: "Asha", phone: "9876543210", address: "KMS 214", payment: "UPI" },
  );
  assert.ok(msg.includes("Offer (-5%): -₹30"));
});

test("whatsapp link picks WhatsApp Web on PC and wa.me on phones", () => {
  assert.equal(whatsappUrl("919999999999", "hi there", true), "https://web.whatsapp.com/send?phone=919999999999&text=hi%20there");
  assert.ok(isMobile("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile", 5));
  assert.ok(isMobile("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari", 5)); // iPad
  assert.ok(!isMobile("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari", 0));
  assert.ok(!isMobile("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140", 0));
});

test("filterProducts searches every word, filters category/stock and sorts by price", () => {
  const items: Product[] = [
    { ...p(1, 180), name: "Lunik Rocket", category: "Rockets", description: "Whistle up" },
    { ...p(2, 250), name: "2 Sound Rocket", category: "Rockets", in_stock: false },
    { ...p(3, 40), name: "Electric Sparklers", category: "Sparklers", description: "golden sparks" },
  ];
  const ids = (f: Parameters<typeof filterProducts>[1]) => filterProducts(items, f).map((x) => x.id);
  assert.deepEqual(ids({ q: "rocket", category: null, sort: "default" }), [1, 2]);
  assert.deepEqual(ids({ q: "GOLDEN", category: null, sort: "default" }), [3]);
  assert.deepEqual(ids({ q: "rocket whistle", category: null, sort: "default" }), [1]);
  assert.deepEqual(ids({ q: "", category: "Rockets", sort: "price-desc", inStockOnly: true }), [1]);
  assert.deepEqual(ids({ q: "", category: null, sort: "price-asc" }), [3, 1, 2]);
});
