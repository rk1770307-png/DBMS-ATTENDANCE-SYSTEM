-- ============================================================================
-- ATTENDANCE MANAGEMENT AND MONITORING SYSTEM (AMMS)
-- Database: MySQL 8.0+ (InnoDB Engine)
-- Module: 02_seed_data_mysql.sql - Comprehensive Academic Dataset
-- Six Engineering Departments with Realistic Classes, Faculty, Students & Records
-- ============================================================================

USE amms;

START TRANSACTION;

-- ----------------------------------------------------------------------------
-- 1. DEPARTMENTS (6 Engineering Departments)
-- ----------------------------------------------------------------------------
INSERT INTO departments (department_id, department_code, department_name, established_year, contact_email, building_location) VALUES
(1, 'COMP', 'Computer Engineering', 1995, 'hod.comp@engg-institute.edu', 'Block A, 3rd Floor'),
(2, 'IT', 'Information Technology', 2001, 'hod.it@engg-institute.edu', 'Block A, 4th Floor'),
(3, 'ENTC', 'Electronics & Telecommunication', 1992, 'hod.entc@engg-institute.edu', 'Block B, 2nd Floor'),
(4, 'MECH', 'Mechanical Engineering', 1988, 'hod.mech@engg-institute.edu', 'Workshop Complex & Block C'),
(5, 'CIVIL', 'Civil Engineering', 1988, 'hod.civil@engg-institute.edu', 'Block D, Ground & 1st Floor'),
(6, 'ELEC', 'Electrical Engineering', 1990, 'hod.elec@engg-institute.edu', 'Block B, 3rd Floor')
ON DUPLICATE KEY UPDATE department_name = VALUES(department_name);

-- ----------------------------------------------------------------------------
-- 2. FACULTY (HODs, Professors, TGs, Class Teachers across 6 Departments)
-- ----------------------------------------------------------------------------
INSERT INTO faculty (faculty_id, employee_code, first_name, last_name, email, phone_number, department_id, designation, qualification, joining_date, is_active) VALUES
-- COMP Faculty
(1, 'FAC-COMP-01', 'Namdev', 'Sawant', 'namdev.sawant@engg-institute.edu', '+91 9823011001', 1, 'HOD', 'Ph.D. in Computer Science', '2008-07-15', TRUE),
(2, 'FAC-COMP-02', 'Pooja', 'Verma', 'pooja.verma@engg-institute.edu', '+91 9823011002', 1, 'Associate Professor', 'M.Tech CSE, Ph.D.', '2012-08-01', TRUE),
(3, 'FAC-COMP-03', 'Amit', 'Kulkarni', 'amit.kulkarni@engg-institute.edu', '+91 9823011003', 1, 'Assistant Professor', 'M.Tech Data Science', '2016-01-10', TRUE),
(4, 'FAC-COMP-04', 'Neha', 'Patil', 'neha.patil@engg-institute.edu', '+91 9823011004', 1, 'Assistant Professor', 'Ph.D. Information Security', '2018-06-20', TRUE),

-- IT Faculty
(5, 'FAC-IT-01', 'Sunita', 'Kulkarni', 'sunita.kulkarni@engg-institute.edu', '+91 9823012001', 2, 'HOD', 'Ph.D. in Information Technology', '2010-06-12', TRUE),
(6, 'FAC-IT-02', 'Siddharth', 'Joshi', 'siddharth.joshi@engg-institute.edu', '+91 9823012002', 2, 'Associate Professor', 'M.Tech Software Engg', '2014-09-01', TRUE),
(7, 'FAC-IT-03', 'Ananya', 'Rao', 'ananya.rao@engg-institute.edu', '+91 9823012003', 2, 'Assistant Professor', 'M.Tech AI & Cloud', '2019-07-15', TRUE),

-- ENTC Faculty
(8, 'FAC-ENTC-01', 'Anil', 'Deshmukh', 'anil.deshmukh@engg-institute.edu', '+91 9823013001', 3, 'HOD', 'Ph.D. in Signal Processing', '2005-03-20', TRUE),
(9, 'FAC-ENTC-02', 'Kavita', 'Mane', 'kavita.mane@engg-institute.edu', '+91 9823013002', 3, 'Associate Professor', 'Ph.D. Embedded Systems', '2013-11-05', TRUE),

-- MECH Faculty
(10, 'FAC-MECH-01', 'Vikram', 'Patil', 'vikram.patil@engg-institute.edu', '+91 9823014001', 4, 'HOD', 'Ph.D. in Thermal Engineering', '2002-01-15', TRUE),
(11, 'FAC-MECH-02', 'Suresh', 'Babar', 'suresh.babar@engg-institute.edu', '+91 9823014002', 4, 'Associate Professor', 'M.Tech CAD/CAM', '2011-04-18', TRUE),

-- CIVIL Faculty
(12, 'FAC-CIVIL-01', 'Ramesh', 'Shinde', 'ramesh.shinde@engg-institute.edu', '+91 9823015001', 5, 'HOD', 'Ph.D. in Structural Engineering', '2004-08-25', TRUE),
(13, 'FAC-CIVIL-02', 'Pravin', 'Gaikwad', 'pravin.gaikwad@engg-institute.edu', '+91 9823015002', 5, 'Assistant Professor', 'M.Tech Geotechnical Engg', '2017-02-01', TRUE),

-- ELEC Faculty
(14, 'FAC-ELEC-01', 'Meena', 'Joshi', 'meena.joshi@engg-institute.edu', '+91 9823016001', 6, 'HOD', 'Ph.D. in Power Systems', '2006-09-10', TRUE),
(15, 'FAC-ELEC-02', 'Ganesh', 'Kadam', 'ganesh.kadam@engg-institute.edu', '+91 9823016002', 6, 'Assistant Professor', 'M.Tech Control Systems', '2018-07-01', TRUE)
ON DUPLICATE KEY UPDATE designation = VALUES(designation);

-- Link HODs back to departments
UPDATE departments SET hod_faculty_id = 1 WHERE department_id = 1;
UPDATE departments SET hod_faculty_id = 5 WHERE department_id = 2;
UPDATE departments SET hod_faculty_id = 8 WHERE department_id = 3;
UPDATE departments SET hod_faculty_id = 10 WHERE department_id = 4;
UPDATE departments SET hod_faculty_id = 12 WHERE department_id = 5;
UPDATE departments SET hod_faculty_id = 14 WHERE department_id = 6;

