import { cents } from "@/features/finance/money";
export function ReportBars({title,rows}:{title:string;rows:{label:string;value:string;display:string}[]}){
 const max=rows.reduce((maximum,row)=>{const value=cents(row.value);return value>maximum?value:maximum;},0n);
 return<figure className="min-w-0 rounded-xl border border-base-300 bg-base-100 p-5"><figcaption className="mb-5 text-base font-semibold">{title}</figcaption>{!rows.length?<p className="text-sm text-base-content/60">No matching records.</p>:<dl className="space-y-4">{rows.map((row,index)=><div key={`${index}:${row.label}`}><div className="mb-1 flex justify-between gap-3 text-xs"><dt className="break-words">{row.label}</dt><dd className="shrink-0 font-medium tabular-nums">{row.display}</dd></div><div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-base-200"><div className="h-full rounded-full bg-primary" style={{width:`${max?Number(cents(row.value)*10000n/max)/100:0}%`}}/></div></div>)}</dl>}</figure>;
}
