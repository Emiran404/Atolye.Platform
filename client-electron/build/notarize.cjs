const path = require('path');
const { notarize } = require('@electron/notarize');

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

module.exports = async context => {
  if (context.electronPlatformName !== 'darwin' || context.appOutDir.includes('-temp')) return;

  const { APPLE_API_KEY, APPLE_API_KEY_ID, APPLE_API_ISSUER } = process.env;
  if (!APPLE_API_KEY || !APPLE_API_KEY_ID || !APPLE_API_ISSUER) {
    if (!process.env.CI) {
      console.log('[Notarization] Yerel derlemede Apple secret değerleri bulunmadığı için atlandı.');
      return;
    }
    throw new Error('macOS notarization için Apple API secret değerleri eksik.');
  }

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const attempts = 3;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      console.log(`[Notarization] Apple doğrulaması başlatılıyor (${attempt}/${attempts})...`);
      await notarize({
        tool: 'notarytool',
        appPath,
        appleApiKey: APPLE_API_KEY,
        appleApiKeyId: APPLE_API_KEY_ID,
        appleApiIssuer: APPLE_API_ISSUER
      });
      console.log('[Notarization] Apple doğrulaması ve stapling tamamlandı.');
      return;
    } catch (error) {
      console.error(`[Notarization] ${attempt}. deneme başarısız: ${error.message}`);
      if (attempt === attempts) throw error;
      await wait(attempt * 60_000);
    }
  }
};
