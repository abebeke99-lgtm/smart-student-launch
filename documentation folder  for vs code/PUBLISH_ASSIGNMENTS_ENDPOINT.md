# Backend Endpoint Implementation: Publish Assignments

**Date:** August 29, 2026  
**Status:** ✅ COMPLETE & TESTED  
**Endpoint:** `GET /api/evaluations/publish-assignments`

---

## Overview

The `/api/evaluations/publish-assignments` endpoint retrieves course assignments with their publication status for a department. This endpoint is essential for the Publish Evaluation feature in the department head dashboard, allowing users to see which assignments have been published to students and/or instructors.

---

## Technical Specifications

### Endpoint Details

| Property | Value |
|----------|-------|
| **HTTP Method** | GET |
| **Route** | `/api/evaluations/publish-assignments` |
| **Full URL** | `http://localhost:5001/api/evaluations/publish-assignments` |
| **Authentication** | Required (JWT Bearer token) |
| **Authorization** | dept_head, admin roles only |
| **Response Format** | JSON array of assignment objects |

### Request

#### Headers
```
Authorization: Bearer <valid_jwt_token>
Content-Type: application/json (not required for GET)
```

#### Query Parameters
```
GET /api/evaluations/publish-assignments?department=<department_id_or_name>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `department` | string\|number | No | Department ID (numeric) or department name/code (string). If omitted, uses authenticated user's department. |

### Response

#### Success Response (200 OK)
```json
[
  {
    "id": 1,
    "course_id": 5,
    "instructor_id": 12,
    "program_type": "Regular",
    "year_level": "1st Year (Freshman)",
    "semester": "Semester I",
    "section": "A",
    "is_student_published": 1,
    "is_peer_published": 0,
    "course_code": "CS101",
    "course_name": "Introduction to Programming",
    "instructor_name": "Dr. John Doe"
  },
  {
    "id": 2,
    "course_id": 6,
    "instructor_id": 13,
    "program_type": "Regular",
    "year_level": "1st Year (Freshman)",
    "semester": "Semester I",
    "section": "B",
    "is_student_published": 0,
    "is_peer_published": 1,
    "course_code": "MATH101",
    "course_name": "Calculus I",
    "instructor_name": "Prof. Jane Smith"
  }
]
```

#### Error Responses

**400 Bad Request - Missing Department**
```json
{
  "success": false,
  "message": "Department information not found. Please provide a valid department parameter."
}
```

**404 Not Found - Invalid Department**
```json
{
  "success": false,
  "message": "Department was not found."
}
```

**401 Unauthorized - Invalid Token**
```json
{
  "success": false,
  "message": "Unauthorized: invalid access token."
}
```

**403 Forbidden - Insufficient Permissions**
```json
{
  "success": false,
  "message": "Forbidden: Insufficient permissions."
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "message": "Unable to load course assignments."
}
```

---

## Response Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique identifier for the course assignment |
| `course_id` | integer | ID of the associated course |
| `instructor_id` | integer | ID of the assigned instructor |
| `program_type` | string | Program type (e.g., "Regular", "Extension") |
| `year_level` | string | Year/level of students (e.g., "1st Year (Freshman)", "2nd Year") |
| `semester` | string | Semester when course is taught (e.g., "Semester I", "Semester II") |
| `section` | string | Student section/group identifier |
| `is_student_published` | integer | Publication status for students (1 = published, 0 = not published) |
| `is_peer_published` | integer | Publication status for peer/instructor evaluation (1 = published, 0 = not published) |
| `course_code` | string | Course code (e.g., "CS101") |
| `course_name` | string | Full course name |
| `instructor_name` | string | Full name of assigned instructor |

---

## Implementation Details

### File Location
- **Route File:** `backend/routes/evaluationRoutes.js`
- **Main Backend:** `backend/index.js` (imports and registers route)
- **Database:** Course assignments query from `course_assignments`, `courses`, and `instructors` tables

### Route Handler Location
```
backend/routes/evaluationRoutes.js
- Lines: Full file is the route handler
- Function: /publish-assignments GET handler
- Database Helper: resolveDepartmentId() function
```

### Authentication Flow
1. Request includes Authorization header with JWT token
2. `authenticateToken` middleware validates token
3. `authorizeRoles('dept_head', 'admin')` verifies user has appropriate role
4. User's department_id is extracted from JWT payload
5. If query parameter provided, department is resolved by ID or name

### Database Query
```sql
SELECT ca.id, ca.course_id, ca.instructor_id, ca.program_type, ca.year_level, 
       ca.semester, ca.section,
       ca.is_student_published,
       ca.is_peer_published,
       c.code AS course_code, c.name AS course_name,
       TRIM(CONCAT(COALESCE(i.first_name, ''), ' ', COALESCE(i.last_name, ''))) AS instructor_name
