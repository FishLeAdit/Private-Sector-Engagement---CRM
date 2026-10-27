// PostgREST rejects a page that starts after the last row with HTTP 416 (code PGRST103) and no row count.
// List queries then re-read page 1 to learn the total, so the page can redirect to the real last page.
export function isPastLastPage(error: { code?: string } | null) {
  return error?.code === "PGRST103";
}
