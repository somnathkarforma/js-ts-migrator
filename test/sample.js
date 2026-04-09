/**
 * @fileoverview Fintech utility module — TS·FORGE sample fixture
 * A realistic financial processing module exercising every JS type challenge.
 * @module fintech-utils
 */

// ── Symbols & WeakMap ─────────────────────────────────
const TRANSACTION_SYMBOL = Symbol('Transaction');
const _privateData = new WeakMap();

// ── Constants ─────────────────────────────────────────
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF'];
const MAX_TRANSFER_AMOUNT = 1_000_000;
const MIN_TRANSFER_AMOUNT = 0.01;
const RISK_SCORE_THRESHOLD = 75;

// ── Currency Formatter ────────────────────────────────
/**
 * Format a numeric amount as a currency string.
 * @param {number} amount - The amount to format
 * @param {string} [currency='USD'] - ISO 4217 currency code
 * @param {string} [locale='en-US'] - BCP 47 locale string
 * @returns {string} Formatted currency string
 */
const formatCurrency = (amount, currency = 'USD', locale = 'en-US') => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// ── Validation Functions ──────────────────────────────
/**
 * Validate a payment amount.
 * @param {number} amount
 * @returns {true|string} true if valid, error message if invalid
 */
function validateAmount(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return 'Amount must be a valid number';
  }
  if (amount < MIN_TRANSFER_AMOUNT) {
    return `Amount must be at least ${formatCurrency(MIN_TRANSFER_AMOUNT)}`;
  }
  if (amount > MAX_TRANSFER_AMOUNT) {
    return `Amount must not exceed ${formatCurrency(MAX_TRANSFER_AMOUNT)}`;
  }
  return true;
}

/**
 * Validate currency code.
 * @param {string} currency
 * @returns {boolean}
 */
const validateCurrency = (currency) =>
  typeof currency === 'string' && SUPPORTED_CURRENCIES.includes(currency.toUpperCase());

/**
 * Validate email address.
 */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '');
}

// ── Risk Scorer ───────────────────────────────────────
/**
 * Calculate a risk score for a transaction.
 * Intentionally ambiguous return — for @ts-review testing.
 * @param {Object} transaction
 * @param {number} transaction.amount
 * @param {string} transaction.fromCountry
 * @param {string} transaction.toCountry
 * @param {number} [transaction.velocityCount]
 */
function calculateRiskScore(transaction) {
  let score = 0;

  if (transaction.amount > 10_000) score += 20;
  if (transaction.amount > 50_000) score += 30;

  const highRiskCountries = ['XX', 'YY', 'ZZ'];
  if (highRiskCountries.includes(transaction.fromCountry)) score += 25;
  if (highRiskCountries.includes(transaction.toCountry))   score += 25;

  if ((transaction.velocityCount ?? 0) > 5) score += 15;

  // Intentionally ambiguous — could return number OR object
  if (score > RISK_SCORE_THRESHOLD) {
    return { score, level: 'HIGH', requiresReview: true };
  }
  return score;
}

// ── Base Entity Class ─────────────────────────────────
class BaseEntity {
  constructor(id) {
    this.id = id;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  get age() {
    return Math.floor((Date.now() - this.createdAt.getTime()) / 1000);
  }

  set updatedNow(value) {
    if (value === true) this.updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}

// ── Transaction Class ─────────────────────────────────
/**
 * Represents a financial transaction.
 * @extends BaseEntity
 */
class Transaction extends BaseEntity {
  /**
   * @param {string} id - Transaction ID
   * @param {string} fromUserId - Sender user ID
   * @param {string} toUserId - Recipient user ID
   * @param {number} amount - Transfer amount
   * @param {string} currency - ISO 4217 currency code
   * @param {Object} [metadata] - Optional transaction metadata
   */
  constructor(id, fromUserId, toUserId, amount, currency, metadata = {}) {
    super(id);
    this.fromUserId = fromUserId;
    this.toUserId = toUserId;
    this.amount = amount;
    this.currency = currency;
    this.status = 'pending';
    this.metadata = metadata;
    _privateData.set(this, { internalRef: `TXN-${Date.now()}` });
  }

  get internalRef() {
    return _privateData.get(this)?.internalRef;
  }

  toDisplayString() {
    return `[${this.id}] ${formatCurrency(this.amount, this.currency)} — ${this.status} (${this.fromUserId} → ${this.toUserId})`;
  }

  /**
   * Process this transaction via a payment gateway.
   * @param {Object} gateway - Payment gateway instance
   * @returns {Promise<{success: boolean, reference: string}>}
   */
  process(gateway) {
    return new Promise((resolve, reject) => {
      // Callback pattern — exercising async conversion challenge
      gateway.charge({ amount: this.amount, currency: this.currency }, (err, result) => {
        if (err) {
          this.status = 'failed';
          this.updatedNow = true;
          reject(err);
          return;
        }
        this.status = result.success ? 'complete' : 'failed';
        this.updatedNow = true;
        resolve(result);
      });
    });
  }

  toJSON() {
    return {
      ...super.toJSON(),
      fromUserId: this.fromUserId,
      toUserId: this.toUserId,
      amount: this.amount,
      currency: this.currency,
      status: this.status,
      metadata: this.metadata,
    };
  }
}

// ── Higher-Order Functions ────────────────────────────
/**
 * Creates a rate-limited version of a function.
 * @param {Function} fn - Function to rate-limit
 * @param {number} limitMs - Minimum milliseconds between calls
 * @returns {Function} Rate-limited function
 */
const rateLimit = (fn, limitMs) => {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall < limitMs) {
      return Promise.reject(new Error(`Rate limited: wait ${limitMs - (now - lastCall)}ms`));
    }
    lastCall = now;
    return fn.apply(this, args);
  };
};

