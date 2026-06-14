/**
 * Format a Date object to "YYYY-MM-DDTHH:mm" format for datetime-local input
 * Handles timezone by using local time components
 * 
 * @param {Date} date - Date object to format (defaults to current time)
 * @returns {string} - Formatted string suitable for datetime-local input
 */
export function formatLocalDateTime(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
