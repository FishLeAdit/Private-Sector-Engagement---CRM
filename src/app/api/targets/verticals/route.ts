import { financeApi,financeJson,invalidateFinance } from "@/features/finance/context";
export async function POST(request:Request){return financeApi(request,async service=>{const result=await service.vertical(await financeJson(request));invalidateFinance();return result;},true,true);}
