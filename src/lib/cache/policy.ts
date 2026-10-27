import { createHash } from "node:crypto";
import type { AccessResult } from "@/lib/auth/session";
import { isActivePseProfile } from "@/lib/auth/roles";
export const REPORT_TTL_SECONDS=30;
export const VERTICAL_TTL_SECONDS=300;
export const CACHE_VERSION="pse-cache-v1";
export type CacheScope={project:string;userId:string;role:string;department:string;session:string};
export type CacheSpec={key:string[];tags:string[];ttl:number};
export type CacheBackend={get<T>(spec:CacheSpec,load:()=>Promise<T>):Promise<T>};
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
export function projectCacheId(url:string){return digest(new URL(url).origin).slice(0,24);}
export function cacheScope(access:AccessResult,projectUrl:string,token:string):CacheScope{
 if(access.status!=="allowed"||access.profile.id!==access.userId||!isActivePseProfile(access.profile)||!token)throw new Error("Verified PSE access is required before cache lookup.");
 return{project:projectCacheId(projectUrl),userId:access.userId,role:access.profile.role,department:access.profile.department,session:digest(token)};
}
export function cacheTags(project:string,userId?:string){return{reports:`${CACHE_VERSION}:reports:${project}`,verticals:`${CACHE_VERSION}:verticals:${project}`,user:`${CACHE_VERSION}:user:${project}:${userId??""}`};}
export function cacheSpec(scope:CacheScope,resource:"report"|"verticals",identity:string,now=Date.now()):CacheSpec{
 const ttl=resource==="report"?REPORT_TTL_SECONDS:VERTICAL_TTL_SECONDS,tags=cacheTags(scope.project,scope.userId);
 // Rotating keys impose a hard age boundary instead of serving TTL-expired data via SWR.
 return{key:[CACHE_VERSION,resource,scope.project,scope.userId,scope.role,scope.department,scope.session,identity,String(Math.floor(now/(ttl*1000)))],tags:[resource==="report"?tags.reports:tags.verticals,tags.user],ttl};
}
