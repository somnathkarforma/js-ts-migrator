/**
 * @fileoverview Input validators — returns true or an error message string
 * Return type `true | string` is intentional for @ts-review.
 */
'use strict';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IBAN_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/;
const SUPPORTED_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'SGD']);
const LUHN_STRIP_RE = /\D/g;

/**
 * @param {string} email
 * @returns {true | string}
 */
function validateEmail(email) {
  if (typeof email !== 'string' || !email.trim()) return 'Email is required';
  if (!EMAIL_RE.test(email.trim())) return 'Email address is invalid';
  if (email.length > 254) return 'Email address is too long';
  return true;
}

/**
 * @param {number|string} amount
 * @param {{ min?: number, max?: number }} [opts]
 * @returns {true | string}
 */
function validateAmount(amount, opts = {}) {
  const { min = 0.01, max = 1_000_000 } = opts;
  const n = Number(amount);
  if (!Number.isFinite(n)) return 'Amount must be a number';
  if (n < min) return `Amount must be at least ${min}`;
  if (n > max) return `Amount must not exceed ${max}`;
  if (!/^\d+(\.\d{1,2})?$/.test(String(n))) return 'Amount must have at most 2 decimal places';
  return true;
}

/**
 * @param {string} currency
 * @returns {true | string}
 */
function validateCurrency(currency) {
  if (typeof currency !== 'string') return 'Currency must be a string';
  const code = currency.trim().toUpperCase();
  if (!SUPPORTED_CURRENCIES.has(code)) {
    return `Unsupported currency: ${code}. Supported: ${[...SUPPORTED_CURRENCIES].join(', ')}`;
  }
  return true;
}

/**
 * Validates an IBAN using mod-97 checksum.
 * @param {string} iban
 * @returns {true | string}
 */
function validateIBAN(iban) {
  if (typeof iban !== 'string') return 'IBAN must be a string';
  const normalized = iban.replace(/\s/g, '').toUpperCase();
  if (!IBAN_RE.test(normalized)) return 'IBAN format is invalid';

  // Mod-97 check
  const rearranged = normalized.slice(4) + normalized.slice(0, 4);
  const numeric = rearranged
    .split('')
    .map(ch => (ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch))
    .join('');

  let remainder = 0;
  for (const chunk of numeric.match(/.{1,7}/g) || []) {
    remainder = (parseInt(String(remainder) + chunk, 10)) % 97;
  }
  if (remainder !== 1) return 'IBAN checksum is invalid';
  return true;
}

/**
 * Validates a credit/debit card number using the Luhn algorithm.
 * @param {string|number} cardNumber
 * @returns {true | string}
 */
function validateCreditCard(cardNumber) {
  const digits = String(cardNumber).replace(LUHN_STRIP_RE, '');
  if (digits.length < 13 || digits.length > 19) return 'Card number length is invalid';

  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  if (sum % 10 !== 0) return 'Card number is invalid (Luhn check failed)';
  return true;
}

/**
 * Validates a transfer request object — returns array of errors.
 * @param {{ fromUserId: string, toUserId: string, amount: number, currency: string, note?: string }} transfer
 * @returns {string[]} Empty array means valid
 */
function validateTransfer(transfer) {
  const errors = [];
  if (!transfer.fromUserId) errors.push('fromUserId is required');
  if (!transfer.toUserId) errors.push('toUserId is required');
  if (transfer.fromUserId === transfer.toUserId) errors.push('Cannot transfer to yourself');

  const amtResult = validateAmount(transfer.amount);
  if (amtResult !== true) errors.push(amtResult);

  const currResult = validateCurrency(transfer.currency);
  if (currResult !== true) errors.push(currResult);

  if (transfer.note && transfer.note.length > 200) errors.push('Note must be 200 characters or fewer');

  return errors;
}

module.exports = {
  validateEmail,
  validateAmount,
  validateCurrency,
  validateIBAN,
  validateCreditCard,
  validateTransfer,
};
