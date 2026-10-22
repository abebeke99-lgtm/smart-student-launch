# Deployment Checklist: Conditional Evaluation Score Calculation & Printable Performance Reports

## Summary
This deployment introduces conditional performance score calculations based on teaching status and printable performance report letters for academic leaders (Vice President, Academic Director, College Deans, Department Heads).

**Key Changes:**
- ✅ Created reusable scoring utility (`performanceScore.js`) with teaching-based weight logic
- ✅ Updated all three evaluation paths (VP, Dean, Directorate) to use explicit teaching status
- ✅ Extended database schemas to persist component scores and teaching status
- ✅ Created reusable printable breakdown component (`EvaluationScoreBreakdown.jsx`)
- ✅ Updated frontend dashboards to display teaching status and use printable component
- ✅ Added `@media print` CSS for clean print output

---

## Pre-Deployment Validation (✅ Completed)

### Backend Validation
- ✅ **Syntax Check**: All backend modules pass syntax validation
  ```
  node --check backend/index.js
  node --check backend/routes/dean.js
  node --check backend/routes/directorate.js
  node --check backend/routes/vicePresident.js
  ```
- ✅ **Unit Tests**: All 4 performanceScore tests pass
  - Teaching weights: 50% student, 20% peer, 30% supervisor
  - Non-teaching weights: 0% student, 40% peer, 60% supervisor
  - Rounding to 2 decimal places
  - Type checking for `isTeaching` parameter

### Frontend Validation
- ✅ **Build**: Frontend builds successfully (`npm run build`)
  - No compilation errors
  - All components bundled correctly
  - Output size reasonable (~404KB gzipped for main app)
- ✅ **Lint**: ESLint passes with 0 warnings (`npm run lint`)
  - All JSX/import errors resolved
  - Code style compliant

---

## Database Migration (Pre-Deployment)

The following schema changes will be applied automatically on startup:

### `vice_president_evaluations` table
**New columns** (idempotent via `ensureColumn()`):
- `student_average` (DECIMAL 5,2) – Average of student evaluation scores
- `peer_average` (DECIMAL 5,2) – Average of peer evaluation scores
- `is_teaching` (TINYINT 1) – Boolean flag for teaching load
- `final_score` (DECIMAL 5,2, nullable) – Weighted final score

### `directorate_evaluations` table
**Same columns as above** for consistency

### Data Persistence Strategy
- **Student Average**: Calculated from `student_evaluation_submissions` table (average of all submitted scores)
- **Peer Average**: Calculated from `peer_evaluation_submissions` table (average of all submitted scores)
- **Teaching Status**: Derived from `course_assignments` table (EXISTS query: does instructor have any assignments in the cycle?)
- **Final Score**: Calculated by `calculatePerformanceScore()` utility and stored for auditing

---

## Deployment Steps

### 1. Backend Deployment
```bash
# Deploy updated backend files:
# - backend/utils/performanceScore.js (NEW)
# - backend/index.js (MODIFIED)
# - backend/routes/vicePresident.js (MODIFIED)
# - backend/routes/directorate.js (MODIFIED)
# - backend/routes/dean.js (MODIFIED)
# - backend/config/vicePresidentEvaluations.js (MODIFIED)

# On server startup, schema migrations run automatically:
# The ensureVicePresidentEvaluationSchema() function will:
# 1. Create vice_president_evaluations table if it doesn't exist
# 2. Add missing columns idempotently
# 3. No data loss (ALTER TABLE ADD COLUMN with DEFAULT values)
```

### 2. Frontend Deployment
```bash
# Deploy updated frontend files:
# - frontend/src/components/EvaluationScoreBreakdown.jsx (NEW)
# - frontend/src/pages/VicePresidentDashboard.jsx (MODIFIED)
# - frontend/src/pages/DirectorateDashboard.jsx (MODIFIED)
# - frontend/src/components/ResultCertificateActions.jsx (MODIFIED)
# - frontend/src/index.css (MODIFIED – added print media query)

# Frontend is built and ready:
# - dist/assets/EvaluationScoreBreakdown-*.js (NEW compiled component)
# - dist/assets/VicePresidentDashboard-*.js (UPDATED)
# - dist/assets/DirectorateDashboard-*.js (UPDATED)
# - dist/index.html (UPDATED with print styles)
```

### 3. Database Backup (Recommended)
```sql
-- Before deployment, backup evaluation-related tables:
-- BACKUP evaluation_results
-- BACKUP vice_president_evaluations
-- BACKUP directorate_evaluations
-- BACKUP peer_evaluation_submissions
-- BACKUP student_evaluation_submissions
```

---

## Post-Deployment Testing (Manual)

