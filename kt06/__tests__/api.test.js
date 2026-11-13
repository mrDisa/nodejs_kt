const request=require('supertest');
const bcrypt=require('bcrypt');
const app=require('../src/app');
const {prisma}=require('../src/config');
const {signAccess}=require('../src/utils/jwt');
const {canManage}=require('../src/middleware/rbac');

async function createUser(email,role='USER'){
  return prisma.user.create({data:{email,name:'Sample User',role,passwordHash:await bcrypt.hash('password123',4)}});
}
const auth=user=>({Authorization:'Bearer '+signAccess(user)});
const post=(url,body,headers)=>request(app).post(url).set(headers||{}).send(body);

test('register success hashes password and hides it',async()=>{
  const r=await post('/auth/register',{name:'Alice',email:'alice@example.com',password:'password123'});
  expect(r.status).toBe(201);expect(r.body.data.role).toBe('USER');
  expect(r.body.data).not.toHaveProperty('passwordHash');
  const u=await prisma.user.findUnique({where:{email:'alice@example.com'}});
  expect(await bcrypt.compare('password123',u.passwordHash)).toBe(true);
});
test('duplicate email returns 409',async()=>{
  const body={name:'Alice',email:'alice@example.com',password:'password123'};
  await post('/auth/register',body);
  expect((await post('/auth/register',body)).status).toBe(409);
});
test('login returns access and httpOnly refresh',async()=>{
  await createUser('bob@example.com');
  const r=await post('/auth/login',{email:'bob@example.com',password:'password123'});
  expect(r.status).toBe(200);expect(r.body.data.accessToken).toBeTruthy();
  expect(r.headers['set-cookie'].join(' ')).toContain('HttpOnly');
});
test('invalid password returns 401',async()=>{
  await createUser('bob@example.com');
  expect((await post('/auth/login',{email:'bob@example.com',password:'wrong'})).status).toBe(401);
});
test('refresh rotates token and logout revokes it',async()=>{
  await createUser('bob@example.com');
  const agent=request.agent(app);
  expect((await agent.post('/auth/login').send({email:'bob@example.com',password:'password123'})).status).toBe(200);
  expect((await agent.post('/auth/refresh')).status).toBe(200);
  expect((await agent.post('/auth/logout')).status).toBe(204);
  expect((await agent.post('/auth/refresh')).status).toBe(401);
});
test('protected route returns 401 without access token',async()=>{
  expect((await request(app).get('/api/projects')).status).toBe(401);
});
test('project create, read, update, delete',async()=>{
  const u=await createUser('owner@example.com');
  const created=await post('/api/projects',{name:'College tasks'},auth(u));
  expect(created.status).toBe(201);
  const id=created.body.data.id;
  expect((await request(app).get('/api/projects/'+id).set(auth(u))).status).toBe(200);
  const updated=await request(app).patch('/api/projects/'+id).set(auth(u)).send({status:'ARCHIVED'});
  expect(updated.status).toBe(200);expect(updated.body.data.status).toBe('ARCHIVED');
  expect((await request(app).delete('/api/projects/'+id).set(auth(u))).status).toBe(204);
  expect((await request(app).get('/api/projects/'+id).set(auth(u))).status).toBe(404);
});
test('task create, read, update, delete',async()=>{
  const u=await createUser('owner@example.com');
  const p=await prisma.project.create({data:{name:'College',ownerId:u.id}});
  const created=await post('/api/tasks',{title:'Write tests',projectId:p.id},auth(u));
  expect(created.status).toBe(201);
  const id=created.body.data.id;
  expect((await request(app).get('/api/tasks/'+id).set(auth(u))).status).toBe(200);
  const changed=await request(app).patch('/api/tasks/'+id).set(auth(u)).send({status:'DONE'});
  expect(changed.status).toBe(200);expect(changed.body.data.status).toBe('DONE');
  expect((await request(app).delete('/api/tasks/'+id).set(auth(u))).status).toBe(204);
});
test('other USER cannot edit or delete project or task',async()=>{
  const owner=await createUser('owner@example.com');
  const stranger=await createUser('stranger@example.com');
  const p=await prisma.project.create({data:{name:'Private',ownerId:owner.id}});
  const t=await prisma.task.create({data:{title:'Private task',projectId:p.id}});
  expect((await request(app).patch('/api/projects/'+p.id).set(auth(stranger)).send({name:'Stolen'})).status).toBe(403);
  expect((await request(app).delete('/api/tasks/'+t.id).set(auth(stranger))).status).toBe(403);
  expect((await post('/api/tasks',{title:'Should not work',projectId:p.id},auth(stranger))).status).toBe(403);
});
test('ADMIN can manage other users projects and roles',async()=>{
  const owner=await createUser('owner@example.com');
  const admin=await createUser('admin@example.com','ADMIN');
  const p=await prisma.project.create({data:{name:'Shared',ownerId:owner.id}});
  expect((await request(app).patch('/api/projects/'+p.id).set(auth(admin)).send({name:'Edited by admin'})).status).toBe(200);
  const role=await request(app).patch('/admin/users/'+owner.id+'/role').set(auth(admin)).send({role:'ADMIN'});
  expect(role.status).toBe(200);expect(role.body.data.role).toBe('ADMIN');
});
test('USER cannot change roles',async()=>{
  const user=await createUser('user@example.com');
  expect((await request(app).patch('/admin/users/'+user.id+'/role').set(auth(user)).send({role:'ADMIN'})).status).toBe(403);
});
test('filters and pagination work on projects and tasks',async()=>{
  const u=await createUser('owner@example.com');
  const a=await prisma.project.create({data:{name:'Study Python',ownerId:u.id}});
  await prisma.project.create({data:{name:'Another project',ownerId:u.id,status:'ARCHIVED'}});
  await prisma.task.create({data:{title:'Finish API',status:'DONE',priority:'HIGH',projectId:a.id}});
  await prisma.task.create({data:{title:'Start tests',status:'TODO',priority:'LOW',projectId:a.id}});
  const projects=await request(app).get('/api/projects?search=STUDY&status=ACTIVE&page=1&limit=1').set(auth(u));
  expect(projects.status).toBe(200);expect(projects.body.meta).toEqual({total:1,page:1,limit:1,pages:1});
  const tasks=await request(app).get('/api/tasks?projectId='+a.id+'&status=DONE&priority=HIGH&search=finish&page=1&limit=1').set(auth(u));
  expect(tasks.status).toBe(200);expect(tasks.body.meta.total).toBe(1);
});
test('validation responds 400 with details',async()=>{
  const u=await createUser('owner@example.com');
  const r=await post('/api/projects',{name:'X',role:'ADMIN'},auth(u));
  expect(r.status).toBe(400);expect(r.body.error.details.length).toBeGreaterThan(0);
});
test('Swagger UI and OpenAPI schemas are available',async()=>{
  const r=await request(app).get('/api/openapi.json');
  expect(r.status).toBe(200);
  expect(r.body.components.schemas.Project).toBeDefined();
  expect(r.body.components.schemas.Task).toBeDefined();
  expect(r.body.paths['/api/projects/{id}']).toBeDefined();
  expect((await request(app).get('/api/docs/')).status).toBe(200);
});
test('helmet sets secure response headers',async()=>{
  const r=await request(app).get('/health');
  expect(r.status).toBe(200);
  expect(r.headers['x-frame-options']).toBeDefined();
  expect(r.headers['x-content-type-options']).toBe('nosniff');
});
test('login limited after 10 requests via Redis',async()=>{
  for(let i=0;i<10;i++){
    const r=await post('/auth/login',{email:'none@example.com',password:'wrong'});
    expect(r.status).toBe(401);
  }
  expect((await post('/auth/login',{email:'none@example.com',password:'wrong'})).status).toBe(429);
});
test('unit: ownership helper respects ADMIN and owner',()=>{
  expect(canManage({id:2,role:'USER'},2)).toBe(true);
  expect(canManage({id:3,role:'USER'},2)).toBe(false);
  expect(canManage({id:3,role:'ADMIN'},2)).toBe(true);
});
