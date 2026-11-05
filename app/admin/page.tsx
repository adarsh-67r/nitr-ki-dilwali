"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import type { Session } from "@supabase/supabase-js";
import { FileSpreadsheet, Loader2, Search, LogOut, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { filterProducts, rupee, split, type PlacedOrder, type Product } from "@/lib/order";
import { parseProductRows } from "@/lib/importProducts";

type Coupon = { code: string; percent_off: number; active: boolean; min_amount: number; auto: boolean };
type Order = Omit<PlacedOrder, "percent"> & { name: string; phone: string; address: string; payment_mode: string; created_at: string };

export default function AdminPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isSuper, setIsSuper] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return setIsAdmin(null);
    supabase.rpc("is_admin").then(({ data }) => setIsAdmin(!!data));
    supabase.rpc("is_super").then(({ data }) => setIsSuper(!!data));
  }, [session]);

  if (session === undefined) return <Center><Loader2 className="animate-spin" /></Center>;
  if (!session) return <Login />;
  if (isAdmin === null) return <Center><Loader2 className="animate-spin" /></Center>;
  if (!isAdmin)
    return (
      <Center>
        <p>{session.user.email} is not an admin.</p>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>Sign out</Button>
      </Center>
    );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-3xl text-sindoor">Admin</h1>
        <div className="flex gap-1">
          <ChangePassword />
          <Button variant="ghost" onClick={() => supabase.auth.signOut()}><LogOut /> Sign out</Button>
        </div>
      </div>
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Crackers</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          {isSuper && <TabsTrigger value="admins">Admins</TabsTrigger>}
        </TabsList>
        <TabsContent value="products" className="pt-4"><Products /></TabsContent>
        <TabsContent value="coupons" className="pt-4"><Coupons /></TabsContent>
        <TabsContent value="orders" className="pt-4"><Orders /></TabsContent>
        {isSuper && <TabsContent value="admins" className="pt-4"><Admins /></TabsContent>}
      </Tabs>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Center>
      <form
        className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-border bg-card p-6 text-left"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          setBusy(false);
          if (error) toast.error(error.message);
        }}
      >
        <h1 className="font-heading text-2xl text-sindoor">Admin login</h1>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Label htmlFor="password">Password</Label>
        <Input
          id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={busy} className="mt-2">{busy && <Loader2 className="animate-spin" />} Sign in</Button>
        <p className="text-xs text-muted-foreground">No account? Ask the superadmin to add you.</p>
      </form>
    </Center>
  );
}

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>Change password</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change password</DialogTitle></DialogHeader>
          <form
            id="pw-form" className="flex flex-col gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (pw.length < 8) return toast.error("Use at least 8 characters");
              setBusy(true);
              const { error } = await supabase.auth.updateUser({ password: pw });
              setBusy(false);
              if (error) return toast.error(error.message);
              toast.success("Password changed");
              setPw("");
              setOpen(false);
            }}
          >
            <Label htmlFor="new-pw">New password</Label>
            <Input id="new-pw" type="password" autoComplete="new-password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} />
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" form="pw-form" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------------- Products ---------------- */

const EMPTY: Omit<Product, "id"> = { name: "", category: "", description: "", price: 0, mrp: null, image_url: null, in_stock: true, sort: 0 };

