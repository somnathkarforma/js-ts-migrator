/**
 * @fileoverview JWT-based authentication utilities for fintech-dashboard
 */
'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const BCRYPT_ROUNDS = 12;

/**
 * Generate a signed JWT token for a user.
 * @param {{ userId: string, email: string, role: string }} payload
 * @returns {string} Signed JWT token
 */
function generateToken(payload) {
  return jwt.sign(
    { userId: payload.userId, email: payload.email, role: payload.role || 'user' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, issuer: 'fintech-dashboard' }
  );
}

/**
 * Verify a JWT token and return its payload.
 * @param {string} token
 * @returns {{ userId: string, email: string, role: string } | null}
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, { issuer: 'fintech-dashboard' });
  } catch (err) {
    return null;
  }
}

/**
 * Hash a plain-text password.
 * Uses a callback pattern (for @ts-review async conversion testing).
 * @param {string} plainPassword
 * @param {function(Error|null, string|undefined): void} callback
 */
function hashPassword(plainPassword, callback) {
  bcrypt.genSalt(BCRYPT_ROUNDS, function (saltErr, salt) {
    if (saltErr) {
      callback(saltErr, undefined);
      return;
    }
    bcrypt.hash(plainPassword, salt, function (hashErr, hash) {
      if (hashErr) {
        callback(hashErr, undefined);
        return;
      }
      callback(null, hash);
    });
  });
}

/**
 * Compare a plain-text password against a bcrypt hash.
 * Returns a Promise.
 * @param {string} plainPassword
 * @param {string} hashedPassword
 * @returns {Promise<boolean>}
 */
function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Wrap hashPassword in a Promise for convenience.
 * Exercises mixed async patterns.
 * @param {string} plainPassword
 * @returns {Promise<string>}
 */
function hashPasswordAsync(plainPassword) {
  return new Promise((resolve, reject) => {
    hashPassword(plainPassword, (err, hash) => {
      if (err) reject(err);
      else resolve(hash);
    });
  });
}

/**
 * Decode a token without verifying its signature.
 * Used for reading headers when signature verification is not required.
 * @param {string} token
 * @returns {Object|null}
 */
function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  hashPasswordAsync,
  decodeToken,
};
