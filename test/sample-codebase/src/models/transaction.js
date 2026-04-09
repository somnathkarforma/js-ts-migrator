/**
 * @fileoverview Transaction model for fintech-dashboard
 */
'use strict';

const EventEmitter = require('events');

const VALID_STATUSES = ['pending', 'processing', 'complete', 'failed', 'refunded'];
const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CHF'];

class Transaction extends EventEmitter {
  /**
   * @param {string} id
   * @param {string} fromUserId
   * @param {string} toUserId
   * @param {number} amount
   * @param {string} currency
   * @param {Object} [metadata]
   */
  constructor(id, fromUserId, toUserId, amount, currency, metadata = {}) {
    super();
    this.id = id;
    this.fromUserId = fromUserId;
    this.toUserId = toUserId;
    this.amount = amount;
    this.currency = currency;
    this.status = 'pending';
    this.metadata = metadata;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.processedAt = null;
    this.refundedAt = null;
    this.failureReason = null;
  }

  /**
   * Process the transaction.
   * @param {Object} gateway - Payment gateway
   * @returns {Promise<void>}
   */
  async process(gateway) {
    if (this.status !== 'pending') {
      throw new Error(`Cannot process transaction in status: ${this.status}`);
    }
    this.status = 'processing';
    this.updatedAt = new Date();
    this.emit('statusChange', { id: this.id, status: 'processing' });

    try {
      const result = await gateway.charge({
        amount: this.amount,
        currency: this.currency,
        reference: this.id,
      });
      this.status = 'complete';
      this.processedAt = new Date();
      this.updatedAt = new Date();
      this.metadata.gatewayRef = result.reference;
      this.emit('statusChange', { id: this.id, status: 'complete' });
      this.emit('processed', this);
    } catch (err) {
      this.status = 'failed';
      this.failureReason = err.message;
      this.updatedAt = new Date();
      this.emit('statusChange', { id: this.id, status: 'failed' });
      this.emit('failed', { id: this.id, reason: err.message });
      throw err;
    }
  }

  /**
   * Refund a completed transaction.
   * @param {Object} gateway
   * @param {string} reason
   * @returns {Promise<Transaction>} The refund transaction
   */
  async refund(gateway, reason) {
    if (this.status !== 'complete') {
      throw new Error(`Cannot refund transaction with status: ${this.status}`);
    }
    const refundResult = await gateway.refund({
      originalReference: this.metadata.gatewayRef,
      amount: this.amount,
      reason,
    });

    this.status = 'refunded';
    this.refundedAt = new Date();
    this.updatedAt = new Date();
    this.emit('refunded', this);

    // Return a new transaction representing the refund
    const refundTxn = new Transaction(
      refundResult.refundId,
      this.toUserId,
      this.fromUserId,
      this.amount,
      this.currency,
      { originalTxnId: this.id, reason, refund: true }
    );
    return refundTxn;
  }

  /**
   * Get a human-readable display string.
   * @returns {string}
   */
  toDisplayString() {
    const statusEmoji = {
      pending:    '⏳',
      processing: '🔄',
      complete:   '✅',
      failed:     '❌',
      refunded:   '↩️',
    };
    const emoji = statusEmoji[this.status] || '?';
    return `${emoji} [${this.id}] ${this.amount} ${this.currency} | ${this.fromUserId} → ${this.toUserId} | ${this.status}`;
  }

  /**
   * Check if the transaction is settled (terminal state).
   * @returns {boolean}
   */
  isSettled() {
    return ['complete', 'failed', 'refunded'].includes(this.status);
  }

  toJSON() {
    return {
      id: this.id,
      fromUserId: this.fromUserId,
      toUserId: this.toUserId,
      amount: this.amount,
      currency: this.currency,
      status: this.status,
      metadata: this.metadata,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      processedAt: this.processedAt?.toISOString() ?? null,
      refundedAt: this.refundedAt?.toISOString() ?? null,
      failureReason: this.failureReason,
    };
  }
}

module.exports = Transaction;
