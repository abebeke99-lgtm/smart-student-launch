async function getSystemSettings(req, res) {
  return res.status(200).json({
    success: true,
    data: {
      environment: process.env.NODE_ENV || 'development',
      currency: 'ETB',
      payments: {
        mode: 'simulation-only',
        methods: ['telebirr', 'cbe-birr', 'mobile-banking'],
      },
      uploads: {
        maximumSizeMb: 5,
        imageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      },
      orderStatuses: ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'],
      timezone: 'UTC for reports',
    },
  });
}

module.exports = { getSystemSettings };
