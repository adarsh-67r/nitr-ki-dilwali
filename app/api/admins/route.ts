import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * Superadmin only: add an admin with a password, or set an existing admin's password.
 * Accounts are created already confirmed, so no email is sent.
 */
export async function POST(req: Request) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return err(500, "Server is missing SUPABASE_SECRET_KEY");

  // Check the caller with their own token, so RLS and is_super() decide, not this route.
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return err(401, "Sign in first");
  const caller = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: isSuper } = await caller.rpc("is_super");
  if (!isSuper) return err(403, "Only the superadmin can manage admins");

  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err(400, "Enter a valid email");
  if (password.length < 8 || password.length > 72) return err(400, "Password must be 8–72 characters");

  const admin = createClient(URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const { error: listErr } = await admin.from("admins").upsert({ email }, { onConflict: "email", ignoreDuplicates: true });
  if (listErr) return err(500, listErr.message);

  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (!created.error) return Response.json({ ok: true, created: true });
  if (created.error.code !== "email_exists") return err(500, created.error.message);

  // shortcut: scans up to 1000 users to find the id by email; fine for a stall's handful of admins.
  const { data: list, error: findErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = list?.users.find((u) => u.email?.toLowerCase() === email);
  if (findErr || !user) return err(500, findErr?.message ?? "Couldn't find that account");
  const { error: pwErr } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (pwErr) return err(500, pwErr.message);
  return Response.json({ ok: true, created: false });
}

const err = (status: number, message: string) => Response.json({ error: message }, { status });
