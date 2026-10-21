export type YearComparison = {
  year: number;
  previousYear: number;
  isYearToDate: boolean;
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
};

export function createYearComparison(year: number, today?: Date): YearComparison;
export function isWithinPeriod(value: string | null | undefined, start: Date, end: Date): boolean;
