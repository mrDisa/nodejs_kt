const {spawnSync}=require('node:child_process');
const path=require('node:path');
process.env.NODE_ENV='test';
process.env.DATABASE_URL='file:./test.db';
process.env.JWT_ACCESS_SECRET='test-access-secret-0123456789-abcdefghijklmnopqrstuvwxyz';
process.env.JWT_REFRESH_SECRET='test-refresh-secret-0123456789-abcdefghijklmnopqrstuvwxyz';
const base=path.resolve(__dirname,'..');
for (const [script,args] of [
  [require.resolve('prisma'),['migrate','deploy']],
  [require.resolve('prisma'),['generate']],
  [require.resolve('jest/bin/jest'),['--runInBand']]
]) {
 const result=spawnSync(process.execPath,[script,...args],{stdio:'inherit',env:process.env,cwd:base});
 if(result.error){console.error(result.error);process.exit(1);}
 if(result.status!==0)process.exit(result.status||1);
}
