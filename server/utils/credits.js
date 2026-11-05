const pool = require('../db/connection');
const { getCycleKey, getPlanKey } = require('./usage');
const { resolveEntitlements } = require('./entitlements');

const CREDIT_ACTIONS = {
  STATIC_AD_IMAGE: 'static_ad_image',
  HOOK_SCRIPT: 'hook_script',
  FACEBOOK_AD_COPY: 'facebook_ad_copy',
  BULK_CREATIVE: 'bulk_creative',
  PRODUCT_EXTRACT: 'product_extract',
  MONTHLY_SOCIAL_CALENDAR: 'monthly_social_calendar',
  CREATIVE_BRIEF: 'creative_brief',
  FACEBOOK_SEARCH: 'facebook_search',
  VIDEO_GENERATION: 'video_generation',
};

const DEFAULT_CREDIT_ACTION_COSTS = [
  [CREDIT_ACTIONS.STATIC_AD_IMAGE, 'Generate static ad', 4],
  [CREDIT_ACTIONS.HOOK_SCRIPT, 'Generate hook script', 1],
  [CREDIT_ACTIONS.FACEBOOK_AD_COPY, 'Generate Facebook ad copy', 2],
  [CREDIT_ACTIONS.BULK_CREATIVE, 'Generate bulk creative', 3],
  [CREDIT_ACTIONS.PRODUCT_EXTRACT, 'Extract product from website', 1],
  [CREDIT_ACTIONS.MONTHLY_SOCIAL_CALENDAR, 'Generate monthly content calendar', 5],
  [CREDIT_ACTIONS.CREATIVE_BRIEF, 'Generate creative brief', 3],
  [CREDIT_ACTIONS.FACEBOOK_SEARCH, 'Facebook ads search', 2],
  [CREDIT_ACTIONS.VIDEO_GENERATION, 'Generate AI video', 30],
];

function normalizePositiveInt(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.floor(number));
}

function getMonthlyCreditAllowance(subscription = {}) {
  if (subscription?.limits && Object.prototype.hasOwnProperty.call(subscription.limits, 'monthly_credits')) {
    return normalizePositiveInt(subscription.limits.monthly_credits, 0);
  }
  const resolved = resolveEntitlements(subscription);
  return normalizePositiveInt(resolved?.limits?.monthly_credits, 0);
}

async function ensureCreditActionCosts() {
  for (const [actionKey, label, creditCost] of DEFAULT_CREDIT_ACTION_COSTS) {
    await pool.query(
      `INSERT INTO credit_action_costs (action_key, label, credit_cost, is_active)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE label = VALUES(label)`,
      [actionKey, label, creditCost]
    );
  }
}

async function getCreditActionCost(actionKey) {
  const [rows] = await pool.query(
    `SELECT action_key, label, credit_cost, is_active
     FROM credit_action_costs
     WHERE action_key = ?
     LIMIT 1`,
    [actionKey]
  );
  const row = rows?.[0];
  if (row && row.is_active) {
    return {
      action_key: row.action_key,
      label: row.label,
      credit_cost: normalizePositiveInt(row.credit_cost, 0),
    };
  }

  const fallback = DEFAULT_CREDIT_ACTION_COSTS.find(([key]) => key === actionKey);
  if (!fallback) {
    return { action_key: actionKey, label: actionKey, credit_cost: 1 };
  }
  return { action_key: fallback[0], label: fallback[1], credit_cost: fallback[2] };
}

