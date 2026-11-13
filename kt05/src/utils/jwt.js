const jwt = require('jsonwebtoken');
function signAccess(user) {
  return jwt.sign({ sub: String(user.id), kind: 'access' },
    process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}
function signRefresh(user) {
  return jwt.sign({ sub: String(user.id), kind: 'refresh', version: user.tokenVersion },
    process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
}
function verifyAccess(token) {
  const p = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  if (p.kind !== 'access' || !/^\d+$/.test(String(p.sub))) throw new jwt.JsonWebTokenError('Invalid access token');
  return p;
}
function verifyRefresh(token) {
  const p = jwt.verify(token, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'] });
  if (p.kind !== 'refresh' || !/^\d+$/.test(String(p.sub)) || !Number.isInteger(p.version))
    throw new jwt.JsonWebTokenError('Invalid refresh token');
  return p;
}
const refreshCookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict', path: '/auth', maxAge: 7 * 24 * 60 * 60 * 1000
};
module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh, refreshCookieOptions };
