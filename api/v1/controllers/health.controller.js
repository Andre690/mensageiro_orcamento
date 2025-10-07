const { asyncHandler } = require('../../../utils/asyncHandler');
const { getHealthInfo } = require('../../../services/health.service');

exports.getHealth = asyncHandler(async (req, res) => {
  const info = getHealthInfo();
  res.json(info);
});

