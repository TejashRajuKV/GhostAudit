// Vendor collusion network graph.
// Nodes = vendors, edges = suspicious money flows:
//   • circular payments (round-tripping): similar amounts within 7 days across vendors
//   • shared bank accounts or near-identical addresses
const { getDb } = require('../db');

function buildNetwork() {
  const db = getDb();
  const vendors = db.prepare('SELECT * FROM vendors').all();
  const txs = db.prepare('SELECT * FROM transactions ORDER BY invoice_date ASC').all();

  const byVendor = {};
  for (const t of txs) (byVendor[t.vendor_id] ||= []).push(t);

  const edges = [];
  const vendorIds = Object.keys(byVendor);

  // Round-tripping edges: cross-vendor amount matches within 7 days
  for (let i = 0; i < vendorIds.length; i++) {
    for (let j = i + 1; j < vendorIds.length; j++) {
      const a = byVendor[vendorIds[i]], b = byVendor[vendorIds[j]];
      let matches = 0, totalPaired = 0;
      const samples = [];
      for (const ta of a) {
        for (const tb of b) {
          const days = Math.abs(new Date(ta.invoice_date) - new Date(tb.invoice_date)) / 86400000;
          if (days > 7) continue;
          totalPaired++;
          if (Math.abs(ta.amount - tb.amount) / Math.max(ta.amount, 1) < 0.05) {
            matches++;
            if (samples.length < 3) samples.push({ a: ta.invoice_number, b: tb.invoice_number, amountA: ta.amount, amountB: tb.amount, daysApart: Math.round(days) });
          }
        }
      }
      if (matches > 0) {
        edges.push({
          source: +vendorIds[i], target: +vendorIds[j],
          weight: matches,
          strength: matches >= 3 ? 'STRONG' : matches === 2 ? 'MODERATE' : 'WEAK',
          type: 'ROUND_TRIPPING',
          samples,
        });
      }
    }
  }

  // Shared attribute edges: same bank account or identical address prefix
  for (let i = 0; i < vendors.length; i++) {
    for (let j = i + 1; j < vendors.length; j++) {
      const v1 = vendors[i], v2 = vendors[j];
      const reasons = [];
      if (v1.bank_account && v1.bank_account === v2.bank_account) reasons.push('Shared bank account');
      if (v1.address && v2.address && v1.address.length > 5 && v1.address === v2.address) reasons.push('Identical registered address');
      if (reasons.length) {
        edges.push({ source: v1.id, target: v2.id, weight: 2, strength: 'STRONG', type: 'SHARED_ATTRIBUTE', reasons });
      }
    }
  }

  // Connected components → potential collusion rings
  const adj = {};
  for (const e of edges) {
    (adj[e.source] ||= new Set()).add(e.target);
    (adj[e.target] ||= new Set()).add(e.source);
  }
  const seen = new Set();
  const rings = [];
  for (const node of Object.keys(adj)) {
    if (seen.has(node)) continue;
    const comp = [];
    const stack = [node];
    while (stack.length) {
      const n = stack.pop();
      if (seen.has(String(n))) continue;
      seen.add(String(n));
      comp.push(+n);
      for (const nb of (adj[n] || [])) if (!seen.has(String(nb))) stack.push(nb);
    }
    if (comp.length >= 2) rings.push(comp);
  }

  const nodes = vendors.map(v => {
    const vTxs = byVendor[v.id] || [];
    const degree = edges.filter(e => e.source === v.id || e.target === v.id).length;
    return {
      id: v.id, name: v.name, is_ghost: !!v.is_ghost, ghost_score: v.ghost_score,
      totalSpend: vTxs.reduce((s, t) => s + t.amount, 0),
      txCount: vTxs.length, degree,
      ring: rings.findIndex(r => r.includes(v.id)),
    };
  }).filter(n => n.txCount > 0 || n.degree > 0);

  return {
    nodes,
    edges,
    rings: rings.map(r => ({
      members: r.map(id => vendors.find(v => v.id === id)?.name).filter(Boolean),
      size: r.length,
      hasGhost: r.some(id => vendors.find(v => v.id === id)?.is_ghost),
    })),
    summary: `${nodes.length} vendors, ${edges.length} suspicious links, ${rings.length} connected cluster(s)` +
      (rings.some(r => r.some(id => vendors.find(v => v.id === id)?.is_ghost)) ? ' — ⚠️ at least one cluster contains known ghost vendors' : ''),
  };
}

module.exports = { buildNetwork };
