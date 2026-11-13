const express=require('express');
const {prisma,publicUser}=require('../config');
const {authenticate,roles,asyncRoute}=require('../middleware/auth');
const {validate,validateId,role}=require('../middleware/validate');
const router=express.Router();
router.use(authenticate,roles('ADMIN'));
router.patch('/users/:id/role',validateId,validate(role),asyncRoute(async(req,res)=>{
  const user=await prisma.user.update({where:{id:req.resourceId},data:{role:req.body.role},select:publicUser});
  res.json(user);
}));
module.exports=router;
