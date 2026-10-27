import { describe,expect,it,vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database.types";
import { reportFixture } from "../helpers/report-fixture";
vi.mock("server-only",()=>({}));
import { createReportRepository } from "../../src/features/reports/queries";
function repository(body:unknown=reportFixture(),status=200){const fetcher=vi.fn().mockImplementation(async()=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}}));return{fetcher,repo:createReportRepository(createClient<Database>("https://example.supabase.co","sb_publishable_fictional",{global:{fetch:fetcher},auth:{persistSession:false,autoRefreshToken:false}}))};}
const filters={year:2026,period:"q3"as const,employee_id:"",vertical_id:"",currency:"BDT"};
describe("report SQL query contracts",()=>{
 it("fails closed if a fresh profile lookup loses PSE visibility",async()=>{await expect(repository([]).repo.employees()).rejects.toMatchObject({status:403});});
 it("uses one aggregate RPC with parameterized quarter filters and no paginated sums",async()=>{const{repo,fetcher}=repository();await repo.read(filters);expect(fetcher).toHaveBeenCalledTimes(1);const[url,init]=fetcher.mock.calls[0];expect(String(url)).toContain("/rpc/pse_report");expect(JSON.parse(init.body)).toEqual({p_year:2026,p_quarter:3,p_month:0,p_employee_id:"",p_vertical_id:"",p_currency:"BDT"});});
 it("passes month and unassigned attribution explicitly",async()=>{const{repo,fetcher}=repository();await repo.read({...filters,period:"m02",vertical_id:"unassigned",currency:"USD"});expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({p_quarter:0,p_month:2,p_vertical_id:"unassigned",p_currency:"USD"});});
 it.each([["42501",403],["22023",422],["22P02",422],["22008",422],["XX000",503]])("scrubs provider failure %s",async(code,status)=>{await expect(repository({code,message:"Sensitive provider detail"},400).repo.read(filters)).rejects.toMatchObject({status});});
 it.each([null,[],{}])("refuses missing or malformed aggregate data %j",async body=>{await expect(repository(body).repo.read(filters)).rejects.toMatchObject({status:503});});
 it("bounds internal lookups without excluding inactive historical dimensions",async()=>{const{repo,fetcher}=repository([{id:"fictional-permitted-profile"}]);await repo.options();const urls=fetcher.mock.calls.map(([url])=>new URL(url));expect(urls[0].searchParams.get("department")).toBe("eq.PSE");expect(urls.every(url=>url.searchParams.get("limit")==="1000")).toBe(true);expect(urls[0].searchParams.get("active")).toBeNull();expect(urls[1].searchParams.get("active")).toBeNull();});
});
