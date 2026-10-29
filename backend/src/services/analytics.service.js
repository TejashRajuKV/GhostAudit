// Fraud analytics engine: Benford's Law, duplicate invoices, threshold evasion.
// Pure statistical detectors that run over the transactions table.
const { getDb } = require('../db');

// ── Benford's Law ──────────────────────────────────────────────
// In natural financial datasets the leading digit distribution follows
// P(d) = log10(1 + 1/d). Significant deviation ⇒ fabricated numbers.
const BENFORD = [0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046]; // digits 1..9

function benfordsLaw(vendorId = null) {
  const db = getDb();
  const rows = vendorId
    ? db.prepare('SELECT amount FROM transactions WHERE amount > 0 AND vendor_id = ?').all(vendorId)
    : db.prepare('SELECT amount, vendor_id FROM transactions WHERE amount > 0').all();

  const counts = new Array(9).fill(0);
  let n = 0;
  for (const r of rows) {
    const first = String(Math.floor(r.amount)).replace(/[^1-9]/, '').charAt(0);
    if (!first) continue;
    counts[parseInt(first) - 1]++;
    n++;
  }
  if (n < 20) return { error: 'Insufficient sample size (need ≥20 transactions)', n };

  const digits = [];
  let chiSq = 0;
  for (let d = 1; d <= 9; d++) {
    const observed = counts[d - 1] / n;
    const expected = BENFORD[d - 1];
    chiSq += Math.pow((counts[d - 1] - expected * n), 2) / (expected * n);
    digits.push({
      digit: d,
      observedPct: +(observed * 100).toFixed(1),
      expectedPct: +(expected * 100).toFixed(1),
      deviationPct: +((observed - expected) * 100).toFixed(1),
    });
  }
  // MAD (Mean Absolute Deviation) — standard Benford conformity test
  const mad = digits.reduce((s, x) => s + Math.abs(x.observedPct / 100 - x.expectedPct / 100), 0) / 9;
  const conformity = mad < 0.006 ? 'CLOSE CONFORMITY' : mad < 0.012 ? 'ACCEPTABLE' : mad < 0.015 ? 'MARGINAL' : 'NONCONFORMITY';

  return {
    sampleSize: n,
    chiSquare: +chiSq.toFixed(2),
    mad: +mad.toFixed(4),
    conformity,
    verdict: mad >= 0.015 ? '⚠️ Leading digits deviate from Benford expectation — possible fabrication' : '✅ Distribution broadly conforms to Benford’s Law',
    digits,
    perVendor: vendorId ? undefined : topBenfordVendors(),
  };
}

// Per-vendor MAD to find worst offenders
function topBenfordVendors() {
  const db = getDb();
  const vendors = db.prepare('SELECT id, name FROM vendors').all();
  const out = [];
  for (const v of vendors) {
    const rows = db.prepare('SELECT amount FROM transactions WHERE amount > 0 AND vendor_id = ?').all(v.id);
    if (rows.length < 10) continue;
    const counts = new Array(9).fill(0);
    for (const r of rows) {
      const first = String(Math.floor(r.amount)).replace(/[^1-9]/, '').charAt(0);
      if (first) counts[parseInt(first) - 1]++;
    }
    const n = counts.reduce((a, b) => a + b, 0);
    const mad = counts.reduce((s, c, i) => s + Math.abs(c / n - BENFORD[i]), 0) / 9;
    out.push({ vendorId: v.id, vendor: v.name, sample: rows.length, mad: +mad.toFixed(4) });
  }
  return out.sort((a, b) => b.mad - a.mad).slice(0, 5);
}

