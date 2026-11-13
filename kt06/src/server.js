const app=require('./app');
const {prisma,redis,port}=require('./config');

async function main() {
  await prisma.$connect();
  await redis.connect();
  const server=app.listen(port,()=>console.log('TaskFlow listening on '+port));
  async function shutdown(){
    server.close(async()=>{
      await Promise.allSettled([prisma.$disconnect(),redis.quit()]);
      process.exit(0);
    });
  }
  process.once('SIGINT',shutdown);
  process.once('SIGTERM',shutdown);
}
main().catch(async error=>{
  console.error('Startup failure:',error);
  await Promise.allSettled([prisma.$disconnect(),redis.isOpen?redis.quit():Promise.resolve()]);
  process.exit(1);
});
