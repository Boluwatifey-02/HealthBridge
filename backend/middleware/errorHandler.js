function errorHandler(error, req, res, next) {
  console.error(`${req.method} ${req.originalUrl} failed:`, error.message);

  const statusCode = error.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    message: isProduction && statusCode >= 500 ? 'Something went wrong on the server.' : error.message || 'Something went wrong on the server.',
  });
}

module.exports = errorHandler;