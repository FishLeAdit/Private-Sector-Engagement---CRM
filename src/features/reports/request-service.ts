import "server-only";
import type { AccessResult } from "@/lib/auth/session";
import { isActivePseProfile } from "@/lib/auth/roles";
import type { createClient } from "@/lib/supabase/server";
import { createBearerClient } from "@/lib/supabase/bearer";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { cacheScope } from "@/lib/cache/policy";
import { nextCacheBackend } from "@/lib/cache/server";
import { createReportCache } from "./cache";
import { createReportRepository } from "./queries";
import { createReportsService } from "./service";
import { ReportError } from "./types";
export async function reportRequestService(access:AccessResult,client:Awaited<ReturnType<typeof createClient>>){
 // getSession captures credentials only; callers already verified them with
 // getUser + a fresh profile. Never make authentication decisions from this session.
 if(access.status!=="allowed"||access.userId!==access.profile.id||!isActivePseProfile(access.profile))throw new ReportError(403,"Active PSE access is required.");
 if(process.env.PSE_REPORT_CACHE_ENABLED?.trim().toLowerCase()==="false")return createReportsService(createReportRepository(client),access);
 const{data,error}=await client.auth.getSession();
 if(error)throw new ReportError([400,401,403].includes(error.status??0)?401:503,"Report session verification is unavailable. Sign in again or retry shortly.");
 if(!data.session)throw new ReportError(401,"Sign in again to view reports.");
 if(data.session.user.id!==access.userId)throw new ReportError(403,"Session identity has changed. Sign in again.");
 const token=data.session.access_token,scope=cacheScope(access,getSupabaseConfig().url,token);
 return createReportsService(createReportRepository(createBearerClient(token)),access,createReportCache(nextCacheBackend,scope));
}
