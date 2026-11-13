const Joi = require('joi');

const categories = ['electronics', 'clothing', 'food', 'other'];
const fields = {
  name: Joi.string().trim().min(2).max(100),
  price: Joi.number().greater(0),
  category: Joi.string().valid(...categories),
  stock: Joi.number().integer().min(0),
  description: Joi.string().allow('').max(500)
};
const createSchema = Joi.object({
  name: fields.name.required(),
  price: fields.price.required(),
  category: fields.category.required(),
  stock: fields.stock.default(0),
  description: fields.description.optional()
}).unknown(false);
const putSchema = Joi.object({
  name: fields.name.required(),
  price: fields.price.required(),
  category: fields.category.required(),
  stock: fields.stock.default(0),
  description: fields.description.optional()
}).unknown(false);
const patchSchema = Joi.object(fields).min(1).unknown(false);
const querySchema = Joi.object({
  category: fields.category,
  minPrice: Joi.number().min(0),
  maxPrice: Joi.number().min(0),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
}).custom((value, helper) => {
  if (value.minPrice !== undefined && value.maxPrice !== undefined && value.minPrice > value.maxPrice) {
    return helper.message('minPrice must be less than or equal to maxPrice');
  }
  return value;
});

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { value, error } = schema.validate(req[source], {
      abortEarly: false, convert: true, stripUnknown: false
    });
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(item => ({ field: item.path.join('.'), message: item.message }))
      });
    }
    if (source === 'query') req.validatedQuery = value;
    else req[source] = value;
    next();
  };
}

module.exports = { validate, createSchema, putSchema, patchSchema, querySchema };
