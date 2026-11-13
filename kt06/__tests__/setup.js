const {prisma,redis}=require('../src/config');
beforeAll(async()=>{
  await prisma.$connect();
  if(!redis.isOpen)await redis.connect();
});
beforeEach(async()=>{
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await redis.flushDb();
});
afterAll(async()=>{
  await prisma.$disconnect();
  if(redis.isOpen)await redis.quit();
});
