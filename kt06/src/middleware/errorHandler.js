const {Prisma}=require('@prisma/client');

module.exports=function errorHandler(err,_req,res,_next) {
  if(res.headersSent)return;
  if(err instanceof Prisma.PrismaClientKnownRequestError){
    if(err.code==='P2002')return res.status(409).json({error:{code:'CONFLICT',message:'Unique value already exists'}});
    if(err.code==='P2025')return res.status(404).json({error:{code:'NOT_FOUND',message:'Resource not found'}});
    if(err.code==='P2003')return res.status(400).json({error:{code:'BAD_RELATION',message:'Invalid relation'}});
  }
  if(err.type==='entity.too.large')return res.status(413).json({error:{code:'PAYLOAD_TOO_LARGE',message:'JSON body exceeds 10kb'}});
  if(err.type==='entity.parse.failed')return res.status(400).json({error:{code:'INVALID_JSON',message:'Malformed JSON'}});
  if(process.env.NODE_ENV!=='test')console.error(err);
  res.status(500).json({error:{code:'INTERNAL_ERROR',message:'Internal server error',
    ...(process.env.NODE_ENV==='development'?{details:err.message}:{})
  }});
};
