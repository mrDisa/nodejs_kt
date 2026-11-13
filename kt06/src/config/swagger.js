const data=ref=>({type:'object',required:['data'],properties:{data:{$ref:'#/components/schemas/'+ref}}});
const errorResponse={description:'Error response',content:{'application/json':{schema:{$ref:'#/components/schemas/Error'}}}};
const jsonBody=schema=>({required:true,content:{'application/json':{schema:{$ref:'#/components/schemas/'+schema}}}});
const response=(description,schema)=>({description,content:{'application/json':{schema}}});
const objectRef=name=>({$ref:'#/components/schemas/'+name});
const single=(name,description='Success')=>response(description,data(name));
const paramId={name:'id',in:'path',required:true,schema:{type:'integer',minimum:1},description:'Resource ID'};
const pageParams=[
  {name:'page',in:'query',schema:{type:'integer',minimum:1,default:1}},
  {name:'limit',in:'query',schema:{type:'integer',minimum:1,maximum:100,default:10}}
];
const authorized={security:[{bearerAuth:[]}]};
const crudErrors={'400':errorResponse,'401':errorResponse,'403':errorResponse,'404':errorResponse,'409':errorResponse};
const docs={
  openapi:'3.0.3',
  info:{title:'TaskFlow API',version:'1.0.0',description:'Final coursework backend: projects and tasks, JWT and RBAC, PostgreSQL and Redis'},
  servers:[{url:'/',description:'Current host'}],
  tags:[
    {name:'Auth',description:'Registration, login and JWT refresh'},
    {name:'Projects',description:'Project CRUD'},
    {name:'Tasks',description:'Task CRUD'},
    {name:'Admin',description:'Role management'},
    {name:'System',description:'Health check'}
  ],
  components:{
    securitySchemes:{bearerAuth:{type:'http',scheme:'bearer',bearerFormat:'JWT'}},
    schemas:{
      User:{type:'object',required:['id','email','name','role','createdAt'],properties:{
        id:{type:'integer',example:1},email:{type:'string',format:'email'},name:{type:'string'},
        role:{type:'string',enum:['USER','ADMIN']},createdAt:{type:'string',format:'date-time'}}},
      Project:{type:'object',properties:{
        id:{type:'integer'},name:{type:'string'},description:{type:'string',nullable:true},
        status:{type:'string',enum:['ACTIVE','ARCHIVED']},
        ownerId:{type:'integer'},createdAt:{type:'string',format:'date-time'},
        updatedAt:{type:'string',format:'date-time'}}},
      Task:{type:'object',properties:{
        id:{type:'integer'},title:{type:'string'},description:{type:'string',nullable:true},
        status:{type:'string',enum:['TODO','IN_PROGRESS','DONE']},
        priority:{type:'string',enum:['LOW','MEDIUM','HIGH']},
        dueDate:{type:'string',format:'date-time',nullable:true},
        projectId:{type:'integer'},createdAt:{type:'string',format:'date-time'},
        updatedAt:{type:'string',format:'date-time'}}},
      RegisterInput:{type:'object',required:['name','email','password'],properties:{
        name:{type:'string',minLength:2,maxLength:100,example:'Alice'},
        email:{type:'string',format:'email',example:'alice@example.com'},
        password:{type:'string',format:'password',minLength:8,example:'strongPassword123'}}},
      LoginInput:{type:'object',required:['email','password'],properties:{
        email:{type:'string',format:'email'},password:{type:'string',format:'password'}}},
      Tokens:{type:'object',properties:{
        accessToken:{type:'string'},tokenType:{type:'string',example:'Bearer'},expiresIn:{type:'integer',example:900}}},
      ProjectInput:{type:'object',required:['name'],properties:{
        name:{type:'string',minLength:2,maxLength:100},description:{type:'string',nullable:true},
        status:{type:'string',enum:['ACTIVE','ARCHIVED']}}},
      ProjectPatch:{type:'object',minProperties:1,properties:{
        name:{type:'string',minLength:2},description:{type:'string',nullable:true},
        status:{type:'string',enum:['ACTIVE','ARCHIVED']}}},
      TaskInput:{type:'object',required:['title','projectId'],properties:{
        title:{type:'string',minLength:2},description:{type:'string',nullable:true},
        status:{type:'string',enum:['TODO','IN_PROGRESS','DONE']},
        priority:{type:'string',enum:['LOW','MEDIUM','HIGH']},
        dueDate:{type:'string',format:'date-time',nullable:true},projectId:{type:'integer'}}},
      TaskPatch:{type:'object',minProperties:1,properties:{
        title:{type:'string',minLength:2},description:{type:'string',nullable:true},
        status:{type:'string',enum:['TODO','IN_PROGRESS','DONE']},
        priority:{type:'string',enum:['LOW','MEDIUM','HIGH']},
        dueDate:{type:'string',format:'date-time',nullable:true}}},
      RoleInput:{type:'object',required:['role'],properties:{role:{type:'string',enum:['USER','ADMIN']}}},
      Meta:{type:'object',properties:{total:{type:'integer'},page:{type:'integer'},limit:{type:'integer'},pages:{type:'integer'}}},
      Error:{type:'object',required:['error'],properties:{error:{type:'object',properties:{
        code:{type:'string'},message:{type:'string'},details:{type:'array',items:{type:'object'}}}}}}
    }
  },
  paths:{}
};
const p=docs.paths;
p['/health']={get:{tags:['System'],summary:'Liveness check',responses:{'200':response('Service alive',{type:'object',properties:{data:{type:'object',properties:{status:{type:'string'}}}}})}}};
p['/api/openapi.json']={get:{tags:['System'],summary:'OpenAPI JSON specification',responses:{'200':{description:'OpenAPI document'}}}};
p['/api/docs']={get:{tags:['System'],summary:'Interactive Swagger UI',responses:{'200':{description:'HTML Swagger UI'}}}};
p['/auth/register']={post:{tags:['Auth'],summary:'Register USER with bcrypt password hashing',requestBody:jsonBody('RegisterInput'),
  responses:{'201':single('User','User created'),'400':errorResponse,'409':errorResponse}}};
