export function formatEstimatedArrivalTime(value: string | null | undefined): string {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return "-";

  const businessDayRangeText = normalizedValue.replace(/^(\d+)\s*-\s*(\d+)\s*business days?$/i, "$1-$2 个工作日");
  if (businessDayRangeText !== normalizedValue) return businessDayRangeText;

  return normalizedValue.replace(/^(\d+)\s*business days?$/i, "$1 个工作日");
}
