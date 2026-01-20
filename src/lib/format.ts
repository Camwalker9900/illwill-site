const statFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const formatStat = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return statFormatter.format(value);
};

export const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-US', options ?? { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};
