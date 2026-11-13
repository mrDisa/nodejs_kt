const express=require('express');
const {prisma}=require('../config');
const {authenticate,asyncRoute}=require('../middleware/auth');
const {canManage}=require('../middleware/rbac');
const {schemas,validate,validateId}=require('../middleware/validate');
const router=express.Router();
const fail=(res,code,message)=>res.status(code).json({error:{code:code===404?'NOT_FOUND':'FORBIDDEN',message}});
router.use(authenticate);

router.get('/',validate(schemas.projectsQuery,'query'),asyncRoute(async(req,res)=>{
  const {page,limit,search,status,ownerId}=req.filters;
  const where={
    ...(req.user.role!=='ADMIN'?{ownerId:req.user.id}:ownerId?{ownerId}:{}),
    ...(status?{status}:{}),
    ...(search?{name:{contains:search,mode:'insensitive'}}:{})
  };
  const [total,data]=await prisma.$transaction([
    prisma.project.count({where}),
    prisma.project.findMany({where,skip:(page-1)*limit,take:limit,
      include:{_count:{select:{tasks:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}]})
  ]);
  res.json({data,meta:{total,page,limit,pages:Math.ceil(total/limit)}});
}));

router.get('/:id',validateId,asyncRoute(async(req,res)=>{
  const project=await prisma.project.findUnique({where:{id:req.resourceId},
    include:{tasks:{orderBy:[{createdAt:'desc'},{id:'desc'}]}}});
  if(!project)return fail(res,404,'Project not found');
  if(!canManage(req.user,project.ownerId))return fail(res,403,'Not your project');
  res.json({data:project});
}));

router.post('/',validate(schemas.projectCreate),asyncRoute(async(req,res)=>{
  const project=await prisma.project.create({data:{...req.body,ownerId:req.user.id}});
  res.status(201).location('/api/projects/'+project.id).json({data:project});
}));

router.patch('/:id',validateId,validate(schemas.projectPatch),asyncRoute(async(req,res)=>{
  const project=await prisma.project.findUnique({where:{id:req.resourceId},select:{ownerId:true}});
  if(!project)return fail(res,404,'Project not found');
  if(!canManage(req.user,project.ownerId))return fail(res,403,'Not your project');
  res.json({data:await prisma.project.update({where:{id:req.resourceId},data:req.body})});
}));

router.delete('/:id',validateId,asyncRoute(async(req,res)=>{
  const project=await prisma.project.findUnique({where:{id:req.resourceId},select:{ownerId:true}});
  if(!project)return fail(res,404,'Project not found');
  if(!canManage(req.user,project.ownerId))return fail(res,403,'Not your project');
  await prisma.project.delete({where:{id:req.resourceId}});
  res.status(204).end();
}));
module.exports=router;
