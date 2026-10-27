import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import type { AccessResult } from "../../src/lib/auth/session";
import { reportFixture } from "../helpers/report-fixture";
const mocks=vi.hoisted(()=>({bearer:vi.fn(),repository:vi.fn(),cacheGet:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("../../src/lib/supabase/bearer",()=>({createBearerClient:mocks.bearer}));vi.mock("../../src/lib/supabase/config",()=>({getSupabaseConfig:()=>({url:"https://example.supabase.co",key:"sb_publishable_fictional"})}));vi.mock("../../src/lib/cache/server",()=>({nextCacheBackend:{get:mocks.cacheGet}}));vi.mock("../../src/features/reports/queries",()=>({createReportRepository:mocks.repository}));
import { reportRequestService } from "../../src/features/reports/request-service";
const userId="00000000-0000-4000-8000-000000000002";
const actor:AccessResult={status:"allowed",userId,profile:{id:userId,display_name:"Fictional Employee",department:"PSE",role:"pse_member",active:true}};
function client(id=userId,error:unknown=null,session=true){return{auth:{getSession:vi.fn().mockResolvedValue({data:{session:session?{user:{id},access_token:"fictional-bearer-secret"}:null},error})}}as unknown as Parameters<typeof reportRequestService>[1];}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("PSE_REPORT_CACHE_ENABLED","true");mocks.cacheGet.mockImplementation((_spec,load)=>load());mocks.repository.mockReturnValue({read:vi.fn().mockResolvedValue(reportFixture()),employees:vi.fn().mockResolvedValue([{id:userId,display_name:"Fresh name",active:true}]),verticals:vi.fn().mockResolvedValue([])});});
afterEach(()=>vi.unstubAllEnvs());
describe("request-bound private cache construction",()=>{
 it("fails closed with 503 on a session-provider outage before any cache lookup",async()=>{await expect(reportRequestService(actor,client(userId,{status:500}))).rejects.toMatchObject({status:503});expect(mocks.cacheGet).not.toHaveBeenCalled();});
 it("supports uncached operation without capturing bearer credentials",async()=>{vi.stubEnv("PSE_REPORT_CACHE_ENABLED","false");const c=client(),service=await reportRequestService(actor,c);await service.read({year:2026});expect(c.auth.getSession).not.toHaveBeenCalled();expect(mocks.bearer).not.toHaveBeenCalled();expect(mocks.cacheGet).not.toHaveBeenCalled();});
 it("captures bearer credentials outside cached execution and keys only by a digest",async()=>{const c=client(),service=await reportRequestService(actor,c);await service.read({year:2026});expect(c.auth.getSession).toHaveBeenCalledTimes(1);expect(mocks.bearer).toHaveBeenCalledWith("fictional-bearer-secret");expect(JSON.stringify(mocks.cacheGet.mock.calls.map(c=>c[0]))).not.toContain("fictional-bearer-secret");});
 it.each(["anonymous","forbidden","unavailable"]as const)("rejects unverified %s without reading session/cache",async status=>{const c=client();await expect(reportRequestService({status},c)).rejects.toMatchObject({status:403});expect(c.auth.getSession).not.toHaveBeenCalled();expect(mocks.cacheGet).not.toHaveBeenCalled();});
 it("rejects mismatched or missing sessions without returning cached data",async()=>{await expect(reportRequestService(actor,client("other"))).rejects.toMatchObject({status:403});await expect(reportRequestService(actor,client(userId,null,false))).rejects.toMatchObject({status:401});expect(mocks.cacheGet).not.toHaveBeenCalled();});
});
