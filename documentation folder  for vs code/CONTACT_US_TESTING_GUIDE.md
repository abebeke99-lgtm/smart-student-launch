# Contact Us Form - Quick Testing & Usage Guide

## Quick Start

### Frontend - Submitting a Contact Message
1. Navigate to `/contact` in the frontend application
2. Fill in the form:
   - **Name:** Your full name (required)
   - **Email:** Your email address (required, must be valid format)
   - **Subject:** Optional topic for your message
   - **Message:** Your message (required, minimum 10 characters)
3. Click "Send Message" button
4. Wait for the "Sending..." state
5. Receive a success toast confirming the message was received
6. Form will auto-clear after 3 seconds

---

## API Testing

### 1. Submit a Contact Message
```bash
curl -X POST http://localhost:5001/api/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Course Inquiry",
    "message": "I have a question about the instructor evaluation process"
  }'
```

**Success Response (201):**
```json
{
  "success": true,
  "message": {
    "en": "Message received successfully! We will get back to you soon.",
    "am": "መልእክትዎ በተሳካ ሁኔታ ደርሶናል! በቅርቡ እንመለሳለን።"
  },
  "data": {
    "id": 1,
    "timestamp": "2026-08-31T10:30:00.000Z",
    "emailSent": true
  }
}
```

---

### 2. Get All Contact Messages (Admin)
```bash
curl -X GET "http://localhost:5001/api/contact/messages" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Optional Query Parameters:**
- `status=unread` - Filter by status (unread/read/replied/all)
- `limit=50` - Results per page (default: 50)
- `offset=0` - Pagination offset (default: 0)

**Example with filters:**
```bash
curl -X GET "http://localhost:5001/api/contact/messages?status=unread&limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Success Response:**
```json
{
  "success": true,
  "message": {
    "en": "Contact messages retrieved successfully.",
    "am": "ሕዝብ መልእክቶች በተሳካ ሁኔታ ተገኝቷል።"
  },
  "data": {
    "messages": [
      {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "subject": "Course Inquiry",
        "message": "I have a question about the instructor evaluation process",
        "status": "unread",
        "created_at": "2026-08-31T10:30:00.000Z"
      }
    ],
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

---

### 3. Update Message Status
```bash
curl -X PUT "http://localhost:5001/api/contact/messages/1/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "read"}'
```

**Valid Status Values:**
- `unread` - New message
- `read` - Message has been read
- `replied` - Admin has replied to the message

**Success Response:**
```json
{
  "success": true,
  "message": {
    "en": "Message status updated successfully.",
    "am": "የመልእክቱ ሁኔታ በተሳካ ሁኔታ ተቀይሮ ነው።"
  }
}
```

---

### 4. Delete a Message
```bash
curl -X DELETE "http://localhost:5001/api/contact/messages/1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Success Response:**
```json
{
  "success": true,
  "message": {
    "en": "Message deleted successfully.",
    "am": "መልእክት በተሳካ ሁኔታ ተሰርዟል።"
  }
}
```

---

## Validation Testing

### ✅ Valid Submission
```json
{
  "name": "Test User",
  "email": "test@example.com",
  "subject": "Test Subject",
  "message": "This is a test message with at least 10 characters"
}
```

### ❌ Validation Errors

**Missing name:**
```json
{
  "name": "",
  "email": "test@example.com",
  "message": "Message content"
}
```
Response: `400 Bad Request - "Name is required."`

**Invalid email:**
```json
{
  "name": "Test User",
  "email": "invalid-email",
  "message": "Message content here"
}
```
Response: `400 Bad Request - "Invalid email format."`

**Message too short:**
```json
{
  "name": "Test User",
  "email": "test@example.com",
  "message": "Short"
}
```
Response: `400 Bad Request - "Message must be at least 10 characters long."`

**Missing message:**
```json
{
  "name": "Test User",
  "email": "test@example.com",
  "message": ""
}
```
Response: `400 Bad Request - "Message is required."`

---

## Email Verification

### Checking Email Delivery

1. **Admin Email:** `enyihefikiradis@gmail.com`
2. **Email Subject:** `[Contact Us] {subject}` (or "New Contact Us message" if no subject)
3. **Reply-To:** Sender's email address (for easy reply)

### Email Content Example
```
Subject: [Contact Us] Course Inquiry

Name: John Doe
Email: john@example.com
Subject: Course Inquiry

Message:
I have a question about the instructor evaluation process and how students submit feedback.
```

### Troubleshooting Email Issues

Contact messages are saved before the email notification is attempted. If email delivery fails, the endpoint still returns HTTP 201 with `success: true` and `data.emailSent: false`; the failure is logged by the backend and the saved message remains available in the admin messages endpoint.

