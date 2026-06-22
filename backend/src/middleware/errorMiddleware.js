const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode;
  if (!statusCode || statusCode === 200) {
    statusCode = 500;
    if (err.name === 'ValidationError') statusCode = 400;
    if (err.name === 'CastError') statusCode = 400;
    if (err.code === 11000) statusCode = 400;
  }

  if (statusCode >= 500 && (process.env.NODE_ENV || 'development') !== 'production') {
    console.error('[API]', req.method, req.originalUrl, err);
  }

  let message = err.message;
  if (err.name === 'ValidationError' && err.errors) {
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = { notFound, errorHandler };