async function ensureCreditAccount(userId, subscription = {}, connection = pool) {
  const cycleKey = getCycleKey(subscription);
  const monthlyAllowance = getMonthlyCreditAllowance(subscription);

  const [rows] = await connection.query(
    `SELECT user_id, cycle_key, balance, monthly_allowance, lifetime_purchased, lifetime_spent, last_refilled_at
     FROM credit_accounts
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );

  if (!rows?.length) {
    await connection.query(
      `INSERT INTO credit_accounts (user_id, cycle_key, balance, monthly_allowance, last_refilled_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [userId, cycleKey, monthlyAllowance, monthlyAllowance]
    );
    return {
      user_id: userId,
      cycle_key: cycleKey,
      balance: monthlyAllowance,
      monthly_allowance: monthlyAllowance,
      lifetime_purchased: 0,
      lifetime_spent: 0,
    };
  }

  const account = rows[0];
  if (account.cycle_key !== cycleKey || Number(account.monthly_allowance || 0) !== monthlyAllowance) {
    const purchasedOrBonusBalance = Math.max(
      0,
      normalizePositiveInt(account.balance, 0) - normalizePositiveInt(account.monthly_allowance, 0)
    );
    const nextBalance = monthlyAllowance + purchasedOrBonusBalance;
    await connection.query(
      `UPDATE credit_accounts
       SET cycle_key = ?, balance = ?, monthly_allowance = ?, last_refilled_at = NOW()
       WHERE user_id = ?`,
      [cycleKey, nextBalance, monthlyAllowance, userId]
    );
    return {
      ...account,
      cycle_key: cycleKey,
      balance: nextBalance,
      monthly_allowance: monthlyAllowance,
    };
  }

  return {
    ...account,
    balance: normalizePositiveInt(account.balance, 0),
    monthly_allowance: normalizePositiveInt(account.monthly_allowance, monthlyAllowance),
    lifetime_purchased: normalizePositiveInt(account.lifetime_purchased, 0),
    lifetime_spent: normalizePositiveInt(account.lifetime_spent, 0),
  };
}

async function getCreditSummary(userId, subscription = {}) {
  const account = await ensureCreditAccount(userId, subscription);
  const [costRows] = await pool.query(
    `SELECT action_key, label, credit_cost, is_active
     FROM credit_action_costs
     ORDER BY action_key ASC`
  );

  return {
    plan_key: getPlanKey(subscription),
    cycle_key: account.cycle_key,
    balance: normalizePositiveInt(account.balance, 0),
    monthly_allowance: normalizePositiveInt(account.monthly_allowance, 0),
    lifetime_purchased: normalizePositiveInt(account.lifetime_purchased, 0),
    lifetime_spent: normalizePositiveInt(account.lifetime_spent, 0),
    action_costs: (costRows || []).map((row) => ({
      action_key: row.action_key,
      label: row.label,
      credit_cost: normalizePositiveInt(row.credit_cost, 0),
      is_active: Boolean(row.is_active),
    })),
  };
}

function buildCreditErrorPayload(actionCost, account) {
  return {
    error: 'Not enough credits to run this action.',
    code: 'insufficient_credits',
    action_key: actionCost.action_key,
    required_credits: actionCost.credit_cost,
    credit_balance: normalizePositiveInt(account?.balance, 0),
    credits: {
      balance: normalizePositiveInt(account?.balance, 0),
      monthly_allowance: normalizePositiveInt(account?.monthly_allowance, 0),
      cycle_key: account?.cycle_key || null,
    },
    upgrade_prompt: 'Buy more credits or upgrade your plan to continue.',
  };
}

