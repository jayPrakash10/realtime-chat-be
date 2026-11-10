// Every successful response has the same shape: { success: true, data, meta? }.
function sendSuccess(res, statusCode, data, meta) {
  const body = { success: true, data };
  if (meta) {
    body.meta = meta;
  }
  return res.status(statusCode).json(body);
}

function sendPage(res, { items, meta }) {
  return sendSuccess(res, 200, items, meta);
}

function sendNoContent(res) {
  return res.status(204).send();
}

module.exports = { sendSuccess, sendPage, sendNoContent };
