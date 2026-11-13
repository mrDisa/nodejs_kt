const express = require('express');
const { prisma } = require('../config');
const { validate, validateId, postCreate, postPatch, postsQuery } = require('../middleware/validate');

const router = express.Router();
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const include = { author: true, tags: { orderBy: { name: 'asc' } } };

function tagOperations(names) {
  return names.map(name => ({
    where: { name },
    create: { name }
  }));
}
function inputToData(input, isPatch) {
  const { tags, authorId, ...scalars } = input;
  const data = { ...scalars };
  if (authorId !== undefined) data.author = { connect: { id: authorId } };
  if (tags !== undefined) {
    data.tags = isPatch
      ? { set: [], connectOrCreate: tagOperations(tags) }
      : { connectOrCreate: tagOperations(tags) };
  }
  return data;
}

router.get('/', validate(postsQuery, 'query'), asyncRoute(async (req, res) => {
  const { search, published, authorId, page, limit } = req.validatedQuery;
  const where = {
    ...(search !== undefined ? { title: { contains: search } } : {}),
    ...(published !== undefined ? { published } : {}),
    ...(authorId !== undefined ? { authorId } : {})
  };
  // SQLite's LIKE operator is case-insensitive for ASCII; Prisma SQLite does not expose mode: 'insensitive'.
  const [total, data] = await prisma.$transaction([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include
    })
  ]);
  res.json({ data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
}));

router.get('/:id', validateId, asyncRoute(async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: req.resourceId }, include
  });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
}));

router.post('/', validate(postCreate), asyncRoute(async (req, res) => {
  const { authorId } = req.body;
  const author = await prisma.user.findUnique({ where: { id: authorId }, select: { id: true } });
  if (!author) return res.status(404).json({ error: 'Author not found' });
  const post = await prisma.post.create({
    data: inputToData(req.body, false), include
  });
  res.status(201).location(`/api/posts/${post.id}`).json(post);
}));

router.patch('/:id', validateId, validate(postPatch), asyncRoute(async (req, res) => {
  if (req.body.authorId !== undefined) {
    const author = await prisma.user.findUnique({
      where: { id: req.body.authorId }, select: { id: true }
    });
    if (!author) return res.status(404).json({ error: 'Author not found' });
  }
  const post = await prisma.post.update({
    where: { id: req.resourceId }, data: inputToData(req.body, true), include
  });
  res.json(post);
}));

router.delete('/:id', validateId, asyncRoute(async (req, res) => {
  await prisma.post.delete({ where: { id: req.resourceId } });
  res.status(204).end();
}));

module.exports = router;
