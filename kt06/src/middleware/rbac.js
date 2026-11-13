function allowRoles(...roles) {
  return (req,res,next) => {
    if (!req.user) return res.status(401).json({error:{code:'UNAUTHORIZED',message:'Authentication required'}});
    if (!roles.includes(req.user.role)) return res.status(403).json({error:{code:'FORBIDDEN',message:'Insufficient permissions'}});
    next();
  };
}
function canManage(user,ownerId) {
  return user.role==='ADMIN'||user.id===ownerId;
}
module.exports={allowRoles,canManage};
