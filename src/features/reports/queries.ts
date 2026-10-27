import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { ReportFilters } from "./schemas";
import { ReportError,type Report } from "./types";
function failure(error:{code?:string}):never{if(error.code==="42501")throw new ReportError(403,"Active PSE access is required to view reports.");if(["22023","22P02","22008"].includes(error.code??""))throw new ReportError(422,"Choose valid report filters.");throw new ReportError(503,"Reports are temporarily unavailable. Please try again.");}
export function createReportRepository(client:SupabaseClient<Database>){return{
 async read(input:ReportFilters){const{data,error}=await client.rpc("pse_report",{p_year:input.year,p_quarter:input.period.startsWith("q")?Number(input.period.slice(1)):0,p_month:input.period.startsWith("m")?Number(input.period.slice(1)):0,p_employee_id:input.employee_id,p_vertical_id:input.vertical_id,p_currency:input.currency});if(error)failure(error);if(!data||typeof data!=="object"||Array.isArray(data)||!("fundraising"in data))throw new ReportError(503,"Report data is unavailable.");return data as unknown as Report;},
 async employees(){const{data,error}=await client.from("profiles").select("id,display_name,active").eq("department","PSE").in("role",["pse_member","pse_manager","admin"]).order("display_name").order("id").limit(1000);if(error)failure(error);if(!data?.length)throw new ReportError(403,"PSE profile access has changed. Sign in again.");return data;},
 async verticals(){const{data,error}=await client.from("target_verticals").select("id,name,active,is_provisional").order("name").order("id").limit(1000);if(error)failure(error);return data??[];},
 async options(){const[employees,verticals]=await Promise.all([this.employees(),this.verticals()]);return{employees,verticals};},
};}
export type ReportRepository=ReturnType<typeof createReportRepository>;
