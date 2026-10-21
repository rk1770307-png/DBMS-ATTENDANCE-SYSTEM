-- ============================================================================
-- ATTENDANCE MANAGEMENT AND MONITORING SYSTEM (AMMS)
-- Database: PostgreSQL 14+ / 16+ / 18+
-- Module: 03_queries_and_views.sql - Formal Relational Queries & Analytical Views
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECTION A: ANALYTICAL VIEWS FOR THE 5 USER ROLES
-- ----------------------------------------------------------------------------

-- 1. STUDENT PERSPECTIVE: Personal Attendance Summary per Course
-- Aggregates total conducted sessions, attended count, percentage, and 75% status
CREATE OR REPLACE VIEW view_student_attendance_summary AS
SELECT 
    s.student_id,
    s.prn,
    s.roll_number,
    s.first_name || ' ' || s.last_name AS student_name,
    s.email,
    d.division_name,
    c.course_id,
    c.course_code,
    c.course_name,
    c.credits,
    COUNT(ls.schedule_id) AS total_conducted_lectures,
    COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END) AS attended_lectures,
    (COUNT(ls.schedule_id) - COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END)) AS absent_lectures,
    COUNT(CASE WHEN ar.status = 'LATE' THEN 1 END) AS late_lectures,
    ROUND(
        COALESCE(
            (COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END)::DECIMAL / 
             NULLIF(COUNT(ls.schedule_id), 0)) * 100.0, 
            0.0
        ), 2
    ) AS attendance_percentage,
    CASE 
        WHEN COUNT(ls.schedule_id) = 0 THEN 'NO_DATA'
        WHEN (COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END)::DECIMAL / COUNT(ls.schedule_id)) * 100.0 < 75.0 
        THEN 'CRITICAL_DEFICIENCY'
        ELSE 'SATISFACTORY'
    END AS warning_status
FROM students s
JOIN divisions d ON s.division_id = d.division_id
JOIN course_allocations ca ON ca.division_id = d.division_id
JOIN courses c ON ca.course_id = c.course_id
LEFT JOIN lecture_schedules ls ON ls.allocation_id = ca.allocation_id AND ls.status = 'CONDUCTED'
LEFT JOIN attendance_records ar ON ar.schedule_id = ls.schedule_id AND ar.student_id = s.student_id
GROUP BY 
    s.student_id, s.prn, s.roll_number, s.first_name, s.last_name, s.email, 
    d.division_name, c.course_id, c.course_code, c.course_name, c.credits;

-- 2. COURSE TEACHER PERSPECTIVE: Lecture-wise and Course Metrics
-- Provides Course Teachers with macro and micro metrics for their allocated classes
CREATE OR REPLACE VIEW view_course_attendance_metrics AS
SELECT 
    ca.allocation_id,
    c.course_id,
    c.course_code,
    c.course_name,
    f.faculty_id,
    f.first_name || ' ' || f.last_name AS course_teacher,
    cl.class_level,
    d.division_name,
    COUNT(DISTINCT ls.schedule_id) FILTER (WHERE ls.status = 'CONDUCTED') AS conducted_lectures,
    COUNT(DISTINCT ls.schedule_id) FILTER (WHERE ls.status = 'SCHEDULED') AS upcoming_lectures,
    COUNT(DISTINCT ls.schedule_id) FILTER (WHERE ls.status = 'CANCELLED') AS cancelled_lectures,
    COUNT(DISTINCT s.student_id) AS total_enrolled_students,
    ROUND(
        COALESCE(
            AVG(
                CASE 
                    WHEN ls.status = 'CONDUCTED' AND ar.status IN ('PRESENT', 'EXCUSED') THEN 100.0 
                    WHEN ls.status = 'CONDUCTED' AND ar.status = 'ABSENT' THEN 0.0 
                    ELSE NULL 
                END
            ), 0.0
        ), 2
    ) AS average_course_attendance_pct
FROM course_allocations ca
JOIN courses c ON ca.course_id = c.course_id
JOIN faculty f ON ca.faculty_id = f.faculty_id
JOIN divisions d ON ca.division_id = d.division_id
JOIN classes cl ON d.class_id = cl.class_id
LEFT JOIN students s ON s.division_id = d.division_id AND s.is_active = TRUE
LEFT JOIN lecture_schedules ls ON ls.allocation_id = ca.allocation_id
LEFT JOIN attendance_records ar ON ar.schedule_id = ls.schedule_id AND ar.student_id = s.student_id
GROUP BY 
    ca.allocation_id, c.course_id, c.course_code, c.course_name, 
    f.faculty_id, f.first_name, f.last_name, cl.class_level, d.division_name;