FROM course_assignments ca
INNER JOIN courses c ON c.id = ca.course_id
INNER JOIN instructors i ON i.id = ca.instructor_id
WHERE ca.department_id = ? 
ORDER BY ca.created_at DESC
```

### Department Resolution
The `resolveDepartmentId()` helper function supports multiple input formats:

1. **Numeric ID:** Direct lookup by `departments.id`
   - Input: `5` → Looks up dept with id=5

2. **Department Name/Code:** Case-insensitive lookup by name or code
   - Input: `"Computer Science"` → Looks up dept with LOWER(name)="computer science"
   - Input: `"CS"` → Looks up dept with LOWER(code)="cs"

---

## Integration with Frontend

### Frontend API Call
```javascript
// From: frontend/src/services/api.js
export const evaluationApi = {
  getPublishAssignments: (params = {}) => 
    request('/evaluations/publish-assignments', { method: 'GET', params })
}
```

### Usage in Component
```javascript
// From: frontend/src/pages/PublishEvaluation.jsx
const loadAssignments = async () => {
  try {
    const rows = await evaluationApi.getPublishAssignments({ 
      department: departmentId 
    });
    setAssignments(Array.isArray(rows) ? rows : []);
  } catch (error) {
    console.error('Unable to load course assignments:', error);
  }
};
```

---

## Usage Examples

### Example 1: Get assignments for current user's department
```bash
curl -X GET http://localhost:5001/api/evaluations/publish-assignments \
  -H "Authorization: Bearer <valid_jwt_token>" \
  -H "Content-Type: application/json"
```

### Example 2: Get assignments for specific department (by ID)
```bash
curl -X GET "http://localhost:5001/api/evaluations/publish-assignments?department=3" \
  -H "Authorization: Bearer <valid_jwt_token>"
```

### Example 3: Get assignments for specific department (by name)
```bash
curl -X GET "http://localhost:5001/api/evaluations/publish-assignments?department=Computer%20Science" \
  -H "Authorization: Bearer <valid_jwt_token>"
```

### Example 4: JavaScript/Fetch
```javascript
// Using the evaluationApi wrapper
const assignments = await evaluationApi.getPublishAssignments({ 
  department: 5 
});

// Or direct fetch
const response = await fetch(
  '/api/evaluations/publish-assignments?department=5',
  {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);
const assignments = await response.json();
```

---

## Testing

### Test 1: Endpoint Accessibility
```bash
# Test endpoint responds (with auth error as expected)
curl -X GET http://localhost:5001/api/evaluations/publish-assignments \
  -H "Authorization: Bearer test"

# Expected: 401 Unauthorized or auth error
```

### Test 2: With Valid Authentication
```bash
# Login to get valid token
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"depthead","password":"password"}'

# Use token in request
curl -X GET "http://localhost:5001/api/evaluations/publish-assignments?department=1" \
  -H "Authorization: Bearer <returned_token>"

# Expected: 200 OK with assignment array
```

### Test 3: Missing Department
```bash
# Request without department parameter (and user department not set)
curl -X GET http://localhost:5001/api/evaluations/publish-assignments \
  -H "Authorization: Bearer <valid_token_no_dept>"

# Expected: 400 Bad Request
```

### Test 4: Invalid Department
```bash
curl -X GET "http://localhost:5001/api/evaluations/publish-assignments?department=999" \
  -H "Authorization: Bearer <valid_token>"

