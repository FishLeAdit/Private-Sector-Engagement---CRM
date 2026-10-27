import "server-only";
import { NextResponse } from "next/server";
import { authorizeApi,requirePseUser } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { reportRequestService } from "./request-service";
import { ReportError } from "./types";
export async function reportsPage(){const access=await requirePseUser();return reportRequestService(access,await createClient());}
export async function reportData<T>(load:()=>Promise<T>){try{return{ok:true as const,data:await load()};}catch(error){if(error instanceof ReportError)return{ok:false as const,error};throw error;}}
export async function reportsApi(request:Request){
 const started=performance.now(),finish=(response:NextResponse)=>{response.headers.set("Server-Timing",`report;dur=${(performance.now()-started).toFixed(1)}`);return response;};
 const auth=await authorizeApi();if(!auth.ok)return finish(auth.response);const headers={"Cache-Control":"private, no-store"};
 try{const service=await reportRequestService(auth.access,await createClient());return finish(NextResponse.json(await service.read(Object.fromEntries(new URL(request.url).searchParams)),{headers}));}
 catch(error){if(error instanceof ReportError)return finish(NextResponse.json({error:error.message},{status:error.status,headers}));return finish(NextResponse.json({error:"Reports are temporarily unavailable. Please try again."},{status:503,headers}));}
}
