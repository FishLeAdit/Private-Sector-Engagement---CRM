import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getSupabaseConfig } from "./config";
// Captured outside cache execution, after getUser/profile verification. No cookies
// or request APIs run in cached functions, and no administrative client is used.
export function createBearerClient(token:string){const{url,key}=getSupabaseConfig();return createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${token}`},fetch:(input,init)=>fetch(input,{...init,cache:"no-store"})}});}
