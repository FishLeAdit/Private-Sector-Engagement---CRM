import "server-only";
import { revalidatePath } from "next/cache";

// Re-renders one record's list, detail and edit pages after a successful write.
export function revalidateRecordPages(basePath: string, id: string) {
  revalidatePath(basePath);
  revalidatePath(`${basePath}/${id}`);
  revalidatePath(`${basePath}/${id}/edit`);
}

// Re-renders every page under each section, such as related-record panels on other modules' pages.
export function revalidateSections(...basePaths: string[]) {
  for (const path of basePaths) revalidatePath(path, "layout");
}
