# Contact Us Feature - Implementation Guide

## Overview
The Contact Us feature has been fully implemented with official Mekdela Amba University details, comprehensive form validation, and backend integration for message storage.

## Features Implemented

### 1. **Frontend (Contact.jsx)**
- Official university contact information:
  - **Email:** enyihefikiradis@gmail.com
  - **Phone:** +251 332405111
  - **Location:** Gimba, Ethiopia
  - **P.O. Box:** P.O. Box 32
  - **Office Hours:** Mon-Fri, 9:00 AM - 5:00 PM

#### Form Features:
- **Real-time field validation:**
  - Name field validation (required, non-empty)
  - Email validation (required, valid format)
  - Message validation (required, minimum 10 characters)
  - Live error display as user types
  - Character counter for message field

- **Enhanced User Experience:**
  - Loading spinner during form submission
  - Success confirmation message
  - Toast notifications (success/error)
  - Automatic form reset after successful submission
  - Real-time error clearing when user corrects input
  - Disabled submit button during loading

### 2. **Backend API (contactController.js)**
- **POST /api/contact/submit** - Public endpoint
  - Accepts: `{ name, email, message }`
  - Returns: Success with message ID and timestamp
  - Validation:
    - Email format validation using regex
    - Minimum message length (10 characters)
    - Trimming of whitespace
  - Error handling with detailed error messages

- **GET /api/contact/messages** - Admin only
  - Retrieves stored contact messages
  - Supports filtering by status (unread, read, replied)
  - Supports pagination (limit, offset)
  - Returns total count and paginated results

- **PUT /api/contact/messages/:id/status** - Admin only
  - Updates message status (unread → read → replied)
  - Validates status values

- **DELETE /api/contact/messages/:id** - Admin only
  - Deletes contact messages
  - Only accessible to admin role

### 3. **Database (contact_messages table)**
```sql
CREATE TABLE contact_messages (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'unread',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_contact_messages_status (status),
    INDEX idx_contact_messages_created_at (created_at)
)
```

## API Documentation

### Submit Contact Message (Public)
**Endpoint:** `POST /api/contact/submit`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "This is a test message about the system."
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": {
    "en": "Your message has been sent successfully!",
    "am": "መልእክትዎ በተሳካ ሁኔታ ተልከዋል!"
  },
  "data": {
    "id": 1,
    "timestamp": "2026-08-29T07:23:46.139Z"
  }
}
```

**Error Response (400/500):**
```json
{
  "success": false,
  "message": {
    "en": "Invalid email format.",
    "am": "ልክ ያልሆነ ኢሜይል ቅርጸት።"
  }
}
```

### Get Contact Messages (Admin)
**Endpoint:** `GET /api/contact/messages`

**Query Parameters:**
- `status` - (optional) Filter by status: 'unread', 'read', 'replied', or 'all'
- `limit` - (optional) Number of results per page (default: 50)
- `offset` - (optional) Pagination offset (default: 0)

**Example:**
```
GET /api/contact/messages?status=unread&limit=10&offset=0
```

**Response:**
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
        "name": "Test User",
        "email": "test@example.com",
        "message": "This is a test message.",
        "status": "unread",
        "created_at": "2026-08-29T07:23:46.000Z"
      }
    ],
    "total": 1,
    "limit": 10,
    "offset": 0
  }
}
```

### Update Message Status (Admin)
**Endpoint:** `PUT /api/contact/messages/:id/status`

**Request Body:**
```json
{
  "status": "read"
}
```

**Valid Status Values:** unread, read, replied

### Delete Message (Admin only)
**Endpoint:** `DELETE /api/contact/messages/:id`

**Response:**
```json
{
  "success": true,
  "message": {
    "en": "Message deleted successfully.",
    "am": "መልእክት በተሳካ ሁኔታ ተሰርዟል።"
  }
}
```

## Testing

### Test Scripts Included
1. **test_contact_api.js** - Basic functionality test
   - Tests successful message submission
   - Verifies API returns correct response

