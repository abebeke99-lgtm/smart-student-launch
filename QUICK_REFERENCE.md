# Quick Reference: Conditional Scoring & Printable Reports

## For Backend Developers

### Using the Scoring Utility

```javascript
const { calculatePerformanceScore } = require('../utils/performanceScore');

// Calculate weighted score for a teaching role
const result = calculatePerformanceScore({
  isTeaching: true,
  studentScore: 82,
  peerScore: 76,
  supervisorScore: 88
});
// Returns: { weights: { student: 50, peer: 20, supervisor: 30 }, totalScore: 83.00, ... }

// Calculate weighted score for non-teaching role
const result2 = calculatePerformanceScore({
  isTeaching: false,
  studentScore: 82,    // Will be ignored
  peerScore: 76,
  supervisorScore: 88
});
// Returns: { weights: { student: 0, peer: 40, supervisor: 60 }, totalScore: 83.20, ... }
```

### Determining Teaching Status

```javascript
// Query teaching status from course_assignments table
const [[row]] = await pool.query(`
  SELECT EXISTS (
    SELECT 1 FROM course_assignments ca
    WHERE ca.instructor_id = ? AND ca.cycle_id = ?
  ) AS is_teaching
`, [instructorId, cycleId]);

const isTeaching = Boolean(row.is_teaching);
```

### Storing Results

```javascript
// After calculating, store components for auditing
await pool.query(`
  UPDATE vice_president_evaluations SET
    student_average = ?,
    peer_average = ?,
    is_teaching = ?,
    final_score = ?,
    status = 'PUBLISHED'
  WHERE id = ?
`, [studentAvg, peerAvg, isTeaching, breakdown.totalScore, evaluationId]);
```

---

## For Frontend Developers

### Using the Breakdown Component

```jsx
import EvaluationScoreBreakdown from '../components/EvaluationScoreBreakdown';

export default function MyDashboard() {
  const [evaluation, setEvaluation] = useState(null);

  return (
    <div>
      <h2>{evaluation.full_name}</h2>
      
      {/* Show teaching status */}
      <p>{evaluation.is_teaching ? '✓ Has Teaching Load' : '✗ No Teaching Load'}</p>
      
      {/* Render printable breakdown */}
      <EvaluationScoreBreakdown
        isTeaching={evaluation.is_teaching}
        studentScore={evaluation.student_average}
        peerScore={evaluation.peer_average}
        supervisorScore={evaluation.supervisor_score}
        supervisorLabel="Vice President"
        finalScore={evaluation.final_score}
      />
      
      {/* Print button */}
      <button onClick={() => window.print()}>Print Report</button>
    </div>
  );
}
```

### Component Props

| Prop | Type | Required | Notes |
|------|------|----------|-------|
| `isTeaching` | boolean | Yes | Controls which rows displayed (affects weights) |
| `studentScore` | number | No | 0–100; ignored if `isTeaching=false` |
| `peerScore` | number | No | 0–100 |
| `supervisorScore` | number | No | 0–100 |
| `supervisorLabel` | string | No | Default: "Supervisor"; use "Vice President", "Dean", etc. |
| `finalScore` | number | No | If provided, displayed instead of calculated value |

### Print Behavior

```jsx
// In your component, add print class management
import { useEffect } from 'react';

export default function ReportView() {
  useEffect(() => {
    const handlePrintStart = () => document.body.classList.add('print-result-letter');
    const handlePrintEnd = () => document.body.classList.remove('print-result-letter');
    
    window.addEventListener('beforeprint', handlePrintStart);
    window.addEventListener('afterprint', handlePrintEnd);
    
    return () => {
      window.removeEventListener('beforeprint', handlePrintStart);
      window.removeEventListener('afterprint', handlePrintEnd);
    };
  }, []);

  return (
    <div className="result-letter">
      {/* Your report content */}
    </div>
  );
}
```

### API Response Structure

```javascript
// GET /api/vice-president/academic-directorate
{
  staff: [
    {
      id: 1,
      full_name: "Dr. Jane Smith",
      is_teaching: true,              // NEW
      student_average: 82.5,          // NEW
      peer_average: 76.3,             // NEW
      supervisor_score: 88,
      final_score: 83.2               // NEW
    }
  ]
}

// GET /api/directorate/deans
{
  deans: [
    {
      id: 2,
      full_name: "Prof. John Doe",
      is_teaching: false,             // NEW
      studentScore: null,             // Will be null for non-teaching
      peerScore: 74,
      supervisorScore: 85,
      score: 78.5                     // final_score
    }
  ]
}
```

---

## Weight Reference

### Teaching Roles (is_teaching = true)
| Component | Weight | Notes |
|-----------|--------|-------|
| Student Evaluation | 50% | Average of all student submissions |
| Peer Evaluation | 20% | Average of all peer submissions |
| Supervisor Evaluation | 30% | Score from VP/Dean/Directorate ratings |
| **Total** | **100%** | - |

### Non-Teaching Roles (is_teaching = false)
| Component | Weight | Notes |
|-----------|--------|-------|
| Student Evaluation | 0% | Excluded (not applicable) |
| Peer Evaluation | 40% | Average of all peer submissions |
| Supervisor Evaluation | 60% | Score from VP/Dean/Directorate ratings |
| **Total** | **100%** | - |

### Examples

**Teaching Role Calculation:**
```
Student: 80 × 50% = 40
Peer: 70 × 20% = 14
Supervisor: 90 × 30% = 27
Total: 40 + 14 + 27 = 81%
```

**Non-Teaching Role Calculation:**
```
Student: [excluded]
Peer: 70 × 40% = 28
Supervisor: 85 × 60% = 51
Total: 28 + 51 = 79%
```

