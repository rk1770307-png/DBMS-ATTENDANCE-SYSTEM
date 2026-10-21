-- ============================================================================
-- ATTENDANCE MANAGEMENT AND MONITORING SYSTEM (AMMS)
-- Database: MySQL 8.0+ (InnoDB Engine)
-- Module: 05_performance_benchmarks_mysql.sql
-- Indexing Strategy & EXPLAIN ANALYZE Performance Optimization
-- ============================================================================

USE amms;

-- ============================================================================
-- 1. BENCHMARK QUERY 1: DEFICIENT ATTENDANCE SCAN (< 75%)
-- ============================================================================
EXPLAIN ANALYZE
SELECT 
    s.student_id,
    s.roll_number,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
    COUNT(ar.attendance_id) AS total_marked,
    COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END) AS present_count,
    ROUND(
        (COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END) / 
         NULLIF(COUNT(ar.attendance_id), 0)) * 100.0, 2
    ) AS attendance_pct
FROM students s
JOIN attendance_records ar ON s.student_id = ar.student_id
GROUP BY s.student_id, s.roll_number, s.first_name, s.last_name
HAVING (COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END) / 
        NULLIF(COUNT(ar.attendance_id), 0)) * 100.0 < 75.0;

-- ============================================================================
-- 2. BENCHMARK QUERY 2: SPECIFIC STUDENT COURSE BREAKDOWN
-- ============================================================================
EXPLAIN ANALYZE
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
-- 3. INDEX CREATION (OPTIMIZATION PHASE)
-- ============================================================================
CREATE INDEX idx_attendance_student_status 
ON attendance_records (student_id, status);

CREATE INDEX idx_attendance_schedule_id 
ON attendance_records (schedule_id);

CREATE INDEX idx_lecture_schedules_alloc_date 
ON lecture_schedules (allocation_id, lecture_date);

CREATE INDEX idx_students_division_id 
ON students (division_id, roll_number);

CREATE INDEX idx_audit_attendance_id 
ON attendance_audit_trail (attendance_id, modified_at);
