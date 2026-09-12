export function recordId(row:object):string;
export function timestamp(value:unknown):number;
export function compareRecords(kind:string,a:object,b:object):number;
export function filterRecords<T>(kind:string,rows:T[],options:Record<string,string|undefined>):T[];