-- ----------------------------------------------------------------------------
-- 3. PROGRAMS (UG Degree Programs for all 6 departments)
-- ----------------------------------------------------------------------------
INSERT INTO programs (program_id, program_code, program_name, department_id, degree_level, total_semesters) VALUES
(1, 'BTECH-COMP', 'Bachelor of Technology in Computer Engineering', 1, 'UG', 8),
(2, 'BTECH-IT', 'Bachelor of Technology in Information Technology', 2, 'UG', 8),
(3, 'BTECH-ENTC', 'Bachelor of Technology in Electronics & Telecommunication', 3, 'UG', 8),
(4, 'BTECH-MECH', 'Bachelor of Technology in Mechanical Engineering', 4, 'UG', 8),
(5, 'BTECH-CIVIL', 'Bachelor of Technology in Civil Engineering', 5, 'UG', 8),
(6, 'BTECH-ELEC', 'Bachelor of Technology in Electrical Engineering', 6, 'UG', 8)
ON DUPLICATE KEY UPDATE program_name = VALUES(program_name);

-- ----------------------------------------------------------------------------
-- 4. ACADEMIC YEARS
-- ----------------------------------------------------------------------------
INSERT INTO academic_years (academic_year_id, year_label, start_date, end_date, is_current) VALUES
(1, '2025-2026', '2025-07-01', '2026-06-30', TRUE),
(2, '2024-2025', '2024-07-01', '2025-06-30', FALSE)
ON DUPLICATE KEY UPDATE is_current = VALUES(is_current);

-- ----------------------------------------------------------------------------
-- 5. CLASSES (FE, SE, TE, BE across programs - configured to exactly 2 classes)
-- ----------------------------------------------------------------------------
INSERT INTO classes (class_id, program_id, academic_year_id, class_level, semester) VALUES
-- COMP Classes (2 Academic Classes)
(1, 1, 1, 'SE', 3), -- Class 1: Second Year (Semester 3)
(2, 1, 1, 'TE', 5)  -- Class 2: Third Year (Semester 5)
ON DUPLICATE KEY UPDATE semester = VALUES(semester);

-- ----------------------------------------------------------------------------
-- 6. DIVISIONS (Cohorts with designated Class Teachers)
-- ----------------------------------------------------------------------------
INSERT INTO divisions (division_id, class_id, division_name, class_teacher_faculty_id, classroom_number) VALUES
(1, 1, 'A', 2, 'Room A-301'), -- SE-COMP Div A (Class Teacher: Prof Pooja Verma)
(2, 1, 'B', 3, 'Room A-302'), -- SE-COMP Div B (Class Teacher: Prof Amit Kulkarni)
(3, 2, 'A', 4, 'Room A-303')  -- TE-COMP Div A (Class Teacher: Prof Neha Patil)
ON DUPLICATE KEY UPDATE classroom_number = VALUES(classroom_number);

-- ----------------------------------------------------------------------------
-- 7. COURSES (Curriculum subjects - configured to exactly 5 courses)
-- ----------------------------------------------------------------------------
INSERT INTO courses (course_id, course_code, course_name, department_id, semester, lecture_type, credits, weekly_hours) VALUES
-- Exactly 5 Academic Courses
(1, 'CS301', 'Database Management Systems', 1, 3, 'THEORY', 4.0, 4),
(2, 'CS302', 'Data Structures and Algorithms', 1, 3, 'THEORY', 4.0, 4),
(3, 'CS303', 'Computer Organization & Architecture', 1, 3, 'THEORY', 3.0, 3),
(4, 'CS501', 'Operating Systems & System Programming', 1, 5, 'THEORY', 4.0, 4),
(5, 'CS502', 'Software Engineering & Agile Methodology', 1, 5, 'THEORY', 3.0, 3)
ON DUPLICATE KEY UPDATE course_name = VALUES(course_name);

-- ----------------------------------------------------------------------------
-- 8. STUDENTS (Comprehensive student roster for SE-COMP Div A, Div B, and others)
-- ----------------------------------------------------------------------------
INSERT INTO students (student_id, prn, roll_number, first_name, last_name, email, phone_number, parent_phone, parent_email, division_id, admission_year, is_active) VALUES
-- SE-COMP Div A (Roll 101 to 115)
(1, 'PRN20240101', 101, 'Aarav', 'Sharma', 'aarav.sharma@student.engg.edu', '+91 9900010101', '+91 9811100001', 'p.sharma@gmail.com', 1, 2024, TRUE),
(2, 'PRN20240102', 102, 'Aditi', 'Patil', 'aditi.patil@student.engg.edu', '+91 9900010102', '+91 9811100002', 'p.patil@gmail.com', 1, 2024, TRUE),
(3, 'PRN20240103', 103, 'Aryan', 'Deshmukh', 'aryan.deshmukh@student.engg.edu', '+91 9900010103', '+91 9811100003', 'p.deshmukh@gmail.com', 1, 2024, TRUE),
(4, 'PRN20240104', 104, 'Diya', 'Joshi', 'diya.joshi@student.engg.edu', '+91 9900010104', '+91 9811100004', 'p.joshi@gmail.com', 1, 2024, TRUE),
(5, 'PRN20240105', 105, 'Ishaan', 'Kulkarni', 'ishaan.kulkarni@student.engg.edu', '+91 9900010105', '+91 9811100005', 'p.kulkarni@gmail.com', 1, 2024, TRUE),
(6, 'PRN20240106', 106, 'Kavya', 'Nair', 'kavya.nair@student.engg.edu', '+91 9900010106', '+91 9811100006', 'p.nair@gmail.com', 1, 2024, TRUE),
(7, 'PRN20240107', 107, 'Manish', 'Chavan', 'manish.chavan@student.engg.edu', '+91 9900010107', '+91 9811100007', 'p.chavan@gmail.com', 1, 2024, TRUE),
(8, 'PRN20240108', 108, 'Neha', 'Gupte', 'neha.gupte@student.engg.edu', '+91 9900010108', '+91 9811100008', 'p.gupte@gmail.com', 1, 2024, TRUE),
(9, 'PRN20240109', 109, 'Pranav', 'More', 'pranav.more@student.engg.edu', '+91 9900010109', '+91 9811100009', 'p.more@gmail.com', 1, 2024, TRUE),
(10, 'PRN20240110', 110, 'Rhea', 'Sen', 'rhea.sen@student.engg.edu', '+91 9900010110', '+91 9811100010', 'p.sen@gmail.com', 1, 2024, TRUE),
(11, 'PRN20240111', 111, 'Rohan', 'Mehta', 'rohan.mehta@student.engg.edu', '+91 9900010111', '+91 9811100011', 'p.mehta@gmail.com', 1, 2024, TRUE),
(12, 'PRN20240112', 112, 'Sanya', 'Bansal', 'sanya.bansal@student.engg.edu', '+91 9900010112', '+91 9811100012', 'p.bansal@gmail.com', 1, 2024, TRUE),
(13, 'PRN20240113', 113, 'Tanmay', 'Bhosale', 'tanmay.bhosale@student.engg.edu', '+91 9900010113', '+91 9811100013', 'p.bhosale@gmail.com', 1, 2024, TRUE),
(14, 'PRN20240114', 114, 'Varun', 'Shinde', 'varun.shinde@student.engg.edu', '+91 9900010114', '+91 9811100014', 'p.shinde@gmail.com', 1, 2024, TRUE),
(15, 'PRN20240115', 115, 'Zoya', 'Khan', 'zoya.khan@student.engg.edu', '+91 9900010115', '+91 9811100015', 'p.khan@gmail.com', 1, 2024, TRUE),

