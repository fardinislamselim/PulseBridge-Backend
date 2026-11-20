/**
 * Date range and analytics math utilities for Admin Dashboard & Analytics.
 */

export interface ParsedDateRange {
  start: Date;
  end: Date;
  period: string;
}

/**
 * Parses query period / date range into consistent UTC Date boundaries.
 */
export const parseDateRange = (query: {
  period?: 'today' | '7d' | '30d' | '90d' | '6m' | '1y' | 'all' | string;
  startDate?: string;
  endDate?: string;
}): ParsedDateRange => {
  const now = new Date();
  const end = query.endDate ? new Date(query.endDate) : new Date(now);

  // If custom date range provided
  if (query.startDate) {
    const start = new Date(query.startDate);
    if (isNaN(start.getTime())) {
      throw new Error('Invalid startDate');
    }
    if (isNaN(end.getTime())) {
      throw new Error('Invalid endDate');
    }
    if (start > end) {
      throw new Error('startDate cannot be later than endDate');
    }
    return { start, end, period: 'custom' };
  }

  const period = query.period || '30d';
  const start = new Date(end);

  switch (period) {
    case 'today': {
      start.setUTCHours(0, 0, 0, 0);
      break;
    }
    case '7d': {
      start.setUTCDate(start.getUTCDate() - 7);
      break;
    }
    case '30d': {
      start.setUTCDate(start.getUTCDate() - 30);
      break;
    }
    case '90d': {
      start.setUTCDate(start.getUTCDate() - 90);
      break;
    }
    case '6m': {
      start.setUTCDate(start.getUTCDate() - 180);
      break;
    }
    case '1y': {
      start.setUTCDate(start.getUTCDate() - 365);
      break;
    }
    case 'all': {
      start.setTime(new Date('2024-01-01T00:00:00.000Z').getTime());
      break;
    }
    default: {
      start.setUTCDate(start.getUTCDate() - 30);
      break;
    }
  }

  return { start, end, period };
};

/**
 * Calculates previous period boundaries of identical duration for growth comparison.
 */
export const getPreviousPeriod = (start: Date, end: Date): { prevStart: Date; prevEnd: Date } => {
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(start.getTime() - durationMs);
  return { prevStart, prevEnd };
};

/**
 * Calculates percentage growth between two periods.
 * Returns null if previousPeriod <= 0 to avoid Infinity/NaN.
 */
export const calculateGrowthPercentage = (
  currentPeriod: number,
  previousPeriod: number
): number | null => {
  if (previousPeriod > 0) {
    const pct = ((currentPeriod - previousPeriod) / previousPeriod) * 100;
    return Number(pct.toFixed(2));
  }
  return null;
};

/**
 * Safely calculates percentage (part / total) * 100.
 */
export const calculatePercentage = (part: number, total: number): number => {
  if (total <= 0) return 0;
  return Number(((part / total) * 100).toFixed(2));
};

/**
 * Calculates fulfillment rate: (fulfilled / eligible) * 100.
 */
export const calculateFulfillmentRate = (fulfilled: number, eligible: number): number => {
  if (eligible <= 0) return 0;
  return Number(((fulfilled / eligible) * 100).toFixed(2));
};

/**
 * Formats a Date object to YYYY-MM-DD in UTC.
 */
export const formatUtcDateKey = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

/**
 * Generates continuous date buckets between start and end date for chart intervals.
 */
export const generateDateBuckets = (
  start: Date,
  end: Date,
  interval: 'day' | 'week' | 'month' = 'day'
): string[] => {
  const buckets: string[] = [];
  const current = new Date(start);

  while (current <= end) {
    buckets.push(formatUtcDateKey(current));
    if (interval === 'day') {
      current.setUTCDate(current.getUTCDate() + 1);
    } else if (interval === 'week') {
      current.setUTCDate(current.getUTCDate() + 7);
    } else {
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
  }

  return buckets;
};
