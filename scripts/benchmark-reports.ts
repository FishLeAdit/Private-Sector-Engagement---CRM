// Local, fictional PostgreSQL/cache-policy benchmark. No network or hosted writes.
import assert from "node:assert/strict";
import { mkdir,writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { createLocalDatabase,asActor,fixtureIds as ids } from "./lib/local-database";
import { MeasurementCache } from "./lib/measurement-cache";
import { cacheScope,cacheTags } from "../src/lib/cache/policy";
import { createReportCache } from "../src/features/reports/cache";
import { resolveAccess } from "../src/lib/auth/session";
import type { AccessProfile } from "../src/lib/auth/roles";
import type { ReportRepository } from "../src/features/reports/queries";
import type { Report,ReportOptions } from "../src/features/reports/types";
// Service has a server-only marker; load its shared logic through an internal
// server condition in package.json so this CLI does not import any app credentials.
import { createReportsService } from "../src/features/reports/service";
const round=(n:number)=>Number(n.toFixed(3));
function stats(samples:number[]){const sorted=[...samples].sort((a,b)=>a-b);return{samples:samples.length,median_ms:round(sorted[Math.floor(sorted.length/2)]),p95_ms:round(sorted[Math.ceil(sorted.length*.95)-1]),min_ms:round(sorted[0]),max_ms:round(sorted.at(-1)!)};}
async function main(){
 const db=await createLocalDatabase();
 try{
  await asActor(db,ids.member,tx=>tx.query("insert into public.recognized_contributions(opportunity_id,employee_id,target_vertical_id,amount,currency,recognized_at,contribution_type,notes) select $1,$2,$3,123.45,'BDT',make_date(2026,1+(n%12),15)::timestamp at time zone 'Asia/Dhaka','cash','Fictional isolated benchmark receipt' from generate_series(1,10000)n",[ids.cashOpportunity,ids.member,ids.dsp]));
  let reportQueries=0,employeeQueries=0,verticalQueries=0,accessQueries=0;
  const repo:ReportRepository={
   async read(f){reportQueries++;return asActor(db,ids.member,async tx=>(await tx.query<{data:Report}>("select public.pse_report($1,$2,$3,$4,$5,$6)as data",[f.year,f.period.startsWith("q")?Number(f.period.slice(1)):0,f.period.startsWith("m")?Number(f.period.slice(1)):0,f.employee_id,f.vertical_id,f.currency])).rows[0].data);},
   async employees(){employeeQueries++;return asActor(db,ids.member,async tx=>(await tx.query<ReportOptions["employees"][number]>("select id,display_name,active from public.profiles where department='PSE' and role in('pse_member','pse_manager','admin')order by display_name,id limit 1000")).rows);},
   async verticals(){verticalQueries++;return asActor(db,ids.member,async tx=>(await tx.query<ReportOptions["verticals"][number]>("select id,name,active,is_provisional from public.target_verticals order by name,id limit 1000")).rows);},
   async options(){const[employees,verticals]=await Promise.all([this.employees(),this.verticals()]);return{employees,verticals};},
  };
  const backend=new MeasurementCache(()=>0),filters={year:2026,period:"year"as const,employee_id:"",vertical_id:"",currency:"BDT"};
  async function request(cached:boolean){const access=await resolveAccess({verifyUser:async()=>({id:ids.member}),loadProfile:async id=>{accessQueries++;return asActor(db,ids.member,async tx=>(await tx.query<AccessProfile>("select id,display_name,department,role,active from public.profiles where id=$1",[id])).rows[0]??null);}});if(access.status!=="allowed")throw new Error("Local benchmark access denied.");const scope=cacheScope(access,"https://fictional-benchmark.invalid","fictional-local-session"),service=createReportsService(repo,access,cached?createReportCache(backend,scope,()=>0):undefined);const[result]=await Promise.all([service.read(filters),service.options()]);return result.report;}
  for(let i=0;i<3;i++)await request(false); // Warm PostgreSQL/WASM/JIT, not the cache.
  reportQueries=employeeQueries=verticalQueries=accessQueries=0;
  const before:number[]=[];let baseline!:Report;
  for(let i=0;i<25;i++){const start=performance.now();baseline=await request(false);before.push(performance.now()-start);}
  const uncachedQueries={reports:reportQueries,profiles:employeeQueries,verticals:verticalQueries,access:accessQueries};
  reportQueries=employeeQueries=verticalQueries=accessQueries=0;
  const coldStart=performance.now(),cold=await request(true),coldMs=performance.now()-coldStart;
  const after:number[]=[];let warmed!:Report;
  for(let i=0;i<25;i++){const start=performance.now();warmed=await request(true);after.push(performance.now()-start);}
  assert.deepEqual(warmed.fundraising,baseline.fundraising);assert.deepEqual(cold.workload,baseline.workload);assert.deepEqual(warmed.pipeline,baseline.pipeline);
  const cachedQueries={reports:reportQueries,profiles:employeeQueries,verticals:verticalQueries,access:accessQueries};
  await asActor(db,ids.member,tx=>tx.query("insert into public.recognized_contributions(opportunity_id,employee_id,amount,recognized_at,contribution_type,notes)values($1,$2,100,'2026-01-01T04:00Z','cash','Fictional cache invalidation check')",[ids.cashOpportunity,ids.member]));
  backend.invalidate(cacheTags(cacheScope({status:"allowed",userId:ids.member,profile:{id:ids.member,display_name:"Fictional",department:"PSE",role:"pse_member",active:true}},"https://fictional-benchmark.invalid","fictional-local-session").project).reports);
  const updated=await request(true);assert.equal(Number(updated.fundraising.actual),Number(warmed.fundraising.actual)+100);
  await db.query("update public.profiles set active=false where id=$1",[ids.member]);await assert.rejects(()=>request(true),/access denied/);
  const output={measured_at_utc:new Date().toISOString(),environment:"Node.js / PGlite / single local process; no hosted requests",dataset:{additional_receipts:10000,selected_bdt_receipts:baseline.fundraising.receipt_count},path:"fresh local profile authorization + report service read/options + SQL aggregate; repeated identical year/team/currency",uncached:stats(before),cached_warm:stats(after),cached_cold_ms:round(coldMs),query_counts:{uncached_25:uncachedQueries,cached_cold_plus_25_warm:cachedQueries},checks:{same_financial_and_pipeline_values:true,profile_checks_on_every_request:true,mutation_invalidation_reflected:true,revoked_profile_denied_with_warm_cache:true},limits:["Cache storage is the isolated MeasurementCache driver, not Next Data Cache persistence or a distributed backend.","Local Auth adapter validates database membership but does not measure Supabase JWT/network verification, HTTP, RSC rendering or browser latency.","These measurements are not a hosted production speedup claim."]};
  await mkdir("docs/benchmarks",{recursive:true});await writeFile("docs/benchmarks/report-cache.json",JSON.stringify(output,null,2)+"\n");console.log(JSON.stringify(output,null,2));
 }finally{await db.close();}
}
main().catch(()=>{console.error("Local report benchmark failed; no hosted project was accessed.");process.exitCode=1;});
