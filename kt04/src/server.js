const app=require('./app');
const {port,prisma}=require('./config');
const server=app.listen(port,()=>console.log('KT4 API: http://localhost:'+port));
function shutdown(){server.close(async()=>{await prisma.$disconnect();process.exit(0);});}
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);
