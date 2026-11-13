const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const root = path.resolve(__dirname, '../..');
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer from 1 to 65535');
}

module.exports = {
  port,
  root,
  uploadDir: path.join(root, 'uploads', 'products'),
  dataFile: path.join(root, 'data', 'products.json')
};
