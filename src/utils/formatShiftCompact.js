/**
 * UI-only formatter for compact shift display.
 *
 * Goal examples:
 * - "07:00–19:00" -> "07–19"
 * - "07:00-19:00" -> "07–19"
 * - "7-19" -> "07–19"
 * - "19-7" -> "19–07"
 *
 * Rules:
 * - remove ":00" minutes
 * - no spaces
 * - use en dash (–)
 * - if no shift => return empty string
 * - keep non-time codes like "0" / "U" as-is
 */
export const formatShiftCompact = shiftInput => {
  if (shiftInput === null || shiftInput === undefined) return '';

  // Support objects like { start, end } / { from, to } and arrays [start, end]
  if (Array.isArray(shiftInput)) {
    const [start, end] = shiftInput;
    return formatShiftCompact({ start, end });
  }

  if (typeof shiftInput === 'object') {
    const start =
      shiftInput.start ??
      shiftInput.from ??
      shiftInput.begin ??
      shiftInput.startTime ??
      shiftInput.timeFrom;
    const end =
      shiftInput.end ??
      shiftInput.to ??
      shiftInput.finish ??
      shiftInput.endTime ??
      shiftInput.timeTo;
    if (start == null || end == null) return '';
    return formatShiftCompact(`${start}-${end}`);
  }

  if (typeof shiftInput !== 'string') return '';

  const raw = shiftInput.trim();
  if (!raw) return '';

  // Keep special non-time codes unchanged.
  if (raw === '0') return '0';
  if (raw.toUpperCase() === 'U') return 'U';

  // Normalize: remove spaces, normalize various dashes to a simple hyphen
  const normalized = raw.replace(/\s+/g, '').replace(/[–—−]/g, '-');
  const parts = normalized.split('-');
  if (parts.length < 2) return raw;

  const [startRaw, endRaw] = parts;

  const parseTimePart = part => {
    const m = String(part).match(/^(\d{1,2})(?::(\d{1,2}))?/);
    if (!m) return null;
    const hh = String(Number(m[1])).padStart(2, '0');
    const mm = m[2] ? String(Number(m[2])).padStart(2, '0') : null;
    if (!mm || mm === '00') return hh;
    return `${hh}:${mm}`;
  };

  const start = parseTimePart(startRaw);
  const end = parseTimePart(endRaw);
  if (!start || !end) return raw;

  return `${start}–${end}`;
};
