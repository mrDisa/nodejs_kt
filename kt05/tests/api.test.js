const request=require('supertest');
const bcrypt=require('bcrypt');
const app=require('../src/app');
const {prisma}=require('../src/config');
const {signAccess}=require('../src/utils/jwt');
const {canManagePost}=require('../src/middleware/auth');

async function user(email,role='USER'){
  return prisma.user.create({data:{email,name:'Test User',passwordHash:await bcrypt.hash('secret123',4),role}});
}
const bearer=u=>({Authorization:'Bearer '+signAccess(u)});
beforeEach(async()=>{
  await prisma.post.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany();
});
afterAll(async()=>{await prisma.$disconnect();});

describe('Authentication',()=>{
  test('register success: password is hashed',async()=>{
    const r=await request(app).post('/auth/register').send({email:'alice@example.com',name:'Alice',password:'secret123'});
    expect(r.status).toBe(201);
    expect(r.body).not.toHaveProperty('passwordHash');
    const db=await prisma.user.findUnique({where:{email:'alice@example.com'}});
    expect(db.passwordHash).not.toBe('secret123');
    expect(await bcrypt.compare('secret123',db.passwordHash)).toBe(true);
  });
  test('register duplicate email returns 409',async()=>{
    const body={email:'alice@example.com',name:'Alice',password:'secret123'};
    await request(app).post('/auth/register').send(body);
    expect((await request(app).post('/auth/register').send(body)).status).toBe(409);
  });
  test('login succeeds, sets httpOnly refresh cookie',async()=>{
    await user('alice@example.com');
    const r=await request(app).post('/auth/login').send({email:'alice@example.com',password:'secret123'});
    expect(r.status).toBe(200);
    expect(r.body.accessToken).toBeTruthy();
    expect(r.headers['set-cookie'].join(' ')).toContain('HttpOnly');
  });
  test('login wrong password returns 401',async()=>{
    await user('alice@example.com');
    expect((await request(app).post('/auth/login').send({email:'alice@example.com',password:'wrong'})).status).toBe(401);
  });
  test('/auth/me without bearer token returns 401',async()=>{
    expect((await request(app).get('/auth/me')).status).toBe(401);
  });
  test('/auth/me with token returns sanitized user',async()=>{
    const u=await user('alice@example.com');
    const r=await request(app).get('/auth/me').set(bearer(u));
    expect(r.status).toBe(200);
    expect(r.body.email).toBe(u.email);
    expect(r.body.passwordHash).toBeUndefined();
  });
  test('refresh cookie gives new access token; logout revokes refresh',async()=>{
    await user('alice@example.com');
    const agent=request.agent(app);
    const login=await agent.post('/auth/login').send({email:'alice@example.com',password:'secret123'});
    expect(login.status).toBe(200);
    const refresh=await agent.post('/auth/refresh');
    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toBeTruthy();
    expect((await agent.post('/auth/logout')).status).toBe(204);
    expect((await agent.post('/auth/refresh')).status).toBe(401);
  });
  test('login rate limit permits at most 10 requests in 15 minutes',async()=>{
    const agent=request(app);
    let statuses=[];
    for(let i=0;i<11;i++){
      const r=await agent.post('/auth/login').set('X-Forwarded-For','').send({email:'rate@example.org',password:'bad'});
      statuses.push(r.status);
    }
    expect(statuses[10]).toBe(429);
  });
});

describe('RBAC and posts',()=>{
  test('owner can delete their own post',async()=>{
    const u=await user('owner@example.com');
    const p=await prisma.post.create({data:{title:'Owned',authorId:u.id}});
    expect((await request(app).delete('/api/posts/'+p.id).set(bearer(u))).status).toBe(204);
  });
  test('another USER cannot delete a post (403)',async()=>{
    const owner=await user('owner@example.com');
    const other=await user('other@example.com');
    const p=await prisma.post.create({data:{title:'Owned',authorId:owner.id}});
    expect((await request(app).delete('/api/posts/'+p.id).set(bearer(other))).status).toBe(403);
  });
  test('moderator may edit someone else\'s post',async()=>{
    const owner=await user('owner@example.com');
    const moderator=await user('mod@example.com','MODERATOR');
    const p=await prisma.post.create({data:{title:'Original',authorId:owner.id}});
    const r=await request(app).patch('/api/posts/'+p.id).set(bearer(moderator)).send({title:'Edited'});
    expect(r.status).toBe(200);expect(r.body.title).toBe('Edited');
  });
  test('USER cannot list users; MODERATOR can',async()=>{
    const normal=await user('user@example.com');
    const moderator=await user('mod@example.com','MODERATOR');
    expect((await request(app).get('/api/users').set(bearer(normal))).status).toBe(403);
    expect((await request(app).get('/api/users').set(bearer(moderator))).status).toBe(200);
  });
  test('only ADMIN can promote a user',async()=>{
    const ordinary=await user('user@example.com');
    const admin=await user('admin@example.com','ADMIN');
    expect((await request(app).patch('/admin/users/'+ordinary.id+'/role').set(bearer(ordinary)).send({role:'ADMIN'})).status).toBe(403);
    const r=await request(app).patch('/admin/users/'+ordinary.id+'/role').set(bearer(admin)).send({role:'MODERATOR'});
    expect(r.status).toBe(200);expect(r.body.role).toBe('MODERATOR');
  });
  test('post creation connects existing tag instead of duplicating',async()=>{
    const u=await user('owner@example.com');
    for(let i=0;i<2;i++){
      const r=await request(app).post('/api/posts').set(bearer(u)).send({title:'Entry '+i,tags:['prisma']});
      expect(r.status).toBe(201);
    }
    expect(await prisma.tag.count({where:{name:'prisma'}})).toBe(1);
  });
  test('response has helmet security headers and body limit',async()=>{
    const r=await request(app).get('/no-route');
    expect(r.headers['x-frame-options']).toBeTruthy();
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    const u=await user('owner@example.com');
    expect((await request(app).post('/api/posts').set(bearer(u)).send({title:'A'.repeat(11000)})).status).toBe(413);
  });
  test('post filter and pagination retain KT3 features',async()=>{
    const u=await user('owner@example.com');
    await prisma.post.create({data:{title:'Prisma Guide',published:true,authorId:u.id}});
    await prisma.post.create({data:{title:'Other',published:false,authorId:u.id}});
    const r=await request(app).get('/api/posts?search=prisma&published=true&authorId='+u.id+'&page=1&limit=1').set(bearer(u));
    expect(r.status).toBe(200);
    expect(r.body.meta).toEqual({total:1,page:1,limit:1,pages:1});
    expect(r.body.data[0].title).toBe('Prisma Guide');
  });
});

test('unit test: canManagePost enforces ownership',()=>{
  const post={authorId:3};
  expect(canManagePost({user:{id:3,role:'USER'}},post)).toBe(true);
  expect(canManagePost({user:{id:4,role:'USER'}},post)).toBe(false);
  expect(canManagePost({user:{id:4,role:'MODERATOR'}},post)).toBe(true);
});
