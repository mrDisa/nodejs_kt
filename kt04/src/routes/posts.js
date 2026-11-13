const express=require('express');
const {prisma}=require('../config');
const {authenticate,asyncRoute,canManagePost}=require('../middleware/auth');
const {validate,validateId,postCreate,postPatch,postQuery}=require('../middleware/validate');
const router=express.Router();
const include={author:{select:{id:true,name:true,email:true,role:true}},tags:{orderBy:{name:'asc'}}};
const connectOrCreate=names=>names.map(name=>({where:{name},create:{name}}));
router.use(authenticate);
router.get('/',validate(postQuery,'query'),asyncRoute(async(req,res)=>{
  const {page,limit,search,published,authorId}=req.validatedQuery;
  const where={...(search!==undefined?{title:{contains:search}}:{}),...(published!==undefined?{published}:{}),...(authorId!==undefined?{authorId}:{})};
  const [total,data]=await prisma.$transaction([
    prisma.post.count({where}),
    prisma.post.findMany({where,include,skip:(page-1)*limit,take:limit,orderBy:[{createdAt:'desc'},{id:'desc'}]})
  ]);
  res.json({data,meta:{total,page,limit,pages:Math.ceil(total/limit)}});
}));
router.get('/:id',validateId,asyncRoute(async(req,res)=>{
  const post=await prisma.post.findUnique({where:{id:req.resourceId},include});
  if(!post)return res.status(404).json({error:'Post not found'});
  res.json(post);
}));
router.post('/',validate(postCreate),asyncRoute(async(req,res)=>{
  const {tags,authorId,...fields}=req.body;
  if(authorId!==undefined&&authorId!==req.user.id)
    return res.status(403).json({error:'Cannot create posts for another user'});
  const post=await prisma.post.create({
    data:{...fields,author:{connect:{id:req.user.id}},tags:{connectOrCreate:connectOrCreate(tags)}},include
  });
  res.status(201).location('/api/posts/'+post.id).json(post);
}));
router.patch('/:id',validateId,validate(postPatch),asyncRoute(async(req,res)=>{
  const existing=await prisma.post.findUnique({where:{id:req.resourceId},select:{authorId:true}});
  if(!existing)return res.status(404).json({error:'Post not found'});
  if(!canManagePost(req,existing))return res.status(403).json({error:'Forbidden'});
  const {tags,...fields}=req.body;
  const post=await prisma.post.update({where:{id:req.resourceId},data:{
    ...fields,...(tags!==undefined?{tags:{set:[],connectOrCreate:connectOrCreate(tags)}}:{})
  },include});
  res.json(post);
}));
router.delete('/:id',validateId,asyncRoute(async(req,res)=>{
  const post=await prisma.post.findUnique({where:{id:req.resourceId},select:{authorId:true}});
  if(!post)return res.status(404).json({error:'Post not found'});
  if(!canManagePost(req,post))return res.status(403).json({error:'Forbidden'});
  await prisma.post.delete({where:{id:req.resourceId}});res.status(204).end();
}));
module.exports=router;
