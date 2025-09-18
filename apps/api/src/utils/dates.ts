export function monthBounds(period: string): { start: Date; end: Date } {
  const [year, month] = period.split('-').map((part) => Number.parseInt(part, 10));
  if (!year || !month || month < 1 || month > 12) {
    throw new Error('Invalid period');
  }
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}
