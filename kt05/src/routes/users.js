const express=require('express');
const {prisma,publicUser}=require('../config');
const {authenticate,roles,asyncRoute}=require('../middleware/auth');
const {validate,validateId,userPatch,userQuery}=require('../middleware/validate');
const router=express.Router();
router.use(authenticate);
router.get('/',roles('MODERATOR','ADMIN'),validate(userQuery,'query'),asyncRoute(async(req,res)=>{
  const {page,limit}=req.validatedQuery;
  const [total,data]=await prisma.$transaction([
    prisma.user.count(),prisma.user.findMany({select:publicUser,skip:(page-1)*limit,take:limit,orderBy:{id:'asc'}})
  ]);
  res.json({data,meta:{total,page,limit,pages:Math.ceil(total/limit)}});
}));
router.get('/:id',validateId,asyncRoute(async(req,res)=>{
  if(req.user.id!==req.resourceId&&!['MODERATOR','ADMIN'].includes(req.user.role))return res.status(403).json({error:'Forbidden'});
  const user=await prisma.user.findUnique({where:{id:req.resourceId},select:{...publicUser,posts:{orderBy:[{createdAt:'desc'},{id:'desc'}]}}});
  if(!user)return res.status(404).json({error:'User not found'});
  res.json(user);
}));
router.patch('/:id',validateId,validate(userPatch),asyncRoute(async(req,res)=>{
  if(req.user.id!==req.resourceId&&req.user.role!=='ADMIN')return res.status(403).json({error:'Forbidden'});
  const user=await prisma.user.update({where:{id:req.resourceId},data:req.body,select:publicUser});
  res.json(user);
}));
router.delete('/:id',validateId,asyncRoute(async(req,res)=>{
  if(req.user.id!==req.resourceId&&req.user.role!=='ADMIN')return res.status(403).json({error:'Forbidden'});
  await prisma.user.delete({where:{id:req.resourceId}});res.status(204).end();
}));
module.exports=router;
