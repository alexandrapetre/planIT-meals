/**
 * Parse measure strings like "1 cup", "2 tbsp", "500g", "1/2".
 * Returns { quantity, unit } with graceful fallbacks.
 */
function parseMeasure(measure) {
  if (!measure || typeof measure !== 'string') {
    return { quantity: 1, unit: '' };
  }
  const raw = measure.trim();
  if (!raw) return { quantity: 1, unit: '' };

  const fractionMatch = raw.match(/^(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if (fractionMatch) {
    const num = Number(fractionMatch[1]);
    const den = Number(fractionMatch[2]);
    const quantity = den > 0 ? +(num / den).toFixed(3) : 1;
    return { quantity, unit: (fractionMatch[3] || '').trim() || '' };
  }

  const mixedMatch = raw.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const num = Number(mixedMatch[2]);
    const den = Number(mixedMatch[3]);
    const quantity = den > 0 ? +(whole + num / den).toFixed(3) : whole;
    return { quantity, unit: (mixedMatch[4] || '').trim() || '' };
  }

  const numMatch = raw.match(/^([0-9]+(?:\.[0-9]+)?)\s*(.*)$/);
  if (numMatch) {
    return {
      quantity: Number(numMatch[1]) || 1,
      unit: (numMatch[2] || '').trim(),
    };
  }

  return { quantity: 1, unit: raw };
}

module.exports = { parseMeasure };
