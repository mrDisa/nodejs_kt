const { prisma, publicUser } = require('../config');
const { verifyAccess } = require('../utils/jwt');
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const authenticate = asyncRoute(async (req,res,next) => {
  const match = /^Bearer (\S+)$/i.exec(req.get('authorization') || '');
  if (!match) return res.status(401).json({error:'Authentication required'});
  let payload;
  try { payload = verifyAccess(match[1]); }
  catch { return res.status(401).json({error:'Invalid or expired access token'}); }
  const user = await prisma.user.findUnique({where:{id:Number(payload.sub)},select:publicUser});
  if (!user) return res.status(401).json({error:'User not found'});
  req.user = user; next();
});
const roles = (...allowed) => (req,res,next) => {
  if (!req.user) return res.status(401).json({error:'Authentication required'});
  if (!allowed.includes(req.user.role)) return res.status(403).json({error:'Forbidden'});
  next();
};
const canManagePost = (req,post) => ['ADMIN','MODERATOR'].includes(req.user.role) || req.user.id === post.authorId;
module.exports = { asyncRoute,authenticate,roles,canManagePost };
