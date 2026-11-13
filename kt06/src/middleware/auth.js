const { prisma, publicUser } = require('../config');
const { verifyAccess } = require('../utils/jwt');
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);

const authenticate = asyncRoute(async (req,res,next) => {
  const match=/^Bearer (\S+)$/i.exec(req.get('authorization')||'');
  if(!match) return res.status(401).json({error:{code:'UNAUTHORIZED',message:'Authentication required'}});
  let payload;
  try { payload=verifyAccess(match[1]); }
  catch { return res.status(401).json({error:{code:'UNAUTHORIZED',message:'Invalid or expired access token'}}); }
  const user=await prisma.user.findUnique({where:{id:Number(payload.sub)},select:publicUser});
  if(!user) return res.status(401).json({error:{code:'UNAUTHORIZED',message:'User not found'}});
  req.user=user;
  next();
});
module.exports={authenticate,asyncRoute};
