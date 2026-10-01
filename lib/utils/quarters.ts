import { toIsoDate } from "./dates";

export type Quarter = { year: number; q: 1 | 2 | 3 | 4 };

export const quarterId = ({ year, q }: Quarter) => `${year}-Q${q}`;
export const quarterLabel = ({ year, q }: Quarter) => `Q${q} ${year}`;

export function currentQuarter(now = new Date()): Quarter {
  return { year: now.getFullYear(), q: (Math.floor(now.getMonth() / 3) + 1) as Quarter["q"] };
}

/** The quarter `n` quarters before `from`. */
export function prevQuarter(from: Quarter, n = 1): Quarter {
  const idx = from.year * 4 + (from.q - 1) - n;
  return { year: Math.floor(idx / 4), q: ((idx % 4) + 1) as Quarter["q"] };
}

/**
 * ISO date range of a calendar quarter. The current quarter ends yesterday
 * (today's data is incomplete); a future quarter returns null.
 */
export function quarterRange(
  { year, q }: Quarter,
  now = new Date(),
): { from: string; to: string; partial: boolean } | null {
  const start = new Date(year, (q - 1) * 3, 1);
  const end = new Date(year, q * 3, 0);
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (start > yesterday) return null;
  const partial = end > yesterday;
  return { from: toIsoDate(start), to: toIsoDate(partial ? yesterday : end), partial };
}
