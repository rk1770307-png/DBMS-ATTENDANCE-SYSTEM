-- ============================================================================
-- ATTENDANCE MANAGEMENT AND MONITORING SYSTEM (AMMS)
-- Database: MySQL 8.0+ (InnoDB Engine)
-- Module: 01_schema_mysql.sql - Normalized Relational Schema (3NF)
-- Engineering Institute with Six Academic Departments
-- ============================================================================

CREATE DATABASE IF NOT EXISTS amms;
USE amms;

-- Disable foreign key checks for clean drop order
SET FOREIGN_KEY_CHECKS = 0;

DROP TRIGGER IF EXISTS trg_audit_attendance_update;

DROP TABLE IF EXISTS user_credentials;
DROP TABLE IF EXISTS attendance_audit_trail;
DROP TABLE IF EXISTS attendance_records;
DROP TABLE IF EXISTS lecture_schedules;
DROP TABLE IF EXISTS tg_student_mapping;
DROP TABLE IF EXISTS teacher_guardians;
DROP TABLE IF EXISTS course_allocations;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS divisions;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS academic_years;
DROP TABLE IF EXISTS programs;
DROP TABLE IF EXISTS faculty;
DROP TABLE IF EXISTS departments;

SET FOREIGN_KEY_CHECKS = 1;

