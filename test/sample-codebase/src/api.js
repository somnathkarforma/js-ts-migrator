/**
 * @fileoverview Express REST API router for fintech-dashboard
 */
'use strict';

const express = require('express');
const auth = require('./auth');
const User = require('./models/user');
const Transaction = require('./models/transaction');
const PaymentService = require('./services/paymentService');
const { validateAmount, validateEmail } = require('./utils/validators');

const router = express.Router();
const paymentService = new PaymentService();

// ── Request Validation Middleware ─────────────────────
function validateContentType(req, res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }
  next();
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  const payload = auth.verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = payload;
  next();
}

function validatePagination(req, res, next) {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  req.pagination = { page, limit, offset: (page - 1) * limit };
  next();
}

// ── GET /users ────────────────────────────────────────
router.get('/users', requireAuth, validatePagination, async (req, res) => {
  try {
    // In a real app, this would query a database
    const users = await User.findAll({ limit: req.pagination.limit, offset: req.pagination.offset });
    res.json({
      data: users.map(u => u.toSafeObject()),
      pagination: {
        page: req.pagination.page,
        limit: req.pagination.limit,
        total: users.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /transactions ────────────────────────────────
router.post('/transactions', requireAuth, validateContentType, async (req, res, next) => {
  try {
    const { fromUserId, toUserId, amount, currency, note } = req.body;

    // Validate required fields
    if (!fromUserId || !toUserId) {
      return res.status(400).json({ error: 'fromUserId and toUserId are required' });
    }

    const amountCheck = validateAmount(amount);
    if (amountCheck !== true) {
      return res.status(400).json({ error: amountCheck });
    }

    // Authorization check — users may only initiate from their own account
    if (req.user.userId !== fromUserId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to transfer from this account' });
    }

    const result = await paymentService.initiateTransfer({
      fromUserId,
      toUserId,
      amount: parseFloat(amount),
      currency: currency || 'USD',
      note: note || '',
    });

    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

// ── GET /balance/:userId ──────────────────────────────
router.get('/balance/:userId', requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Users can only view their own balance (or admin can view any)
    if (req.user.userId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const history = await paymentService.getTransactionHistory(userId, { limit: 5 });

    res.json({
      userId: user.id,
      balance: user.balance,
      currency: user.currency || 'USD',
      recentTransactions: history,
    });
  } catch (err) {
    next(err);
  }
});

// ── Error Handling Middleware ─────────────────────────
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Do not leak stack traces in non-development environments
  const body = { error: message };
  if (process.env.NODE_ENV === 'development') {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

router.use(errorHandler);

module.exports = router;
