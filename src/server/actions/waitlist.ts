"use server";

import "server-only";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "guerrillamail.info", "guerrillamail.biz", "guerrillamail.de",
  "tempmail.com", "temp-mail.org", "throwaway.email", "dispostable.com",
  "yopmail.com", "trashmail.com", "trashmail.net", "trashmail.at", "trashmail.io",
  "maildrop.cc", "sharklasers.com", "spam4.me", "discard.email",
  "fakeinbox.com", "mailnull.com", "crap.email", "pokemail.net",
  "10minutemail.com", "10minutemail.net", "10minutemail.org",
  "mailnesia.com", "throwam.com",
]);

function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}

export type WaitlistState = { ok: true } | { ok: false; error: string } | null;

export async function joinWaitlistAction(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const raw = ((formData.get("email") as string | null) ?? "").trim().toLowerCase();

  const result = z.email("Enter a valid email address.").safeParse(raw);
  if (!result.success) {
    return { ok: false, error: result.error.issues[0].message };
  }

  const email = result.data;

  if (isDisposableEmail(email)) {
    return { ok: false, error: "Please use a real email address." };
  }

  const db = createServiceClient();
  const { error } = await db.from("waitlist").insert({ email, source: "landing" });

  if (error) {
    // 23505 = unique_violation: email already on the list.
    // Return ok:true to avoid leaking whether an address is registered.
    if (error.code === "23505") return { ok: true };
    console.error("[joinWaitlistAction] db error:", error.code);
    return { ok: false, error: "Something went wrong. Please try again." };
  }

  return { ok: true };
}
