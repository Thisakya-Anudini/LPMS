const normalizeDurationUnit = (unit) => {
  const normalized = String(unit || '').trim().toLowerCase();
  if (!normalized) {
    return 'years';
  }

  if (['hour', 'hours', 'hr', 'hrs'].includes(normalized)) {
    return 'hours';
  }

  if (['day', 'days', 'date', 'dates'].includes(normalized)) {
    return 'days';
  }

  if (['week', 'weeks'].includes(normalized)) {
    return 'weeks';
  }

  if (['month', 'months'].includes(normalized)) {
    return 'months';
  }

  if (['year', 'years', 'yr', 'yrs'].includes(normalized)) {
    return 'years';
  }

  return normalized;
};

export const parseTotalDurationValue = (value) => {
  const normalized = String(value || '').trim();
  if (normalized === '') {
    return { valid: true };
  }

  if (normalized.startsWith('-')) {
    return { valid: false, message: 'totalDuration must not be negative.' };
  }

  const durationMatch = normalized.match(/^[+-]?\s*([0-9]+(?:\.[0-9]+)?)\s*(hours?|hrs?|days?|dates?|weeks?|months?|years?|yrs?)\s*$/i);
  if (!durationMatch) {
    return {
      valid: false,
      message: 'totalDuration format is invalid. Use a numeric value with hours, days, weeks, months, or years.'
    };
  }

  const numericValue = Number(durationMatch[1]);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return { valid: false, message: 'totalDuration must be a valid non-negative number.' };
  }

  return { valid: true };
};

export const parseDurationParts = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return { value: '', unit: 'months' };
  }

  const durationMatch = normalized.match(/^([0-9]+(?:\.[0-9]+)?)\s*(hours?|hrs?|days?|dates?|weeks?|months?|years?|yrs?)?\s*$/i);
  if (!durationMatch) {
    return { value: normalized, unit: 'months' };
  }

  const numberPart = durationMatch[1];
  const unitPart = normalizeDurationUnit(durationMatch[2]);

  return {
    value: numberPart,
    unit: unitPart
  };
};

export const formatDurationValue = (value, unit) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return '';
  }

  const normalizedUnit = normalizeDurationUnit(unit);
  return `${normalizedValue} ${normalizedUnit}`;
};
