const express=require('express');
const {prisma}=require('../config');
const {authenticate,asyncRoute}=require('../middleware/auth');
const {canManage}=require('../middleware/rbac');
const {schemas,validate,validateId}=require('../middleware/validate');
const router=express.Router();
const fail=(res,code,message)=>res.status(code).json({error:{code:code===404?'NOT_FOUND':'FORBIDDEN',message}});
router.use(authenticate);

router.get('/',validate(schemas.tasksQuery,'query'),asyncRoute(async(req,res)=>{
  const {page,limit,projectId,status,priority,search}=req.filters;
  const where={
    ...(req.user.role!=='ADMIN'?{project:{ownerId:req.user.id}}:{}),
    ...(projectId?{projectId}:{}),
    ...(status?{status}:{}),
    ...(priority?{priority}:{}),
    ...(search?{title:{contains:search,mode:'insensitive'}}:{})
  };
  const [total,data]=await prisma.$transaction([
    prisma.task.count({where}),
    prisma.task.findMany({where,skip:(page-1)*limit,take:limit,
      include:{project:{select:{id:true,name:true,ownerId:true}}},
      orderBy:[{createdAt:'desc'},{id:'desc'}]})
  ]);
  res.json({data,meta:{total,page,limit,pages:Math.ceil(total/limit)}});
}));

router.get('/:id',validateId,asyncRoute(async(req,res)=>{
  const task=await prisma.task.findUnique({where:{id:req.resourceId},include:{project:true}});
  if(!task)return fail(res,404,'Task not found');
  if(!canManage(req.user,task.project.ownerId))return fail(res,403,'Not your task');
  res.json({data:task});
}));

router.post('/',validate(schemas.taskCreate),asyncRoute(async(req,res)=>{
  const project=await prisma.project.findUnique({where:{id:req.body.projectId}});
  if(!project)return fail(res,404,'Project not found');
  if(!canManage(req.user,project.ownerId))return fail(res,403,'Not your project');
  const task=await prisma.task.create({data:req.body});
  res.status(201).location('/api/tasks/'+task.id).json({data:task});
}));

router.patch('/:id',validateId,validate(schemas.taskPatch),asyncRoute(async(req,res)=>{
  const task=await prisma.task.findUnique({where:{id:req.resourceId},include:{project:{select:{ownerId:true}}}});
  if(!task)return fail(res,404,'Task not found');
  if(!canManage(req.user,task.project.ownerId))return fail(res,403,'Not your task');
  res.json({data:await prisma.task.update({where:{id:req.resourceId},data:req.body})});
}));

router.delete('/:id',validateId,asyncRoute(async(req,res)=>{
  const task=await prisma.task.findUnique({where:{id:req.resourceId},include:{project:{select:{ownerId:true}}}});
  if(!task)return fail(res,404,'Task not found');
  if(!canManage(req.user,task.project.ownerId))return fail(res,403,'Not your task');
  await prisma.task.delete({where:{id:req.resourceId}});
  res.status(204).end();
}));
module.exports=router;