// ── Duplicate invoice detector ────────────────────────────────
function duplicateInvoices() {
  const db = getDb();
  // Exact duplicates: same invoice_number used more than once
  const exact = db.prepare(`
    SELECT invoice_number, vendor_id, COUNT(*) as occurrences, GROUP_CONCAT(id) as tx_ids,
           MAX(amount) as amount, MIN(invoice_date) as first_seen
    FROM transactions WHERE invoice_number IS NOT NULL
    GROUP BY invoice_number, amount HAVING COUNT(*) > 1
    ORDER BY occurrences DESC LIMIT 50
  `).all();

  // Near-duplicates: same vendor + same amount on different dates within 10 days
  const near = [];
  const byVendor = {};
  const all = db.prepare('SELECT * FROM transactions ORDER BY invoice_date ASC').all();
  for (const t of all) (byVendor[t.vendor_id] ||= []).push(t);
  for (const [vid, list] of Object.entries(byVendor)) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (Math.abs(a.amount - b.amount) / Math.max(a.amount, 1) > 0.02) continue;
        const days = Math.abs(new Date(a.invoice_date) - new Date(b.invoice_date)) / 86400000;
        if (days <= 10 && a.invoice_number !== b.invoice_number) {
          near.push({ vendor_id: +vid, tx_a: a.id, tx_b: b.id, invoice_a: a.invoice_number, invoice_b: b.invoice_number, amount: a.amount, daysApart: Math.round(days) });
        }
      }
    }
  }
  const vendors = {};
  for (const v of db.prepare('SELECT id, name FROM vendors').all()) vendors[v.id] = v.name;
  for (const nd of near) nd.vendor_name = vendors[nd.vendor_id];
  for (const ex of exact) ex.vendor_name = vendors[ex.vendor_id];

  return {
    exactDuplicates: exact,
    nearDuplicates: near.slice(0, 50),
    summary: `${exact.length} repeated invoice numbers, ${near.length} near-duplicate payment pairs`,
  };
}

// ── Threshold-evasion / round-number analysis ─────────────────
function thresholdEvasion() {
  const db = getDb();
  const txs = db.prepare(`
    SELECT t.*, v.name as vendor_name FROM transactions t
    LEFT JOIN vendors v ON t.vendor_id = v.id
  `).all();

  const buckets = { justBelow: [], roundNumbers: [], repeatedAmounts: {} };
  for (const t of txs) {
    const th = t.approval_threshold || 100000;
    // Just below threshold: within 5% under the approval limit
    if (t.amount < th && t.amount >= th * 0.95) {
      buckets.justBelow.push({ id: t.id, vendor: t.vendor_name, amount: t.amount, threshold: th, gap: +(th - t.amount).toFixed(0), date: t.invoice_date });
    }
    // Suspiciously round: divisible by 10000 and > 10000
    if (t.amount >= 10000 && t.amount % 10000 === 0) {
      buckets.roundNumbers.push({ id: t.id, vendor: t.vendor_name, amount: t.amount, date: t.invoice_date });
    }
    buckets.repeatedAmounts[t.amount] = (buckets.repeatedAmounts[t.amount] || 0) + 1;
  }
  const repeats = Object.entries(buckets.repeatedAmounts)
    .filter(([, c]) => c >= 3)
    .map(([amt, count]) => ({ amount: +amt, count }))
    .sort((a, b) => b.count - a.count);

  const total = txs.length || 1;
  const roundPct = +(buckets.roundNumbers.length / total * 100).toFixed(1);
  const justBelowPct = +(buckets.justBelow.length / total * 100).toFixed(1);

  return {
    stats: {
      totalTransactions: total,
      justBelowThresholdPct: justBelowPct,
      roundNumberPct: roundPct,
      note: justBelowPct > 15 ? '⚠️ Unusually high share of invoices sit just below approval thresholds — classic structuring signal' : '✅ Threshold proximity looks normal',
    },
    justBelowThreshold: buckets.justBelow.sort((a, b) => a.gap - b.gap).slice(0, 50),
    roundNumbers: buckets.roundNumbers.slice(0, 50),
    repeatedAmounts: repeats,
  };
}

// ── Combined risk score per vendor ─────────────────────────────
function vendorRiskScores() {
  const db = getDb();
  const vendors = db.prepare('SELECT * FROM vendors').all();
  const txs = db.prepare('SELECT * FROM transactions').all();
  const cases = db.prepare("SELECT vendor_id, COUNT(*) as c FROM cases GROUP BY vendor_id").all();
  const caseMap = Object.fromEntries(cases.map(c => [c.vendor_id, c.c]));

  const byVendor = {};
  for (const t of txs) (byVendor[t.vendor_id] ||= []).push(t);

  const scores = vendors.map(v => {
    const list = byVendor[v.id] || [];
    const factors = [];
    let score = v.ghost_score || 0;
    factors.push({ name: 'Behavioral ghost score', value: score });

    const th = 100000;
    const justBelow = list.filter(t => t.amount < th && t.amount >= th * 0.95).length;
    if (list.length && justBelow / list.length > 0.3) { score += 15; factors.push({ name: 'Threshold stacking', value: 15 }); }

    const roundCount = list.filter(t => t.amount >= 10000 && t.amount % 10000 === 0).length;
    if (list.length && roundCount / list.length > 0.4) { score += 10; factors.push({ name: 'Round-number bias', value: 10 }); }

    if (!v.gstin || !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v.gstin)) {
      score += 20; factors.push({ name: 'Invalid GSTIN', value: 20 });
    }
    if (!v.address || v.address.length < 20) { score += 10; factors.push({ name: 'Incomplete address', value: 10 }); }
    if (v.bank_account && /^(.)\1+$/.test(v.bank_account)) { score += 15; factors.push({ name: 'Suspicious bank pattern', value: 15 }); }

    const openCases = caseMap[v.id] || 0;
    if (openCases) { score += Math.min(20, openCases * 5); factors.push({ name: `Open cases (${openCases})`, value: Math.min(20, openCases * 5) }); }

    score = Math.min(100, Math.round(score));
    return {
      vendorId: v.id, vendor: v.name, score,
      band: score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW',
      totalSpend: list.reduce((s, t) => s + t.amount, 0),
      txCount: list.length,
      factors,
    };
  });
  return scores.sort((a, b) => b.score - a.score);
}

