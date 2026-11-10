const Joi = require('joi');
const { PAGINATION } = require('../config/constants');

const OBJECT_ID_LENGTH = 24;

const objectId = Joi.string().hex().length(OBJECT_ID_LENGTH).messages({
  'string.hex': '{{#label}} must be a valid id',
  'string.length': '{{#label}} must be a valid id',
});

const idParams = Joi.object({
  id: objectId.required(),
});

const paginationFields = {
  page: Joi.number().integer().min(1).default(PAGINATION.DEFAULT_PAGE),
  limit: Joi.number().integer().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
};

const paginationQuery = Joi.object(paginationFields);

module.exports = { objectId, idParams, paginationFields, paginationQuery };