-- SE-COMP Div B (Roll 201 to 205)
(16, 'PRN20240201', 201, 'Aniket', 'Pawar', 'aniket.pawar@student.engg.edu', '+91 9900010201', '+91 9811100016', 'p.pawar@gmail.com', 2, 2024, TRUE),
(17, 'PRN20240202', 202, 'Bhavna', 'Trivedi', 'bhavna.trivedi@student.engg.edu', '+91 9900010202', '+91 9811100017', 'p.trivedi@gmail.com', 2, 2024, TRUE),
(18, 'PRN20240203', 203, 'Chetan', 'Salve', 'chetan.salve@student.engg.edu', '+91 9900010203', '+91 9811100018', 'p.salve@gmail.com', 2, 2024, TRUE),
(19, 'PRN20240204', 204, 'Deepak', 'Yadav', 'deepak.yadav@student.engg.edu', '+91 9900010204', '+91 9811100019', 'p.yadav@gmail.com', 2, 2024, TRUE),
(20, 'PRN20240205', 205, 'Esha', 'Modi', 'esha.modi@student.engg.edu', '+91 9900010205', '+91 9811100020', 'p.modi@gmail.com', 2, 2024, TRUE),

-- TE-COMP Div A (Roll 301 to 305)
(21, 'PRN20240301', 301, 'Farhan', 'Qureshi', 'farhan.qureshi@student.engg.edu', '+91 9900010301', '+91 9811100021', 'p.qureshi@gmail.com', 3, 2024, TRUE),
(22, 'PRN20240302', 302, 'Gauri', 'Oak', 'gauri.oak@student.engg.edu', '+91 9900010302', '+91 9811100022', 'p.oak@gmail.com', 3, 2024, TRUE),
(23, 'PRN20240303', 303, 'Harsh', 'Vardhan', 'harsh.vardhan@student.engg.edu', '+91 9900010303', '+91 9811100023', 'p.vardhan@gmail.com', 3, 2024, TRUE),
(24, 'PRN20240304', 304, 'Ira', 'Bhave', 'ira.bhave@student.engg.edu', '+91 9900010304', '+91 9811100024', 'p.bhave@gmail.com', 3, 2024, TRUE),
(25, 'PRN20240305', 305, 'Jayesh', 'Thakur', 'jayesh.thakur@student.engg.edu', '+91 9900010305', '+91 9811100025', 'p.thakur@gmail.com', 3, 2024, TRUE),
-- Additional Student: Ram Joshi
(26, 'PRN20240116', 116, 'Ram', 'Joshi', 'ram.joshi@student.engg.edu', '+91 9900010116', '+91 9811100026', 'p.joshi.ram@gmail.com', 1, 2024, TRUE)
ON DUPLICATE KEY UPDATE first_name = VALUES(first_name);

-- ----------------------------------------------------------------------------
-- 9. COURSE ALLOCATIONS
-- Maps Faculty to Courses & Divisions for Academic Year 2025-2026
-- ----------------------------------------------------------------------------
INSERT INTO course_allocations (allocation_id, course_id, faculty_id, division_id, academic_year_id, allocation_role) VALUES
(1, 1, 2, 1, 1, 'PRIMARY'), -- Prof Pooja Verma teaches CS301 (DBMS) to SE-COMP Div A
(2, 2, 3, 1, 1, 'PRIMARY'), -- Prof Amit Kulkarni teaches CS302 (DSA) to SE-COMP Div A
(3, 3, 4, 1, 1, 'PRIMARY'), -- Prof Neha Patil teaches CS303 (COA) to SE-COMP Div A
(4, 1, 2, 2, 1, 'PRIMARY'), -- Prof Pooja Verma teaches CS301 (DBMS) to SE-COMP Div B
(5, 2, 3, 2, 1, 'PRIMARY'), -- Prof Amit Kulkarni teaches CS302 (DSA) to SE-COMP Div B
(6, 4, 2, 3, 1, 'PRIMARY'), -- Prof Pooja Verma teaches CS501 (OS) to TE-COMP Div A
(7, 5, 1, 3, 1, 'PRIMARY')  -- Dr. Namdev Sawant teaches CS502 (SE) to TE-COMP Div A
ON DUPLICATE KEY UPDATE allocation_role = VALUES(allocation_role);

-- ----------------------------------------------------------------------------
-- 10. TEACHER GUARDIANS (TGs)
-- ----------------------------------------------------------------------------
INSERT INTO teacher_guardians (tg_id, faculty_id, department_id, academic_year_id, batch_name, max_mentees) VALUES
(1, 3, 1, 1, 'COMP-SE-Batch-TG1', 20), -- Prof Amit Kulkarni (SE-COMP TG Batch 1)
(2, 4, 1, 1, 'COMP-SE-Batch-TG2', 20)  -- Prof Neha Patil (SE-COMP TG Batch 2)
ON DUPLICATE KEY UPDATE batch_name = VALUES(batch_name);

