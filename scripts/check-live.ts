/** Explicit, bounded live integration check: two catalogue reads and one product in two supported shops. */
import { compare } from '../lib/compare.ts';
const result = await compare({ items: [{ code: '9000101810325', qty: 1 }], shopIds: ['auchan-007', 'tesco-1025'], loyaltyChainIds: [], extraStopCost: 0 });
console.log(JSON.stringify({ comparedAt: result.comparedAt, oldestObservation: result.oldestObservation, products: result.products, quotes: result.quotes, plans: result.plans, warnings: result.warnings }, null, 2));
if (!result.plans.some(p => p.complete) || result.quotes.some(q => q.status === 'error')) process.exitCode = 1;
