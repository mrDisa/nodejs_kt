const Joi = require('joi');

const positiveId = Joi.number().integer().positive();
const userCreate = Joi.object({
  email: Joi.string().email().max(254).required(),
  name: Joi.string().trim().min(2).max(100).required(),
  role: Joi.string().valid('USER', 'ADMIN').default('USER')
}).unknown(false);
const userPatch = Joi.object({
  email: Joi.string().email().max(254),
  name: Joi.string().trim().min(2).max(100),
  role: Joi.string().valid('USER', 'ADMIN')
}).min(1).unknown(false);
const tags = Joi.array().items(Joi.string().trim().min(1).max(50)).max(30).unique().default([]);
const postCreate = Joi.object({
  title: Joi.string().trim().min(1).max(255).required(),
  content: Joi.string().allow('', null).max(20000),
  published: Joi.boolean().default(false),
  authorId: positiveId.required(),
  tags
}).unknown(false);
const postPatch = Joi.object({
  title: Joi.string().trim().min(1).max(255),
  content: Joi.string().allow('', null).max(20000),
  published: Joi.boolean(),
  authorId: positiveId,
  tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(30).unique()
}).min(1).unknown(false);
const pagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
};
const usersQuery = Joi.object(pagination).unknown(false);
const postsQuery = Joi.object({
  ...pagination,
  search: Joi.string().trim().min(1).max(255),
  published: Joi.boolean(),
  authorId: positiveId
}).unknown(false);

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false, convert: true
    });
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    if (source === 'query') req.validatedQuery = value;
    else req[source] = value;
    next();
  };
}
function validateId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0 || !/^\d+$/.test(req.params.id)) {
    return res.status(400).json({
      error: 'Validation error',
      details: [{ field: 'id', message: 'id must be a positive integer' }]
    });
  }
  req.resourceId = id;
  next();
}
module.exports = { validate, validateId, userCreate, userPatch, postCreate, postPatch, usersQuery, postsQuery };
