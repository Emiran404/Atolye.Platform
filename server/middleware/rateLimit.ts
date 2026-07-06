// @ts-nocheck
/**
 * Rate Limiting Middleware
 *
 * NOT: Genel API / login / upload limiter'ları yerel lab ortamında (bridge/proxy
 * arkasında tüm istemciler tek IP'den görünebildiği için sınav gönderme gibi sıcak
 * yolları kilitlememek adına) şimdilik bypass modunda bırakıldı.
 *
 * Ancak nadir çağrılan ve hassas olan kurtarma anahtarı uçları için GERÇEK bir
 * rate limiter uygulanır (brute-force ve kötüye kullanıma karşı).
 */
import rateLimit from 'express-rate-limit';

// Tüm limiter'ları bypass eden basit middleware
const bypassLimiter = (req, res, next) => next();

// Genel API rate limiter
export const apiLimiter = bypassLimiter;

// Login endpoint'leri için rate limiter
export const loginLimiter = bypassLimiter;

// Dosya yükleme için rate limiter
export const uploadLimiter = bypassLimiter;

// Kurtarma anahtarı uçları için GERÇEK rate limiter:
// 15 dakikalık pencerede IP başına en fazla 5 istek.
export const recoveryKeyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, error: 'Çok fazla deneme. Lütfen 15 dakika sonra tekrar deneyin.' }
});

