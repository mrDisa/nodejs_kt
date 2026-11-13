const express = require('express');
const { port, uploadDir } = require('./config');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const productRoutes = require('./routes/products');

const app = express();
app.disable('x-powered-by');
app.use(logger);
app.use(express.json({ limit: '100kb' }));
app.use('/uploads/products', express.static(uploadDir));
app.use('/api/products', productRoutes);
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

if (require.main === module) {
  app.listen(port, () => console.log(`API listening at http://localhost:${port}`));
}
module.exports = app;
