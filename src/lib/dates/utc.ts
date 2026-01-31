export const parseYyyyMmDdToUtcMs = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date.getTime();
};

export const isValidYyyyMmDd = (value: string) => parseYyyyMmDdToUtcMs(value) !== null;

export const diffDaysInclusive = (startDate: string, endDate: string) => {
  const start = parseYyyyMmDdToUtcMs(startDate);
  const end = parseYyyyMmDdToUtcMs(endDate);
  if (start === null || end === null) return null;
  const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

export const toYyyyMmDdUtc = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const todayUtcYyyyMmDd = () => toYyyyMmDdUtc(new Date());

export const addDaysToYyyyMmDd = (value: string, days: number) => {
  const start = parseYyyyMmDdToUtcMs(value);
  if (start === null) return null;
  const next = new Date(start + days * 24 * 60 * 60 * 1000);
  return toYyyyMmDdUtc(next);
};