p['/auth/login']={post:{tags:['Auth'],summary:'Login. Sets httpOnly refreshToken cookie',requestBody:jsonBody('LoginInput'),
  responses:{'200':single('Tokens'),'400':errorResponse,'401':errorResponse,'429':errorResponse,'503':errorResponse}}};
p['/auth/refresh']={post:{tags:['Auth'],summary:'Rotate refresh cookie and issue access token',
  parameters:[{name:'refreshToken',in:'cookie',required:true,schema:{type:'string'}}],
  responses:{'200':single('Tokens'),'401':errorResponse,'404':errorResponse}}};
p['/auth/logout']={post:{tags:['Auth'],summary:'Clear and revoke refresh cookie',
  responses:{'204':{description:'Logged out (empty body)'}}}};
p['/auth/me']={get:{...authorized,tags:['Auth'],summary:'Get current user',
  responses:{'200':single('User'),'401':errorResponse}}};
p['/api/projects']={
  get:{...authorized,tags:['Projects'],summary:'List projects with filtering and pagination',parameters:[
    ...pageParams,{name:'status',in:'query',schema:{type:'string',enum:['ACTIVE','ARCHIVED']}},
    {name:'search',in:'query',schema:{type:'string'}},
    {name:'ownerId',in:'query',description:'Effective for ADMIN; USER always sees own projects',schema:{type:'integer'}}
  ],responses:{'200':response('Paginated projects',{type:'object',properties:{
    data:{type:'array',items:objectRef('Project')},meta:objectRef('Meta')}}),...crudErrors}},
  post:{...authorized,tags:['Projects'],summary:'Create project owned by current user',requestBody:jsonBody('ProjectInput'),
    responses:{'201':single('Project','Created'),...crudErrors}}
};
p['/api/projects/{id}']={
  get:{...authorized,tags:['Projects'],summary:'Get project including its tasks',parameters:[paramId],responses:{'200':single('Project'),...crudErrors}},
  patch:{...authorized,tags:['Projects'],summary:'Update own project or any project as ADMIN',parameters:[paramId],requestBody:jsonBody('ProjectPatch'),responses:{'200':single('Project'),...crudErrors}},
  delete:{...authorized,tags:['Projects'],summary:'Delete project and its tasks',parameters:[paramId],responses:{'204':{description:'Deleted (empty body)'},...crudErrors}}
};
p['/api/tasks']={
  get:{...authorized,tags:['Tasks'],summary:'List tasks with filtering and pagination',parameters:[
    ...pageParams,{name:'projectId',in:'query',schema:{type:'integer'}},
    {name:'status',in:'query',schema:{type:'string',enum:['TODO','IN_PROGRESS','DONE']}},
    {name:'priority',in:'query',schema:{type:'string',enum:['LOW','MEDIUM','HIGH']}},
    {name:'search',in:'query',schema:{type:'string'}}
  ],responses:{'200':response('Paginated tasks',{type:'object',properties:{
    data:{type:'array',items:objectRef('Task')},meta:objectRef('Meta')}}),...crudErrors}},
  post:{...authorized,tags:['Tasks'],summary:'Create task in accessible project',requestBody:jsonBody('TaskInput'),
    responses:{'201':single('Task','Created'),...crudErrors}}
};
p['/api/tasks/{id}']={
  get:{...authorized,tags:['Tasks'],summary:'Get task by ID',parameters:[paramId],responses:{'200':single('Task'),...crudErrors}},
  patch:{...authorized,tags:['Tasks'],summary:'Update task in own project or as ADMIN',parameters:[paramId],requestBody:jsonBody('TaskPatch'),responses:{'200':single('Task'),...crudErrors}},
  delete:{...authorized,tags:['Tasks'],summary:'Delete task',parameters:[paramId],responses:{'204':{description:'Deleted (empty body)'},...crudErrors}}
};
p['/admin/users']={get:{...authorized,tags:['Admin'],summary:'List users (ADMIN only)',responses:{
  '200':response('List of public user fields',{type:'object',properties:{data:{type:'array',items:objectRef('User')}}}),
  '401':errorResponse,'403':errorResponse}}};
p['/admin/users/{id}/role']={patch:{...authorized,tags:['Admin'],summary:'Update user role (ADMIN only)',
  parameters:[paramId],requestBody:jsonBody('RoleInput'),responses:{'200':single('User'),...crudErrors}}};
module.exports=docs;
