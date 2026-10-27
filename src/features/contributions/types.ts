import type { Tables } from "@/types/database.types";

export type Contribution = Tables<"recognized_contributions"> & {
  opportunity: { id: string; deal_name: string } | null;
  employee: { display_name: string } | null;
  vertical: { name: string } | null;
  recorder: { display_name: string } | null;
};
