const { apiRequest } = require('../utils/apiHelper');

const API_VERSION_PREFIX = '/api/v1';

const getCoreApiUrl = (endpoint) => {
  const baseUrl = (process.env.BASE_URL || '').replace(/\/+$/, '');
  return `${baseUrl}${API_VERSION_PREFIX}${endpoint}`;
};

/**
 * POST /app/v1/wallet/deplete
 * Stateless gateway proxy: forwards AI token consumption from the Python AI service
 * to Core Laravel (POST /api/v1/wallet/deplete), where the single source-of-truth wallet lives.
 */
exports.trackUsage = async (req, res) => {
  try {
    const {
      prompt_tokens = 0,
      completion_tokens = 0,
      total_tokens = 0,
      model = 'gpt-4o-mini',
      request_id = null,
      timestamp = null
    } = req.body || {};

    const tenantId =
      req.user?.tenantId ||
      req.headers?.['x-tenant-id'] ||
      req.body?.tenant_id ||
      req.body?.tenantId;

    if (!tenantId || tenantId === 'null') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No Tenant ID'
      });
    }

    const resolvedTotal = Number(total_tokens) || (Number(prompt_tokens) + Number(completion_tokens));
    if (!resolvedTotal || resolvedTotal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing tenantId or positive token usage data'
      });
    }

    const apiKey = req.headers?.['x-api-key'] || process.env.CORE_API_KEY;
    const correlationId = req.headers?.['x-correlation-id'] || request_id || null;
    const customHeaders = correlationId ? { 'X-Correlation-ID': String(correlationId) } : {};
    const payload = {
      tenant_id: String(tenantId),
      prompt_tokens: Number(prompt_tokens) || 0,
      completion_tokens: Number(completion_tokens) || 0,
      total_tokens: resolvedTotal,
      model,
      request_id: correlationId,
      timestamp: timestamp || new Date().toISOString()
    };

    const result = await apiRequest(
      getCoreApiUrl('/wallet/deplete'),
      'post',
      payload,
      customHeaders,
      apiKey,
      String(tenantId)
    );

    if (!result.success) {
      const upstreamStatus = result.status;
      const clientStatus = (
        upstreamStatus === 401 ||
        upstreamStatus === 403 ||
        upstreamStatus === 404 ||
        upstreamStatus >= 500
      )
        ? upstreamStatus
        : 400;
      return res.status(clientStatus).json({
        status: clientStatus,
        success: false,
        message: result.data?.message || result.message || 'Failed to deduct tokens in Core wallet',
        data: result.data?.data ?? result.data ?? null
      });
    }

    const coreData = result.data?.data ?? result.data ?? {};
    return res.status(200).json({
      status: 200,
      success: true,
      balance: coreData.balance ?? result.data?.balance ?? null,
      deducted: coreData.deducted ?? resolvedTotal,
      message: result.data?.message || 'Wallet tokens deducted successfully',
      data: coreData
    });
  } catch (err) {
    const errMsg = err?.message || err.response?.data?.error_description;
    console.error('[WALLET-PROXY] trackUsage error:', errMsg);
    return res.status(500).json({
      success: false,
      message: 'Failed trackUsage'
    });
  }
};

/**
 * GET /app/v1/wallet/check-balance
 * Stateless gateway proxy: queries Core Laravel (GET /api/v1/wallet/balance)
 * to verify whether the tenant has sufficient AI token balance.
 */
exports.checkSufficientBalance = async (req, res) => {
  try {
    const tenantId =
      req.user?.tenantId ||
      req.headers?.['x-tenant-id'] ||
      req.query?.tenantId ||
      req.query?.tenant_id;

    if (!tenantId || tenantId === 'null') {
      return res.status(401).json({
        success: false,
        allowed: false,
        error: 'Unauthorized: No Tenant ID'
      });
    }

    const apiKey = req.headers?.['x-api-key'] || process.env.CORE_API_KEY;
    const correlationId = req.headers?.['x-correlation-id'] || null;
    const customHeaders = correlationId ? { 'X-Correlation-ID': String(correlationId) } : {};
    const params = new URLSearchParams({ tenant_id: String(tenantId) });
    const url = `${getCoreApiUrl('/wallet/balance')}?${params.toString()}`;

    const result = await apiRequest(
      url,
      'get',
      null,
      customHeaders,
      apiKey,
      String(tenantId)
    );

    if (!result.success) {
      const errBody = result.data?.data ?? result.data ?? {};
      const explicitError = errBody.error || result.data?.error;

      // If Core returns 404 (no wallet found for tenant) or an explicit domain denial (e.g. 402/422 with allowed: false),
      // map cleanly to HTTP 200 with allowed: false so downstream callers get a deterministic business decision.
      if (
        result.status === 404 ||
        errBody.allowed === false ||
        ['insufficient_funds', 'wallet_suspended', 'no_wallet'].includes(explicitError)
      ) {
        return res.status(200).json({
          status: 200,
          success: true,
          allowed: false,
          error: explicitError || (result.status === 404 ? 'no_wallet' : 'insufficient_funds'),
          balance: errBody.balance ?? 0,
          required: errBody.required ?? 1500
        });
      }
      const upstreamStatus = result.status;
      const clientStatus = (
        upstreamStatus === 401 ||
        upstreamStatus === 403 ||
        upstreamStatus >= 500
      )
        ? upstreamStatus
        : 400;
      return res.status(clientStatus).json({
        status: clientStatus,
        success: false,
        error: explicitError || 'wallet_service_unavailable',
        message: result.data?.message || result.message || 'Failed to check wallet balance in Core'
      });
    }

    const corePayload = result.data?.data ?? result.data ?? {};
    const allowed = corePayload.allowed !== undefined
      ? Boolean(corePayload.allowed)
      : Number(corePayload.balance ?? 0) >= Number(corePayload.required ?? 1500);

    return res.status(200).json({
      status: 200,
      success: true,
      allowed,
      balance: corePayload.balance ?? 0,
      required: corePayload.required ?? 1500,
      error: corePayload.error ?? (allowed ? null : 'insufficient_funds'),
      message: result.data?.message || 'Tenant wallet balance',
      data: corePayload
    });
  } catch (err) {
    const errMsg = err?.message || err.response?.data?.error_description;
    console.error('[WALLET-PROXY] checkSufficientBalance error:', errMsg);
    return res.status(500).json({
      success: false,
      message: 'Failed to process token usage: checkSufficientBalance'
    });
  }
};
