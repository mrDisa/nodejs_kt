const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { dataFile, uploadDir } = require('../config');
const { validate, createSchema, putSchema, patchSchema, querySchema } = require('../middleware/validate');
const upload = require('../middleware/upload');

const router = express.Router();
fs.mkdirSync(path.dirname(dataFile), { recursive: true });
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]\n');

function readProducts() {
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}
function saveProducts(items) {
  const tmp = dataFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2) + '\n');
  fs.renameSync(tmp, dataFile);
}
function getId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid product id', details: [{ field: 'id', message: 'id must be a positive integer' }] });
  }
  req.productId = id;
  next();
}
function findOr404(req, res, next) {
  const products = readProducts();
  const index = products.findIndex(item => item.id === req.productId);
  if (index === -1) return res.status(404).json({ error: 'Product not found' });
  req.products = products;
  req.productIndex = index;
  next();
}
router.get('/', validate(querySchema, 'query'), (req, res) => {
  const { category, minPrice, maxPrice, page, limit } = req.validatedQuery;
  let products = readProducts();
  if (category) products = products.filter(item => item.category === category);
  if (minPrice !== undefined) products = products.filter(item => item.price >= minPrice);
  if (maxPrice !== undefined) products = products.filter(item => item.price <= maxPrice);
  const total = products.length;
  res.json({ data: products.slice((page - 1) * limit, page * limit), total, page, limit });
});
router.get('/:id', getId, findOr404, (req, res) => res.json(req.products[req.productIndex]));
router.post('/', validate(createSchema), (req, res) => {
  const products = readProducts();
  const id = Math.max(0, ...products.map(p => p.id)) + 1;
  const product = {
    id,
    name: req.body.name,
    price: req.body.price,
    category: req.body.category,
    stock: req.body.stock,
    description: req.body.description ?? '',
    imageUrl: null,
    createdAt: new Date().toISOString()
  };
  products.push(product);
  saveProducts(products);
  res.status(201).location(`/api/products/${id}`).json(product);
});
router.put('/:id', getId, validate(putSchema), findOr404, (req, res) => {
  const old = req.products[req.productIndex];
  const updated = {
    id: old.id, name: req.body.name, price: req.body.price,
    category: req.body.category, stock: req.body.stock,
    description: req.body.description ?? '',
    imageUrl: old.imageUrl, createdAt: old.createdAt
  };
  req.products[req.productIndex] = updated;
  saveProducts(req.products);
  res.json(updated);
});
router.patch('/:id', getId, validate(patchSchema), findOr404, (req, res) => {
  const updated = { ...req.products[req.productIndex], ...req.body };
  req.products[req.productIndex] = updated;
  saveProducts(req.products);
  res.json(updated);
});
router.delete('/:id', getId, findOr404, (req, res) => {
  const [removed] = req.products.splice(req.productIndex, 1);
  saveProducts(req.products);
  if (removed.imageUrl) {
    const file = path.basename(removed.imageUrl);
    fs.rmSync(path.join(uploadDir, file), { force: true });
  }
  res.status(204).end();
});
router.post('/:id/image', getId, findOr404, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Image is required', details: [{ field: 'image', message: 'Upload file using image field' }] });
  }
  const old = req.products[req.productIndex];
  const imageUrl = `/uploads/products/${req.file.filename}`;
  req.products[req.productIndex] = { ...old, imageUrl };
  saveProducts(req.products);
  if (old.imageUrl) fs.rmSync(path.join(uploadDir, path.basename(old.imageUrl)), { force: true });
  res.json(req.products[req.productIndex]);
});
module.exports = router;
