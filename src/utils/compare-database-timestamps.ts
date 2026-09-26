// PostgreSQL retains microseconds; Date.parse alone loses ordering within a millisecond.
export function compareDatabaseTimestamps(left: string, right: string): number {
  const difference = Date.parse(left) - Date.parse(right);
  if (!Number.isFinite(difference)) return 0;
  const subMilliseconds = (value: string) => Number((value.match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0').slice(3, 6));
  return difference || subMilliseconds(left) - subMilliseconds(right);
}