### Test Scenario 1: Teaching Role Evaluation (VP → Academic Director)
**Preconditions:**
- Active evaluation cycle exists
- Academic Director has `is_teaching = true` (has course assignments)
- At least one student evaluation submitted (score > 0)
- At least one peer evaluation submitted

**Steps:**
1. Log in as Vice President
2. Navigate to Academic Directorate evaluations
3. Verify teaching status shows: "✓ Has Teaching Load"
4. Publish results for the Academic Director
5. Open the result letter
6. **Verify printed breakdown:**
   - Student Score row present with weight 50%
   - Peer Score row with weight 20%
   - Supervisor (VP) row with weight 30%
   - Final score = (student×0.50) + (peer×0.20) + (supervisor×0.30)
   - Example: (80×0.50) + (70×0.20) + (90×0.30) = 40 + 14 + 27 = 81%

**Print Test:**
1. Open result letter
2. Press Ctrl+P (Print)
3. Verify:
   - Navigation bar hidden
   - Only letter content visible
   - Score breakdown table renders clearly
   - Teaching status visible in letter header

### Test Scenario 2: Non-Teaching Role Evaluation (Dean → Department Head)
**Preconditions:**
- Active evaluation cycle exists
- Department Head has `is_teaching = false` (no course assignments)
- At least one peer evaluation submitted
- At least one supervisor evaluation submitted

**Steps:**
1. Log in as College Dean
2. Navigate to Department Head evaluations
3. Verify teaching status shows: "✗ No Teaching Load"
4. Verify student evaluation scores section hidden (N/A)
5. Publish results for the Department Head
6. Open the result letter
7. **Verify printed breakdown:**
   - Student Score row ABSENT (excluded for non-teaching)
   - Peer Score row with weight 40%
   - Supervisor (Dean) row with weight 60%
   - Final score = (peer×0.40) + (supervisor×0.60)
   - Example: (70×0.40) + (85×0.60) = 28 + 51 = 79%

**Database Verification:**
```sql
-- Check that scores are stored correctly:
SELECT final_score, is_teaching, student_average, peer_average 
FROM directorate_evaluations 
WHERE cycle_id = <ACTIVE_CYCLE_ID>;

-- Verify is_teaching is set correctly:
SELECT is_teaching FROM directorate_evaluations WHERE id = <EVAL_ID>;
-- Should return 0 (false) for non-teaching roles
```

### Test Scenario 3: Multiple Evaluators (Directorate Endpoint)
**Preconditions:**
- Academic Director (evaluator) has published results for multiple College Deans
- Mix of teaching and non-teaching deans

**Steps:**
1. Log in as Academic Director (or Directorate admin)
2. Navigate to "My Published Results" → "College Deans"
3. Verify each dean's card shows:
   - Teaching status badge
   - Score breakdown with correct weights applied
4. Click "View Report" for a teaching dean
5. Verify weights: 50/20/30
6. Click "View Report" for a non-teaching dean
7. Verify weights: 0/40/60 (student score absent)

---

## Important Files & Their Roles

### Backend Utilities
| File | Purpose | Imports From |
|------|---------|--------------|
| `backend/utils/performanceScore.js` | Core calculation engine (NEW) | None – pure function |
| `backend/tests/performanceScore.test.js` | Unit tests for scoring (NEW) | performanceScore.js |

### Backend Routes (Modified to use performanceScore)
| File | Key Changes |
|------|-------------|
| `backend/routes/vicePresident.js` | Line 72-145: `/calculate-publish-results` now queries `is_teaching`, calls `calculatePerformanceScore()`, stores components |
| `backend/routes/directorate.js` | Line 108-210: `/calculate-publish-results` stores `is_teaching`, `student_average`, `peer_average`, `final_score` |
| `backend/routes/dean.js` | Imports `calculatePerformanceScore()`, uses it in result calculation |

### Frontend Components
| File | Purpose |
|------|---------|
| `frontend/src/components/EvaluationScoreBreakdown.jsx` | Reusable breakdown table (NEW) – renders teaching/non-teaching weights |
| `frontend/src/pages/VicePresidentDashboard.jsx` | Uses EvaluationScoreBreakdown, shows teaching status (MODIFIED) |
| `frontend/src/pages/DirectorateDashboard.jsx` | Uses EvaluationScoreBreakdown, shows teaching status (MODIFIED) |
| `frontend/src/components/ResultCertificateActions.jsx` | Uses API-provided `is_teaching` field (MODIFIED) |

### Styling
| File | Changes |
|------|---------|
| `frontend/src/index.css` | Added `@media print` rules to hide navigation, show only `.result-letter` (MODIFIED) |

---