-- ----------------------------------------------------------------------------
-- 1. DEPARTMENTS
-- 6 engineering branches (COMP, IT, ENTC, MECH, CIVIL, ELEC)
-- ----------------------------------------------------------------------------
CREATE TABLE departments (
    department_id INT AUTO_INCREMENT PRIMARY KEY,
    department_code VARCHAR(10) NOT NULL UNIQUE,
    department_name VARCHAR(100) NOT NULL,
    established_year INT NOT NULL CHECK (established_year >= 1950 AND established_year <= 2100),
    contact_email VARCHAR(100) NOT NULL UNIQUE,
    building_location VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. FACULTY
-- Academic staff members
-- ----------------------------------------------------------------------------
CREATE TABLE faculty (
    faculty_id INT AUTO_INCREMENT PRIMARY KEY,
    employee_code VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    department_id INT NOT NULL,
    designation VARCHAR(50) NOT NULL CHECK (designation IN ('Professor', 'Associate Professor', 'Assistant Professor', 'Adjunct Faculty', 'HOD')),
    qualification VARCHAR(100) NOT NULL,
    joining_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_faculty_department FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Circular FK resolution: Add hod_faculty_id to departments table
ALTER TABLE departments 
ADD COLUMN hod_faculty_id INT NULL,
ADD CONSTRAINT fk_dept_hod FOREIGN KEY (hod_faculty_id) REFERENCES faculty(faculty_id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 3. PROGRAMS
-- Academic degree programs (UG, PG, Doctoral)
-- ----------------------------------------------------------------------------
CREATE TABLE programs (
    program_id INT AUTO_INCREMENT PRIMARY KEY,
    program_code VARCHAR(20) NOT NULL UNIQUE,
    program_name VARCHAR(100) NOT NULL,
    department_id INT NOT NULL,
    degree_level VARCHAR(20) NOT NULL CHECK (degree_level IN ('UG', 'PG', 'Doctoral')),
    total_semesters INT NOT NULL CHECK (total_semesters BETWEEN 2 AND 10),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_programs_department FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. ACADEMIC YEARS
-- Calendar periods (e.g. 2025-2026)
-- ----------------------------------------------------------------------------
CREATE TABLE academic_years (
    academic_year_id INT AUTO_INCREMENT PRIMARY KEY,
    year_label VARCHAR(20) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_academic_year_dates CHECK (end_date > start_date)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. CLASSES
-- Year cohort within program (FE, SE, TE, BE)
-- ----------------------------------------------------------------------------
CREATE TABLE classes (
    class_id INT AUTO_INCREMENT PRIMARY KEY,
    program_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    class_level VARCHAR(10) NOT NULL CHECK (class_level IN ('FE', 'SE', 'TE', 'BE')),
    semester INT NOT NULL CHECK (semester BETWEEN 1 AND 8),
    CONSTRAINT uq_program_academic_class UNIQUE (program_id, academic_year_id, class_level, semester),
    CONSTRAINT fk_classes_program FOREIGN KEY (program_id) REFERENCES programs(program_id) ON DELETE RESTRICT,
    CONSTRAINT fk_classes_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(academic_year_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 6. DIVISIONS
-- Subdivisions with designated Class Teacher
-- ----------------------------------------------------------------------------
CREATE TABLE divisions (
    division_id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    division_name VARCHAR(10) NOT NULL,
    class_teacher_faculty_id INT NULL,
    classroom_number VARCHAR(20) NOT NULL,
    CONSTRAINT uq_class_division UNIQUE (class_id, division_name),
    CONSTRAINT fk_divisions_class FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
    CONSTRAINT fk_divisions_faculty FOREIGN KEY (class_teacher_faculty_id) REFERENCES faculty(faculty_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 7. COURSES
-- Curriculum subjects (THEORY, LAB, TUTORIAL)
-- ----------------------------------------------------------------------------
CREATE TABLE courses (
    course_id INT AUTO_INCREMENT PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL UNIQUE,
    course_name VARCHAR(100) NOT NULL,
    department_id INT NOT NULL,
    semester INT NOT NULL CHECK (semester BETWEEN 1 AND 8),
    lecture_type VARCHAR(20) NOT NULL CHECK (lecture_type IN ('THEORY', 'LAB', 'TUTORIAL')),
    credits DECIMAL(3, 1) NOT NULL CHECK (credits > 0),
    weekly_hours INT NOT NULL CHECK (weekly_hours > 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_courses_department FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 8. STUDENTS
-- Enrolled engineering students assigned to academic divisions
-- ----------------------------------------------------------------------------
CREATE TABLE students (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    prn VARCHAR(20) NOT NULL UNIQUE,
    roll_number INT NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    parent_phone VARCHAR(20) NOT NULL,
    parent_email VARCHAR(100),
    division_id INT NOT NULL,
    admission_year INT NOT NULL CHECK (admission_year >= 2000),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_division_roll UNIQUE (division_id, roll_number),
    CONSTRAINT fk_students_division FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 9. COURSE ALLOCATIONS
-- Resolves M:N association between Faculty, Courses, Divisions
-- ----------------------------------------------------------------------------
CREATE TABLE course_allocations (
    allocation_id INT AUTO_INCREMENT PRIMARY KEY,
    course_id INT NOT NULL,
    faculty_id INT NOT NULL,
    division_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    allocation_role VARCHAR(20) NOT NULL DEFAULT 'PRIMARY' CHECK (allocation_role IN ('PRIMARY', 'SECONDARY', 'SUBSTITUTE')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_allocation UNIQUE (course_id, faculty_id, division_id, academic_year_id),
    CONSTRAINT fk_alloc_course FOREIGN KEY (course_id) REFERENCES courses(course_id) ON DELETE RESTRICT,
    CONSTRAINT fk_alloc_faculty FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE RESTRICT,
    CONSTRAINT fk_alloc_division FOREIGN KEY (division_id) REFERENCES divisions(division_id) ON DELETE RESTRICT,
    CONSTRAINT fk_alloc_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(academic_year_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 10. TEACHER GUARDIANS (TG)
-- Mentorship groups
-- ----------------------------------------------------------------------------
CREATE TABLE teacher_guardians (
    tg_id INT AUTO_INCREMENT PRIMARY KEY,
    faculty_id INT NOT NULL,
    department_id INT NOT NULL,
    academic_year_id INT NOT NULL,
    batch_name VARCHAR(50) NOT NULL,
    max_mentees INT NOT NULL DEFAULT 25 CHECK (max_mentees > 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tg_batch UNIQUE (faculty_id, academic_year_id, batch_name),
    CONSTRAINT fk_tg_faculty FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tg_department FOREIGN KEY (department_id) REFERENCES departments(department_id) ON DELETE RESTRICT,
    CONSTRAINT fk_tg_academic_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(academic_year_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 11. TG STUDENT MAPPING
-- Associates individual students to their designated TG
-- ----------------------------------------------------------------------------
CREATE TABLE tg_student_mapping (
    mapping_id INT AUTO_INCREMENT PRIMARY KEY,
    tg_id INT NOT NULL,
    student_id INT NOT NULL,
    assigned_date DATE NOT NULL,
    counseling_notes TEXT,
    counseling_flag BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tg_student UNIQUE (student_id),
    CONSTRAINT fk_tgm_tg FOREIGN KEY (tg_id) REFERENCES teacher_guardians(tg_id) ON DELETE CASCADE,
    CONSTRAINT fk_tgm_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 12. LECTURE SCHEDULES
-- Scheduled / conducted lecture sessions
-- ----------------------------------------------------------------------------
CREATE TABLE lecture_schedules (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    allocation_id INT NOT NULL,
    lecture_date DATE NOT NULL,
    slot_number INT NOT NULL CHECK (slot_number BETWEEN 1 AND 8),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' 
        CHECK (status IN ('SCHEDULED', 'CONDUCTED', 'CANCELLED', 'RESCHEDULED')),
    topic_covered VARCHAR(200),
    substitute_faculty_id INT NULL,
    rescheduled_from_schedule_id INT NULL,
    cancellation_reason VARCHAR(255),
    conducted_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_schedule_slot UNIQUE (allocation_id, lecture_date, slot_number),
    CONSTRAINT fk_sched_allocation FOREIGN KEY (allocation_id) REFERENCES course_allocations(allocation_id) ON DELETE RESTRICT,
    CONSTRAINT fk_sched_substitute FOREIGN KEY (substitute_faculty_id) REFERENCES faculty(faculty_id) ON DELETE SET NULL,
    CONSTRAINT fk_sched_rescheduled FOREIGN KEY (rescheduled_from_schedule_id) REFERENCES lecture_schedules(schedule_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 13. ATTENDANCE RECORDS
-- Atomic attendance entries recorded per student per lecture schedule
-- ----------------------------------------------------------------------------
CREATE TABLE attendance_records (
    attendance_id INT AUTO_INCREMENT PRIMARY KEY,
    schedule_id INT NOT NULL,
    student_id INT NOT NULL,
    status VARCHAR(15) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
    marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    marked_by_faculty_id INT NOT NULL,
    remarks VARCHAR(255),
    CONSTRAINT uq_attendance_entry UNIQUE (schedule_id, student_id),
    CONSTRAINT fk_att_schedule FOREIGN KEY (schedule_id) REFERENCES lecture_schedules(schedule_id) ON DELETE CASCADE,
    CONSTRAINT fk_att_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE RESTRICT,
    CONSTRAINT fk_att_faculty FOREIGN KEY (marked_by_faculty_id) REFERENCES faculty(faculty_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 14. ATTENDANCE AUDIT TRAIL
-- Immutable audit ledger capturing modifications with mandatory reasons
-- ----------------------------------------------------------------------------
CREATE TABLE attendance_audit_trail (
    audit_id INT AUTO_INCREMENT PRIMARY KEY,
    attendance_id INT NOT NULL,
    schedule_id INT NOT NULL,
    student_id INT NOT NULL,
    original_status VARCHAR(15) NOT NULL,
    modified_status VARCHAR(15) NOT NULL,
    modified_by_faculty_id INT NOT NULL,
    modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reason_for_modification VARCHAR(255) NOT NULL,
    CONSTRAINT fk_audit_attendance FOREIGN KEY (attendance_id) REFERENCES attendance_records(attendance_id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_schedule FOREIGN KEY (schedule_id) REFERENCES lecture_schedules(schedule_id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    CONSTRAINT fk_audit_faculty FOREIGN KEY (modified_by_faculty_id) REFERENCES faculty(faculty_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 15. USER CREDENTIALS & AUTHENTICATION
-- Multi-role credentials for Student, Teacher, TG, HOD, and Faculty
-- ----------------------------------------------------------------------------
CREATE TABLE user_credentials (
    credential_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('STUDENT', 'COURSE_TEACHER', 'TG', 'HOD', 'FACULTY', 'CLASS_TEACHER')),
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    student_id INT NULL,
    faculty_id INT NULL,
    department_id INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cred_student FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    CONSTRAINT fk_cred_faculty FOREIGN KEY (faculty_id) REFERENCES faculty(faculty_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- AUTOMATED AUDIT TRIGGER IN MYSQL
-- Automatically intercepts any UPDATE on attendance_records and inserts audit log
-- ----------------------------------------------------------------------------
DELIMITER $$
CREATE TRIGGER trg_audit_attendance_update
AFTER UPDATE ON attendance_records
FOR EACH ROW
BEGIN
    IF (OLD.status <> NEW.status) THEN
        INSERT INTO attendance_audit_trail (
            attendance_id,
            schedule_id,
            student_id,
            original_status,
            modified_status,
            modified_by_faculty_id,
            modified_at,
            reason_for_modification
        ) VALUES (
            OLD.attendance_id,
            OLD.schedule_id,
            OLD.student_id,
            OLD.status,
            NEW.status,
            NEW.marked_by_faculty_id,
            NOW(),
            COALESCE(NEW.remarks, 'Attendance status adjusted via authorized faculty override')
        );
    END IF;
END$$
DELIMITER ;
