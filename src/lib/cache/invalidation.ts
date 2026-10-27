import "server-only";
import { revalidateTag } from "next/cache";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { cacheTags, projectCacheId } from "./policy";
export function invalidateReportCache(metadata = false) {
  const tags = cacheTags(projectCacheId(getSupabaseConfig().url));
  revalidateTag(tags.reports, { expire: 0 });
  if (metadata) revalidateTag(tags.verticals, { expire: 0 });
}
export function invalidateUserReportCache(userId: string) {
  const tags = cacheTags(projectCacheId(getSupabaseConfig().url), userId);
  revalidateTag(tags.user, { expire: 0 });
}
