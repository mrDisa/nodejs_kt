const jwt = require('jsonwebtoken');
function signAccess(user) {
  return jwt.sign({sub: String(user.id), kind: 'access'}, process.env.JWT_ACCESS_SECRET, {expiresIn:'15m'});
}
function signRefresh(user) {
  return jwt.sign({sub: String(user.id), kind: 'refresh', version:user.tokenVersion}, process.env.JWT_REFRESH_SECRET, {expiresIn:'7d'});
}
function verifyAccess(token) {
  const payload=jwt.verify(token,process.env.JWT_ACCESS_SECRET,{algorithms:['HS256']});
  if (payload.kind!=='access'||!/^[1-9]\d*$/.test(String(payload.sub))) throw new jwt.JsonWebTokenError('Invalid access token');
  return payload;
}
function verifyRefresh(token) {
  const payload=jwt.verify(token,process.env.JWT_REFRESH_SECRET,{algorithms:['HS256']});
  if (payload.kind!=='refresh'||!/^[1-9]\d*$/.test(String(payload.sub))||!Number.isInteger(payload.version))
    throw new jwt.JsonWebTokenError('Invalid refresh token');
  return payload;
}
function cookieOptions() {
  return { httpOnly:true, secure: process.env.NODE_ENV==='production', sameSite:'strict', path:'/auth', maxAge:7*24*60*60*1000 };
}
module.exports={signAccess,signRefresh,verifyAccess,verifyRefresh,cookieOptions};
