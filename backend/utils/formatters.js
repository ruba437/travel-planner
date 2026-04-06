function toISODate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function toHHmm(value) {
  if (!value && value !== 0) return null;
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d{1,2}):(\d{2})/);
    if (m) {
      const hh = Number(m[1]);
      const mm = Number(m[2]);
      if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      }
    }
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}



module.exports = { toISODate, toHHmm };