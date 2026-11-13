const Joi=require('joi');

const id=Joi.number().integer().positive();
const paging={page:Joi.number().integer().min(1).default(1),limit:Joi.number().integer().min(1).max(100).default(10)};
const schemas={
  register:Joi.object({
    name:Joi.string().trim().min(2).max(100).required(),
    email:Joi.string().email().max(254).lowercase().required(),
    password:Joi.string().min(8).max(72).required()
  }).unknown(false),
  login:Joi.object({
    email:Joi.string().email().lowercase().required(),password:Joi.string().required()
  }).unknown(false),
  projectsQuery:Joi.object({
    ...paging,status:Joi.string().valid('ACTIVE','ARCHIVED'),
    search:Joi.string().trim().min(1).max(100),ownerId:id
  }).unknown(false),
  projectCreate:Joi.object({
    name:Joi.string().trim().min(2).max(100).required(),
    description:Joi.string().allow('',null).max(1000),
    status:Joi.string().valid('ACTIVE','ARCHIVED').default('ACTIVE')
  }).unknown(false),
  projectPatch:Joi.object({
    name:Joi.string().trim().min(2).max(100),
    description:Joi.string().allow('',null).max(1000),
    status:Joi.string().valid('ACTIVE','ARCHIVED')
  }).min(1).unknown(false),
  tasksQuery:Joi.object({
    ...paging,projectId:id,
    status:Joi.string().valid('TODO','IN_PROGRESS','DONE'),
    priority:Joi.string().valid('LOW','MEDIUM','HIGH'),
    search:Joi.string().trim().min(1).max(100)
  }).unknown(false),
  taskCreate:Joi.object({
    title:Joi.string().trim().min(2).max(200).required(),
    description:Joi.string().allow('',null).max(2000),
    status:Joi.string().valid('TODO','IN_PROGRESS','DONE').default('TODO'),
    priority:Joi.string().valid('LOW','MEDIUM','HIGH').default('MEDIUM'),
    dueDate:Joi.date().iso().allow(null),
    projectId:id.required()
  }).unknown(false),
  taskPatch:Joi.object({
    title:Joi.string().trim().min(2).max(200),
    description:Joi.string().allow('',null).max(2000),
    status:Joi.string().valid('TODO','IN_PROGRESS','DONE'),
    priority:Joi.string().valid('LOW','MEDIUM','HIGH'),
    dueDate:Joi.date().iso().allow(null)
  }).min(1).unknown(false)
};
function validate(schema,source='body') {
  return (req,res,next)=>{
    const {error,value}=schema.validate(req[source],{abortEarly:false,convert:true});
    if(error)return res.status(400).json({error:{
      code:'VALIDATION_ERROR',message:'Invalid input',
      details:error.details.map(x=>({field:x.path.join('.'),message:x.message}))
    }});
    if(source==='query') req.filters=value;
    else req[source]=value;
    next();
  };
}
function validateId(req,res,next){
  const raw=req.params.id;
  const idValue=Number(raw);
  if(!/^[1-9]\d*$/.test(raw)||!Number.isSafeInteger(idValue))
    return res.status(400).json({error:{code:'VALIDATION_ERROR',message:'Invalid resource id'}});
  req.resourceId=idValue;
  next();
}
module.exports={schemas,validate,validateId};
