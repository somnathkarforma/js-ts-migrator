/**
 * @fileoverview Dashboard React component — PropTypes to be converted to TypeScript interfaces
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { formatCurrency, formatRelativeDate, maskSensitive } from '../utils/formatters';
import { validateTransfer } from '../utils/validators';

// ─── Sub-components ──────────────────────────────────────────────────────────

function BalanceCard({ balance, currency, accountId, isLoading }) {
  return (
    <div className="balance-card" role="region" aria-label="Account balance">
      <p className="balance-card__account">{maskSensitive(accountId)}</p>
      {isLoading ? (
        <span className="skeleton" aria-busy="true" />
      ) : (
        <p className="balance-card__amount">{formatCurrency(balance, currency)}</p>
      )}
    </div>
  );
}

BalanceCard.propTypes = {
  balance: PropTypes.number.isRequired,
  currency: PropTypes.string.isRequired,
  accountId: PropTypes.string.isRequired,
  isLoading: PropTypes.bool,
};

BalanceCard.defaultProps = {
  isLoading: false,
};

// ─────────────────────────────────────────────────────────────────────────────

function TransactionRow({ transaction, onSelect }) {
  const handleClick = useCallback(() => onSelect(transaction), [onSelect, transaction]);
  const handleKeyDown = useCallback(
    /** @param {React.KeyboardEvent} e */ (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(transaction);
      }
    },
    [onSelect, transaction]
  );

  const isDebit = transaction.type === 'debit';

  return (
    <div
      className={`txn-row txn-row--${isDebit ? 'debit' : 'credit'}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${transaction.description}, ${formatCurrency(transaction.amount, transaction.currency)}`}
    >
      <span className="txn-row__description">{transaction.description}</span>
      <span className="txn-row__date">{formatRelativeDate(transaction.createdAt)}</span>
      <span className="txn-row__amount">
        {isDebit ? '−' : '+'}{formatCurrency(transaction.amount, transaction.currency)}
      </span>
      <span className={`txn-row__status txn-row__status--${transaction.status}`}>
        {transaction.status}
      </span>
    </div>
  );
}

TransactionRow.propTypes = {
  transaction: PropTypes.shape({
    id: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    amount: PropTypes.number.isRequired,
    currency: PropTypes.string.isRequired,
    type: PropTypes.oneOf(['debit', 'credit']).isRequired,
    status: PropTypes.string.isRequired,
    createdAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]).isRequired,
  }).isRequired,
  onSelect: PropTypes.func.isRequired,
};

// ─────────────────────────────────────────────────────────────────────────────

function TransferForm({ currencies, onSubmit, isSubmitting }) {
  const [form, setForm] = useState({
    toUserId: '',
    amount: '',
    currency: currencies[0] || 'USD',
    note: '',
  });
  const [errors, setErrors] = useState([]);

  /** @param {React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>} e */
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }, []);

  /** @param {React.FormEvent<HTMLFormElement>} e */
  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    const validationErrors = validateTransfer({
      fromUserId: 'CURRENT_USER', // placeholder — resolved by parent
      toUserId: form.toUserId,
      amount: Number(form.amount),
      currency: form.currency,
      note: form.note,
    });
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    onSubmit({ ...form, amount: Number(form.amount) });
  }, [form, onSubmit]);

  return (
    <form className="transfer-form" onSubmit={handleSubmit} noValidate>
      <h2 className="transfer-form__title">Send Money</h2>
      {errors.length > 0 && (
        <ul className="transfer-form__errors" role="alert">
          {errors.map(err => <li key={err}>{err}</li>)}
        </ul>
      )}
      <label htmlFor="toUserId">Recipient ID</label>
      <input
        id="toUserId"
        name="toUserId"
        type="text"
        value={form.toUserId}
        onChange={handleChange}
        required
        autoComplete="off"
      />
      <label htmlFor="amount">Amount</label>
      <input
        id="amount"
        name="amount"
        type="number"
        min="0.01"
        step="0.01"
        value={form.amount}
        onChange={handleChange}
        required
      />
      <label htmlFor="currency">Currency</label>
      <select id="currency" name="currency" value={form.currency} onChange={handleChange}>
        {currencies.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <label htmlFor="note">Note (optional)</label>
      <textarea id="note" name="note" maxLength={200} value={form.note} onChange={handleChange} />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}

TransferForm.propTypes = {
  currencies: PropTypes.arrayOf(PropTypes.string).isRequired,
  onSubmit: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
};

TransferForm.defaultProps = {
  isSubmitting: false,
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

/**
 * Dashboard component — main view of the fintech application.
 */
function Dashboard({ userId, apiClient }) {
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const SUPPORTED_CURRENCIES = useMemo(() => ['USD', 'EUR', 'GBP', 'JPY', 'CHF'], []);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    Promise.all([
      apiClient.get(`/users/${userId}`),
      apiClient.get(`/transactions?userId=${userId}&limit=20`),
    ])
      .then(([userRes, txnRes]) => {
        if (!mounted) return;
        setAccount(userRes.data);
        setTransactions(txnRes.data || []);
        setError(null);
      })
      .catch(err => {
        if (!mounted) return;
        setError(err.message || 'Failed to load dashboard data');
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => { mounted = false; };
  }, [userId, apiClient]);

  const handleTransfer = useCallback(async (formData) => {
    setIsSubmitting(true);
    try {
      await apiClient.post('/transactions', {
        fromUserId: userId,
        ...formData,
      });
      // Refresh transactions after successful transfer
      const res = await apiClient.get(`/transactions?userId=${userId}&limit=20`);
      setTransactions(res.data || []);
    } catch (err) {
      setError(err.message || 'Transfer failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, apiClient]);

  const totalBalance = useMemo(
    () => account ? account.balance : 0,
    [account]
  );

  if (error) {
    return <div className="dashboard__error" role="alert">{error}</div>;
  }

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <h1>Dashboard</h1>
      </header>
      <section className="dashboard__balance">
        <BalanceCard
          balance={totalBalance}
          currency={account?.currency || 'USD'}
          accountId={account?.id || ''}
          isLoading={isLoading}
        />
      </section>
      <section className="dashboard__transactions" aria-label="Transaction history">
        <h2>Recent Transactions</h2>
        {isLoading ? (
          <p aria-busy="true">Loading…</p>
        ) : transactions.length === 0 ? (
          <p>No transactions yet.</p>
        ) : (
          <div className="txn-list" role="list">
            {transactions.map(txn => (
              <TransactionRow key={txn.id} transaction={txn} onSelect={setSelectedTxn} />
            ))}
          </div>
        )}
        {selectedTxn && (
          <div className="txn-detail" role="dialog" aria-modal="true" aria-label="Transaction detail">
            <button onClick={() => setSelectedTxn(null)}>✕ Close</button>
            <pre>{JSON.stringify(selectedTxn, null, 2)}</pre>
          </div>
        )}
      </section>
      <section className="dashboard__transfer">
        <TransferForm
          currencies={SUPPORTED_CURRENCIES}
          onSubmit={handleTransfer}
          isSubmitting={isSubmitting}
        />
      </section>
    </main>
  );
}

Dashboard.propTypes = {
  userId: PropTypes.string.isRequired,
  apiClient: PropTypes.shape({
    get: PropTypes.func.isRequired,
    post: PropTypes.func.isRequired,
  }).isRequired,
};

export default Dashboard;
