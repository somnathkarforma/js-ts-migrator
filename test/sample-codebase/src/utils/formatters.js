/**
 * @fileoverview Pure formatting utilities — no side effects
 */
'use strict';

const ONE_MINUTE = 60 * 1000;
const ONE_HOUR   = 60 * ONE_MINUTE;
const ONE_DAY    = 24 * ONE_HOUR;
const ONE_WEEK   = 7  * ONE_DAY;
const ONE_YEAR   = 365.25 * ONE_DAY;

/**
 * Format a monetary amount with locale-aware number formatting.
 * @param {number} amount
 * @param {string} currency  ISO 4217 code e.g. 'USD'
 * @param {string} [locale]  BCP 47 locale tag, defaults to 'en-US'
 * @returns {string}
 */
function formatCurrency(amount, currency, locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback for unknown currency codes
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Format a Date as a relative time string (e.g. "3 minutes ago").
 * Falls back to absolute format if the date is too old.
 * @param {Date|string|number} date
 * @param {Date} [now]  Inject current time for testing
 * @returns {string}
 */
function formatRelativeDate(date, now = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'Invalid date';

  const diff = now.getTime() - d.getTime();

  if (diff < ONE_MINUTE)    return 'just now';
  if (diff < ONE_HOUR)      return `${Math.floor(diff / ONE_MINUTE)} minute${diff < 2 * ONE_MINUTE ? '' : 's'} ago`;
  if (diff < ONE_DAY)       return `${Math.floor(diff / ONE_HOUR)} hour${diff < 2 * ONE_HOUR ? '' : 's'} ago`;
  if (diff < ONE_WEEK)      return `${Math.floor(diff / ONE_DAY)} day${diff < 2 * ONE_DAY ? '' : 's'} ago`;
  if (diff < ONE_YEAR)      return formatAbsoluteDate(d, { month: 'short', day: 'numeric' });
  return formatAbsoluteDate(d);
}

/**
 * Format a Date as an absolute string.
 * @param {Date|string|number} date
 * @param {Intl.DateTimeFormatOptions} [opts]
 * @param {string} [locale]
 * @returns {string}
 */
function formatAbsoluteDate(date, opts = { year: 'numeric', month: 'short', day: 'numeric' }, locale = 'en-US') {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat(locale, opts).format(d);
}

/**
 * Format an IBAN with spaces every 4 characters for readability.
 * @param {string} iban
 * @returns {string}
 */
function formatIBAN(iban) {
  if (!iban || typeof iban !== 'string') return '';
  return iban.replace(/\s/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Format a large number with SI suffixes (K, M, B).
 * @param {number} value
 * @param {number} [precision]
 * @returns {string}
 */
function formatCompactNumber(value, precision = 1) {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(precision)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(precision)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(precision)}K`;
  return `${sign}${abs.toFixed(precision)}`;
}

/**
 * Mask all but the last 4 characters of a sensitive string.
 * @param {string} value
 * @param {number} [visibleChars]
 * @returns {string}
 */
function maskSensitive(value, visibleChars = 4) {
  if (!value || typeof value !== 'string') return '';
  if (value.length <= visibleChars) return '*'.repeat(value.length);
  return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
}

module.exports = {
  formatCurrency,
  formatRelativeDate,
  formatAbsoluteDate,
  formatIBAN,
  formatCompactNumber,
  maskSensitive,
};
