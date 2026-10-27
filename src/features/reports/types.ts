export type CountMetric={key:string;count:number};
export type ReportOptions={employees:{id:string;display_name:string;active:boolean}[];verticals:{id:string;name:string;active:boolean;is_provisional:boolean}[]};
export type Report={
 generated_at:string;currency:string;start_date:string;end_date_exclusive:string;
 fundraising:{target:string|null;target_status:string|null;plan_id:string|null;actual:string;receipt_count:number;unassigned_actual:string;
  types:{key:string;amount:string;count:number}[];
  dimensions:{employee_id:string;employee_name:string;vertical_id:string|null;vertical_name:string;target:string|null;actual:string;receipt_count:number}[]};
 pipeline:{count:number;expected:string;undated_count:number;undated_expected:string;
  stages:{id:string;name:string;position:number;is_provisional:boolean;outcome:string;count:number;expected:string}[];
  outcomes:{key:string;count:number;expected:string}[]};
 workload:{activity_count:number;meeting_count:number;independent_count:number;undated_activities:number;missing_context:number;types:CountMetric[];statuses:CountMetric[];categories:CountMetric[];meeting_statuses:CountMetric[];
  owners:{id:string;name:string;activities:number;completed_activities:number;meetings:number;done_meetings:number}[]};
 trends:{month:string;actual:string;activities:number;completed_activities:number;meetings:number;done_meetings:number}[];
};
export class ReportError extends Error{constructor(public status:number,message:string){super(message);this.name="ReportError";}}
