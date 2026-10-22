const test = require('node:test');
const assert = require('node:assert/strict');
const ContactMessage = require('../src/models/ContactMessage');

test('contact messages trim fields and normalize email addresses', async () => {
  const submission = new ContactMessage({
    fullName: '  Alex Student  ',
    email: '  ALEX@example.com  ',
    subject: '  Menu question  ',
    message: "  Could you tell me about today's menu?  ",
  });

  await submission.validate();

  assert.equal(submission.fullName, 'Alex Student');
  assert.equal(submission.email, 'alex@example.com');
  assert.equal(submission.subject, 'Menu question');
  assert.equal(submission.message, "Could you tell me about today's menu?");
});

test('contact messages enforce required fields and size constraints', async () => {
  const submission = new ContactMessage({
    fullName: 'A',
    email: 'not-an-email',
    subject: 'x',
    message: 'short',
  });

  await assert.rejects(submission.validate(), (error) => {
    assert.equal(error.name, 'ValidationError');
    assert.ok(error.errors.fullName);
    assert.ok(error.errors.email);
    assert.ok(error.errors.subject);
    assert.ok(error.errors.message);
    return true;
  });
});