## Rollback Plan

If issues arise post-deployment:

### Option 1: Quick Rollback (Preserve Data)
1. Revert frontend to previous build (no data loss)
2. Revert backend routes (but keep database schema – columns are safe to leave)
3. Existing `final_score` values remain in DB but unused
4. Previous endpoints will ignore new columns

### Option 2: Full Rollback (Delete New Columns)
```sql
-- If needed, remove new columns (CAREFUL – destroys data):
ALTER TABLE vice_president_evaluations DROP COLUMN student_average, DROP COLUMN peer_average, DROP COLUMN is_teaching, DROP COLUMN final_score;
ALTER TABLE directorate_evaluations DROP COLUMN student_average, DROP COLUMN peer_average, DROP COLUMN is_teaching, DROP COLUMN final_score;
```

---

## Monitoring & Alerts

### Key Metrics to Monitor Post-Deployment
1. **API Performance**
   - Check `/academic-directorate` endpoint response time (new fields added)
   - Check `/calculate-publish-results` response time (new calculation added)
2. **Database**
   - Monitor table sizes (new columns add ~16 bytes per row)
   - Check for slow queries on `course_assignments` EXISTS subqueries
3. **Frontend**
   - Monitor error console for missing `is_teaching` field
   - Check print functionality (CSS may need refinement for multi-page letters)
4. **Business Logic**
   - Verify published scores match expected weights
   - Audit sample evaluations: (student×50%) + (peer×20%) + (supervisor×30%) for teaching roles

### Sample Audit Query
```sql
-- Verify a published result uses correct weights:
SELECT 
  ROUND((student_average * 0.50 + peer_average * 0.20 + (SELECT AVG(ratings) FROM ...)*0.30), 2) AS expected_score,
  final_score AS actual_score,
  is_teaching,
  ROUND(ABS(final_score - (student_average * 0.50 + peer_average * 0.20 + ...)*0.30), 2) AS delta
FROM vice_president_evaluations
WHERE status = 'PUBLISHED' AND is_teaching = 1;
```

---

## Known Limitations & Future Enhancements

### Current Limitations
1. **Multi-page letters**: Print CSS assumes single-page output. Multi-page letters may require page-break CSS refinement.
2. **Teaching status determinism**: Uses `EXISTS (SELECT FROM course_assignments)` – if an instructor is assigned zero courses by mistake, they'll be marked non-teaching. Consider UI warnings.
3. **Historical data**: Existing records in `evaluation_results` won't have `is_teaching` flag retroactively populated.

### Future Enhancements
1. **Export to PDF**: Add server-side PDF generation instead of browser print
2. **Score archives**: Archive breakdown components with evaluation for compliance/audit
3. **Teaching status override**: Allow admin to manually set teaching status if course_assignments is incomplete
4. **Weighted report summaries**: Department-level rollups using conditional weights

---

## Sign-Off Checklist

- [ ] Backend syntax validated
- [ ] Backend unit tests pass (4/4)
- [ ] Frontend builds successfully
- [ ] Frontend lints successfully (0 warnings)
- [ ] Database schema changes reviewed
- [ ] Test scenarios 1–3 executed manually
- [ ] Print functionality tested in browser
- [ ] Audit query confirms correct weights applied
- [ ] Rollback plan understood and documented
- [ ] Team notified of new print functionality
- [ ] Monitoring alerts configured

---

## Support & Troubleshooting

### Issue: "is_teaching field not found" errors
**Root Cause:** Frontend calling old API endpoint that doesn't expose the field  
**Fix:** Ensure backend has been deployed and restarted. Check API response includes `is_teaching`.

### Issue: Printed letter is blank or shows only header
**Root Cause:** `.print-result-letter` class not applied to body or `.result-letter` element missing  
**Fix:** Check VicePresidentDashboard/DirectorateDashboard useEffect hook that adds class before print.

### Issue: Weights are wrong (e.g., showing 60/20/20 instead of 50/20/30)
**Root Cause:** Calculation using old hardcoded weights instead of `calculatePerformanceScore()`  
**Fix:** Verify backend route calls `calculatePerformanceScore()` with `isTeaching` parameter.

### Issue: Database migration fails on startup
**Root Cause:** Table doesn't exist or permission denied  
**Fix:** Check that `vice_president_evaluations` table exists in database. Verify user has ALTER TABLE permissions.

---

## Contact & Escalation
For deployment issues, contact:
- **Backend Issues**: DevOps/Backend Team – check backend logs for performanceScore errors
- **Frontend Issues**: Frontend Team – check browser console for EvaluationScoreBreakdown errors
- **Database Issues**: DBA – check MySQL error log for schema migration issues
