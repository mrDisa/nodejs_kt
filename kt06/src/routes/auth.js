const express=require('express');
const bcrypt=require('bcrypt');
const {prisma,redis,publicUser}=require('../config');
const {signAccess,signRefresh,verifyRefresh,cookieOptions}=require('../utils/jwt');
const {authenticate,asyncRoute}=require('../middleware/auth');
const {schemas,validate}=require('../middleware/validate');
const router=express.Router();
const name='refreshToken';
const fail=(res,status,code,message)=>res.status(status).json({error:{code,message}});
async function loginLimit(req,res,next){
  // Redis provides an IP-scoped fixed 15-minute window; never bypass on Redis errors.
  try{
    if(!redis.isOpen) return fail(res,503,'SERVICE_UNAVAILABLE','Login temporarily unavailable');
    const key='login:'+req.ip;
    const count=await redis.incr(key);
    if(count===1)await redis.expire(key,900);
    if(count>10)return fail(res,429,'RATE_LIMITED','Too many login attempts');
    next();
  }catch(nextError){next(nextError);}
}

router.post('/register',validate(schemas.register),asyncRoute(async(req,res)=>{
  const {password,...fields}=req.body;
  const passwordHash=await bcrypt.hash(password,12);
  const user=await prisma.user.create({data:{...fields,passwordHash},select:publicUser});
  res.status(201).location('/api/users/'+user.id).json({data:user});
}));

router.post('/login',loginLimit,validate(schemas.login),asyncRoute(async(req,res)=>{
  const user=await prisma.user.findUnique({where:{email:req.body.email}});
  const dummy='$2b$12$KIXID09MYtM4lGvFcrmoS.oUqn7snbwXqLxUvm8SA6x7OIA4rsKfO';
  const matched=await bcrypt.compare(req.body.password,user?.passwordHash||dummy);
  if(!user||!matched)return fail(res,401,'INVALID_CREDENTIALS','Invalid email or password');
  res.cookie(name,signRefresh(user),cookieOptions());
  res.json({data:{accessToken:signAccess(user),tokenType:'Bearer',expiresIn:900}});
}));

router.post('/refresh',asyncRoute(async(req,res)=>{
  let payload;
  try{payload=verifyRefresh(req.cookies?.[name]||'');}
  catch{return fail(res,401,'UNAUTHORIZED','Invalid refresh token');}
  const updated=await prisma.user.updateMany({
    where:{id:Number(payload.sub),tokenVersion:payload.version},
    data:{tokenVersion:{increment:1}}
  });
  if(updated.count!==1)return fail(res,401,'UNAUTHORIZED','Revoked refresh token');
  const user=await prisma.user.findUnique({where:{id:Number(payload.sub)}});
  res.cookie(name,signRefresh(user),cookieOptions());
  res.json({data:{accessToken:signAccess(user),tokenType:'Bearer',expiresIn:900}});
}));

router.post('/logout',asyncRoute(async(req,res)=>{
  try{
    const payload=verifyRefresh(req.cookies?.[name]||'');
    await prisma.user.updateMany({
      where:{id:Number(payload.sub),tokenVersion:payload.version},
      data:{tokenVersion:{increment:1}}
    });
  }catch{/* Always remove the cookie even if token is expired. */}
  const {maxAge,...options}=cookieOptions();
  res.clearCookie(name,options).status(204).end();
}));

router.get('/me',authenticate,(req,res)=>res.json({data:req.user}));
module.exports=router;
