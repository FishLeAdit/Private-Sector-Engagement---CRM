import type { Report } from "../../src/features/reports/types";
export function reportFixture():Report{return{
 generated_at:"2026-10-27T04:00:00Z",currency:"BDT",start_date:"2026-01-01",end_date_exclusive:"2027-01-01",
 fundraising:{target:"1000000",target_status:"draft",plan_id:"60000000-0000-4000-8000-000000000001",actual:"280000",receipt_count:5,unassigned_actual:"25000",types:[{key:"cash",amount:"240000",count:4},{key:"valued_in_kind",amount:"40000",count:1}],dimensions:[{employee_id:"00000000-0000-4000-8000-000000000002",employee_name:"Fictional Employee",vertical_id:null,vertical_name:"Unassigned",target:null,actual:"25000",receipt_count:1}]},
 pipeline:{count:2,expected:"500000",undated_count:1,undated_expected:"10000",stages:[{id:"stage",name:"Fictional configurable stage",position:1,is_provisional:true,outcome:"open",count:2,expected:"500000"}],outcomes:[{key:"open",count:2,expected:"500000"}]},
 workload:{activity_count:10,meeting_count:6,independent_count:4,undated_activities:1,missing_context:1,types:[{key:"visit",count:2},{key:"event",count:1}],statuses:[{key:"done",count:4}],categories:[{key:"stewardship",count:3}],meeting_statuses:[{key:"scheduled",count:3},{key:"done",count:2},{key:"cancelled",count:1}],owners:[{id:"owner",name:"Fictional Employee",activities:10,completed_activities:4,meetings:6,done_meetings:2}]},
 trends:[{month:"2026-01",actual:"100000",activities:2,completed_activities:1,meetings:1,done_meetings:1},{month:"2026-02",actual:"0",activities:0,completed_activities:0,meetings:0,done_meetings:0}],
};}
