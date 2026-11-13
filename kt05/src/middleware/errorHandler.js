const {Prisma}=require('@prisma/client');
module.exports=(err,_req,res,_next)=>{
  if(res.headersSent)return;
  if(err instanceof Prisma.PrismaClientKnownRequestError){
    if(err.code==='P2002')return res.status(409).json({error:'Unique value already exists'});
    if(err.code==='P2025')return res.status(404).json({error:'Record not found'});
    if(err.code==='P2003')return res.status(400).json({error:'Invalid relation'});
  }
  if(err.type==='entity.too.large')return res.status(413).json({error:'Request body exceeds 10kb'});
  if(err.type==='entity.parse.failed')return res.status(400).json({error:'Invalid JSON'});
  if(process.env.NODE_ENV!=='test')console.error(err);
  res.status(500).json({error:'Internal server error',...(process.env.NODE_ENV==='development'?{message:err.message}:{})});
};
