"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, Search, ShoppingBag, Volume2, VolumeX, TicketPercent, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { burstFrom, finale } from "@/lib/fx";
import { isMuted, play, setMuted } from "@/lib/sfx";
import {
  bestPercent, cartTotals, filterProducts, isMobile, nextOffer, rupee, split, whatsappMessage, whatsappUrl,
  type Cart, type Customer, type Offer, type ProductFilter, type PlacedOrder, type Product,
} from "@/lib/order";

const EMOJI: Record<string, string> = {
  Sparklers: "✨", "Flower Pots": "🎇", Chakras: "🌀", Rockets: "🚀", Bombs: "💥", "Sky Shots": "🎆", Combos: "🎁",
};
const CART_KEY = "dw-cart";
const WA = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER!;

export default function Shop({ products, offers }: { products: Product[]; offers: Offer[] }) {
  const [cart, setCart] = useState<Cart>({});
  const [open, setOpen] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [coupon, setCoupon] = useState<(Offer & { code: string }) | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [form, setForm] = useState<Customer>({ name: "", phone: "", address: "", payment: "UPI" });

  useEffect(() => {
    setMutedState(isMuted());
    try {
      const saved = JSON.parse(localStorage.getItem(CART_KEY) ?? "{}") as Cart;
      const ids = new Set(products.filter((p) => p.in_stock).map((p) => p.id));
      setCart(Object.fromEntries(Object.entries(saved).filter(([id, q]) => ids.has(+id) && q > 0)));
    } catch {}
  }, [products]);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  }, [cart]);

  const [filter, setFilter] = useState<ProductFilter>({ q: "", category: null, sort: "default" });
  const allCategories = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);
  const shown = useMemo(() => filterProducts(products, filter), [products, filter]);
  const filtering = filter.q.trim() !== "" || filter.category !== null || filter.sort !== "default";
  // Grouped by category normally; a price sort reads better as one flat list.
  const categories = useMemo(() => {
    if (filter.sort !== "default") return [["Sorted by price", shown] as [string, Product[]]];
    const m = new Map<string, Product[]>();
    for (const p of shown) m.set(p.category, [...(m.get(p.category) ?? []), p]);
    return [...m.entries()];
  }, [shown, filter.sort]);

  const sub = cartTotals(cart, products, 0).subtotal;
  const best = bestPercent(sub, coupon, offers);
  const t = cartTotals(cart, products, best.percent);
  const nudge = nextOffer(sub, offers);
  const lines = products.filter((p) => cart[p.id]);

  function change(p: Product, d: 1 | -1, el?: Element | null) {
    setCart((c) => {
      const q = Math.min(99, Math.max(0, (c[p.id] ?? 0) + d));
      const next = { ...c };
      if (q) next[p.id] = q; else delete next[p.id];
      return next;
    });
    if (d > 0) { play("pop"); burstFrom(el ?? null); } else play("fizz");
  }

  async function applyCoupon(el: Element) {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setChecking(true);
    const { data, error } = await supabase.rpc("apply_coupon", { p_code: code });
    setChecking(false);
    if (error || !data) return toast.error("That coupon isn't valid");
    const c = { code, ...(data as Offer) };
    setCoupon(c);
    if (sub < c.min_amount) return toast(`${code} works on orders of ${rupee(c.min_amount)} or more. Add ${rupee(c.min_amount - sub)} more.`);
    play("chime");
    burstFrom(el, 40);
    toast.success(`${code} applied: ${c.percent}% off`);
  }

  async function placeOrder() {
    const f = { ...form, name: form.name.trim(), address: form.address.trim() };
    if (f.name.length < 2) return toast.error("Please enter your name");
    if (!/^[6-9]\d{9}$/.test(f.phone)) return toast.error("Enter a valid 10-digit phone number");
    if (f.address.length < 3) return toast.error("Enter your hostel and room number");
    if (!lines.length) return toast.error("Your cart is empty");

    setPlacing(true);
    // Open the tab now, inside the click; a tab opened after the network call gets popup-blocked.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    const { data, error } = await supabase.rpc("place_order", {
      p_name: f.name, p_phone: f.phone, p_address: f.address, p_payment: f.payment,
      p_items: lines.map((p) => ({ id: p.id, qty: cart[p.id] })),
      p_coupon: coupon && sub >= coupon.min_amount ? coupon.code : null,
    });
    if (error) {
      tab?.close();
      setPlacing(false);
      return toast.error(error.message || "Couldn't place the order. Try again.");
    }
    const order = data as PlacedOrder;
    const url = whatsappUrl(WA, whatsappMessage(order, f), !isMobile(navigator.userAgent, navigator.maxTouchPoints));
    play("rocket");
    finale();
    setCart({});
    setCoupon(null);
    setOpen(false);
    toast.success(`Order ${order.id} placed! Opening WhatsApp…`, {
      duration: 15000,
      action: { label: "Open WhatsApp", onClick: () => window.open(url, "_blank", "noopener") },
    });
    if (tab) {
      tab.location.href = url;
      setPlacing(false);
    } else {
      // Popup blocked: fall back to opening WhatsApp in this tab after the fireworks.
      setTimeout(() => { setPlacing(false); window.location.href = url; }, 1600);
    }
  }

  return (
    <div className="relative flex-1">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <a href="#top" className="font-heading text-2xl text-primary">NITR ki Dilwali</a>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="icon" aria-label={muted ? "Unmute sounds" : "Mute sounds"}
              onClick={() => { setMuted(!muted); setMutedState(!muted); if (muted) play("chime"); }}
            >
              {muted ? <VolumeX /> : <Volume2 />}
            </Button>
            <Button onClick={() => setOpen(true)} className="relative gap-2" aria-label={`Cart, ${t.count} items`}>
              <ShoppingBag /> <span className="hidden sm:inline">Cart</span>
              <AnimatePresence>
                {t.count > 0 && (
                  <motion.span
                    key={t.count}
                    initial={{ scale: 1.8 }} animate={{ scale: 1 }}
                    className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground"
                  >
                    {t.count}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="mx-auto max-w-6xl px-4 pb-10 pt-14 text-center sm:pt-20">
        <motion.p
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-3 text-sm uppercase tracking-[0.3em] text-muted-foreground"
        >
          NIT Rourkela · Diwali 2026
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, type: "spring" }}
          className="font-heading text-5xl leading-tight text-primary sm:text-7xl"
        >
          Shubh Deepavali 🪔
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="mx-auto mt-4 max-w-xl text-lg text-foreground/85"
        >
          Fill your cart, place the order and confirm on WhatsApp. Pick up your crackers at Jagda gate; we&apos;ll tell you the time.
        </motion.p>
        <div className="mt-8 flex items-end justify-center gap-6 sm:gap-10" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i} className="flex flex-col items-center"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.08 }}
            >
              <div className="flame" style={{ animationDelay: `${i * 0.23}s` }} />
              <div className="-mt-1 h-4 w-12 rounded-b-full bg-gradient-to-b from-orange-500 to-amber-800 shadow-[0_0_20px_#ff7a18]" />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Search + filters */}
      <div className="sticky top-[57px] z-30 border-b border-border/60 bg-background/95">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3">
          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">Search crackers</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search" placeholder="Search crackers" className="h-10 pl-9 text-base"
                value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })}
              />
            </label>
            <label className="shrink-0">
              <span className="sr-only">Sort</span>
              <select
                className="h-10 border border-input bg-background px-2 text-sm"
                value={filter.sort} onChange={(e) => setFilter({ ...filter, sort: e.target.value as ProductFilter["sort"] })}
              >
                <option value="default">By category</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
            </label>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter by category">
            {[null, ...allCategories].map((c) => {
              const on = filter.category === c;
              return (
                <button
                  key={c ?? "all"} type="button" aria-pressed={on}
                  onClick={() => setFilter({ ...filter, category: c })}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary hover:text-primary"}`}
                >
                  {c ?? "All"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Products */}
      <main className="mx-auto max-w-6xl px-4 pb-32">
        {!products.length && <p className="py-20 text-center text-muted-foreground">Crackers coming soon. Check back shortly!</p>}
        {products.length > 0 && !shown.length && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="text-muted-foreground">No crackers match {filter.q.trim() ? `"${filter.q.trim()}"` : "these filters"}.</p>
            <Button variant="outline" onClick={() => setFilter({ q: "", category: null, sort: "default" })}>Clear filters</Button>
          </div>
        )}
        {filtering && shown.length > 0 && <p className="pt-4 text-sm text-muted-foreground">{shown.length} of {products.length} crackers</p>}
        {categories.map(([cat, items]) => (
          <section key={cat} id={slug(cat)} className="scroll-mt-20 pt-14">
            <h2 className="mb-5 font-heading text-3xl text-primary">{EMOJI[cat] ?? "🪔"} {cat}</h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
              {items.map((p, i) => (
                <motion.article
                  key={p.id}
                  initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: (i % 4) * 0.06 }}
                  whileHover={{ y: -4 }}
                  className={`group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg shadow-black/30 transition hover:border-primary/60 hover:shadow-[0_0_30px_-6px_oklch(0.83_0.16_78/55%)] ${p.in_stock ? "" : "opacity-55 grayscale"}`}
                >
                  <div className="relative aspect-square bg-gradient-to-br from-fuchsia-950 via-indigo-950 to-amber-950">
                    {p.image_url ? (
                      <Image src={p.image_url} alt={p.name} fill sizes="(max-width:768px) 50vw, 25vw" className="object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center text-6xl transition duration-500 group-hover:scale-110" aria-hidden>
                        {EMOJI[p.category] ?? "🪔"}
                      </span>
                    )}
                    {!p.in_stock && <Badge variant="destructive" className="absolute left-2 top-2">Sold out</Badge>}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <h3 className="text-sm font-semibold leading-snug sm:text-base">{p.name}</h3>
                    {p.description && <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <span className="flex flex-wrap items-baseline gap-x-1.5 font-semibold text-primary">
                        {rupee(p.price)}
                        {p.mrp && p.mrp > p.price && (
                          <>
                            <s className="text-xs font-normal text-muted-foreground">{rupee(p.mrp)}</s>
                            <span className="text-xs text-parrot">{Math.round((1 - p.price / p.mrp) * 100)}% off</span>
                          </>
                        )}
                      </span>
                      {p.in_stock && <Stepper qty={cart[p.id] ?? 0} name={p.name} onChange={(d, el) => change(p, d, el)} />}
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* Sticky cart bar */}
      <AnimatePresence>
        {t.count > 0 && !open && (
          <motion.div
            initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            className="fixed inset-x-0 bottom-0 z-40 p-3 sm:p-4"
          >
            <button
              onClick={() => setOpen(true)}
              className="mx-auto flex w-full max-w-xl items-center justify-between rounded-2xl bg-primary px-5 py-3.5 font-semibold text-primary-foreground shadow-[0_0_40px_-4px_oklch(0.83_0.16_78/70%)] transition active:scale-[0.98]"
            >
              <span>{t.count} item{t.count > 1 ? "s" : ""} · {rupee(t.total)}</span>
              <span className="flex items-center gap-2">View cart <ShoppingBag className="size-4" /></span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart + checkout */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-heading text-2xl text-primary">Your Cart 🎆</SheetTitle>
            <SheetDescription>Review your crackers and fill in your details.</SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-5 px-4 pb-6">
            {!lines.length ? (
              <p className="py-10 text-center text-muted-foreground">Your cart is empty. Add some crackers! 🪔</p>
            ) : (
              <ul className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {lines.map((p) => (
                    <motion.li
                      key={p.id} layout
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20, height: 0 }}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
                    >
                      <span className="text-2xl" aria-hidden>{EMOJI[p.category] ?? "🪔"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{rupee(p.price)} × {cart[p.id]} = {rupee(p.price * cart[p.id])}</p>
                      </div>
                      <Stepper qty={cart[p.id]} name={p.name} onChange={(d, el) => change(p, d, el)} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}

            {nudge && lines.length > 0 && (
              <p className="bg-accent/20 px-3 py-2 text-sm">Add {rupee(nudge.short)} more and get {nudge.percent}% off the whole order.</p>
            )}

            {/* Coupon */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="coupon">Coupon code</Label>
              {coupon ? (
                <div className="flex items-center justify-between rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-sm">
                  <span>
                    <TicketPercent className="mr-1 inline size-4" /> {coupon.code}: {coupon.percent}% off
                    {sub < coupon.min_amount && <span className="block text-xs text-muted-foreground">Add {rupee(coupon.min_amount - sub)} more to use it</span>}
                  </span>
                  <Button size="icon-xs" variant="ghost" aria-label="Remove coupon" onClick={() => setCoupon(null)}><X /></Button>
                </div>
              ) : (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => { e.preventDefault(); applyCoupon(e.currentTarget.querySelector("button")!); }}
                >
                  <Input id="coupon" placeholder="DIWALI10" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} className="uppercase" />
                  <Button type="submit" variant="secondary" disabled={checking || !couponInput.trim()}>
                    {checking ? <Loader2 className="animate-spin" /> : "Apply"}
                  </Button>
                </form>
              )}
            </div>

            {/* Totals */}
            <dl className="flex flex-col gap-1 rounded-xl border border-border bg-card p-3 text-sm">
              <Row label="Subtotal" value={rupee(t.subtotal)} />
              {t.discount > 0 && <Row label={`${best.auto ? "Offer" : `Coupon ${coupon?.code}`} (${best.percent}% off)`} value={`−${rupee(t.discount)}`} />}
              <Row label="Total" value={rupee(t.total)} strong />
              <div className="my-1 border-t border-dashed border-border" />
              <Row label="Pay now (50% advance)" value={rupee(split(t.total).advance)} strong />
              <Row label="Pay at pickup" value={rupee(split(t.total).balance)} />
            </dl>

            {/* Details */}
            <div className="flex flex-col gap-3">
              <Field id="name" label="Name">
                <Input id="name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your full name" />
              </Field>
              <Field id="phone" label="Phone number">
                <Input
                  id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10-digit mobile"
                  value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                />
              </Field>
              <Field id="address" label="Hostel & room">
                <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. KMS Hall, Room 214" />
              </Field>
              <p className="rounded-lg border border-border bg-card p-3 text-sm">
                <span className="font-medium">Payment: UPI only.</span> Pay the 50% advance by UPI after you place the order.
              </p>
            </div>

            <Button size="lg" className="h-12 text-base" disabled={placing || !lines.length} onClick={placeOrder}>
              {placing ? <Loader2 className="animate-spin" /> : "🚀"} Place order on WhatsApp
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Pay half now to confirm your order; pay the rest when you pick up your crackers at Jagda gate. We&apos;ll share the pickup time on WhatsApp.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Stepper({ qty, name, onChange }: { qty: number; name: string; onChange: (d: 1 | -1, el: Element) => void }) {
  if (!qty)
    return (
      <Button size="sm" onClick={(e) => onChange(1, e.currentTarget)} aria-label={`Add ${name}`}>
        <Plus /> Add
      </Button>
    );
  return (
    <div className="flex items-center gap-1 rounded-lg border border-primary/50 bg-primary/10 p-0.5">
      <Button size="icon-sm" variant="ghost" aria-label={`Remove one ${name}`} onClick={(e) => onChange(-1, e.currentTarget)}>
        <Minus />
      </Button>
      <span className="relative w-6 overflow-hidden text-center text-sm font-semibold tabular-nums" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={qty} className="block" initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 14, opacity: 0 }}>
            {qty}
          </motion.span>
        </AnimatePresence>
      </span>
      <Button size="icon-sm" variant="ghost" aria-label={`Add one more ${name}`} disabled={qty >= 99} onClick={(e) => onChange(1, e.currentTarget)}>
        <Plus />
      </Button>
    </div>
  );
}

const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className={`flex justify-between ${strong ? "border-t border-border pt-2 text-base font-semibold text-primary" : ""}`}>
    <dt>{label}</dt><dd>{value}</dd>
  </div>
);

const Field = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>
);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

