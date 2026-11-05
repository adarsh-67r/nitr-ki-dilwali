export type Product = {
  id: number;
  name: string;
  category: string;
  description: string | null;
  price: number;
  mrp: number | null; // struck-out price; null when there is no discount to show
  image_url: string | null;
  in_stock: boolean;
  sort: number;
};

export type Cart = Record<number, number>; // product id -> qty

export type PlacedOrder = {
  id: string;
  items: { id: number; name: string; price: number; qty: number }[];
  subtotal: number;
  discount: number;
  percent: number;
  coupon: string | null;
  total: number;
};

export type Customer = { name: string; phone: string; address: string; payment: "UPI" };

export const rupee = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// Display-only estimate; the real total comes back from place_order().
export function cartTotals(cart: Cart, products: Product[], percent: number) {
  const subtotal = products.reduce((s, p) => s + (cart[p.id] ?? 0) * p.price, 0);
  const discount = Math.floor((subtotal * percent) / 100);
  const count = Object.values(cart).reduce((s, q) => s + q, 0);
  return { subtotal, discount, total: subtotal - discount, count };
}

/** Payment policy: half up front to confirm, the rest after the buyer receives the crackers. The odd rupee goes in the advance. */
export const split = (total: number) => ({ advance: Math.ceil(total / 2), balance: Math.floor(total / 2) });

export type Offer = { percent: number; min_amount: number };

/** Mirrors place_order(): the better of a valid code (if its minimum is met) and the best auto offer reached. */
export function bestPercent(subtotal: number, code: Offer | null, offers: Offer[]) {
  const fromCode = code && subtotal >= code.min_amount ? code.percent : 0;
  const auto = Math.max(0, ...offers.filter((o) => subtotal >= o.min_amount).map((o) => o.percent));
  return { percent: Math.max(fromCode, auto), auto: auto > fromCode };
}

/** The next auto offer above the current one, for an "add ₹X more" nudge. */
export function nextOffer(subtotal: number, offers: Offer[]) {
  const now = bestPercent(subtotal, null, offers).percent;
  const o = offers.filter((x) => x.min_amount > subtotal && x.percent > now).sort((a, b) => a.min_amount - b.min_amount)[0];
  return o ? { ...o, short: o.min_amount - subtotal } : null;
}

export function whatsappMessage(o: PlacedOrder, c: Customer) {
  const lines = o.items.map((i, n) => `${n + 1}. ${i.name} × ${i.qty} = ${rupee(i.price * i.qty)}`);
  return [
    `🪔 *New Diwali Order — ${o.id}*`,
    ``,
    `*Name:* ${c.name}`,
    `*Phone:* ${c.phone}`,
    `*Address:* ${c.address}`,
    `*Payment:* ${c.payment}`,
    ``,
    `*Items:*`,
    ...lines,
    ``,
    `Subtotal: ${rupee(o.subtotal)}`,
    ...(o.discount ? [`${o.coupon ? `Coupon ${o.coupon}` : "Offer"} (-${o.percent}%): -${rupee(o.discount)}`] : []),
    `*Total: ${rupee(o.total)}*`,
    ``,
    `*Pay now (50% advance): ${rupee(split(o.total).advance)}*`,
    `Pay after you receive your crackers (50%): ${rupee(split(o.total).balance)}`,
    `_Order is confirmed once the advance is paid._`,
  ].join("\n");
}

/** wa.me opens the app on phones; on a PC, WhatsApp Web's send link skips the "open app?" landing page. */
export const whatsappUrl = (number: string, text: string, web = false) =>
  web
    ? `https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(text)}`
    : `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

/** Phones and tablets (iPadOS reports a Mac user agent, so touch points give it away). */
export const isMobile = (ua: string, touchPoints: number) =>
  /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);

export type ProductFilter = { q: string; category: string | null; sort: "default" | "price-asc" | "price-desc"; inStockOnly?: boolean };

/** Shared by the shop and the admin list: text search over name/category/description, category, stock and price sort. */
export function filterProducts(products: Product[], f: ProductFilter) {
  const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
  const out = products.filter((p) => {
    if (f.category && p.category !== f.category) return false;
    if (f.inStockOnly && !p.in_stock) return false;
    const hay = `${p.name} ${p.category} ${p.description ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  if (f.sort === "price-asc") out.sort((a, b) => a.price - b.price);
  if (f.sort === "price-desc") out.sort((a, b) => b.price - a.price);
  return out;
}
