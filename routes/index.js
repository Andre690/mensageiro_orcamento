const { Router } = require('express');
const healthRoutes = require('../api/v1/routes/health.routes');

const router = Router();

// Versioned API
router.use('/v1', healthRoutes);

module.exports = router;

