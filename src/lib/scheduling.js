// Whether a recurring class is within its active term on a given date (YYYY-MM-DD).
// Null start/end means open-ended in that direction. String comparison works fine
// since both are ISO 8601 dates.
export function isClassActiveOn(cls, dateStr) {
  if (cls.start_date && dateStr < cls.start_date) return false;
  if (cls.end_date && dateStr > cls.end_date) return false;
  return true;
}
