export function wholeUnits(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil(n);
}

export function restockShortfalls(rows = []) {
  const totals = {};
  for (const row of rows || []) {
    const key = String(row?.product_key || '').trim();
    if (!key) continue;
    const units = wholeUnits(row?.shortfall_units);
    if (!units) continue;
    totals[key] = (totals[key] || 0) + units;
  }
  return totals;
}

export function hydratePacks(servings, packSize = 10) {
  const units = wholeUnits(servings);
  const size = wholeUnits(packSize) || 10;
  return units ? Math.ceil(units / size) : 0;
}

export function restockBasketUnits(shortfalls = {}) {
  return (
    wholeUnits(shortfalls.bottle_mix) +
    wholeUnits(shortfalls.energy_gel) +
    wholeUnits(shortfalls.boost_gel) +
    hydratePacks(shortfalls.hydrate) +
    wholeUnits(shortfalls.recover)
  );
}
