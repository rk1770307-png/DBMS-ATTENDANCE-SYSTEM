-- ============================================================================
-- ATTENDANCE MANAGEMENT AND MONITORING SYSTEM (AMMS)
-- Database: MySQL 8.0+ (InnoDB Engine)
-- Module: 03_queries_and_views_mysql.sql - Analytical Views & Queries
-- ============================================================================

USE amms;

-- 1. STUDENT PERSPECTIVE VIEW
CREATE OR REPLACE VIEW view_student_attendance_summary AS
SELECT 
    s.student_id,
    s.prn,
    s.roll_number,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
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
            (COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END) / 
             NULLIF(COUNT(ls.schedule_id), 0)) * 100.0, 
            0.0
        ), 2
    ) AS attendance_percentage,
    CASE 
        WHEN COUNT(ls.schedule_id) = 0 THEN 'NO_DATA'
        WHEN (COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END) / COUNT(ls.schedule_id)) * 100.0 < 75.0 
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

-- 2. COURSE TEACHER PERSPECTIVE VIEW
CREATE OR REPLACE VIEW view_course_attendance_metrics AS
SELECT 
    ca.allocation_id,
    c.course_id,
    c.course_code,
    c.course_name,
    f.faculty_id,
    CONCAT(f.first_name, ' ', f.last_name) AS course_teacher,
    cl.class_level,
    d.division_name,
    COUNT(DISTINCT CASE WHEN ls.status = 'CONDUCTED' THEN ls.schedule_id END) AS conducted_lectures,
    COUNT(DISTINCT CASE WHEN ls.status = 'SCHEDULED' THEN ls.schedule_id END) AS upcoming_lectures,
    COUNT(DISTINCT CASE WHEN ls.status = 'CANCELLED' THEN ls.schedule_id END) AS cancelled_lectures,
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

-- 3. TEACHER GUARDIAN (TG) PERSPECTIVE VIEW
CREATE OR REPLACE VIEW view_tg_mentee_monitoring AS
SELECT 
    tg.tg_id,
    f.faculty_id AS tg_faculty_id,
    CONCAT(f.first_name, ' ', f.last_name) AS tg_name,
    tg.batch_name,
    s.student_id,
    s.roll_number,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
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
            (COUNT(DISTINCT CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN ar.attendance_id END) / 
             NULLIF(COUNT(DISTINCT ls.schedule_id), 0)) * 100.0, 
            0.0
        ), 2
    ) AS cumulative_attendance_pct,
    CASE 
        WHEN (COUNT(DISTINCT CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN ar.attendance_id END) / 
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

-- 4. CLASS TEACHER DIVISION MATRIX VIEW
CREATE OR REPLACE VIEW view_division_attendance_matrix AS
SELECT 
    d.division_id,
    cl.class_level,
    d.division_name,
    d.classroom_number,
    CONCAT(f.first_name, ' ', f.last_name) AS class_teacher,
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
                (COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END) / 
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

-- 5. HOD DEPARTMENT OVERVIEW VIEW
CREATE OR REPLACE VIEW view_hod_department_overview AS
SELECT 
    dept.department_id,
    dept.department_code,
    dept.department_name,
    CONCAT(hod.first_name, ' ', hod.last_name) AS hod_name,
    COUNT(DISTINCT f.faculty_id) AS total_faculty_count,
    COUNT(DISTINCT c.course_id) AS total_active_courses,
    COUNT(DISTINCT s.student_id) AS total_enrolled_students,
    COUNT(DISTINCT CASE WHEN ls.status = 'CONDUCTED' THEN ls.schedule_id END) AS total_conducted_sessions,
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

-- 6. CONTINUOUS ABSENCE ALERTS VIEW (Window functions LAG)
CREATE OR REPLACE VIEW view_continuous_absence_alerts AS
WITH numbered_records AS (
    SELECT 
        ar.attendance_id,
        ar.student_id,
        s.roll_number,
        CONCAT(s.first_name, ' ', s.last_name) AS student_name,
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
