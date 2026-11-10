function getSkip(page, limit) {
  return (page - 1) * limit;
}

function buildPageMeta(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

module.exports = { getSkip, buildPageMeta };
