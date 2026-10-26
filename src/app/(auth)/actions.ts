"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/auth/session";
import { loginSchema, type AuthFormState } from "@/features/auth/schemas";
import { signInWithAccess } from "@/features/auth/service";

export async function signInAction(_previous: AuthFormState, form: FormData): Promise<AuthFormState> {
  const input = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!input.success) return { error: "Enter a valid email address and your password." };
  let result;
  try {
    result = await signInWithAccess(await createClient(), input.data.email, input.data.password);
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please try again shortly." };
  }
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  redirect(safeReturnPath(form.get("next")));
}

export async function signOutAction(): Promise<AuthFormState> {
  try {
    const { error } = await (await createClient()).auth.signOut({ scope: "local" });
    if (error) return { error: "Unable to sign out. Please try again." };
  } catch {
    return { error: "Unable to sign out. Please try again." };
  }
  revalidatePath("/", "layout");
  redirect("/login");
}
