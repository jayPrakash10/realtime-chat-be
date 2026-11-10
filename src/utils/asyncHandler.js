// Express 4 does not catch rejected promises, so async route handlers forward errors to next() through this wrapper.
function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