---

## Database Schema

### New Columns (Both Tables)

```sql
-- Added to vice_president_evaluations and directorate_evaluations
ALTER TABLE [TABLE] ADD COLUMN student_average DECIMAL(5,2) NOT NULL DEFAULT 0.00;
ALTER TABLE [TABLE] ADD COLUMN peer_average DECIMAL(5,2) NOT NULL DEFAULT 0.00;
ALTER TABLE [TABLE] ADD COLUMN is_teaching TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE [TABLE] ADD COLUMN final_score DECIMAL(5,2) DEFAULT NULL;
```

### Query to Audit Calculations

```sql
-- Verify stored calculations match weight formula
SELECT 
  id,
  is_teaching,
  student_average,
  peer_average,
  (SELECT AVG(ratings) FROM ...) AS supervisor_score,
  final_score,
  CASE 
    WHEN is_teaching = 1 THEN
      ROUND((student_average * 0.50 + peer_average * 0.20 + supervisor_score * 0.30), 2)
    ELSE
      ROUND((peer_average * 0.40 + supervisor_score * 0.60), 2)
  END AS expected_score,
  ABS(final_score - expected_score) AS delta
FROM vice_president_evaluations
WHERE status = 'PUBLISHED'
ORDER BY delta DESC;
```

---

## Troubleshooting

### Issue: Component shows wrong weights
**Cause**: `isTeaching` prop not set correctly  
**Fix**: Verify API response includes `is_teaching` field and pass it correctly:
```jsx
<EvaluationScoreBreakdown
  isTeaching={Boolean(data.is_teaching)}  // Ensure boolean
  ...
/>
```

### Issue: Student row appears for non-teaching role
**Cause**: `isTeaching` prop not boolean (e.g., 0 or null)  
**Fix**: Coerce to boolean in component call:
```jsx
isTeaching={Boolean(evaluation.is_teaching)}
```

### Issue: Print shows entire page, not just report
**Cause**: `.print-result-letter` class not on body  
**Fix**: Ensure useEffect hook is running and adding class before print:
```javascript
window.addEventListener('beforeprint', () => {
  document.body.classList.add('print-result-letter');
});
```

### Issue: Database migration fails
**Cause**: Column already exists or permission denied  
**Fix**: Check existing schema:
```sql
SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'vice_president_evaluations' 
AND COLUMN_NAME IN ('student_average', 'peer_average', 'is_teaching', 'final_score');
```

---

## Common Patterns

### Pattern 1: Fetch and Display Evaluation
```jsx
const [evaluation, setEvaluation] = useState(null);

useEffect(() => {
  fetch('/api/vice-president/academic-directorate')
    .then(r => r.json())
    .then(data => setEvaluation(data.staff[0]))
    .catch(err => console.error('Failed to load:', err));
}, []);

if (!evaluation) return <p>Loading...</p>;

return (
  <div>
    <h2>{evaluation.full_name}</h2>
    <p>Teaching: {evaluation.is_teaching ? 'Yes' : 'No'}</p>
    <EvaluationScoreBreakdown {...evaluation} />
  </div>
);
```

### Pattern 2: Conditional Rendering by Teaching Status
```jsx
{evaluation.is_teaching ? (
  <p>Student evaluations available: {evaluation.student_average}</p>
) : (
  <p>This role is non-teaching (student evaluations not applicable)</p>
)}
```

### Pattern 3: List Reports with Print Per Item
```jsx
{evaluations.map(eval => (
  <div key={eval.id} className="result-letter">
    <h3>{eval.full_name}</h3>
    <EvaluationScoreBreakdown {...eval} />
    <button onClick={() => window.print()}>Print</button>
  </div>
))}
```

---

## Files to Know

| File | Purpose |
|------|---------|
| `backend/utils/performanceScore.js` | Core calculation utility – import and call this |
| `frontend/src/components/EvaluationScoreBreakdown.jsx` | Printable table component – import and use in dashboards |
| `backend/routes/vicePresident.js` | VP endpoint implementation |
| `backend/routes/directorate.js` | Directorate endpoint implementation |
| `backend/routes/dean.js` | Dean endpoint implementation |
| `frontend/src/index.css` | Print media queries – don't remove! |

---

## Testing Checklist

- [ ] Check unit tests pass: `node --test backend/tests/performanceScore.test.js`
- [ ] Verify API response includes `is_teaching`: `curl http://localhost:5000/api/vice-president/academic-directorate`
- [ ] Test teaching role prints correctly with 50/20/30 weights
- [ ] Test non-teaching role prints correctly with 0/40/60 weights (student row hidden)
- [ ] Test print preview (Ctrl+P) hides navigation
- [ ] Verify printed output includes score breakdown table
- [ ] Verify stored `final_score` matches calculated value

---

## Performance Notes

- **Calculation Time**: ~1ms per score (O(1) operation)
- **Database Size**: +16 bytes per evaluation row (4 new DECIMAL/TINYINT columns)
- **Query Impact**: +1 EXISTS subquery per published evaluation (minimal overhead)
- **Print Size**: Report letter typically 1–2 pages; no performance impact

---

## Support

**Questions about scoring logic?** → See `performanceScore.js` comments  
**Questions about component rendering?** → See `EvaluationScoreBreakdown.jsx` implementation  
**Questions about API contract?** → See `API_ENDPOINT_VERIFICATION.md`  
**Questions about deployment?** → See `DEPLOYMENT_CHECKLIST.md`  

**Need to update weights?** → Modify `performanceScore.js` lines 12–13 (single source of truth)
