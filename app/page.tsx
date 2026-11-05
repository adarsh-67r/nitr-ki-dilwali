import { cacheLife, cacheTag } from "next/cache";
import Shop from "@/components/Shop";
import { supabase } from "@/lib/supabase";
import type { Offer, Product } from "@/lib/order";

async function getProducts() {
  "use cache";
  cacheLife("minutes"); // admin edits show up within about a minute
  cacheTag("products");
  const { data, error } = await supabase.from("products").select("*").order("sort").order("id");
  if (error) throw error;
  return data as Product[];
}

async function getOffers() {
  "use cache";
  cacheLife("minutes");
  cacheTag("products");
  const { data, error } = await supabase.rpc("auto_offers");
  if (error) throw error;
  return data as Offer[];
}

export default async function Page() {
  const [products, offers] = await Promise.all([getProducts(), getOffers()]);
  return <Shop products={products} offers={offers} />;
}