-- ----------------------------------------------------------------------------
-- 11. TG STUDENT MAPPINGS
-- ----------------------------------------------------------------------------
INSERT INTO tg_student_mapping (mapping_id, tg_id, student_id, assigned_date, counseling_notes, counseling_flag) VALUES
-- Batch TG1 (Prof Amit Kulkarni): Students 1 to 8
(1, 1, 1, '2025-07-15', 'Excellent academic standing. Active in tech clubs.', FALSE),
(2, 1, 2, '2025-07-15', 'Consistent high performer.', FALSE),
(3, 1, 3, '2025-07-15', 'Warning: Frequent unexcused leaves on Mondays. Parent notified.', TRUE),
(4, 1, 4, '2025-07-15', 'Good progress, participating in coding contests.', FALSE),
(5, 1, 5, '2025-07-15', 'Critical low attendance in Theory sessions. First counseling conducted.', TRUE),
(6, 1, 6, '2025-07-15', 'Regular attendance.', FALSE),
(7, 1, 7, '2025-07-15', 'Irregular attendance pattern noted.', TRUE),
(8, 1, 8, '2025-07-15', 'Satisfactory.', FALSE),
-- Batch TG2 (Prof Neha Patil): Students 9 to 15
(9, 2, 9, '2025-07-15', 'Active student, attendance above 85%.', FALSE),
(10, 2, 10, '2025-07-15', 'Good academic focus.', FALSE),
(11, 2, 11, '2025-07-15', 'Continuous absence recorded in September. Health issues cited.', TRUE),
(12, 2, 12, '2025-07-15', 'Regular.', FALSE),
(13, 2, 13, '2025-07-15', 'Needs improvement in laboratory attendance.', TRUE),
(14, 2, 14, '2025-07-15', 'Good attendance record.', FALSE),
(15, 2, 15, '2025-07-15', 'High performer, 95% attendance.', FALSE),
(16, 1, 26, '2025-07-15', 'High academic performance. Regular in classes.', FALSE)
ON DUPLICATE KEY UPDATE counseling_flag = VALUES(counseling_flag);

-- ----------------------------------------------------------------------------
-- 12. LECTURE SCHEDULES
-- Scheduled and conducted sessions for SE-COMP Div A (Allocation 1: CS301 DBMS)
-- ----------------------------------------------------------------------------
INSERT INTO lecture_schedules (schedule_id, allocation_id, lecture_date, slot_number, start_time, end_time, room_number, status, topic_covered, conducted_at) VALUES
(1, 1, '2025-09-01', 1, '09:00:00', '10:00:00', 'Room A-301', 'CONDUCTED', 'Introduction to Database Systems & Architecture', '2025-09-01 10:05:00'),
(2, 1, '2025-09-03', 2, '10:00:00', '11:00:00', 'Room A-301', 'CONDUCTED', 'Entity-Relationship Modeling & Constraints', '2025-09-03 11:02:00'),
(3, 1, '2025-09-05', 1, '09:00:00', '10:00:00', 'Room A-301', 'CONDUCTED', 'Relational Model, Keys, and Integrity Constraints', '2025-09-05 10:00:00'),
(4, 1, '2025-09-08', 1, '09:00:00', '10:00:00', 'Room A-301', 'CONDUCTED', 'Relational Algebra: Select, Project, Join operations', '2025-09-08 10:03:00'),
(5, 1, '2025-09-10', 2, '10:00:00', '11:00:00', 'Room A-301', 'CONDUCTED', 'Tuple and Domain Relational Calculus', '2025-09-10 10:58:00'),
(6, 1, '2025-09-12', 1, '09:00:00', '10:00:00', 'Room A-301', 'CONDUCTED', 'SQL DDL, DML, and Complex Joins', '2025-09-12 10:01:00'),
(7, 1, '2025-09-15', 1, '09:00:00', '10:00:00', 'Room A-301', 'CONDUCTED', 'Functional Dependencies & Normalization up to 3NF/BCNF', '2025-09-15 10:04:00'),
(8, 1, '2025-09-17', 2, '10:00:00', '11:00:00', 'Room A-301', 'CONDUCTED', 'Transactions, ACID Properties, Concurrency Control', '2025-09-17 11:00:00'),
(9, 1, '2025-09-19', 1, '09:00:00', '10:00:00', 'Room A-301', 'CONDUCTED', 'Database Recovery, Write-Ahead Logging, and Indexing', '2025-09-19 10:02:00'),
(10, 1, '2025-09-22', 1, '09:00:00', '10:00:00', 'Room A-301', 'CONDUCTED', 'Query Optimization and EXPLAIN ANALYZE Cost Models', '2025-09-22 10:05:00'),
-- Allocation 2: CS302 (DSA) Lectures
(11, 2, '2025-09-01', 3, '11:15:00', '12:15:00', 'Room A-301', 'CONDUCTED', 'Asymptotic Notations & Complexity Analysis', '2025-09-01 12:18:00'),
(12, 2, '2025-09-03', 4, '12:15:00', '13:15:00', 'Room A-301', 'CONDUCTED', 'Balanced Binary Search Trees & AVL Trees', '2025-09-03 13:20:00'),
(13, 2, '2025-09-08', 3, '11:15:00', '12:15:00', 'Room A-301', 'CONDUCTED', 'B-Trees and Multi-Way Index Structures', '2025-09-08 12:15:00'),
-- Allocation 3: CS303 (COA) Lectures
(14, 3, '2025-09-02', 1, '09:00:00', '10:00:00', 'Room A-301', 'CONDUCTED', 'Instruction Set Architecture & Pipelining', '2025-09-02 10:05:00'),
(15, 3, '2025-09-04', 2, '10:00:00', '11:00:00', 'Room A-301', 'CONDUCTED', 'Cache Memory Hierarchy & Mapping Techniques', '2025-09-04 11:00:00'),
-- Rescheduled / Cancelled / Upcoming Lectures
(16, 1, '2025-09-24', 1, '09:00:00', '10:00:00', 'Room A-301', 'CANCELLED', NULL, NULL),
(17, 1, '2025-09-25', 5, '14:00:00', '15:00:00', 'Room A-301', 'SCHEDULED', 'Distributed Databases & Replication', NULL),
-- Allocation 7: CS502 (Operating Systems - Div B) taught by Dr. Namdev Sawant (HOD)
(18, 7, '2025-09-08', 2, '10:15:00', '11:15:00', 'Room B-201', 'CONDUCTED', 'OS Fundamentals & System Architecture', '2025-09-08 11:15:00'),
(19, 7, '2025-09-12', 3, '11:15:00', '12:15:00', 'Room B-201', 'CONDUCTED', 'Process Scheduling Algorithms & CPU Dispatcher', '2025-09-12 12:15:00'),
(20, 7, '2025-09-26', 1, '09:00:00', '10:00:00', 'Room B-201', 'SCHEDULED', 'Inter-Process Communication & Mutex Semaphores', NULL)
ON DUPLICATE KEY UPDATE status = VALUES(status);

