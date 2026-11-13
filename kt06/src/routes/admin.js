const express=require('express');
const {prisma,publicUser}=require('../config');
const {authenticate,asyncRoute}=require('../middleware/auth');
const {allowRoles}=require('../middleware/rbac');
const {validateId}=require('../middleware/validate');
const Joi=require('joi');
const {validate}=require('../middleware/validate');
const router=express.Router();
router.use(authenticate,allowRoles('ADMIN'));
router.get('/users',asyncRoute(async(req,res)=>{
  const users=await prisma.user.findMany({select:publicUser,orderBy:{id:'asc'}});
  res.json({data:users});
}));
router.patch('/users/:id/role',validateId,validate(Joi.object({role:Joi.string().valid('USER','ADMIN').required()}).unknown(false)),
  asyncRoute(async(req,res)=>{
    const user=await prisma.user.update({where:{id:req.resourceId},data:{role:req.body.role},select:publicUser});
    res.json({data:user});
  }));
module.exports=router;
