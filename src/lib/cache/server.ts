import "server-only";
import { unstable_cache } from "next/cache";
import type { CacheBackend } from "./policy";
// The app keeps Cache Components disabled; this supported legacy Data Cache API
// avoids changing the existing request-rendered layout/authentication model.
export const nextCacheBackend:CacheBackend={
 async get(spec,load){return unstable_cache(load,spec.key,{revalidate:spec.ttl,tags:spec.tags})();},
};
