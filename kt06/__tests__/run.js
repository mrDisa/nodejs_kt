const {spawnSync}=require('node:child_process');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
require('dotenv').config({path:path.join(base,'.env'),override:false});
if(!process.env.TEST_DATABASE_URL) {
  console.error('TEST_DATABASE_URL is required: use a dedicated test database');
  process.exit(1);
}
if(process.env.TEST_DATABASE_URL===process.env.DATABASE_URL) {
  console.error('TEST_DATABASE_URL must differ from DATABASE_URL');
  process.exit(1);
}
// Redis DB 15 is reserved for tests. Never clear the application's Redis database.
const redisUrl=new URL(process.env.REDIS_URL||'redis://localhost:6379');
redisUrl.pathname='/15';
const env={...process.env,NODE_ENV:'test',DATABASE_URL:process.env.TEST_DATABASE_URL,REDIS_URL:redisUrl.toString()};
for(const [binary,args] of [
  [require.resolve('prisma/build/index.js'),['migrate','deploy']],
  [require.resolve('prisma/build/index.js'),['generate']],
  [require.resolve('jest/bin/jest'),['--runInBand']]
]){
  const result=spawnSync(process.execPath,[binary,...args],{cwd:base,env,stdio:'inherit'});
  if(result.error){console.error(result.error);process.exit(1);}
  if(result.status!==0)process.exit(result.status||1);
}
