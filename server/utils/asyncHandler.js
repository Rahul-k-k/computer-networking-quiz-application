// Wraps an async route handler so rejected promises reach Express's error
// handler instead of becoming unhandled rejections (Express 4 doesn't await).
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
