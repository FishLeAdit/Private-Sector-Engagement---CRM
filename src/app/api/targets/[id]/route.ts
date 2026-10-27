import { financeApi,financeJson,invalidateFinance } from "@/features/finance/context";
import { FinanceError } from "@/features/finance/types";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return financeApi(request,async service=>service.details((await params).id));}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){return financeApi(request,async service=>{const body=await financeJson(request);if(!body||typeof body!=="object"||body.request_id!==(await params).id)throw new FinanceError(422,"Submission ID must match the target plan.");const result=await service.save(body);invalidateFinance();return result;},true,true);}
