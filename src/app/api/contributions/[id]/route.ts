import { financeApi } from "@/features/finance/context";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return financeApi(request,async service=>({contribution:await service.contribution((await params).id)}));}
