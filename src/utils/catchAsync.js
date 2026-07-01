// Wraps an async controller so rejected promises are passed to next()
// instead of needing a try/catch block in every single function.
function catchAsync(fn) {
  return function wrapped(req, res, next) {
    fn(req, res, next).catch(next);
  };
}

module.exports = catchAsync;