module.exports = { benfordsLaw, duplicateInvoices, thresholdEvasion, vendorRiskScores, msmeDelayedPayments, complianceDrift, riskForecast, peerBenchmark, shadowProcurement };

// ── Tier 3: MSME Act Delayed Payment Detection (#31) ───────────
// MSMED Act 2006: suppliers must be paid within 45 days of invoice.
// Violations attract compound interest @ 3x bank rate + penalties.
function msmeDelayedPayments() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT t.id, t.invoice_number, t.amount, t.invoice_date, t.payment_date,
           v.name AS vendor_name, v.gstin
    FROM transactions t JOIN vendors v ON v.id = t.vendor_id
    WHERE t.invoice_date IS NOT NULL AND t.payment_date IS NOT NULL
  `).all();
  const violations = [];
  for (const r of rows) {
    const days = Math.round((new Date(r.payment_date) - new Date(r.invoice_date)) / 86400000);
    if (days > 45) {
      // Statutory interest: 3x annual bank rate (assume 12% => 36% p.a.), pro-rata on overdue amount
      const interest = +(r.amount * 0.36 * (days - 45) / 365).toFixed(2);
      violations.push({ ...r, days_taken: days, days_overdue: days - 45, estimated_interest_liability: interest });
    }
  }
  return { rule: 'MSMED Act 2006 — Section 16 (45-day payment)', total_violations: violations.length,
           total_interest_exposure: +violations.reduce((s, v) => s + v.estimated_interest_liability, 0).toFixed(2),
           violations: violations.sort((a, b) => b.days_overdue - a.days_overdue) };
}

// ── Tier 3: Compliance Drift Detection (#20) ───────────────────
// Monthly trend of flagged share + Benford MAD → gradual deterioration signal.
function complianceDrift() {
  const db = getDb();
  const months = db.prepare(`
    SELECT strftime('%Y-%m', invoice_date) AS month,
           COUNT(*) AS tx_count,
           SUM(is_flagged) AS flagged,
           AVG(CASE WHEN approval_threshold > 0 THEN amount * 1.0 / approval_threshold ELSE NULL END) AS threshold_ratio
    FROM transactions WHERE invoice_date IS NOT NULL
    GROUP BY month ORDER BY month
  `).all();
  const series = months.map(m => ({ ...m, flag_rate: m.tx_count ? +(m.flagged / m.tx_count).toFixed(3) : 0 }));
  let drift = 'STABLE';
  if (series.length >= 3) {
    const first = series.slice(0, Math.ceil(series.length / 2)).reduce((s, m) => s + m.flag_rate, 0);
    const last = series.slice(Math.ceil(series.length / 2)).reduce((s, m) => s + m.flag_rate, 0);
    const half = Math.floor(series.length / 2);
    if (last / (series.length - half) > (first / half) * 1.5) drift = 'DETERIORATING';
    else if (last / (series.length - half) < (first / half) * 0.6) drift = 'IMPROVING';
  }
  return { drift_status: drift, months: series };
}

// ── Tier 3: Financial Weather Forecast (#21) ───────────────────
// Naive linear projection of open-case count + flag rate over next 3 months.
function riskForecast() {
  const db = getDb();
  const cases = db.prepare(`
    SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS n
    FROM cases GROUP BY month ORDER BY month
  `).all();
  const y = cases.map(c => c.n);
  const forecast = [];
  if (y.length >= 2) {
    const n = y.length;
    const sx = n * (n - 1) / 2, sy = y.reduce((a, b) => a + b, 0);
    const sxy = y.reduce((s, v, i) => s + i * v, 0), sxx = n * (2 * n - 1) * (n - 1) / 6;
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
    const intercept = (sy - slope * sx) / n;
    for (let k = 1; k <= 3; k++) {
      forecast.push({ horizon: `month+${k}`, predicted_new_cases: Math.max(0, Math.round(intercept + slope * (n - 1 + k))) });
    }
  }
  let trend = 'INSUFFICIENT DATA';
  if (y.length >= 2) trend = slope > 0.5 ? 'RISING RISK' : slope < -0.5 ? 'CLEARING' : 'STEADY';
  return { trend, historical: cases, forecast, method: 'linear regression on monthly case volume' };
}

// ── Tier 3: Peer Benchmark Anomaly Detection (#19) ─────────────
// Compare each vendor's stats against the peer median/MAD across all vendors.
function peerBenchmark() {
  const db = getDb();
  const vendors = db.prepare('SELECT id, name FROM vendors').all();
  const stats = vendors.map(v => {
    const r = db.prepare(`SELECT COUNT(*) c, AVG(amount) avg_amt,
      SUM(CASE WHEN is_flagged=1 THEN 1 ELSE 0 END)*1.0/COUNT(*) flag_rate,
      AVG(julianday(payment_date)-julianday(invoice_date)) avg_days
      FROM transactions WHERE vendor_id=?`).get(v.id);
    return { vendor_id: v.id, vendor: v.name, tx_count: r.c, avg_amount: r.avg_amt, flag_rate: r.flag_rate, avg_payment_days: r.avg_days };
  }).filter(s => s.tx_count > 0);
  const med = (arr) => { const s = [...arr].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; };
  const benchmarks = {};
  for (const key of ['avg_amount', 'flag_rate', 'avg_payment_days']) {
    const vals = stats.map(s => s[key]).filter(v => v != null && !isNaN(v));
    const m = med(vals);
    const mad = med(vals.map(v => Math.abs(v - m))) || 1e-9;
    benchmarks[key] = { median: +m.toFixed(3), mad: +mad.toFixed(3) };
    for (const s of stats) {
      if (s[key] == null || isNaN(s[key])) continue;
      s[`${key}_peer_score`] = +(((s[key] - m) / (1.4826 * mad))).toFixed(2); // robust z-score
    }
  }
  const outliers = stats.filter(s => ['flag_rate', 'avg_amount', 'avg_payment_days']
    .some(k => Math.abs(s[`${k}_peer_score`] || 0) > 2));
  return { benchmarks, vendors: stats, outliers, note: 'robust z-score vs peer median; |score|>2 ⇒ anomaly' };
}

// ── Tier 3: Shadow Procurement Detector (#41) ──────────────────
// Heuristic: unverified vendors receiving above-median spend, or many small
// just-under-threshold invoices to a single payee ⇒ procurement-control bypass.
function shadowProcurement() {
  const db = getDb();
  const cols = db.prepare('PRAGMA table_info(vendors)').all().map(c => c.name);
  // Schema uses is_ghost (1 = unverified/ghost). Treat "not ghost" as verified.
  const ghostCol = cols.find(c => /ghost/i.test(c) && !/score/i.test(c));
  const verifiedExpr = ghostCol ? `CASE WHEN v.${ghostCol} = 1 THEN 0 ELSE 1 END` : '1';
  const rows = db.prepare(`
    SELECT v.id vendor_id, v.name, ${verifiedExpr} AS is_verified, COUNT(t.id) tx_count,
           SUM(t.amount) total_spend,
           SUM(CASE WHEN t.amount < t.approval_threshold AND t.amount >= t.approval_threshold*0.9 THEN 1 ELSE 0 END) near_threshold
    FROM vendors v JOIN transactions t ON t.vendor_id = v.id GROUP BY v.id
  `).all();
  const medianSpend = rows.map(r => r.total_spend).sort((a, b) => a - b)[Math.floor(rows.length / 2)] || 0;
  const suspects = rows.filter(r =>
    (!r.is_verified && r.total_spend > medianSpend) ||
    (r.tx_count >= 3 && r.near_threshold / r.tx_count > 0.5)
  ).map(r => ({
    vendor_id: r.vendor_id, vendor: r.name, is_verified: !!r.is_verified,
    total_spend: r.total_spend, near_threshold_invoices: r.near_threshold,
    reason: !r.is_verified && r.total_spend > medianSpend
      ? 'Unverified vendor with above-median spend'
      : 'Majority of invoices cluster just below approval threshold'
  }));
  return { policy: 'All purchases should route through verified vendors & respect approval thresholds', suspects };
}
