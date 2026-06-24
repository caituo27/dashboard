export function currency(value: number) {
  return `¥${value.toLocaleString("zh-CN")}`;
}

export function scoreText(value: number | null | undefined) {
  return value == null ? "-" : `${value}/100`;
}

export function compactText(value: string, length = 78) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}