-- 3. TEACHER GUARDIAN (TG) PERSPECTIVE: Mentee Monitoring & Deficiency Flags
CREATE OR REPLACE VIEW view_tg_mentee_monitoring AS
SELECT 
    tg.tg_id,
    f.faculty_id AS tg_faculty_id,
    f.first_name || ' ' || f.last_name AS tg_name,
    tg.batch_name,
    s.student_id,
    s.roll_number,
    s.first_name || ' ' || s.last_name AS student_name,
    s.email AS student_email,
    s.phone_number AS student_phone,
    s.parent_phone,
    tgm.counseling_flag,
    tgm.counseling_notes,
    COUNT(DISTINCT ls.schedule_id) AS total_conducted_lectures,
    COUNT(DISTINCT ls.schedule_id) AS total_lectures_all_courses,
    COUNT(DISTINCT CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN ar.attendance_id END) AS attended_lectures,
    COUNT(DISTINCT CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN ar.attendance_id END) AS total_attended,
    (COUNT(DISTINCT ls.schedule_id) - COUNT(DISTINCT CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN ar.attendance_id END)) AS absent_lectures,
    ROUND(
        COALESCE(
            (COUNT(DISTINCT CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN ar.attendance_id END)::DECIMAL / 
             NULLIF(COUNT(DISTINCT ls.schedule_id), 0)) * 100.0, 
            0.0
        ), 2
    ) AS cumulative_attendance_pct,
    CASE 
        WHEN (COUNT(DISTINCT CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN ar.attendance_id END)::DECIMAL / 
              NULLIF(COUNT(DISTINCT ls.schedule_id), 0)) * 100.0 < 75.0 
        THEN 'DEFAULTER_ALERT'
        ELSE 'NORMAL'
    END AS defaulter_status
FROM teacher_guardians tg
JOIN faculty f ON tg.faculty_id = f.faculty_id
JOIN tg_student_mapping tgm ON tg.tg_id = tgm.tg_id
JOIN students s ON tgm.student_id = s.student_id
JOIN divisions d ON s.division_id = d.division_id
JOIN course_allocations ca ON ca.division_id = d.division_id
LEFT JOIN lecture_schedules ls ON ls.allocation_id = ca.allocation_id AND ls.status = 'CONDUCTED'
LEFT JOIN attendance_records ar ON ar.schedule_id = ls.schedule_id AND ar.student_id = s.student_id
GROUP BY 
    tg.tg_id, f.faculty_id, f.first_name, f.last_name, tg.batch_name,
    s.student_id, s.roll_number, s.first_name, s.last_name, s.email,
    s.phone_number, s.parent_phone, tgm.counseling_flag, tgm.counseling_notes;

-- 4. CLASS TEACHER PERSPECTIVE: Division Cohort Health
CREATE OR REPLACE VIEW view_division_attendance_matrix AS
SELECT 
    d.division_id,
    cl.class_level,
    d.division_name,
    d.classroom_number,
    f.first_name || ' ' || f.last_name AS class_teacher,
    COUNT(DISTINCT s.student_id) AS total_students,
    COUNT(DISTINCT CASE 
        WHEN mentee_summary.cumulative_pct < 75.0 THEN s.student_id 
    END) AS defaulters_below_75,
    ROUND(COALESCE(AVG(mentee_summary.cumulative_pct), 0.0), 2) AS division_average_attendance_pct
FROM divisions d
JOIN classes cl ON d.class_id = cl.class_id
LEFT JOIN faculty f ON d.class_teacher_faculty_id = f.faculty_id
LEFT JOIN students s ON s.division_id = d.division_id AND s.is_active = TRUE
LEFT JOIN (
    SELECT 
        s2.student_id,
        ROUND(
            COALESCE(
                (COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END)::DECIMAL / 
                 NULLIF(COUNT(ls.schedule_id), 0)) * 100.0, 
                0.0
            ), 2
        ) AS cumulative_pct
    FROM students s2
    JOIN divisions d2 ON s2.division_id = d2.division_id
    JOIN course_allocations ca ON ca.division_id = d2.division_id
    LEFT JOIN lecture_schedules ls ON ls.allocation_id = ca.allocation_id AND ls.status = 'CONDUCTED'
    LEFT JOIN attendance_records ar ON ar.schedule_id = ls.schedule_id AND ar.student_id = s2.student_id
    GROUP BY s2.student_id
) mentee_summary ON mentee_summary.student_id = s.student_id
GROUP BY 
    d.division_id, cl.class_level, d.division_name, d.classroom_number, 
    f.first_name, f.last_name;

