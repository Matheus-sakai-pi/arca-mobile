// PostgREST caps a response at 1,000 rows by default; the curriculum exceeds that.
export async function loadAllRows<T>(page: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>, check: (error: { message: string; code?: string } | null) => void): Promise<T[]> {
  const rows: T[] = [];
  const size = 500;
  for (let start = 0; ; start += size) {
    const result = await page(start, start + size - 1);
    check(result.error);
    const items = result.data ?? [];
    rows.push(...items);
    if (items.length < size) return rows;
  }
}