function Products() {
  const [rows, setRows] = useState<Product[]>([]);
  const [editing, setEditing] = useState<(Omit<Product, "id"> & { id?: number }) | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("products").select("*").order("sort").order("id");
    if (error) toast.error(error.message); else setRows(data as Product[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleStock(p: Product, in_stock: boolean) {
    setRows((r) => r.map((x) => (x.id === p.id ? { ...x, in_stock } : x)));
    const { error } = await supabase.from("products").update({ in_stock }).eq("id", p.id);
    if (error) { toast.error(error.message); load(); }
  }

  async function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  const categories = [...new Set(rows.map((r) => r.category))];
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [stock, setStock] = useState<"" | "in" | "out">("");
  const shown = filterProducts(rows, { q, category: cat || null, sort: "default" }).filter(
    (p) => !stock || (stock === "in" ? p.in_stock : !p.in_stock),
  );

  async function importExcel(file: File) {
    setImporting(true);
    try {
      const { readSheet } = await import("read-excel-file/browser");
      const { rows: parsed, errors } = parseProductRows(await readSheet(file));
      if (errors.length) return toast.error(`Nothing imported. Fix these first:\n${errors.slice(0, 6).join("\n")}${errors.length > 6 ? `\n…and ${errors.length - 6} more` : ""}`, { duration: 15000 });
      if (!parsed.length) return toast.error("The sheet has no product rows");
      // Same name (any case) updates the existing cracker; new names are added. Images are left alone.
      const byName = new Map(rows.map((p) => [p.name.toLowerCase(), p.id]));
      const fresh = parsed.filter((p) => !byName.has(p.name.toLowerCase()));
      const updates = parsed.filter((p) => byName.has(p.name.toLowerCase()));
      const results = await Promise.all([
        fresh.length ? supabase.from("products").insert(fresh) : Promise.resolve({ error: null }),
        ...updates.map((p) => supabase.from("products").update(p).eq("id", byName.get(p.name.toLowerCase())!)),
      ]);
      const failed = results.filter((x) => x.error);
      if (failed.length) toast.error(`${failed.length} write(s) failed: ${failed[0].error!.message}`);
      else toast.success(`Imported: ${fresh.length} added, ${updates.length} updated`);
    } catch (e) {
      toast.error(`Couldn't read that file. Save it as .xlsx and try again. (${(e as Error).message})`);
    } finally {
      setImporting(false);
      load();
    }
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{rows.length} crackers · the shop updates within about a minute</p>
          <p className="text-xs text-muted-foreground">Excel columns: Name, Category, Price, MRP, Description, In stock (yes/no), Sort. Same name updates an existing cracker.</p>
        </div>
        <div className="flex gap-2">
          <a className={buttonVariants({ variant: "ghost" })} href="/crackers-template.xlsx" download>Template</a>
          <label className={buttonVariants({ variant: "outline", className: `cursor-pointer focus-within:ring-3 focus-within:ring-ring/50 ${importing ? "pointer-events-none opacity-50" : ""}` })}>
            {importing ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Import Excel
            <input
              type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) importExcel(f); }}
            />
          </label>
          <Button onClick={() => setEditing({ ...EMPTY, sort: rows.length + 1 })}><Plus /> Add cracker</Button>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, category, description" />
        <select className={SELECT} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className={SELECT} value={stock} onChange={(e) => setStock(e.target.value as typeof stock)} aria-label="Stock">
          <option value="">In &amp; out of stock</option>
          <option value="in">In stock</option>
          <option value="out">Sold out</option>
        </select>
        {shown.length !== rows.length && <span className="text-sm text-muted-foreground">{shown.length} of {rows.length}</span>}
      </div>
      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14" />
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>In stock</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  {p.image_url
                    ? <Image src={p.image_url} alt="" width={40} height={40} className="size-10 rounded object-cover" />
                    : <div className="size-10 rounded bg-muted" />}
                </TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{p.category}</TableCell>
                <TableCell>{rupee(p.price)}{p.mrp ? <s className="ml-2 text-xs text-muted-foreground">{rupee(p.mrp)}</s> : null}</TableCell>
                <TableCell><Switch checked={p.in_stock} onCheckedChange={(v) => toggleStock(p, v)} aria-label={`${p.name} in stock`} /></TableCell>
                <TableCell className="text-right">
                  <Button size="icon-sm" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => setEditing(p)}><Pencil /></Button>
                  <Button size="icon-sm" variant="ghost" aria-label={`Delete ${p.name}`} onClick={() => remove(p)}><Trash2 /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {editing && (
        <ProductDialog
          initial={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}

function ProductDialog({ initial, categories, onClose, onSaved }: {
  initial: Omit<Product, "id"> & { id?: number };
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [p, setP] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file");
    if (file.size > 3 * 1024 * 1024) return toast.error("Image must be under 3 MB");
    setBusy(true);
    const path = `${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase() || "jpg"}`;
    const { error } = await supabase.storage.from("cracker-images").upload(path, file, { contentType: file.type });
    setBusy(false);
    if (error) return toast.error(error.message);
    setP({ ...p, image_url: supabase.storage.from("cracker-images").getPublicUrl(path).data.publicUrl });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!p.name.trim() || !p.category.trim()) return toast.error("Name and category are required");
    if (!Number.isInteger(p.price) || p.price < 0) return toast.error("Price must be a whole number of rupees");
    if (p.mrp !== null && (!Number.isInteger(p.mrp) || p.mrp < p.price)) return toast.error("MRP must be a whole number, at least the selling price");
    setBusy(true);
    const { id, ...fields } = p;
    const row = { ...fields, name: p.name.trim(), category: p.category.trim(), description: p.description?.trim() || null };
    const { error } = id
      ? await supabase.from("products").update(row).eq("id", id)
      : await supabase.from("products").insert(row);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{p.id ? "Edit cracker" : "Add cracker"}</DialogTitle></DialogHeader>
        <form id="product-form" onSubmit={save} className="flex flex-col gap-3">
          <Label htmlFor="p-name">Name</Label>
          <Input id="p-name" required maxLength={80} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          <Label htmlFor="p-cat">Category</Label>
          <Input id="p-cat" required list="cats" value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })} placeholder="Sparklers, Rockets, Bombs…" />
          <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          <Label htmlFor="p-desc">Description</Label>
          <Input id="p-desc" value={p.description ?? ""} onChange={(e) => setP({ ...p, description: e.target.value })} />
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-mrp">MRP (₹, struck out)</Label>
              <Input id="p-mrp" type="number" min={0} step={1} placeholder="optional" value={p.mrp ?? ""} onChange={(e) => setP({ ...p, mrp: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-price">Selling price (₹)</Label>
              <Input id="p-price" type="number" min={0} step={1} required value={p.price} onChange={(e) => setP({ ...p, price: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="p-sort">Display order</Label>
              <Input id="p-sort" type="number" step={1} value={p.sort} onChange={(e) => setP({ ...p, sort: Number(e.target.value) })} />
            </div>
          </div>
          <Label htmlFor="p-img">Image</Label>
          <div className="flex items-center gap-3">
            {p.image_url && <Image src={p.image_url} alt="" width={56} height={56} className="size-14 rounded object-cover" />}
            <Input id="p-img" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            {p.image_url && <Button type="button" variant="ghost" size="sm" onClick={() => setP({ ...p, image_url: null })}>Remove</Button>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={p.in_stock} onCheckedChange={(v) => setP({ ...p, in_stock: v })} /> In stock
          </label>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="product-form" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Coupons ---------------- */

function Coupons() {
  const [rows, setRows] = useState<Coupon[]>([]);
  const [code, setCode] = useState("");
  const [pct, setPct] = useState(10);
  const [min, setMin] = useState(0);
  const [auto, setAuto] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("coupons").select("*").order("code");
    if (error) toast.error(error.message); else setRows(data as Coupon[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,30}$/.test(c)) return toast.error("Use 2–30 letters or numbers");
    if (!(pct >= 1 && pct <= 90)) return toast.error("Discount must be 1–90%");
    if (!(Number.isInteger(min) && min >= 0)) return toast.error("Minimum order must be a whole number of rupees");
    const { error } = await supabase.from("coupons").upsert({ code: c, percent_off: pct, min_amount: min, auto, active: true });
    if (error) return toast.error(error.message);
    setCode("");
    load();
  }

  async function update(c: Coupon, patch: Partial<Coupon>) {
    const { error } = await supabase.from("coupons").update(patch).eq("code", c.code);
    if (error) toast.error(error.message);
    load();
  }

  async function remove(c: Coupon) {
    if (!confirm(`Delete coupon ${c.code}?`)) return;
    const { error } = await supabase.from("coupons").delete().eq("code", c.code);
    if (error) toast.error(error.message);
    load();
  }

  return (
    <>
      <form onSubmit={add} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="c-code">Code</Label>
          <Input id="c-code" className="uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="HOSTEL20" />
        </div>
        <div className="flex w-28 flex-col gap-1.5">
          <Label htmlFor="c-pct">% off</Label>
          <Input id="c-pct" type="number" min={1} max={90} value={pct} onChange={(e) => setPct(Number(e.target.value))} />
        </div>
        <div className="flex w-36 flex-col gap-1.5">
          <Label htmlFor="c-min">Min. order (₹)</Label>
          <Input id="c-min" type="number" min={0} step={1} value={min} onChange={(e) => setMin(Number(e.target.value))} />
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <Switch checked={auto} onCheckedChange={setAuto} /> Apply automatically
        </label>
        <Button type="submit"><Plus /> Add / update</Button>
      </form>
      <p className="mb-3 text-xs text-muted-foreground">
        A minimum order means the code only works once the cart reaches that amount. &quot;Apply automatically&quot; needs no code: the
        discount kicks in when the cart reaches the minimum, and the cart shows how much more to add. Buyers get the better of their code and an automatic offer.
      </p>
      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Code</TableHead><TableHead>% off</TableHead><TableHead>Min. order</TableHead><TableHead>Automatic</TableHead><TableHead>Active</TableHead><TableHead className="w-12" /></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.code}>
                <TableCell className="font-medium">{c.code}</TableCell>
                <TableCell>{c.percent_off}%</TableCell>
                <TableCell>{c.min_amount ? rupee(c.min_amount) : "—"}</TableCell>
                <TableCell><Switch checked={c.auto} onCheckedChange={(v) => update(c, { auto: v })} aria-label={`${c.code} automatic`} /></TableCell>
                <TableCell><Switch checked={c.active} onCheckedChange={(v) => update(c, { active: v })} aria-label={`${c.code} active`} /></TableCell>
                <TableCell><Button size="icon-sm" variant="ghost" aria-label={`Delete ${c.code}`} onClick={() => remove(c)}><Trash2 /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

/* ---------------- Admins ---------------- */

/** Superadmin only. Passwords are set here and sent to the server route; no emails involved. */
async function saveAdmin(email: string, password: string) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/admins", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify({ email, password }),
  });
  const out = (await res.json().catch(() => ({}))) as { error?: string; created?: boolean };
  if (!res.ok) throw new Error(out.error ?? "Something went wrong");
  return out;
}

function Admins() {
  const [rows, setRows] = useState<{ email: string; super: boolean }[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("admins").select("email, super").order("email");
    if (error) toast.error(error.message); else setRows(data);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const em = email.trim().toLowerCase();
      const out = await saveAdmin(em, password);
      toast.success(out.created ? `${em} can now sign in with that password.` : `${em} is an admin; password updated.`);
      setEmail("");
      setPassword("");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(em: string) {
    if (!confirm(`Remove ${em} as an admin? Their login stops working on this page immediately.`)) return;
    const { error } = await supabase.from("admins").delete().eq("email", em);
    if (error) toast.error(error.message);
    load();
  }

  return (
    <>
      <form onSubmit={add} className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex w-72 flex-col gap-1.5">
          <Label htmlFor="a-email">Email</Label>
          <Input id="a-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@nitrkl.ac.in" />
        </div>
        <div className="flex w-56 flex-col gap-1.5">
          <Label htmlFor="a-pw">Password</Label>
          <Input id="a-pw" type="text" autoComplete="off" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="at least 8 characters" />
        </div>
        <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus />} Add admin</Button>
      </form>
      <p className="mb-3 text-xs text-muted-foreground">
        The new admin signs in at this page straight away with the email and password you set. Send them the password yourself.
        Admins can edit crackers, coupons and see orders; only you can manage admins.
      </p>
      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>Email</TableHead><TableHead className="w-56" /></TableRow></TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.email}>
                <TableCell>{a.email}{a.super && <span className="ml-2 text-xs text-muted-foreground">(superadmin, you)</span>}</TableCell>
                <TableCell className="text-right">
                  {!a.super && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setResetFor(a.email)}>Set password</Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Remove ${a.email}`} onClick={() => remove(a.email)}><Trash2 /></Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {resetFor && <SetPassword email={resetFor} onClose={() => setResetFor(null)} />}
    </>
  );
}

function SetPassword({ email, onClose }: { email: string; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New password for {email}</DialogTitle></DialogHeader>
        <form
          id="set-pw" className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await saveAdmin(email, pw);
              toast.success(`Password updated for ${email}`);
              onClose();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Label htmlFor="set-pw-input">Password</Label>
          <Input id="set-pw-input" type="text" autoComplete="off" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="set-pw" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Orders ---------------- */

function Orders() {
  const [rows, setRows] = useState<Order[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500);
    setBusy(false);
    if (error) toast.error(error.message); else setRows(data as Order[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const [q, setQ] = useState("");
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows.filter((o) => {
    const hay = `${o.id} ${o.name} ${o.phone} ${o.address} ${o.coupon ?? ""} ${o.items.map((i) => i.name).join(" ")}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const revenue = shown.reduce((s, o) => s + o.total, 0);

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {shown.length === rows.length ? rows.length : `${shown.length} of ${rows.length}`} orders · {rupee(revenue)} total (unconfirmed)
        </p>
        <Button variant="outline" onClick={load} disabled={busy}><RefreshCw className={busy ? "animate-spin" : ""} /> Refresh</Button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search order no., name, phone, hostel, item" />
      </div>
      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead><TableHead>Time</TableHead><TableHead>Customer</TableHead>
              <TableHead>Address</TableHead><TableHead>Items</TableHead><TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((o) => (
              <TableRow key={o.id} className="align-top">
                <TableCell className="font-mono">{o.id}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(o.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                <TableCell>
                  {o.name}<br />
                  <a className="text-primary underline" href={`https://wa.me/91${o.phone}`} target="_blank" rel="noreferrer">{o.phone}</a>
                </TableCell>
                <TableCell className="max-w-48 whitespace-normal">{o.address}</TableCell>
                <TableCell className="max-w-64 whitespace-normal text-xs">
                  {o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {rupee(o.total)}<br />
                  <span className="text-xs text-muted-foreground">
                    Advance {rupee(split(o.total).advance)} · at pickup {rupee(split(o.total).balance)}<br />
                    {o.payment_mode}{o.coupon ? ` · ${o.coupon}` : ""}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

const Center = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">{children}</div>
);

const SELECT = "h-9 rounded-lg border border-input bg-background px-2 text-sm";

const SearchBox = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <label className="relative w-full max-w-xs">
    <span className="sr-only">{placeholder}</span>
    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input type="search" className="h-9 pl-8" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  </label>
);