-- 5. HOD PERSPECTIVE: Departmental Executive Overview
CREATE OR REPLACE VIEW view_hod_department_overview AS
SELECT 
    dept.department_id,
    dept.department_code,
    dept.department_name,
    hod.first_name || ' ' || hod.last_name AS hod_name,
    COUNT(DISTINCT f.faculty_id) AS total_faculty_count,
    COUNT(DISTINCT c.course_id) AS total_active_courses,
    COUNT(DISTINCT s.student_id) AS total_enrolled_students,
    COUNT(DISTINCT ls.schedule_id) FILTER (WHERE ls.status = 'CONDUCTED') AS total_conducted_sessions,
    ROUND(
        COALESCE(
            AVG(
                CASE 
                    WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 100.0 
                    WHEN ar.status = 'ABSENT' THEN 0.0 
                    ELSE NULL 
                END
            ), 0.0
        ), 2
    ) AS department_overall_attendance_pct
FROM departments dept
LEFT JOIN faculty hod ON dept.hod_faculty_id = hod.faculty_id
LEFT JOIN faculty f ON f.department_id = dept.department_id AND f.is_active = TRUE
LEFT JOIN courses c ON c.department_id = dept.department_id
LEFT JOIN programs p ON p.department_id = dept.department_id
LEFT JOIN classes cl ON cl.program_id = p.program_id
LEFT JOIN divisions d ON d.class_id = cl.class_id
LEFT JOIN students s ON s.division_id = d.division_id AND s.is_active = TRUE
LEFT JOIN course_allocations ca ON ca.division_id = d.division_id
LEFT JOIN lecture_schedules ls ON ls.allocation_id = ca.allocation_id AND ls.status = 'CONDUCTED'
LEFT JOIN attendance_records ar ON ar.schedule_id = ls.schedule_id AND ar.student_id = s.student_id
GROUP BY 
    dept.department_id, dept.department_code, dept.department_name, 
    hod.first_name, hod.last_name;

-- 6. CONTINUOUS ABSENCE PATTERN DETECTION VIEW
-- Uses SQL window functions LAG() and lead analysis to detect 3+ consecutive lecture absences
CREATE OR REPLACE VIEW view_continuous_absence_alerts AS
WITH numbered_records AS (
    SELECT 
        ar.attendance_id,
        ar.student_id,
        s.roll_number,
        s.first_name || ' ' || s.last_name AS student_name,
        ca.course_id,
        c.course_code,
        ls.lecture_date,
        ls.slot_number,
        ar.status,
        LAG(ar.status, 1) OVER (PARTITION BY ar.student_id, ca.course_id ORDER BY ls.lecture_date, ls.slot_number) AS prev_status_1,
        LAG(ar.status, 2) OVER (PARTITION BY ar.student_id, ca.course_id ORDER BY ls.lecture_date, ls.slot_number) AS prev_status_2
    FROM attendance_records ar
    JOIN students s ON ar.student_id = s.student_id
    JOIN lecture_schedules ls ON ar.schedule_id = ls.schedule_id
    JOIN course_allocations ca ON ls.allocation_id = ca.allocation_id
    JOIN courses c ON ca.course_id = c.course_id
    WHERE ls.status = 'CONDUCTED'
)
SELECT 
    student_id,
    roll_number,
    student_name,
    course_id,
    course_code,
    lecture_date AS trigger_date,
    '3 CONSECUTIVE ABSENCES DETECTED' AS alert_message
FROM numbered_records
WHERE status = 'ABSENT' 
  AND prev_status_1 = 'ABSENT' 
  AND prev_status_2 = 'ABSENT';


-- ----------------------------------------------------------------------------
-- SECTION B: FORMAL RELATIONAL ALGEBRA & CALCULUS EQUIVALENTS
-- ----------------------------------------------------------------------------

