export function pageCount(count: number, pageSize: number) {
  return Math.max(1, Math.ceil(count / pageSize));
}

// A list URL that keeps the current filters and changes only the page number.
export function listHref(path: string, filters: Record<string, string | number | boolean>, page: number) {
  const query = Object.entries({ ...filters, page }).map(([key, value]) => [key, String(value)]);
  return `${path}?${new URLSearchParams(query)}`;
}