**For SMTP delivery in Render, configure the web service environment:**
1. Set `EMAIL_PROVIDER=smtp` so production uses the SMTP transport.
2. Set `SMTP_HOST` to the SMTP host for your mail provider (for Gmail, `smtp.gmail.com`).
3. Set `SMTP_PORT` to `587` with `SMTP_SECURE=false`, or use port `465` with `SMTP_SECURE=true`.
4. Set `SMTP_USER` to the full authenticated mailbox and `SMTP_PASS` to its SMTP/app password.
5. Optionally set `SMTP_FROM`; otherwise the authenticated `SMTP_USER` is used as the sender.
6. Verify the admin recipient in the active admin account or set `SMTP_TO`/`ADMIN_EMAIL` as the fallback recipient.
7. Save the Render environment changes, redeploy/restart the service, and inspect its logs for `Email delivery failed` or `Contact email sending failed`.

**Test email connectivity:**
```bash
# Check if environment variables are loaded
node -e "require('dotenv').config(); console.log(process.env.SMTP_HOST)"
```

---

## Frontend Component Testing

### Test Scenarios

#### Scenario 1: Successful Submission
1. Open `/contact` page
2. Fill in all fields with valid data
3. Click "Send Message"
4. Verify loading spinner appears
5. Verify success toast notification
6. Verify success message box appears
7. Verify form auto-clears after 3 seconds

#### Scenario 2: Validation Error
1. Open `/contact` page
2. Leave name field empty
3. Try to submit
4. Verify error message appears below name field
5. Verify button is not disabled
6. Fix the error and submit successfully

#### Scenario 3: Network Error
1. Simulate network error (or disconnect internet)
2. Try to submit form
3. Verify error toast notification appears
4. Verify form data is preserved
5. Fix connection and try again

#### Scenario 4: Mobile Responsiveness
1. Open `/contact` page on mobile device
2. Verify form is readable and usable
3. Verify buttons are clickable
4. Verify contact info cards are visible
5. Verify map is visible and interactive

---

## Database Verification

### Check if Table Exists
```sql
DESCRIBE contact_messages;
```

**Expected output:**
```
| Field      | Type             | Null | Key | Default           |
|------------|------------------|------|-----|-------------------|
| id         | int(10) unsigned | NO   | PRI | auto_increment    |
| name       | varchar(255)     | NO   |     | NULL              |
| email      | varchar(255)     | NO   |     | NULL              |
| subject    | varchar(255)     | YES  |     | NULL              |
| message    | text             | NO   |     | NULL              |
| status     | varchar(32)      | NO   |     | unread            |
| created_at | timestamp        | NO   |     | CURRENT_TIMESTAMP |
| updated_at | timestamp        | NO   |     | CURRENT_TIMESTAMP |
```

### Query All Messages
```sql
SELECT * FROM contact_messages ORDER BY created_at DESC;
```

### Query Unread Messages
```sql
SELECT id, name, email, subject, status, created_at 
FROM contact_messages 
WHERE status = 'unread' 
ORDER BY created_at DESC;
```

### Get Message Count
```sql
SELECT status, COUNT(*) as count 
FROM contact_messages 
GROUP BY status;
```

---

## Authentication Requirements

### Who Can Submit Messages?
✅ **Anyone** - Public endpoint, no authentication required

### Who Can View Messages?
✅ **Authorized admins only** - Requires JWT token with roles:
- `admin`
- `college_dean`
- `academic_directorate`

### Who Can Modify Messages?
✅ **Authorized admins only** - Requires JWT token with roles:
- `admin` (for all operations)
- `college_dean` (for retrieval and status update)
- `academic_directorate` (for retrieval and status update)

---

## Troubleshooting

### Issue: Form submission fails with 500 error
**Solution:**
1. Check backend logs for database connection errors
2. Verify database is running and accessible
3. Verify contact_messages table exists
4. Verify environment variables are set correctly

### Issue: Email is not being sent
**Solution:**
1. Verify SMTP configuration in `.env`
2. Check if SMTP credentials are correct
3. Verify admin email address is set
4. Check backend logs for email errors
5. Verify Gmail app-specific password is correct (if using Gmail)

### Issue: Validation errors not showing on frontend
**Solution:**
1. Check browser console for JavaScript errors
2. Verify Contact.jsx component is loaded correctly
3. Clear browser cache and reload
4. Verify form state management is working

### Issue: Database not storing messages
**Solution:**
1. Verify contact_messages table exists: `DESCRIBE contact_messages;`
2. Check database connection in db.js
3. Verify database credentials in .env
4. Check for SQL errors in backend logs

---

## Performance Monitoring

### Recommended Monitoring
1. Track email delivery success rate
2. Monitor database query performance
3. Track form submission error rates
4. Monitor SMTP connection failures
5. Track response times for admin API

### Database Indexes
✅ Indexes are already in place:
- `idx_contact_messages_status` - For filtering by status
- `idx_contact_messages_created_at` - For sorting by date

---

## Contact Support

If you encounter any issues with the Contact Us form:

1. Check this guide and the verification document
2. Check backend logs: `backend/logs/`
3. Check database connection
4. Verify SMTP configuration
5. Check browser console for frontend errors
6. Review API response codes and messages

---

*Last Updated: August 31, 2026*
