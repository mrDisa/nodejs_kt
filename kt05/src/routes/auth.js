const express=require('express');
const bcrypt=require('bcrypt');
const {prisma,publicUser}=require('../config');
const {authenticate,asyncRoute}=require('../middleware/auth');
const {validate,register,login}=require('../middleware/validate');
const {signAccess,signRefresh,verifyRefresh,refreshCookieOptions}=require('../utils/jwt');
const router=express.Router();
const cookieName='refreshToken';
const clearCookie=res=>res.clearCookie(cookieName,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/auth'});
router.post('/register',validate(register),asyncRoute(async(req,res)=>{
  const {password,...details}=req.body;
  const passwordHash=await bcrypt.hash(password,12);
  const user=await prisma.user.create({data:{...details,passwordHash},select:publicUser});
  res.status(201).json(user);
}));
router.post('/login',validate(login),asyncRoute(async(req,res)=>{
  const user=await prisma.user.findUnique({where:{email:req.body.email}});
  // Use a dummy hash to avoid leaking which emails exist via significantly different response times.
  const dummy='$2b$12$KIXID09MYtM4lGvFcrmoS.oUqn7snbwXqLxUvm8SA6x7OIA4rsKfO';
  const valid=await bcrypt.compare(req.body.password,user?.passwordHash||dummy);
  if(!user||!valid)return res.status(401).json({error:'Invalid credentials'});
  const accessToken=signAccess(user);
  const refreshToken=signRefresh(user);
  res.cookie(cookieName,refreshToken,refreshCookieOptions);
  res.json({accessToken,tokenType:'Bearer',expiresIn:900});
}));
router.post('/refresh',asyncRoute(async(req,res)=>{
  let payload;
  try{payload=verifyRefresh(req.cookies?.[cookieName]||'');}
  catch{return res.status(401).json({error:'Invalid or expired refresh token'});}
  const user=await prisma.user.findUnique({where:{id:Number(payload.sub)}});
  if(!user||user.tokenVersion!==payload.version)return res.status(401).json({error:'Refresh token revoked'});
  // Rotate and invalidate previous refresh tokens.
  const updated=await prisma.user.update({where:{id:user.id},data:{tokenVersion:{increment:1}}});
  res.cookie(cookieName,signRefresh(updated),refreshCookieOptions);
  res.json({accessToken:signAccess(updated),tokenType:'Bearer',expiresIn:900});
}));
router.post('/logout',asyncRoute(async(req,res)=>{
  try {
    const payload=verifyRefresh(req.cookies?.[cookieName]||'');
    await prisma.user.updateMany({where:{id:Number(payload.sub),tokenVersion:payload.version},data:{tokenVersion:{increment:1}}});
  } catch { /* Always clear the cookie, including expired/invalid ones. */ }
  clearCookie(res);res.status(204).end();
}));
router.get('/me',authenticate,(req,res)=>res.json(req.user));
module.exports=router;