2. **test_contact_validation.js** - Comprehensive validation tests
   - Invalid email format rejection
   - Missing name rejection
   - Short message rejection
   - Valid message acceptance

### Run Tests
```bash
# Backend needs to be running (npm start)

# Test basic functionality
node test_contact_api.js

# Test validation
node test_contact_validation.js
```

## Environment Configuration

### Frontend
The frontend uses `VITE_API_URL` to configure the API endpoint. It defaults to `/api`, which works when the frontend and backend are served by the same origin:
```javascript
const API_URL = import.meta.env.VITE_API_URL || '/api';
```

For a separately hosted backend, set the full API base URL (without a trailing slash) in the frontend environment:
```
VITE_API_URL=https://your-api-server.example.com/api
```

### Backend
The backend uses standard environment variables for database connection:
```
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=ipes_db
JWT_SECRET=your-secret-key
```

## User Interface Flow

### Contact Page Layout
1. **Header Section**
   - Title: "Contact Us"
   - Subtitle: Descriptive text

2. **Left Column (Contact Information)**
   - Email card with clickable link
   - Phone card with clickable link
   - Location card with full address
   - Office Hours card

3. **Right Column (Contact Form)**
   - Name field with validation
   - Email field with email validation
   - Message field with character counter
   - Submit button with loading state
   - Success message on submission

## Bilingual Support

All error messages and responses include both English and Amharic translations:
- "Your message has been sent successfully!" / "መልእክትዎ በተሳካ ሁኔታ ተልከዋል!"
- "Invalid email format." / "ልክ ያልሆነ ኢሜይል ቅርጸት።"
- "Message is required." / "መልእክት አስፈላጊ ነው።"

## Security Features

1. **Input Validation**
   - Email format validation (regex)
   - Field length validation
   - Whitespace trimming
   - Message content filtering

2. **Authentication**
   - Admin endpoints protected with JWT authentication
   - Role-based access control (admin, college_dean, academic_directorate)
   - Public endpoints (message submission) accessible without authentication

3. **Database Security**
   - SQL injection prevention via parameterized queries
   - Character encoding (UTF8MB4) for international text support

## File Structure

```
IPES/
├── backend/
│   ├── controllers/
│   │   ├── contactController.js (NEW)
│   │   └── ...
│   ├── routes/
│   │   ├── contactRoutes.js (NEW)
│   │   └── ...
│   ├── database.sql (UPDATED - added contact_messages table)
│   ├── index.js (UPDATED - added contact routes)
│   └── migrate.js (NEW)
├── frontend/
│   └── src/
│       └── pages/
│           └── Contact.jsx (UPDATED - full implementation)
└── test_contact_*.js (NEW - test scripts)
```

## Migration History

- **Date:** 2026-08-29
- **Change:** Added contact_messages table and contact handling endpoints
- **Backwards Compatible:** Yes - only adds new functionality
- **Database Migration:** Run `node migrate.js` to apply database changes

## Future Enhancements

Potential improvements for future versions:
1. Email notifications to administrators when new messages arrive
2. Auto-reply emails to message senders
3. Message categorization/tagging system
4. Advanced analytics dashboard for message patterns
5. Integration with ticketing system
6. File attachments support
7. Rate limiting for message submissions
8. CAPTCHA verification for form submission

## Support & Troubleshooting

### Common Issues

**Issue:** "Cannot POST /api/contact/submit"
- **Solution:** Ensure backend server is running and contact routes are properly registered

**Issue:** "Database error when submitting"
- **Solution:** Run migration script: `node migrate.js`

**Issue:** "API returns 404"
- **Solution:** Verify API_BASE_URL is correctly configured in frontend .env file

**Issue:** Messages not saving to database
- **Solution:** Check database credentials and ensure contact_messages table exists

## Contact & Support
For support with this feature, contact the IPES development team at enyihefikiradis@gmail.com
