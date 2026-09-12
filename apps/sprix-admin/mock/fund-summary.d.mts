import type {AdminFundsSnapshot} from '../src/services/sprixApi';
export function fundSummary(funds:AdminFundsSnapshot):{available:number;settling:number;reviewing:number;paying:number;paid:number;exceptions:number;settledNet:number};