UPDATE lecture_schedules SET cancellation_reason = 'Institute Sports Day Inauguration' WHERE schedule_id = 16;
UPDATE lecture_schedules SET rescheduled_from_schedule_id = 16 WHERE schedule_id = 17;

-- ----------------------------------------------------------------------------
-- 13. ATTENDANCE RECORDS (Bulk atomic attendance logs)
-- ----------------------------------------------------------------------------
-- Schedule 1
INSERT INTO attendance_records (schedule_id, student_id, status, marked_by_faculty_id, remarks) VALUES
(1, 1, 'PRESENT', 2, 'On time'), (1, 2, 'PRESENT', 2, 'On time'), (1, 3, 'ABSENT', 2, 'Unexcused leave'),
(1, 4, 'PRESENT', 2, 'On time'), (1, 5, 'ABSENT', 2, 'Unexcused leave'), (1, 6, 'PRESENT', 2, 'On time'),
(1, 7, 'PRESENT', 2, 'On time'), (1, 8, 'PRESENT', 2, 'On time'), (1, 9, 'PRESENT', 2, 'On time'),
(1, 10, 'PRESENT', 2, 'On time'), (1, 11, 'ABSENT', 2, 'Reported unwell'), (1, 12, 'PRESENT', 2, 'On time'),
(1, 13, 'ABSENT', 2, 'Unexcused'), (1, 14, 'PRESENT', 2, 'On time'), (1, 15, 'PRESENT', 2, 'On time'), (1, 26, 'PRESENT', 2, 'On time')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Schedule 2
INSERT INTO attendance_records (schedule_id, student_id, status, marked_by_faculty_id, remarks) VALUES
(2, 1, 'PRESENT', 2, 'On time'), (2, 2, 'PRESENT', 2, 'On time'), (2, 3, 'ABSENT', 2, 'Consecutive absent (2)'),
(2, 4, 'PRESENT', 2, 'On time'), (2, 5, 'ABSENT', 2, 'Consecutive absent (2)'), (2, 6, 'PRESENT', 2, 'On time'),
(2, 7, 'PRESENT', 2, 'On time'), (2, 8, 'PRESENT', 2, 'On time'), (2, 9, 'PRESENT', 2, 'On time'),
(2, 10, 'PRESENT', 2, 'On time'), (2, 11, 'ABSENT', 2, 'Consecutive absent (2)'), (2, 12, 'PRESENT', 2, 'On time'),
(2, 13, 'ABSENT', 2, 'Consecutive absent (2)'), (2, 14, 'PRESENT', 2, 'On time'), (2, 15, 'PRESENT', 2, 'On time'), (2, 26, 'PRESENT', 2, 'On time')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Schedule 3
INSERT INTO attendance_records (schedule_id, student_id, status, marked_by_faculty_id, remarks) VALUES
(3, 1, 'PRESENT', 2, 'On time'), (3, 2, 'PRESENT', 2, 'On time'), (3, 3, 'ABSENT', 2, 'Consecutive absent (3 - FLAG)'),
(3, 4, 'PRESENT', 2, 'On time'), (3, 5, 'ABSENT', 2, 'Consecutive absent (3 - FLAG)'), (3, 6, 'PRESENT', 2, 'On time'),
(3, 7, 'ABSENT', 2, 'Absent'), (3, 8, 'PRESENT', 2, 'On time'), (3, 9, 'PRESENT', 2, 'On time'),
(3, 10, 'PRESENT', 2, 'On time'), (3, 11, 'ABSENT', 2, 'Consecutive absent (3 - Medical)'), (3, 12, 'PRESENT', 2, 'On time'),
(3, 13, 'ABSENT', 2, 'Consecutive absent (3 - FLAG)'), (3, 14, 'PRESENT', 2, 'On time'), (3, 15, 'PRESENT', 2, 'On time'), (3, 26, 'PRESENT', 2, 'On time')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Schedule 4
INSERT INTO attendance_records (schedule_id, student_id, status, marked_by_faculty_id, remarks) VALUES
(4, 1, 'PRESENT', 2, 'On time'), (4, 2, 'PRESENT', 2, 'On time'), (4, 3, 'PRESENT', 2, 'Resumed classes'),
(4, 4, 'PRESENT', 2, 'On time'), (4, 5, 'ABSENT', 2, 'Consecutive absent (4)'), (4, 6, 'PRESENT', 2, 'On time'),
(4, 7, 'ABSENT', 2, 'Absent'), (4, 8, 'PRESENT', 2, 'On time'), (4, 9, 'PRESENT', 2, 'On time'),
(4, 10, 'PRESENT', 2, 'On time'), (4, 11, 'ABSENT', 2, 'Medical leave'), (4, 12, 'PRESENT', 2, 'On time'),
(4, 13, 'PRESENT', 2, 'On time'), (4, 14, 'PRESENT', 2, 'On time'), (4, 15, 'PRESENT', 2, 'On time'), (4, 26, 'PRESENT', 2, 'On time')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Schedule 5
INSERT INTO attendance_records (schedule_id, student_id, status, marked_by_faculty_id, remarks) VALUES
(5, 1, 'PRESENT', 2, 'On time'), (5, 2, 'PRESENT', 2, 'On time'), (5, 3, 'PRESENT', 2, 'On time'),
(5, 4, 'PRESENT', 2, 'On time'), (5, 5, 'PRESENT', 2, 'Late entry allowed'), (5, 6, 'PRESENT', 2, 'On time'),
(5, 7, 'ABSENT', 2, 'Absent'), (5, 8, 'PRESENT', 2, 'On time'), (5, 9, 'PRESENT', 2, 'On time'),
(5, 10, 'PRESENT', 2, 'On time'), (5, 11, 'ABSENT', 2, 'Medical leave'), (5, 12, 'PRESENT', 2, 'On time'),
(5, 13, 'ABSENT', 2, 'Absent'), (5, 14, 'PRESENT', 2, 'On time'), (5, 15, 'PRESENT', 2, 'On time'), (5, 26, 'ABSENT', 2, 'Absent')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Schedule 6 to 10
INSERT INTO attendance_records (schedule_id, student_id, status, marked_by_faculty_id, remarks) VALUES
(6, 1, 'PRESENT', 2, 'On time'), (6, 2, 'PRESENT', 2, 'On time'), (6, 3, 'PRESENT', 2, 'On time'), (6, 4, 'PRESENT', 2, 'On time'), (6, 5, 'ABSENT', 2, 'Absent'), (6, 6, 'PRESENT', 2, 'On time'), (6, 7, 'PRESENT', 2, 'On time'), (6, 8, 'PRESENT', 2, 'On time'), (6, 9, 'PRESENT', 2, 'On time'), (6, 10, 'PRESENT', 2, 'On time'), (6, 11, 'PRESENT', 2, 'Reported back'), (6, 12, 'PRESENT', 2, 'On time'), (6, 13, 'ABSENT', 2, 'Absent'), (6, 14, 'PRESENT', 2, 'On time'), (6, 15, 'PRESENT', 2, 'On time'), (6, 26, 'PRESENT', 2, 'On time'),
(7, 1, 'PRESENT', 2, 'On time'), (7, 2, 'PRESENT', 2, 'On time'), (7, 3, 'PRESENT', 2, 'On time'), (7, 4, 'PRESENT', 2, 'On time'), (7, 5, 'ABSENT', 2, 'Absent'), (7, 6, 'PRESENT', 2, 'On time'), (7, 7, 'ABSENT', 2, 'Absent'), (7, 8, 'PRESENT', 2, 'On time'), (7, 9, 'PRESENT', 2, 'On time'), (7, 10, 'PRESENT', 2, 'On time'), (7, 11, 'PRESENT', 2, 'On time'), (7, 12, 'PRESENT', 2, 'On time'), (7, 13, 'ABSENT', 2, 'Absent'), (7, 14, 'PRESENT', 2, 'On time'), (7, 15, 'PRESENT', 2, 'On time'), (7, 26, 'PRESENT', 2, 'On time'),
(8, 1, 'PRESENT', 2, 'On time'), (8, 2, 'PRESENT', 2, 'On time'), (8, 3, 'PRESENT', 2, 'On time'), (8, 4, 'PRESENT', 2, 'On time'), (8, 5, 'PRESENT', 2, 'On time'), (8, 6, 'PRESENT', 2, 'On time'), (8, 7, 'PRESENT', 2, 'On time'), (8, 8, 'PRESENT', 2, 'On time'), (8, 9, 'PRESENT', 2, 'On time'), (8, 10, 'PRESENT', 2, 'On time'), (8, 11, 'PRESENT', 2, 'On time'), (8, 12, 'PRESENT', 2, 'On time'), (8, 13, 'PRESENT', 2, 'On time'), (8, 14, 'PRESENT', 2, 'On time'), (8, 15, 'PRESENT', 2, 'On time'), (8, 26, 'PRESENT', 2, 'On time'),
(9, 1, 'PRESENT', 2, 'On time'), (9, 2, 'PRESENT', 2, 'On time'), (9, 3, 'PRESENT', 2, 'On time'), (9, 4, 'PRESENT', 2, 'On time'), (9, 5, 'ABSENT', 2, 'Absent'), (9, 6, 'PRESENT', 2, 'On time'), (9, 7, 'ABSENT', 2, 'Absent'), (9, 8, 'PRESENT', 2, 'On time'), (9, 9, 'PRESENT', 2, 'On time'), (9, 10, 'PRESENT', 2, 'On time'), (9, 11, 'PRESENT', 2, 'On time'), (9, 12, 'PRESENT', 2, 'On time'), (9, 13, 'ABSENT', 2, 'Absent'), (9, 14, 'PRESENT', 2, 'On time'), (9, 15, 'PRESENT', 2, 'On time'), (9, 26, 'PRESENT', 2, 'On time'),
(10, 1, 'PRESENT', 2, 'On time'), (10, 2, 'PRESENT', 2, 'On time'), (10, 3, 'PRESENT', 2, 'On time'), (10, 4, 'PRESENT', 2, 'On time'), (10, 5, 'ABSENT', 2, 'Absent'), (10, 6, 'PRESENT', 2, 'On time'), (10, 7, 'PRESENT', 2, 'On time'), (10, 8, 'PRESENT', 2, 'On time'), (10, 9, 'PRESENT', 2, 'On time'), (10, 10, 'PRESENT', 2, 'On time'), (10, 11, 'PRESENT', 2, 'On time'), (10, 12, 'PRESENT', 2, 'On time'), (10, 13, 'ABSENT', 2, 'Absent'), (10, 14, 'PRESENT', 2, 'On time'), (10, 15, 'PRESENT', 2, 'On time'), (10, 26, 'PRESENT', 2, 'On time')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Schedule 11 to 13 (DSA CS302)
INSERT INTO attendance_records (schedule_id, student_id, status, marked_by_faculty_id, remarks) VALUES
(11, 1, 'PRESENT', 3, 'On time'), (11, 2, 'PRESENT', 3, 'On time'), (11, 3, 'PRESENT', 3, 'On time'), (11, 4, 'PRESENT', 3, 'On time'), (11, 5, 'ABSENT', 3, 'Absent'), (11, 6, 'PRESENT', 3, 'On time'), (11, 7, 'ABSENT', 3, 'Absent'), (11, 8, 'PRESENT', 3, 'On time'), (11, 9, 'PRESENT', 3, 'On time'), (11, 10, 'PRESENT', 3, 'On time'), (11, 11, 'ABSENT', 3, 'Absent'), (11, 12, 'PRESENT', 3, 'On time'), (11, 13, 'ABSENT', 3, 'Absent'), (11, 14, 'PRESENT', 3, 'On time'), (11, 15, 'PRESENT', 3, 'On time'), (11, 26, 'PRESENT', 3, 'On time'),
(12, 1, 'PRESENT', 3, 'On time'), (12, 2, 'PRESENT', 3, 'On time'), (12, 3, 'PRESENT', 3, 'On time'), (12, 4, 'PRESENT', 3, 'On time'), (12, 5, 'ABSENT', 3, 'Absent'), (12, 6, 'PRESENT', 3, 'On time'), (12, 7, 'PRESENT', 3, 'On time'), (12, 8, 'PRESENT', 3, 'On time'), (12, 9, 'PRESENT', 3, 'On time'), (12, 10, 'PRESENT', 3, 'On time'), (12, 11, 'ABSENT', 3, 'Absent'), (12, 12, 'PRESENT', 3, 'On time'), (12, 13, 'PRESENT', 3, 'On time'), (12, 14, 'PRESENT', 3, 'On time'), (12, 15, 'PRESENT', 3, 'On time'), (12, 26, 'PRESENT', 3, 'On time'),
(13, 1, 'PRESENT', 3, 'On time'), (13, 2, 'PRESENT', 3, 'On time'), (13, 3, 'PRESENT', 3, 'On time'), (13, 4, 'PRESENT', 3, 'On time'), (13, 5, 'PRESENT', 3, 'On time'), (13, 6, 'PRESENT', 3, 'On time'), (13, 7, 'ABSENT', 3, 'Absent'), (13, 8, 'PRESENT', 3, 'On time'), (13, 9, 'PRESENT', 3, 'On time'), (13, 10, 'PRESENT', 3, 'On time'), (13, 11, 'ABSENT', 3, 'Absent'), (13, 12, 'PRESENT', 3, 'On time'), (13, 13, 'ABSENT', 3, 'Absent'), (13, 14, 'PRESENT', 3, 'On time'), (13, 15, 'PRESENT', 3, 'On time'), (13, 26, 'PRESENT', 3, 'On time')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Schedule 14 to 15 (COA CS303)
INSERT INTO attendance_records (schedule_id, student_id, status, marked_by_faculty_id, remarks) VALUES
(14, 1, 'PRESENT', 4, 'On time'), (14, 2, 'PRESENT', 4, 'On time'), (14, 3, 'PRESENT', 4, 'On time'), (14, 4, 'PRESENT', 4, 'On time'), (14, 5, 'ABSENT', 4, 'Absent'), (14, 6, 'PRESENT', 4, 'On time'), (14, 7, 'PRESENT', 4, 'On time'), (14, 8, 'PRESENT', 4, 'On time'), (14, 9, 'PRESENT', 4, 'On time'), (14, 10, 'PRESENT', 4, 'On time'), (14, 11, 'PRESENT', 4, 'On time'), (14, 12, 'PRESENT', 4, 'On time'), (14, 13, 'ABSENT', 4, 'Absent'), (14, 14, 'PRESENT', 4, 'On time'), (14, 15, 'PRESENT', 4, 'On time'), (14, 26, 'PRESENT', 4, 'On time'),
(15, 1, 'PRESENT', 4, 'On time'), (15, 2, 'PRESENT', 4, 'On time'), (15, 3, 'PRESENT', 4, 'On time'), (15, 4, 'PRESENT', 4, 'On time'), (15, 5, 'ABSENT', 4, 'Absent'), (15, 6, 'PRESENT', 4, 'On time'), (15, 7, 'ABSENT', 4, 'Absent'), (15, 8, 'PRESENT', 4, 'On time'), (15, 9, 'PRESENT', 4, 'On time'), (15, 10, 'PRESENT', 4, 'On time'), (15, 11, 'PRESENT', 4, 'On time'), (15, 12, 'PRESENT', 4, 'On time'), (15, 13, 'ABSENT', 4, 'Absent'), (15, 14, 'PRESENT', 4, 'On time'), (15, 15, 'PRESENT', 4, 'On time'), (15, 26, 'ABSENT', 4, 'Absent')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Schedule 18 to 19 (OS CS502 - Div B, Dr. Namdev Sawant)
INSERT INTO attendance_records (schedule_id, student_id, status, marked_by_faculty_id, remarks) VALUES
(18, 16, 'PRESENT', 1, 'On time'), (18, 17, 'PRESENT', 1, 'On time'), (18, 18, 'PRESENT', 1, 'On time'), (18, 19, 'PRESENT', 1, 'On time'), (18, 20, 'ABSENT', 1, 'Absent'),
(19, 16, 'PRESENT', 1, 'On time'), (19, 17, 'PRESENT', 1, 'On time'), (19, 18, 'PRESENT', 1, 'On time'), (19, 19, 'ABSENT', 1, 'Absent'), (19, 20, 'PRESENT', 1, 'On time')
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- ----------------------------------------------------------------------------
-- 14. ATTENDANCE AUDIT TRAIL SAMPLES
-- ----------------------------------------------------------------------------
INSERT INTO attendance_audit_trail (audit_id, attendance_id, schedule_id, student_id, original_status, modified_status, modified_by_faculty_id, modified_at, reason_for_modification) VALUES
(1, 11, 1, 11, 'ABSENT', 'EXCUSED', 2, '2025-09-02 14:30:00', 'Medical certificate submitted to HOD office and approved by Prof Verma'),
(2, 26, 2, 11, 'ABSENT', 'EXCUSED', 2, '2025-09-04 15:00:00', 'Medical certificate covering viral fever treatment approved'),
(3, 41, 3, 11, 'ABSENT', 'EXCUSED', 2, '2025-09-06 16:15:00', 'Approved on-duty medical leave per Institute Academic Circular 42'),
(4, 5, 1, 5, 'ABSENT', 'LATE', 2, '2025-09-01 11:30:00', 'Student reported late due to college bus transit delay, verified by transport office'),
(5, 7, 1, 7, 'ABSENT', 'PRESENT', 2, '2025-09-01 12:00:00', 'Roll number transcription correction by course teacher during manual reconciliation')
ON DUPLICATE KEY UPDATE modified_status = VALUES(modified_status);

