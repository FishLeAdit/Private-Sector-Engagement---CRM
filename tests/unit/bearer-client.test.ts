import { afterEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));vi.mock("../../src/lib/supabase/config",()=>({getSupabaseConfig:()=>({url:"https://example.supabase.co",key:"sb_publishable_fictional"})}));
import { createBearerClient } from "../../src/lib/supabase/bearer";
afterEach(()=>vi.unstubAllGlobals());
describe("cookie-free caller-scoped query transport",()=>{
 it("uses the captured caller bearer and public key with no-store fetches",async()=>{const fetcher=vi.fn().mockResolvedValue(Response.json({fundraising:{}}));vi.stubGlobal("fetch",fetcher);await createBearerClient("fictional-user-jwt").rpc("pse_report",{p_year:2026,p_quarter:0,p_month:0,p_employee_id:"",p_vertical_id:"",p_currency:"BDT"});const headers=new Headers(fetcher.mock.calls[0][1].headers);expect(headers.get("authorization")).toBe("Bearer fictional-user-jwt");expect(headers.get("apikey")).toBe("sb_publishable_fictional");expect(fetcher.mock.calls[0][1].cache).toBe("no-store");expect(headers.has("cookie")).toBe(false);});
});
