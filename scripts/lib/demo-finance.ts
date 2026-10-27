import type { Tables,TablesInsert } from "../../src/types/database.types";
import { contributionSchema,targetSchema } from "../../src/features/finance/schemas";
import { cents,decimal } from "../../src/features/finance/money";
import { fromDhakaDateTimeInput } from "../../src/lib/dates";
import { DEMO_MARKER,type DemoProfile } from "./demo-data";
const identifier=(prefix:string,index:number)=>`${prefix}-0000-4000-8000-${String(index).padStart(12,"0")}`;
export const demoTargetIds=[identifier("d6000000",1),identifier("d6000000",2)];
export const demoVerticalIds=[1,2,3].map(i=>identifier("d5000000",i));
export const demoContributionIds=[1,2,3,4,5,6].map(i=>identifier("d9000000",i));
export const demoFinanceVerticals:TablesInsert<"target_verticals">[]=["DSP","VBD","PROJECT"].map((code,index)=>({id:demoVerticalIds[index],code:`DEMO_${code}`,name:`Demo | ${code==="PROJECT"?"Project":code}`,active:true,is_provisional:true}));
type Plan=Pick<Tables<"target_plans">,"id"|"year"|"currency">;
type Opportunity=Pick<Tables<"opportunities">,"id"|"currency"|"contribution_type">;
export function demoFinanceYears(plans:Plan[],currentYear:number){
  const free=(start:number,excluded?:number)=>{for(let year=start;year>start-100&&year>=1;year--)if(year!==excluded&&!plans.some(p=>p.year===year&&p.currency==="BDT"))return year;throw new Error("No free demo target year is available.");};
  const first=plans.find(p=>p.id===demoTargetIds[0])?.year??free(currentYear);
  const second=plans.find(p=>p.id===demoTargetIds[1])?.year??free(currentYear+1,first);
  return[first,second];
}
export function buildDemoFinance(manager:DemoProfile,profiles:DemoProfile[],opportunities:Opportunity[],years:number[]){
  if(!manager.active||manager.department!=="PSE"||!["pse_manager","admin"].includes(manager.role))throw new Error("An existing active PSE manager is required for finance examples.");
  const colleague=profiles.find(p=>p.active&&p.department==="PSE"&&p.role==="pse_member"&&p.id!==manager.id)??manager;
  const candidates=(currency:string,type:string)=>opportunities.filter(o=>o.currency===currency&&o.contribution_type===type);
  const cash=candidates("BDT","cash"),inKind=candidates("BDT","valued_in_kind")[0],usd=candidates("USD","cash")[0];
  if(!cash.length||!inKind||!usd)throw new Error("Existing BDT cash, BDT valued in-kind and USD cash demo opportunities are required; deleted parents are not recreated.");
  const plans=years.map((year,index)=>{
    const quarters=(index?[200000,300000,300000,400000]:[150000,250000,250000,350000]).map((value,i)=>({quarter:i+1,amount:String(value)}));
    const dimensions=[{employee_id:manager.id,vertical_id:demoVerticalIds[0],share:50n},{employee_id:colleague.id,vertical_id:demoVerticalIds[1],share:20n},{employee_id:colleague.id,vertical_id:demoVerticalIds[2],share:30n}];
    const allocations=index?[]:quarters.flatMap(q=>dimensions.map(d=>({quarter:q.quarter,employee_id:d.employee_id,vertical_id:d.vertical_id,amount:decimal(cents(q.amount)*d.share/100n)})));
    const data=targetSchema.parse({request_id:demoTargetIds[index],expected_updated_at:"",year,currency:"BDT",annual_amount:index?"1200000":"1000000",quarters,allocations});
    return{id:data.request_id,values:{year:data.year,currency:data.currency,annual_amount:data.annual_amount,created_by:manager.id,quarters:data.quarters,allocations:data.allocations}};
  });
  const specs=[
    {opportunity:cash[0],amount:"100000",date:"01-20",employee:manager.id,vertical:demoVerticalIds[0],label:"Q1 cash installment"},
    {opportunity:cash[1]??cash[0],amount:"65000",date:"03-20",employee:colleague.id,vertical:demoVerticalIds[1],label:"Q1 cash support — team attainment reaches 110%"},
    {opportunity:inKind,amount:"40000",date:"06-15",employee:colleague.id,vertical:demoVerticalIds[2],label:"Received learning equipment",valuation:"Fictional operational-team inventory/market estimate and PSE agreement: received equipment valued at BDT 40,000. This is manually entered demo evidence."},
    {opportunity:cash[2]??cash[0],amount:"50000",date:"09-20",employee:manager.id,vertical:demoVerticalIds[0],label:"Q3 cash support"},
    {opportunity:cash[3]??cash[0],amount:"25000",date:"10-15",employee:colleague.id,vertical:"",label:"Q4 support with unassigned vertical"},
    {opportunity:usd,amount:"200",date:"08-20",employee:manager.id,vertical:"",label:"USD partial support — reported separately from BDT"},
  ];
  const contributions:TablesInsert<"recognized_contributions">[]=specs.map((spec,index)=>{
    const data=contributionSchema.parse({request_id:demoContributionIds[index],opportunity_id:spec.opportunity.id,employee_id:spec.employee,target_vertical_id:spec.vertical,amount:spec.amount,currency:spec.opportunity.currency,contribution_type:spec.opportunity.contribution_type,recognized_at:fromDhakaDateTimeInput(`${String(years[0]).padStart(4,"0")}-${spec.date}T10:00`),approved_value_note:spec.valuation??"",valuation_reference_url:spec.valuation?"https://drive.google.com/file/d/fictional-demo-received-inventory/view":"",notes:`Demo | ${spec.label}. ${DEMO_MARKER}. Not a real donation or receipt. Pipeline stage/forecast is unchanged.`});
    const{request_id,...values}=data;return{...values,id:request_id,amount:Number(data.amount),recorded_by:manager.id,target_vertical_id:data.target_vertical_id||null,approved_value_note:data.approved_value_note||null,valuation_reference_url:data.valuation_reference_url||null};
  });
  return{plans,contributions};
}
