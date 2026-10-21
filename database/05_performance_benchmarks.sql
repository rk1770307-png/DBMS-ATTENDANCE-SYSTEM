-- ============================================================================
-- ATTENDANCE MANAGEMENT AND MONITORING SYSTEM (AMMS)
-- Database: PostgreSQL 14+ / 16+ / 18+
-- Module: 05_performance_benchmarks.sql
-- Indexing Strategy & EXPLAIN ANALYZE Performance Optimization
-- ============================================================================

-- ============================================================================
-- 1. IDENTIFICATION OF PERFORMANCE-CRITICAL ATTRIBUTES & QUERY WORKLOADS
-- ============================================================================
/*
High-Frequency Workloads in Engineering Institutes:
1. Defaulter List Extraction (< 75% threshold):
   - Frequency: Daily / Weekly automated jobs, TG dashboards, HOD reviews.
   - Filter attributes: `attendance_records.status`, `students.division_id`.
   - Bottleneck: Full table scans across hundreds of thousands of attendance logs.

2. Student Historical Log Range Scans:
   - Frequency: Real-time whenever a student logs in to view their portal.
   - Filter attributes: `attendance_records.student_id`, `lecture_schedules.lecture_date`.
   - Bottleneck: Nested loop joins with sequential table scans.

3. Consecutive Absence Window Scanning:
   - Filter attributes: `attendance_records.student_id`, `lecture_schedules.allocation_id`, `lecture_date`.
   - Bottleneck: Sort operations and window aggregations over large partitions.
*/

-- ============================================================================
-- 2. BENCHMARK QUERY 1: DEFICIENT ATTENDANCE SCAN (< 75%)
-- ============================================================================
-- EXPLAIN (ANALYZE, BUFFERS)
SELECT 
    s.student_id,
    s.roll_number,
    s.first_name || ' ' || s.last_name AS student_name,
    COUNT(ar.attendance_id) AS total_marked,
    COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END) AS present_count,
    ROUND(
        (COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END)::DECIMAL / 
         NULLIF(COUNT(ar.attendance_id), 0)) * 100.0, 2
    ) AS attendance_pct
FROM students s
JOIN attendance_records ar ON s.student_id = ar.student_id
GROUP BY s.student_id, s.roll_number, s.first_name, s.last_name
HAVING (COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(ar.attendance_id), 0)) * 100.0 < 75.0;

-- ============================================================================
-- 3. BENCHMARK QUERY 2: SPECIFIC STUDENT COURSE BREAKDOWN
-- ============================================================================
-- EXPLAIN (ANALYZE, BUFFERS)
SELECT 
    ar.attendance_id,
    c.course_code,
    c.course_name,
    ls.lecture_date,
    ls.slot_number,
    ar.status,
    ar.marked_at
FROM attendance_records ar
JOIN lecture_schedules ls ON ar.schedule_id = ls.schedule_id
JOIN course_allocations ca ON ls.allocation_id = ca.allocation_id
JOIN courses c ON ca.course_id = c.course_id
WHERE ar.student_id = 5
  AND ls.lecture_date BETWEEN '2025-09-01' AND '2025-09-30'
ORDER BY ls.lecture_date, ls.slot_number;

-- ============================================================================
-- 4. INDEX CREATION (OPTIMIZATION PHASE)
-- ============================================================================

-- Index 1: Composite B-tree index on (student_id, status)
-- Allows Index-Only Scans when calculating student presence/absence aggregates
CREATE INDEX IF NOT EXISTS idx_attendance_student_status 
ON attendance_records (student_id, status);

-- Index 2: B-tree index on schedule_id for fast schedule-to-attendance joins
CREATE INDEX IF NOT EXISTS idx_attendance_schedule_id 
ON attendance_records (schedule_id);

-- Index 3: Composite B-tree on lecture_schedules(allocation_id, lecture_date)
CREATE INDEX IF NOT EXISTS idx_lecture_schedules_alloc_date 
ON lecture_schedules (allocation_id, lecture_date);

-- Index 4: Partial Index specifically targeting ABSENT records
-- Highly compact; dramatically accelerates defaulter and continuous absence scans
CREATE INDEX IF NOT EXISTS idx_attendance_partial_absent 
ON attendance_records (student_id, schedule_id) 
WHERE status = 'ABSENT';

-- Index 5: B-tree index on students division
CREATE INDEX IF NOT EXISTS idx_students_division_id 
ON students (division_id, roll_number);

-- Index 6: Audit trail indexing for compliance auditing
CREATE INDEX IF NOT EXISTS idx_audit_attendance_id 
ON attendance_audit_trail (attendance_id, modified_at DESC);
