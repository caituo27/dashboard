export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}) {
  return value.toLocaleString("zh-CN", options);
}

export function formatCount(value: number) {
  return formatNumber(value, { maximumFractionDigits: 0 });
}

export function currency(value: number) {
  return `¥${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function scoreText(value: number | null | undefined) {
  return value == null ? "-" : `${value}/100`;
}

export function compactText(value: string, length = 78) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}
