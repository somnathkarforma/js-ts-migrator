/**
 * @fileoverview User model for fintech-dashboard
 */
'use strict';

class User {
  /**
   * @param {string} id
   * @param {string} email
   * @param {string} name
   * @param {number} balance
   * @param {string} [currency]
   * @param {string} [passwordHash]
   * @param {Date} [createdAt]
   */
  constructor(id, email, name, balance, currency = 'USD', passwordHash = null, createdAt = new Date()) {
    this.id = id;
    this.email = email;
    this.name = name;
    this.balance = balance;
    this.currency = currency;
    this.passwordHash = passwordHash;
    this.createdAt = createdAt;
    this.updatedAt = new Date();
    this.isActive = true;
    this.role = 'user';
  }

  /**
   * Create a User from a raw database row.
   * @param {{ id: string, email: string, name: string, balance: number, currency?: string, password_hash?: string, created_at?: string }} row
   * @returns {User}
   */
  static fromDatabase(row) {
    return new User(
      row.id,
      row.email,
      row.name,
      parseFloat(row.balance) || 0,
      row.currency || 'USD',
      row.password_hash || null,
      row.created_at ? new Date(row.created_at) : new Date()
    );
  }

  /**
   * Find all users (stub — would query DB in production).
   * @param {{ limit?: number, offset?: number }} options
   * @returns {Promise<User[]>}
   */
  static async findAll(options = {}) {
    // Stub implementation
    return [];
  }

  /**
   * Find a user by ID.
   * @param {string} id
   * @returns {Promise<User|null>}
   */
  static async findById(id) {
    // Stub implementation
    return null;
  }

  /**
   * Find a user by email.
   * @param {string} email
   * @returns {Promise<User|null>}
   */
  static async findByEmail(email) {
    // Stub implementation
    return null;
  }

  /**
   * Return a safe user object excluding the password hash.
   * @returns {{ id: string, email: string, name: string, balance: number, currency: string, createdAt: string, isActive: boolean, role: string }}
   */
  toSafeObject() {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      balance: this.balance,
      currency: this.currency,
      createdAt: this.createdAt.toISOString(),
      isActive: this.isActive,
      role: this.role,
    };
  }

  /**
   * Validate user fields.
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate() {
    const errors = [];
    if (!this.id) errors.push('id is required');
    if (!this.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) errors.push('valid email is required');
    if (!this.name || this.name.trim().length < 2) errors.push('name must be at least 2 characters');
    if (typeof this.balance !== 'number' || isNaN(this.balance)) errors.push('balance must be a number');
    if (this.balance < 0) errors.push('balance must not be negative');
    return { valid: errors.length === 0, errors };
  }

  /**
   * Update the user's balance.
   * @param {number} delta - Amount to add (positive) or subtract (negative)
   * @returns {boolean} Whether the update was successful
   */
  updateBalance(delta) {
    const newBalance = this.balance + delta;
    if (newBalance < 0) return false;
    this.balance = +newBalance.toFixed(2);
    this.updatedAt = new Date();
    return true;
  }
}

module.exports = User;
