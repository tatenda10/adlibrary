import { useCallback } from 'react';
import {
  handleApiError,
  showBillingLimitToast,
  showErrorToast,
  showInfoToast,
  showSuccessToast,
  showWarningToast,
} from '../lib/toast.js';
import { shouldShowBillingLimitModal } from '../lib/billingErrors.js';

/**
 * Toast-based API errors (replaces inline error banners + billing modal).
 */
export function useApiToast() {
  const notifyApiError = useCallback((err, fallback, options) => {
    return handleApiError(err, fallback, options);
  }, []);

  const notifyBillingOrApiError = useCallback((err, fallback, options) => {
    if (shouldShowBillingLimitModal(err)) {
      showBillingLimitToast(err);
      return true;
    }
    return handleApiError(err, fallback, options);
  }, []);

  return {
    notifyApiError,
    notifyBillingOrApiError,
    showSuccess: showSuccessToast,
    showInfo: showInfoToast,
    showWarning: showWarningToast,
    showError: showErrorToast,
  };
}

/**
 * @deprecated Use useApiToast — kept so existing imports keep working without modal JSX.
 */
export function useBillingLimitModal() {
  const { notifyBillingOrApiError } = useApiToast();

  const showBillingLimitFromError = useCallback((err) => {
    if (!shouldShowBillingLimitModal(err)) return false;
    showBillingLimitToast(err);
    return true;
  }, []);

  return {
    billingLimitModal: null,
    billingLimitOpen: false,
    billingLimitError: null,
    showBillingLimitFromError,
    closeBillingLimit: () => {},
  };
}
