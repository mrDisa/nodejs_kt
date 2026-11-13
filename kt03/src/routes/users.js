const express = require('express');
const { prisma } = require('../config');
const { validate, validateId, userCreate, userPatch, usersQuery } = require('../middleware/validate');

const router = express.Router();
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', validate(usersQuery, 'query'), asyncRoute(async (req, res) => {
  const { page, limit } = req.validatedQuery;
  const [total, data] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { id: 'asc' }
    })
  ]);
  res.json({ data, meta: { total, page, limit, pages: Math.ceil(total / limit) } });
}));

router.get('/:id', validateId, asyncRoute(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.resourceId },
    include: { posts: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] } }
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
}));

router.post('/', validate(userCreate), asyncRoute(async (req, res) => {
  const user = await prisma.user.create({ data: req.body });
  res.status(201).location(`/api/users/${user.id}`).json(user);
}));

router.patch('/:id', validateId, validate(userPatch), asyncRoute(async (req, res) => {
  const user = await prisma.user.update({ where: { id: req.resourceId }, data: req.body });
  res.json(user);
}));

router.delete('/:id', validateId, asyncRoute(async (req, res) => {
  await prisma.user.delete({ where: { id: req.resourceId } });
  res.status(204).end();
}));

module.exports = router;
