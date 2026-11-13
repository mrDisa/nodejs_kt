const multer = require('multer');

module.exports = function errorHandler(err, _req, res, _next) {
  if (res.headersSent) return;
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Image must not exceed 2 MB'
      : err.message;
    return res.status(400).json({ error: message, details: [{ field: 'image', message }] });
  }
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: status >= 500 ? 'Internal server error' : err.message
  });
};
