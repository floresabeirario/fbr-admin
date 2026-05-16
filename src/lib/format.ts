const eurStandard = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const eurRounded = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export type FormatEUROptions = {
  rounded?: boolean;
  compact?: boolean;
  placeholder?: string;
};

export function formatEUR(
  value: number | null | undefined,
  opts: FormatEUROptions = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return opts.placeholder ?? "—";
  }
  if (opts.compact) {
    return `${value.toFixed(2).replace(".", ",")}€`;
  }
  return opts.rounded ? eurRounded.format(value) : eurStandard.format(value);
}
