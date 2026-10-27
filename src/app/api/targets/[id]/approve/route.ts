import { financeApi,financeJson,invalidateFinance } from "@/features/finance/context";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return financeApi(request,async service=>{const result=await service.approve((await params).id,await financeJson(request));invalidateFinance();return result;},true,true);}
