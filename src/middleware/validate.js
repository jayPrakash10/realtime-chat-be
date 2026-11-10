const ApiError = require('../utils/ApiError');

const REQUEST_PARTS = ['params', 'query', 'body'];

const JOI_OPTIONS = {
  abortEarly: false, // report every invalid field at once
  stripUnknown: true, // silently drop fields we do not expect (e.g. "role" on register)
  convert: true, // turn query strings like "2" into numbers
};

function formatJoiDetails(details, part) {
  return details.map((detail) => ({
    location: part,
    field: detail.path.join('.'),
    message: detail.message.replace(/"/g, ''),
  }));
}

/**
 * Validates req.params / req.query / req.body against Joi schemas and replaces them
 * with the cleaned values, so controllers only ever see trusted, typed input.
 */
function validate(schemas) {
  return (req, res, next) => {
    const errors = [];

    REQUEST_PARTS.forEach((part) => {
      if (!schemas[part]) {
        return;
      }
      const { value, error } = schemas[part].validate(req[part] || {}, JOI_OPTIONS);
      if (error) {
        errors.push(...formatJoiDetails(error.details, part));
      } else {
        req[part] = value;
      }
    });

    if (errors.length > 0) {
      return next(ApiError.badRequest('Validation failed', errors));
    }
    return next();
  };
}

module.exports = validate;
