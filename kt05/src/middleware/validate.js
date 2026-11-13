const Joi = require('joi');
const id = Joi.number().integer().positive();
const email = Joi.string().email().max(254).lowercase();
const name = Joi.string().trim().min(2).max(100);
const password = Joi.string().min(8).max(72);
const register = Joi.object({email:email.required(),name:name.required(),password:password.required()}).unknown(false);
const login = Joi.object({email:email.required(),password:Joi.string().required()}).unknown(false);
const userPatch = Joi.object({email,name}).min(1).unknown(false);
const role = Joi.object({role:Joi.string().valid('USER','MODERATOR','ADMIN').required()}).unknown(false);
const postCreate = Joi.object({
  title:Joi.string().trim().min(1).max(255).required(),
  content:Joi.string().allow('',null).max(20000),
  published:Joi.boolean().default(false),
  authorId:id,
  tags:Joi.array().items(Joi.string().trim().min(1).max(50)).unique().max(30).default([])
}).unknown(false);
const postPatch = Joi.object({
  title:Joi.string().trim().min(1).max(255),content:Joi.string().allow('',null).max(20000),
  published:Joi.boolean(),tags:Joi.array().items(Joi.string().trim().min(1).max(50)).unique().max(30)
}).min(1).unknown(false);
const pagination = {page:Joi.number().integer().min(1).default(1),limit:Joi.number().integer().min(1).max(100).default(10)};
const userQuery = Joi.object(pagination).unknown(false);
const postQuery = Joi.object({...pagination,search:Joi.string().trim().min(1).max(255),published:Joi.boolean(),authorId:id}).unknown(false);
const validate = (schema,source='body') => (req,res,next) => {
  const {error,value} = schema.validate(req[source],{abortEarly:false,convert:true});
  if (error) return res.status(400).json({error:'Validation error',details:error.details.map(d=>({field:d.path.join('.'),message:d.message}))});
  if (source === 'query') req.validatedQuery=value;
  else req[source]=value;
  next();
};
const validateId=(req,res,next)=>{
  const value=Number(req.params.id);
  if (!/^\d+$/.test(req.params.id)||!Number.isSafeInteger(value)||value<=0)
    return res.status(400).json({error:'Validation error',details:[{field:'id',message:'Positive integer required'}]});
  req.resourceId=value;next();
};
module.exports={validate,validateId,register,login,userPatch,role,postCreate,postPatch,userQuery,postQuery};
