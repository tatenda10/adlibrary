import { toast } from 'sonner';
import {
  getBillingLimitMessage,
  getBillingLimitTitle,
  getUsageDetailFromError,
  shouldShowBillingLimitModal,
} from './billingErrors.js';
import { getToastErrorMessage, TOAST_FALLBACKS } from './userFacingError.js';

const DEFAULT_ERROR_DURATION = 5200;
const DEFAULT_SUCCESS_DURATION = 3200;
const BILLING_TOAST_DURATION = 9000;

export function showSuccessToast(message, options = {}) {
  if (!message) return;
  toast.success(message, { duration: options.duration ?? DEFAULT_SUCCESS_DURATION });
}

export function showInfoToast(message, options = {}) {
  if (!message) return;
  toast.info(message, { duration: options.duration ?? DEFAULT_SUCCESS_DURATION });
}

export function showWarningToast(message, options = {}) {
  if (!message) return;
  toast.warning(message, { duration: options.duration ?? DEFAULT_ERROR_DURATION });
}

export function showErrorToast(messageOrErr, fallback = TOAST_FALLBACKS.generic, options = {}) {
  const message =
    typeof messageOrErr === 'string' && !messageOrErr.startsWith('{')
      ? messageOrErr
      : getToastErrorMessage(messageOrErr, fallback);

  if (!message || options.silent) return;

  toast.error(message, {
    duration: options.duration ?? DEFAULT_ERROR_DURATION,
  });
}

export function showBillingLimitToast(err) {
  const title = getBillingLimitTitle(err);
  let description = getBillingLimitMessage(err);
  const usage = getUsageDetailFromError(err);

  if (usage) {
    description = `${description} (${usage.used}/${usage.limit} ${usage.label} this cycle)`;
  }

  toast.error(title, {
    description,
    duration: BILLING_TOAST_DURATION,
    action: {
      label: 'View billing',
      onClick: () => {
        window.location.assign('/billing');
      },
    },
  });
}

/**
 * Central API error handler: billing → billing toast; else error toast.
 * @returns {boolean} true if handled
 */
export function handleApiError(err, fallback = TOAST_FALLBACKS.generic, options = {}) {
  if (!err) return false;

  if (shouldShowBillingLimitModal(err)) {
    showBillingLimitToast(err);
    return true;
  }

  if (options.ignoreNotFound && Number(err?.status) === 404) {
    return false;
  }

  showErrorToast(err, fallback, options);
  return true;
}