-- ----------------------------------------------------------------------------
-- 15. USER CREDENTIALS (Individual Passwords for Every Student & Faculty Member)
-- Pattern: <name>123 (e.g. ram -> ram123, aarav -> aarav123, pooja -> pooja123)
-- ----------------------------------------------------------------------------
INSERT INTO user_credentials (credential_id, username, password_hash, role, display_name, email, student_id, faculty_id, department_id) VALUES
-- 1. Institutional Administrator Account
(1, 'admin', 'admin123', 'HOD', 'Institutional Administrator', 'admin@amms.engg.edu', NULL, 1, 1),

-- 2. Individual Student Accounts (Username: firstname, Password: <firstname>123)
(6, 'aarav', 'aarav123', 'STUDENT', 'Aarav Sharma', 'aarav.sharma@student.engg.edu', 1, NULL, 1),
(7, 'aditi', 'aditi123', 'STUDENT', 'Aditi Patil', 'aditi.patil@student.engg.edu', 2, NULL, 1),
(8, 'aryan', 'aryan123', 'STUDENT', 'Aryan Deshmukh', 'aryan.deshmukh@student.engg.edu', 3, NULL, 1),
(9, 'diya', 'diya123', 'STUDENT', 'Diya Joshi', 'diya.joshi@student.engg.edu', 4, NULL, 1),
(10, 'ishaan', 'ishaan123', 'STUDENT', 'Ishaan Kulkarni', 'ishaan.kulkarni@student.engg.edu', 5, NULL, 1),
(11, 'kavya', 'kavya123', 'STUDENT', 'Kavya Nair', 'kavya.nair@student.engg.edu', 6, NULL, 1),
(12, 'manish', 'manish123', 'STUDENT', 'Manish Chavan', 'manish.chavan@student.engg.edu', 7, NULL, 1),
(13, 'nehag', 'neha123', 'STUDENT', 'Neha Gupte', 'neha.gupte@student.engg.edu', 8, NULL, 1),
(14, 'pranav', 'pranav123', 'STUDENT', 'Pranav More', 'pranav.more@student.engg.edu', 9, NULL, 1),
(15, 'rhea', 'rhea123', 'STUDENT', 'Rhea Sen', 'rhea.sen@student.engg.edu', 10, NULL, 1),
(16, 'rohan', 'rohan123', 'STUDENT', 'Rohan Mehta', 'rohan.mehta@student.engg.edu', 11, NULL, 1),
(17, 'sanya', 'sanya123', 'STUDENT', 'Sanya Bansal', 'sanya.bansal@student.engg.edu', 12, NULL, 1),
(18, 'tanmay', 'tanmay123', 'STUDENT', 'Tanmay Bhosale', 'tanmay.bhosale@student.engg.edu', 13, NULL, 1),
(19, 'varun', 'varun123', 'STUDENT', 'Varun Shinde', 'varun.shinde@student.engg.edu', 14, NULL, 1),
(20, 'zoya', 'zoya123', 'STUDENT', 'Zoya Khan', 'zoya.khan@student.engg.edu', 15, NULL, 1),
(21, 'aniket', 'aniket123', 'STUDENT', 'Aniket Pawar', 'aniket.pawar@student.engg.edu', 16, NULL, 1),
(22, 'bhavna', 'bhavna123', 'STUDENT', 'Bhavna Trivedi', 'bhavna.trivedi@student.engg.edu', 17, NULL, 1),
(23, 'chetan', 'chetan123', 'STUDENT', 'Chetan Salve', 'chetan.salve@student.engg.edu', 18, NULL, 1),
(24, 'deepak', 'deepak123', 'STUDENT', 'Deepak Yadav', 'deepak.yadav@student.engg.edu', 19, NULL, 1),
(25, 'esha', 'esha123', 'STUDENT', 'Esha Modi', 'esha.modi@student.engg.edu', 20, NULL, 1),
(26, 'farhan', 'farhan123', 'STUDENT', 'Farhan Qureshi', 'farhan.qureshi@student.engg.edu', 21, NULL, 1),
(27, 'gauri', 'gauri123', 'STUDENT', 'Gauri Oak', 'gauri.oak@student.engg.edu', 22, NULL, 1),
(28, 'harsh', 'harsh123', 'STUDENT', 'Harsh Vardhan', 'harsh.vardhan@student.engg.edu', 23, NULL, 1),
(29, 'ira', 'ira123', 'STUDENT', 'Ira Bhave', 'ira.bhave@student.engg.edu', 24, NULL, 1),
(30, 'jayesh', 'jayesh123', 'STUDENT', 'Jayesh Thakur', 'jayesh.thakur@student.engg.edu', 25, NULL, 1),
(31, 'ram', 'ram123', 'STUDENT', 'Ram Joshi', 'ram.joshi@student.engg.edu', 26, NULL, 1),