/**
 * Memoize a pure function.
 * @template T
 * @param {function(...any): T} fn
 * @returns {function(...any): T}
 */
const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

// ── Array Processing ──────────────────────────────────
/**
 * Aggregate transaction statistics.
 * @param {Transaction[]} transactions
 * @param {string} currency
 * @returns {{total: number, avg: number, count: number, maxAmount: number}}
 */
function aggregateTransactions(transactions, currency) {
  const filtered = transactions.filter(t => t.currency === currency && t.status === 'complete');
  const amounts = filtered.map(t => t.amount);
  const total = amounts.reduce((sum, amt) => sum + amt, 0);
  const count = amounts.length;
  const avg = count > 0 ? total / count : 0;
  const maxAmount = count > 0 ? Math.max(...amounts) : 0;
  return { total, avg, count, maxAmount };
}

// ── IIFE — Module Init ────────────────────────────────
const fintechConfig = (() => {
  const config = {
    version: '1.0.0',
    maxRetries: 3,
    timeoutMs: 30_000,
    supportedCurrencies: [...SUPPORTED_CURRENCIES],
  };
  Object.freeze(config);
  return config;
})();

// ── Destructuring + Defaults ──────────────────────────
/**
 * Build a transfer request object from partial options.
 * @param {{ fromUserId: string, toUserId: string, amount: number, currency?: string, note?: string }} options
 * @returns {{ fromUserId: string, toUserId: string, amount: number, currency: string, note: string, createdAt: Date }}
 */
function buildTransferRequest({ fromUserId, toUserId, amount, currency = 'USD', note = '' }) {
  const amountValidation = validateAmount(amount);
  if (amountValidation !== true) throw new Error(amountValidation);
  if (!validateCurrency(currency)) throw new Error(`Unsupported currency: ${currency}`);
  return { fromUserId, toUserId, amount, currency: currency.toUpperCase(), note, createdAt: new Date() };
}

// ── Rest/Spread ───────────────────────────────────────
/**
 * Merge multiple transaction metadata objects.
 * @param {Object} base
 * @param {...Object} overrides
 * @returns {Object}
 */
function mergeMetadata(base, ...overrides) {
  return Object.assign({}, base, ...overrides);
}

// ── Computed Properties ───────────────────────────────
function buildAuditEntry(action, entityType, entityId, extra) {
  const timestamp = new Date().toISOString();
  return {
    [timestamp]: {
      action,
      [`${entityType}_id`]: entityId,
      ...extra,
    },
  };
}

// ── Template Literals ─────────────────────────────────
/**
 * Generate a human-readable transaction summary.
 * @param {Transaction} txn
 * @param {string} recipientName
 * @returns {string}
 */
const generateTxnSummary = (txn, recipientName) =>
  `Transaction ${txn.id} — ${formatCurrency(txn.amount, txn.currency)} sent to ${recipientName ?? 'Unknown Recipient'}.
  Status: ${txn.status.toUpperCase()}
  Initiated: ${txn.createdAt.toLocaleDateString()}`;

// ── Memoized Currency Converter ───────────────────────
const convertCurrency = memoize((amount, fromCurrency, toCurrency, rate) => {
  if (!validateCurrency(fromCurrency) || !validateCurrency(toCurrency)) {
    throw new TypeError('Invalid currency code');
  }
  return +(amount * rate).toFixed(2);
});

// ── Exports ───────────────────────────────────────────
export {
  Transaction,
  BaseEntity,
  formatCurrency,
  validateAmount,
  validateCurrency,
  validateEmail,
  calculateRiskScore,
  aggregateTransactions,
  buildTransferRequest,
  mergeMetadata,
  buildAuditEntry,
  generateTxnSummary,
  convertCurrency,
  rateLimit,
  memoize,
  fintechConfig,
  SUPPORTED_CURRENCIES,
  TRANSACTION_SYMBOL,
};

export default Transaction;
