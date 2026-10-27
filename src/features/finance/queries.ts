import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database,Json } from "@/types/database.types";
import type { ContributionInput,contributionFilters,TargetInput } from "./schemas";
import type { z } from "zod";
import { FinanceError,type Actual,type Allocation } from "./types";
import { fromDhakaDateTimeInput } from "@/lib/dates";
const contributionSelect="*,opportunity:opportunity_id(id,deal_name),employee:employee_id(display_name),vertical:target_vertical_id(name),recorder:recorded_by(display_name)" as const;
export function financeDatabaseError(error:{code?:string}):never {
  if(error.code==="42501")throw new FinanceError(403,"Your current account is not allowed to make this change.");
  if(error.code==="P0002")throw new FinanceError(404,"Record not found.");
  if(["40001","23505"].includes(error.code??""))throw new FinanceError(409,"This submission conflicts with an existing record or a newer draft. Reload and review before trying again.");
  if(["23514","23503","23502","22P02","22007","22008","22003","22023"].includes(error.code??""))throw new FinanceError(422,"Review amounts, allocation totals, active employees/verticals and linked opportunity details.");
  throw new FinanceError(503,"Financial records are temporarily unavailable.");
}
export function createFinanceRepository(client:SupabaseClient<Database>){return{
  async options(){const[e,v]=await Promise.all([client.from("profiles").select("id,display_name,active").eq("department","PSE").in("role",["pse_member","pse_manager","admin"]).order("display_name").order("id").limit(1000),client.from("target_verticals").select("*").order("name").order("id").limit(1000)]);if(e.error)financeDatabaseError(e.error);if(v.error)financeDatabaseError(v.error);return{employees:e.data??[],verticals:v.data??[]};},
  async opportunity(id:string){const{data,error}=await client.from("opportunities").select("id,deal_name,owner_id,currency,contribution_type,expected_amount").eq("id",id).maybeSingle();if(error)financeDatabaseError(error);return data;},
  async contributions(input:z.output<typeof contributionFilters>){let query=client.from("recognized_contributions").select(contributionSelect,{count:"exact"});for(const key of["opportunity_id","employee_id","target_vertical_id","currency"]as const)if(input[key])query=query.eq(key,input[key]);if(input.from)query=query.gte("recognized_at",fromDhakaDateTimeInput(`${input.from}T00:00`));if(input.to){const day=new Date(`${input.to}T00:00Z`);day.setUTCDate(day.getUTCDate()+1);query=query.lt("recognized_at",fromDhakaDateTimeInput(`${day.toISOString().slice(0,10)}T00:00`));}const{data,count,error}=await query.order("recognized_at",{ascending:false}).order("id").range((input.page-1)*20,input.page*20-1);if(error)financeDatabaseError(error);return{contributions:data??[],count:count??0};},
  async contribution(id:string){const{data,error}=await client.from("recognized_contributions").select(contributionSelect).eq("id",id).maybeSingle();if(error)financeDatabaseError(error);return data;},
  async record(input:ContributionInput,actor:string){const{request_id,...values}=input;const{data,error}=await client.rpc("record_contribution",{p_id:request_id,p_values:{...values,target_vertical_id:values.target_vertical_id||null,approved_value_note:values.approved_value_note||null,valuation_reference_url:values.valuation_reference_url||null,notes:values.notes||null}});if(error)financeDatabaseError(error);if(!data)throw new FinanceError(503,"Contribution could not be recorded.");const saved=await this.contribution(data);if(!saved||saved.recorded_by!==actor)throw new FinanceError(503,"Reload the contribution list to verify this submission before retrying.");return saved;},
  async plans(page:number){const{data,count,error}=await client.from("target_plans").select("*",{count:"exact"}).order("year",{ascending:false}).order("currency").range((page-1)*20,page*20-1);if(error)financeDatabaseError(error);return{plans:data??[],count:count??0};},
  async plan(id:string){const{data,error}=await client.from("target_plans").select("*,quarters:target_quarters(*),creator:created_by(display_name),approver:approved_by(display_name)").eq("id",id).maybeSingle();if(error)financeDatabaseError(error);return data;},
  async allocations(id:string){
    const rows:Allocation[]=[];
    for(let start=0;start<=4000;start+=1000){
      const{data,count,error}=await client.from("target_allocations").select("*,employee:employee_id(display_name),vertical:vertical_id(name)",{count:"exact"}).eq("plan_id",id).order("quarter").order("employee_id").order("vertical_id").range(start,start+999);
      if(error)financeDatabaseError(error);rows.push(...(data??[]));
      if((count??0)>4000||rows.length>4000)throw new FinanceError(422,"This plan exceeds the supported 4,000 allocation cells.");
      if((data?.length??0)<1000)break;
    }
    return rows;
  },
  async actuals(id:string){const{data,error}=await client.rpc("target_actuals",{p_plan_id:id});if(error)financeDatabaseError(error);return(data??[])as unknown as Actual[];},
  async save(input:TargetInput){const{request_id,expected_updated_at,...values}=input;const{data,error}=await client.rpc("save_target_draft",{p_id:request_id,p_values:values as Json,p_expected_updated_at:expected_updated_at});if(error)financeDatabaseError(error);return data!;},
  async approve(id:string,stamp:string){const{data,error}=await client.rpc("approve_target_draft",{p_plan_id:id,p_expected_updated_at:stamp});if(error)financeDatabaseError(error);return data!;},
  async vertical(input:{id?:string;values:{code:string;name:string;active:boolean;is_provisional:boolean}}){const query=input.id?client.from("target_verticals").update(input.values).eq("id",input.id):client.from("target_verticals").insert(input.values);const{data,error}=await query.select("id").maybeSingle();if(error)financeDatabaseError(error);if(!data)throw new FinanceError(403,"Vertical could not be saved.");return data;},
  async history(id:string){const{data,error}=await client.from("audit_logs").select("id,action,created_at,actor:actor_id(display_name)").eq("entity","target_plans").eq("entity_id",id).order("created_at",{ascending:false}).order("id").limit(20);if(error)financeDatabaseError(error);return data??[];},
};}
export type FinanceRepository=ReturnType<typeof createFinanceRepository>;