/*
================================================================================
QUERY 1: SELECTION AND PROJECTION
================================================================================
Goal: Retrieve all active students in the Computer Engineering Department ('COMP').

1. Relational Algebra (RA):
   π_{student_id, roll_number, first_name, last_name, email} (
       σ_{department_code = 'COMP' ∧ is_active = TRUE} (
           students ⨝ divisions ⨝ classes ⨝ programs ⨝ departments
       )
   )

2. Tuple Relational Calculus (TRC):
   { t | ∃s ∈ students, ∃d ∈ divisions, ∃c ∈ classes, ∃p ∈ programs, ∃dept ∈ departments (
       t[student_id] = s.student_id ∧
       t[roll_number] = s.roll_number ∧
       t[student_name] = s.first_name || ' ' || s.last_name ∧
       t[email] = s.email ∧
       s.division_id = d.division_id ∧
       d.class_id = c.class_id ∧
       c.program_id = p.program_id ∧
       p.department_id = dept.department_id ∧
       dept.department_code = 'COMP' ∧
       s.is_active = TRUE
   )}

3. Domain Relational Calculus (DRC):
   { <sid, roll, fn, ln, em> | ∃did, ay, act (
       <sid, _, roll, fn, ln, em, _, _, _, did, ay, act, _> ∈ students ∧ act = TRUE ∧
       ∃cid, dn, ctf, rm (<did, cid, dn, ctf, rm> ∈ divisions ∧
       ∃pid, ayid, cl, sem (<cid, pid, ayid, cl, sem> ∈ classes ∧
       ∃pcode, pname, deptid, dl, ts (<pid, pcode, pname, deptid, dl, ts, _> ∈ programs ∧
       ∃deptcode (<deptid, deptcode, _, _, _, _, _, _> ∈ departments ∧ deptcode = 'COMP'))))
   )}
*/
-- SQL Implementation of Query 1:
SELECT 
    s.student_id,
    s.roll_number,
    s.first_name,
    s.last_name,
    s.email,
    dept.department_code
FROM students s
JOIN divisions d ON s.division_id = d.division_id
JOIN classes c ON d.class_id = c.class_id
JOIN programs p ON c.program_id = p.program_id
JOIN departments dept ON p.department_id = dept.department_id
WHERE dept.department_code = 'COMP'
  AND s.is_active = TRUE;


/*
================================================================================
QUERY 2: RELATIONAL DIVISION (UNIVERSAL QUANTIFICATION ∀)
================================================================================
Goal: Identify perfect-attendance students who have attended ALL conducted 
lectures in course CS301 (Universal Quantification).

1. Relational Algebra (RA) via Division (÷):
   Let ConductedLectures = π_{schedule_id} (
       σ_{course_code = 'CS301' ∧ status = 'CONDUCTED'} (lecture_schedules ⨝ course_allocations ⨝ courses)
   )
   Let AttendedLectures = π_{student_id, schedule_id} (
       σ_{status = 'PRESENT'} (attendance_records)
   )
   TargetStudents = AttendedLectures ÷ ConductedLectures

   Algebraic equivalent without division operator:
   π_{student_id}(students) - 
   π_{student_id}( (π_{student_id}(students) × ConductedLectures) - AttendedLectures )

2. Tuple Relational Calculus (TRC):
   { s | s ∈ students ∧ 
       ∀l ∈ lecture_schedules (
           (∃ca ∈ course_allocations, ∃c ∈ courses (
               l.allocation_id = ca.allocation_id ∧ 
               ca.course_id = c.course_id ∧ 
               c.course_code = 'CS301' ∧ 
               l.status = 'CONDUCTED'
           )) 
           ⇒ 
           (∃a ∈ attendance_records (
               a.student_id = s.student_id ∧ 
               a.schedule_id = l.schedule_id ∧ 
               a.status = 'PRESENT'
           ))
       )
   }
*/
-- SQL Implementation of Query 2 (Universal Quantification via Double NOT EXISTS):
SELECT 
    s.student_id,
    s.prn,
    s.roll_number,
    s.first_name || ' ' || s.last_name AS perfect_student
FROM students s
WHERE NOT EXISTS (
    -- Any conducted lecture in CS301...
    SELECT ls.schedule_id
    FROM lecture_schedules ls
    JOIN course_allocations ca ON ls.allocation_id = ca.allocation_id
    JOIN courses c ON ca.course_id = c.course_id
    WHERE c.course_code = 'CS301' 
      AND ls.status = 'CONDUCTED'
      AND ca.division_id = s.division_id
      AND NOT EXISTS (
          -- ...that this student did NOT attend as PRESENT
          SELECT 1 
          FROM attendance_records ar
          WHERE ar.schedule_id = ls.schedule_id
            AND ar.student_id = s.student_id
            AND ar.status = 'PRESENT'
      )
);


