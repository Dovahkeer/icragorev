const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Çok fazla giriş denemesi, 15 dakika sonra tekrar deneyin'
});

module.exports = { loginLimiter };
