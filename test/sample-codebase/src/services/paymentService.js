/**
 * @fileoverview PaymentService — core business logic for financial transfers
 */
'use strict';

const Transaction = require('../models/transaction');

const BASE_FEE_RATE = 0.005; // 0.5%
const MIN_FEE = 0.25;
const CROSS_CURRENCY_SURCHARGE = 0.015; // 1.5%

class PaymentService {
  constructor(gateway, userRepository, transactionRepository) {
    // Intentionally ambiguous types — gateway/repo interfaces not defined in JS
    this.gateway = gateway || null;
    this.userRepo = userRepository || null;
    this.txnRepo = transactionRepository || null;
    this._inProgress = new Map();
  }

  /**
   * Initiate a transfer between two users.
   * @param {{ fromUserId: string, toUserId: string, amount: number, currency: string, note?: string }} params
   * @returns {Promise<{ transactionId: string, status: string, fees: number }>}
   */
  async initiateTransfer(params) {
    const { fromUserId, toUserId, amount, currency, note } = params;

    if (this._inProgress.has(fromUserId)) {
      throw new Error('Another transfer is already in progress for this user');
    }

    this._inProgress.set(fromUserId, true);
    try {
      const fees = this.calculateFees(amount, currency, currency);
      const txnId = `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      const txn = new Transaction(txnId, fromUserId, toUserId, amount, currency, { note, fees });

      if (this.gateway) {
        await txn.process(this.gateway);
      } else {
        // No gateway provided — stub mode
        txn.status = 'complete';
        txn.processedAt = new Date();
      }

      return { transactionId: txnId, status: txn.status, fees };
    } finally {
      this._inProgress.delete(fromUserId);
    }
  }

  /**
   * Process a payment synchronously (legacy callback interface).
   * @param {string} txnId
   * @param {function(Error|null, Object|undefined): void} callback
   */
  processPayment(txnId, callback) {
    if (!this.txnRepo) {
      callback(new Error('No transaction repository configured'), undefined);
      return;
    }
    this.txnRepo.findById(txnId)
      .then(txn => {
        if (!txn) {
          callback(new Error(`Transaction ${txnId} not found`), undefined);
          return;
        }
        return txn.process(this.gateway)
          .then(() => callback(null, txn.toJSON()))
          .catch(err => callback(err, undefined));
      })
      .catch(err => callback(err, undefined));
  }

  /**
   * Refund a completed transaction.
   * @param {string} txnId
   * @param {string} reason
   * @returns {Promise<Object>}
   */
  async refundTransaction(txnId, reason) {
    if (!this.txnRepo) throw new Error('No transaction repository');
    const txn = await this.txnRepo.findById(txnId);
    if (!txn) throw new Error(`Transaction ${txnId} not found`);

    const refundTxn = await txn.refund(this.gateway, reason);
    return refundTxn.toJSON();
  }

  /**
   * Retrieve transaction history for a user.
   * @param {string} userId
   * @param {{ limit?: number, offset?: number, currency?: string }} [options]
   * @returns {Promise<Object[]>}
   */
  async getTransactionHistory(userId, options = {}) {
    const { limit = 20, offset = 0, currency } = options;

    if (!this.txnRepo) {
      // Return empty array when no repo — graceful degradation
      return [];
    }

    const transactions = await this.txnRepo.findByUserId(userId, { limit, offset });
    return transactions
      .filter(t => !currency || t.currency === currency)
      .map(t => t.toJSON());
  }

  /**
   * Calculate transfer fees.
   * @param {number} amount
   * @param {string} fromCurrency
   * @param {string} toCurrency
   * @returns {number} Fee amount
   */
  calculateFees(amount, fromCurrency, toCurrency) {
    let rate = BASE_FEE_RATE;
    if (fromCurrency !== toCurrency) {
      rate += CROSS_CURRENCY_SURCHARGE;
    }
    const fee = amount * rate;
    return Math.max(fee, MIN_FEE);
  }

  /**
   * Get fee breakdown for display.
   * Intentionally returns a loosely-typed object — tests @ts-review.
   * @param {number} amount
   * @param {string} fromCurrency
   * @param {string} toCurrency
   */
  getFeeBreakdown(amount, fromCurrency, toCurrency) {
    const baseFee = amount * BASE_FEE_RATE;
    const surcharge = fromCurrency !== toCurrency ? amount * CROSS_CURRENCY_SURCHARGE : 0;
    const total = Math.max(baseFee + surcharge, MIN_FEE);
    return {
      baseFee: +baseFee.toFixed(2),
      surcharge: +surcharge.toFixed(2),
      total: +total.toFixed(2),
      // This dynamic key demonstrates a type challenge
      [`${fromCurrency}_to_${toCurrency}_rate`]: BASE_FEE_RATE + (surcharge > 0 ? CROSS_CURRENCY_SURCHARGE : 0),
    };
  }
}

module.exports = PaymentService;