/*
================================================================================
QUERY 3: COMPLEX JOIN WITH AUDIT TRAIL RECONCILIATION
================================================================================
Goal: Retrieve all lecture sessions where an attendance record was corrected,
along with the original status, modified status, operator faculty, and mandatory reason.
*/
SELECT 
    aat.audit_id,
    c.course_code,
    c.course_name,
    ls.lecture_date,
    ls.slot_number,
    s.roll_number,
    s.first_name || ' ' || s.last_name AS student_name,
    aat.original_status,
    aat.modified_status,
    f.first_name || ' ' || f.last_name AS modified_by_faculty,
    aat.modified_at,
    aat.reason_for_modification
FROM attendance_audit_trail aat
JOIN attendance_records ar ON aat.attendance_id = ar.attendance_id
JOIN lecture_schedules ls ON aat.schedule_id = ls.schedule_id
JOIN course_allocations ca ON ls.allocation_id = ca.allocation_id
JOIN courses c ON ca.course_id = c.course_id
JOIN students s ON aat.student_id = s.student_id
JOIN faculty f ON aat.modified_by_faculty_id = f.faculty_id
ORDER BY aat.modified_at DESC;


/*
================================================================================
QUERY 4: CORRELATED SUBQUERY WITH AGGREGATE COMPARISON
================================================================================
Goal: Find students whose individual attendance in course CS301 is strictly 
lower than the division average attendance percentage for that course.
*/
WITH student_course_stat AS (
    SELECT 
        s.student_id,
        s.division_id,
        s.roll_number,
        s.first_name || ' ' || s.last_name AS student_name,
        ca.course_id,
        ROUND((COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END)::DECIMAL / 
               NULLIF(COUNT(ls.schedule_id), 0)) * 100.0, 2) AS student_pct
    FROM students s
    JOIN course_allocations ca ON ca.division_id = s.division_id
    JOIN courses c ON ca.course_id = c.course_id AND c.course_code = 'CS301'
    JOIN lecture_schedules ls ON ls.allocation_id = ca.allocation_id AND ls.status = 'CONDUCTED'
    LEFT JOIN attendance_records ar ON ar.schedule_id = ls.schedule_id AND ar.student_id = s.student_id
    GROUP BY s.student_id, s.division_id, s.roll_number, s.first_name, s.last_name, ca.course_id
)
SELECT 
    sc.student_id,
    sc.roll_number,
    sc.student_name,
    sc.student_pct,
    (
        SELECT ROUND(AVG(sc_inner.student_pct), 2)
        FROM student_course_stat sc_inner
        WHERE sc_inner.division_id = sc.division_id
    ) AS division_average_pct,
    ROUND(
        (SELECT AVG(sc_inner.student_pct) FROM student_course_stat sc_inner WHERE sc_inner.division_id = sc.division_id) - sc.student_pct, 
        2
    ) AS percentage_points_below_average
FROM student_course_stat sc
WHERE sc.student_pct < (
    SELECT AVG(sc_inner.student_pct)
    FROM student_course_stat sc_inner
    WHERE sc_inner.division_id = sc.division_id
)
ORDER BY sc.student_pct ASC;


/*
================================================================================
QUERY 5: GROUP BY WITH HAVING & WINDOW FUNCTIONS
================================================================================
Goal: Rank students within each academic division based on cumulative attendance
and display ranking deciles.
*/
SELECT 
    d.division_name,
    s.roll_number,
    s.first_name || ' ' || s.last_name AS student_name,
    COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END) AS attended_count,
    COUNT(ls.schedule_id) AS total_sessions,
    ROUND((COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END)::DECIMAL / 
           NULLIF(COUNT(ls.schedule_id), 0)) * 100.0, 2) AS attendance_percentage,
    DENSE_RANK() OVER (
        PARTITION BY d.division_id 
        ORDER BY (COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END)::DECIMAL / 
                  NULLIF(COUNT(ls.schedule_id), 0)) DESC
    ) AS division_rank,
    NTILE(4) OVER (
        PARTITION BY d.division_id 
        ORDER BY (COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END)::DECIMAL / 
                  NULLIF(COUNT(ls.schedule_id), 0)) DESC
    ) AS performance_quartile
FROM students s
JOIN divisions d ON s.division_id = d.division_id
JOIN course_allocations ca ON ca.division_id = d.division_id
JOIN lecture_schedules ls ON ls.allocation_id = ca.allocation_id AND ls.status = 'CONDUCTED'
LEFT JOIN attendance_records ar ON ar.schedule_id = ls.schedule_id AND ar.student_id = s.student_id
GROUP BY d.division_id, d.division_name, s.student_id, s.roll_number, s.first_name, s.last_name
ORDER BY d.division_name, division_rank ASC;
