const ContactMessage = require('../models/ContactMessage');

async function createContactMessage(req, res) {
  await ContactMessage.create({
    fullName: req.body.fullName,
    email: req.body.email,
    subject: req.body.subject,
    message: req.body.message,
  });

  return res.status(201).json({
    success: true,
    data: { message: 'Your message was received.' },
  });
}

module.exports = { createContactMessage };
