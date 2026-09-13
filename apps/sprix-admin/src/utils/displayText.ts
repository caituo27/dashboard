// Presentation aliases only. Keep the original IDs in API payloads, links and row keys.
const prefixes: Record<string, string> = {
  task: 'TK', execution: 'EX', agent: 'AG', settlement: 'ST',
  withdrawal: 'WD', appeal: 'AP', flow: 'FL', exception: 'ER', order: 'OD'
};
export function displayText(value: string): string {
  return value.replace(/demo:(?:business-)?([a-z]+):(\d+)/g, (id, kind: string, number: string) =>
    prefixes[kind] ? `${prefixes[kind]}-${number.padStart(8, '0')}` : id)
    .replace(/DEMO-CELL-/g, 'CELL-')
    .replace(/体验用户/g, '用户')
    .replace(/演示账户（不可真实打款）/g, '账户未绑定')
    .replace(/演示账户/g, '用户账户');
}
export function displayExecutionId(record: {executionNo?: string; executionId?: string}): string {
  return record.executionNo || (record.executionId ? displayText(record.executionId) : '-');
}
export function internalSearch(value: string): string {
  return value.replace(/\b(TK|EX|AG|ST|WD|AP|FL|ER|OD)-(\d+)\b/g, (id, prefix: string, number: string) => {
    const kind = Object.keys(prefixes).find(key => prefixes[key] === prefix);
    return kind ? `demo:${kind}:${Number(number)}` : id;
  });
}

// Display only: preserve source values for searches and API requests.
export function maskPhone(value: string | null | undefined): string {
  if (!value) return '—';
  return value.replace(/^(\+?86[ -]?)?(1[3-9]\d)[ -]?\d{4}[ -]?(\d{4})$/, '$1$2****$3');
}
