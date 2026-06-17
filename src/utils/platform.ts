/**
 * Platforms & Features Detection Utility
 */

export const isWindows = () => {
  // Modern way
  if (navigator.userAgentData && navigator.userAgentData.platform) {
    return navigator.userAgentData.platform === 'Windows';
  }
  // Fallback
  return navigator.platform.indexOf('Win') !== -1 || navigator.userAgent.indexOf('Windows') !== -1;
};

export const canUsePasskey = () => {
  // 1. Browser context check
  const hasBrowserSupport = window.PublicKeyCredential && 
                            navigator.credentials && 
                            navigator.credentials.create;

  // 2. HTTPS requirement
  const isSecure = window.isSecureContext;

  return !!(hasBrowserSupport && isSecure);
};