async function reserveCredits({ userId, subscription = {}, actionKey, amount, description, metadata }) {
  const actionCost = amount
    ? { action_key: actionKey, label: actionKey, credit_cost: normalizePositiveInt(amount, 0) }
    : await getCreditActionCost(actionKey);
  const creditCost = normalizePositiveInt(actionCost.credit_cost, 0);
  if (creditCost <= 0) {
    return { skipped: true, cost: actionCost, reservation: null, account: await ensureCreditAccount(userId, subscription) };
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const account = await ensureCreditAccount(userId, subscription, connection);

    if (normalizePositiveInt(account.balance, 0) < creditCost) {
      await connection.rollback();
      const error = new Error('Not enough credits to run this action.');
      error.status = 402;
      error.code = 'insufficient_credits';
      error.payload = buildCreditErrorPayload(actionCost, account);
      throw error;
    }

    const nextBalance = normalizePositiveInt(account.balance, 0) - creditCost;
    await connection.query(
      `UPDATE credit_accounts
       SET balance = ?
       WHERE user_id = ?`,
      [nextBalance, userId]
    );
    const [result] = await connection.query(
      `INSERT INTO credit_transactions
        (user_id, action_key, transaction_type, status, amount, balance_after, description, metadata)
       VALUES (?, ?, 'reserve', 'reserved', ?, ?, ?, ?)`,
      [
        userId,
        actionKey,
        -creditCost,
        nextBalance,
        description || actionCost.label,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
    await connection.commit();

    return {
      skipped: false,
      cost: actionCost,
      reservation: {
        id: result.insertId,
        amount: creditCost,
      },
      account: {
        ...account,
        balance: nextBalance,
      },
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback failure.
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function spendReservedCredits({ userId, reservationId, description, metadata }) {
  if (!reservationId) return null;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [reservationRows] = await connection.query(
      `SELECT id, action_key, amount, status
       FROM credit_transactions
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [reservationId, userId]
    );
    const reservation = reservationRows?.[0];
    if (!reservation || reservation.status !== 'reserved') {
      await connection.rollback();
      return null;
    }

    await connection.query(
      `UPDATE credit_transactions
       SET status = 'spent'
       WHERE id = ? AND user_id = ?`,
      [reservationId, userId]
    );
    await connection.query(
      `UPDATE credit_accounts
       SET lifetime_spent = lifetime_spent + ?
       WHERE user_id = ?`,
      [Math.abs(Number(reservation.amount || 0)), userId]
    );
    await connection.query(
      `INSERT INTO credit_transactions
        (user_id, action_key, transaction_type, status, amount, related_transaction_id, description, metadata)
       VALUES (?, ?, 'spend', 'completed', ?, ?, ?, ?)`,
      [
        userId,
        reservation.action_key,
        reservation.amount,
        reservationId,
        description || 'Credits spent',
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
    await connection.commit();
    return true;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback failure.
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function refundReservedCredits({ userId, reservationId, description, metadata }) {
  if (!reservationId) return null;
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [reservationRows] = await connection.query(
      `SELECT id, action_key, amount, status
       FROM credit_transactions
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [reservationId, userId]
    );
    const reservation = reservationRows?.[0];
    if (!reservation || reservation.status !== 'reserved') {
      await connection.rollback();
      return null;
    }

    const refundAmount = Math.abs(Number(reservation.amount || 0));
    const [accountRows] = await connection.query(
      `SELECT balance FROM credit_accounts WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    const nextBalance = normalizePositiveInt(accountRows?.[0]?.balance, 0) + refundAmount;
    await connection.query(
      `UPDATE credit_accounts
       SET balance = ?
       WHERE user_id = ?`,
      [nextBalance, userId]
    );
    await connection.query(
      `UPDATE credit_transactions
       SET status = 'refunded'
       WHERE id = ? AND user_id = ?`,
      [reservationId, userId]
    );
    await connection.query(
      `INSERT INTO credit_transactions
        (user_id, action_key, transaction_type, status, amount, balance_after, related_transaction_id, description, metadata)
       VALUES (?, ?, 'refund', 'completed', ?, ?, ?, ?, ?)`,
      [
        userId,
        reservation.action_key,
        refundAmount,
        nextBalance,
        reservationId,
        description || 'Credits refunded',
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
    await connection.commit();
    return { balance: nextBalance };
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback failure.
    }
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  CREDIT_ACTIONS,
  DEFAULT_CREDIT_ACTION_COSTS,
  buildCreditErrorPayload,
  ensureCreditAccount,
  ensureCreditActionCosts,
  getCreditActionCost,
  getCreditSummary,
  getMonthlyCreditAllowance,
  refundReservedCredits,
  reserveCredits,
  spendReservedCredits,
};
