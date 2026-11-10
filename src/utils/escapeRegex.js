// User input goes into MongoDB $regex queries, so special characters must be escaped
// to stop users from injecting their own (possibly very slow) patterns.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = escapeRegex;
