export function createYearComparison(year, today = new Date()) {
  if (!Number.isInteger(year) || year < 1 || year > 9998) {
    throw new RangeError("Comparison year must be an integer between 1 and 9998");
  }

  const isYearToDate = year === today.getFullYear();
  const currentEnd = isYearToDate
    ? new Date(year, today.getMonth(), today.getDate(), 23, 59, 59, 999)
    : new Date(year, 11, 31, 23, 59, 59, 999);
  const previousEnd = isYearToDate
    ? new Date(year - 1, currentEnd.getMonth(), Math.min(currentEnd.getDate(), new Date(year - 1, currentEnd.getMonth() + 1, 0).getDate()), 23, 59, 59, 999)
    : new Date(year - 1, 11, 31, 23, 59, 59, 999);

  return {
    year,
    previousYear: year - 1,
    isYearToDate,
    currentStart: new Date(year, 0, 1),
    currentEnd,
    previousStart: new Date(year - 1, 0, 1),
    previousEnd,
  };
}

export function isWithinPeriod(value, start, end) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp >= start.getTime() && timestamp <= end.getTime();
}