-- 3. Individual Faculty Accounts (Username: firstname/alias, Password: <firstname>123)
(32, 'namdev', 'namdev123', 'HOD', 'Dr. Namdev Sawant', 'namdev.sawant@engg-institute.edu', NULL, 1, 1),
(33, 'pooja', 'pooja123', 'COURSE_TEACHER', 'Prof. Pooja Verma', 'pooja.verma@engg-institute.edu', NULL, 2, 1),
(34, 'amit', 'amit123', 'TG', 'Prof. Amit Kulkarni', 'amit.kulkarni@engg-institute.edu', NULL, 3, 1),
(35, 'neha', 'neha123', 'FACULTY', 'Prof. Neha Patil', 'neha.patil@engg-institute.edu', NULL, 4, 1),
(36, 'sunita', 'sunita123', 'HOD', 'Dr. Sunita Kulkarni', 'sunita.kulkarni@engg-institute.edu', NULL, 5, 2),
(37, 'siddharth', 'siddharth123', 'COURSE_TEACHER', 'Prof. Siddharth Joshi', 'siddharth.joshi@engg-institute.edu', NULL, 6, 2),
(38, 'ananya', 'ananya123', 'FACULTY', 'Prof. Ananya Rao', 'ananya.rao@engg-institute.edu', NULL, 7, 2),
(39, 'anil', 'anil123', 'HOD', 'Dr. Anil Deshmukh', 'anil.deshmukh@engg-institute.edu', NULL, 8, 3),
(40, 'kavita', 'kavita123', 'FACULTY', 'Prof. Kavita Mane', 'kavita.mane@engg-institute.edu', NULL, 9, 3),
(41, 'vikram', 'vikram123', 'HOD', 'Dr. Vikram Patil', 'vikram.patil@engg-institute.edu', NULL, 10, 4),
(42, 'suresh', 'suresh123', 'FACULTY', 'Prof. Suresh Babar', 'suresh.babar@engg-institute.edu', NULL, 11, 4),
(43, 'ramesh', 'ramesh123', 'HOD', 'Dr. Ramesh Shinde', 'ramesh.shinde@engg-institute.edu', NULL, 12, 5),
(44, 'pravin', 'pravin123', 'FACULTY', 'Prof. Pravin Gaikwad', 'pravin.gaikwad@engg-institute.edu', NULL, 13, 5),
(45, 'meena', 'meena123', 'HOD', 'Dr. Meena Joshi', 'meena.joshi@engg-institute.edu', NULL, 14, 6),
(46, 'ganesh', 'ganesh123', 'FACULTY', 'Prof. Ganesh Kadam', 'ganesh.kadam@engg-institute.edu', NULL, 15, 6),
(47, 'nehap', 'neha123', 'FACULTY', 'Prof. Neha Patil', 'neha.patil.alt@engg-institute.edu', NULL, 4, 1)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

COMMIT;