# Expected: 404 Not Found
```

---

## Common Issues & Troubleshooting

### Issue: Endpoint returns 404
**Solution:** 
- Ensure backend is running: `npm start` from backend folder
- Verify `evaluationRoutes.js` is imported in `backend/index.js`
- Check that route is registered: `app.use('/api/evaluations', evaluationRoutes)`
- Restart backend after making changes

### Issue: "Unauthorized: invalid access token"
**Solution:**
- Ensure you're including valid JWT token in Authorization header
- Token format: `Authorization: Bearer <jwt_token>`
- Get valid token by logging in first via `/api/auth/login`

### Issue: "Forbidden: Insufficient permissions"
**Solution:**
- Verify user has `dept_head` or `admin` role
- Check user record in database for correct role assignment

### Issue: Empty array returned (no assignments)
**Possible causes:**
- No course assignments exist for department
- Department ID is wrong
- Course assignments have no linked courses or instructors
- Check database: `SELECT * FROM course_assignments WHERE department_id = ?`

### Issue: Database connection error
**Solution:**
- Verify database credentials in `.env` file
- Ensure MySQL server is running
- Check pool configuration in `backend/config/db.js`

---

## Database Schema (Related Tables)

### course_assignments table
```sql
CREATE TABLE course_assignments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  course_id INT UNSIGNED NOT NULL,
  instructor_id INT UNSIGNED,
  department_id INT UNSIGNED NOT NULL,
  student_id INT UNSIGNED,
  program_type VARCHAR(50),
  year_level VARCHAR(100),
  semester VARCHAR(50),
  section VARCHAR(50),
  publish_target VARCHAR(50),
  is_published TINYINT DEFAULT 0,
  is_student_published TINYINT DEFAULT 0,
  is_peer_published TINYINT DEFAULT 0,
  academic_year VARCHAR(4),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (instructor_id) REFERENCES instructors(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  INDEX idx_dept_id (department_id),
  INDEX idx_published (is_student_published, is_peer_published),
  INDEX idx_created_at (created_at)
);
```

### courses table
```sql
CREATE TABLE courses (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE,
  name VARCHAR(255),
  description TEXT,
  credit_hours DECIMAL(5, 2),
  department_id INT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### instructors table
```sql
CREATE TABLE instructors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  department_id INT UNSIGNED,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Security Considerations

✅ **Authentication Required:** All requests must include valid JWT token  
✅ **Authorization:** Only dept_head and admin roles can access  
✅ **Department Isolation:** Dept heads can only see their own department's assignments  
✅ **SQL Injection Prevention:** Uses parameterized queries  
✅ **Input Validation:** Department parameter validated before database query  
✅ **Error Handling:** Sensitive database errors not exposed to client  

---

## Performance Optimization

**Indexes Used:**
- `idx_dept_id` on `course_assignments.department_id` - Speeds up main WHERE clause
- `idx_created_at` on `course_assignments.created_at` - Enables ORDER BY optimization
- Foreign key indexes on joined tables

**Query Optimization:**
- Single query with INNER JOINs (no N+1 queries)
- Only necessary columns selected
- Ordered by created_at DESC for chronological display
- TRIM + CONCAT for clean instructor name formatting

---

## Deployment Checklist

- [x] Route file created and tested
- [x] Route imported in backend/index.js
- [x] Route registered with app.use()
- [x] Authentication middleware applied
- [x] Authorization middleware applied
- [x] Department resolution logic implemented
- [x] Database query verified
- [x] Error handling implemented
- [x] Frontend integration verified
- [x] Endpoint tested with valid authentication
- [x] Documentation complete

---

## File References

| File | Lines | Purpose |
|------|-------|---------|
| `backend/routes/evaluationRoutes.js` | Full file | Route handler for publish-assignments |
| `backend/index.js` | 13 (import), 66 (use) | Route registration |
| `frontend/src/services/api.js` | 191 | Frontend API wrapper |
| `frontend/src/pages/PublishEvaluation.jsx` | 27-40 | Frontend usage |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-08-29 | Initial implementation as separate route file with full documentation |

---

## Support & Maintenance

### For Questions
- Check this documentation first
- Review backend logs: `npm start` output
- Check frontend console for API error messages

### For Updates
1. Edit `backend/routes/evaluationRoutes.js`
2. Restart backend: `npm start`
3. Test endpoint before deploying
4. Update this documentation

### Contact
- Department: enyihefikiradis@gmail.com
- Reference: "Publish Assignments Endpoint"

---

**Status:** ✅ Production Ready  
**Last Updated:** August 29, 2026  
**Tested:** Yes
