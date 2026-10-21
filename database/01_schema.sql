-- ============================================================================
-- ATTENDANCE MANAGEMENT AND MONITORING SYSTEM (AMMS)
-- Database: PostgreSQL 14+ / 16+ / 18+
-- Module: 01_schema.sql - Normalized Relational Schema (3NF)
-- Engineering Institute with Six Academic Departments
-- ============================================================================

-- Clean up existing objects for reproducible idempotent execution
DROP TRIGGER IF EXISTS trg_audit_attendance_update ON attendance_records;
DROP FUNCTION IF EXISTS fn_audit_attendance_update();

DROP TABLE IF EXISTS attendance_audit_trail CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS lecture_schedules CASCADE;
DROP TABLE IF EXISTS user_credentials CASCADE;
DROP TABLE IF EXISTS tg_student_mapping CASCADE;
DROP TABLE IF EXISTS teacher_guardians CASCADE;
DROP TABLE IF EXISTS course_allocations CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS divisions CASCADE;
DROP TABLE IF EXISTS classes CASCADE;
DROP TABLE IF EXISTS academic_years CASCADE;
DROP TABLE IF EXISTS programs CASCADE;
DROP TABLE IF EXISTS faculty CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- ----------------------------------------------------------------------------
-- 1. DEPARTMENTS
-- Represents the 6 engineering branches (e.g., Computer, IT, ENTC, Mech, Civil, Electrical)
-- Participation: Mandatory 1:N with programs, faculty, courses.
-- ----------------------------------------------------------------------------
CREATE TABLE departments (
    department_id SERIAL PRIMARY KEY,
    department_code VARCHAR(10) NOT NULL UNIQUE,
    department_name VARCHAR(100) NOT NULL,
    established_year INT NOT NULL CHECK (established_year >= 1950 AND established_year <= 2100),
    contact_email VARCHAR(100) NOT NULL UNIQUE,
    building_location VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. FACULTY
-- Academic staff members. Each belongs to a parent department.
-- Primary Key: faculty_id. Alternate Key: employee_code, email.
-- ----------------------------------------------------------------------------
CREATE TABLE faculty (
    faculty_id SERIAL PRIMARY KEY,
    employee_code VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    department_id INT NOT NULL REFERENCES departments(department_id) ON DELETE RESTRICT,
    designation VARCHAR(50) NOT NULL CHECK (designation IN ('Professor', 'Associate Professor', 'Assistant Professor', 'Adjunct Faculty', 'HOD')),
    qualification VARCHAR(100) NOT NULL,
    joining_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Circular FK resolution: Add hod_faculty_id to departments table
ALTER TABLE departments 
ADD COLUMN hod_faculty_id INT REFERENCES faculty(faculty_id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 3. PROGRAMS
-- Academic degree programs offered by departments (e.g., B.Tech in CSE, B.Tech in ME)
-- ----------------------------------------------------------------------------
CREATE TABLE programs (
    program_id SERIAL PRIMARY KEY,
    program_code VARCHAR(20) NOT NULL UNIQUE,
    program_name VARCHAR(100) NOT NULL,
    department_id INT NOT NULL REFERENCES departments(department_id) ON DELETE RESTRICT,
    degree_level VARCHAR(20) NOT NULL CHECK (degree_level IN ('UG', 'PG', 'Doctoral')),
    total_semesters INT NOT NULL CHECK (total_semesters BETWEEN 2 AND 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 4. ACADEMIC YEARS
-- Administrative calendar periods (e.g., '2025-2026')
-- ----------------------------------------------------------------------------
CREATE TABLE academic_years (
    academic_year_id SERIAL PRIMARY KEY,
    year_label VARCHAR(20) NOT NULL UNIQUE,  -- e.g., '2025-2026'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL CHECK (end_date > start_date),
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 5. CLASSES
-- Year of study within a program for an academic year (e.g., FE, SE, TE, BE)
-- ----------------------------------------------------------------------------
CREATE TABLE classes (
    class_id SERIAL PRIMARY KEY,
    program_id INT NOT NULL REFERENCES programs(program_id) ON DELETE RESTRICT,
    academic_year_id INT NOT NULL REFERENCES academic_years(academic_year_id) ON DELETE RESTRICT,
    class_level VARCHAR(10) NOT NULL CHECK (class_level IN ('FE', 'SE', 'TE', 'BE')),
    semester INT NOT NULL CHECK (semester BETWEEN 1 AND 8),
    CONSTRAINT uq_program_academic_class UNIQUE (program_id, academic_year_id, class_level, semester)
);

-- ----------------------------------------------------------------------------
-- 6. DIVISIONS
-- Subdivisions of a class cohort (e.g., SE-COMP Div A, Div B) with assigned Class Teacher
-- ----------------------------------------------------------------------------
CREATE TABLE divisions (
    division_id SERIAL PRIMARY KEY,
    class_id INT NOT NULL REFERENCES classes(class_id) ON DELETE CASCADE,
    division_name VARCHAR(10) NOT NULL, -- e.g., 'A', 'B'
    class_teacher_faculty_id INT REFERENCES faculty(faculty_id) ON DELETE SET NULL,
    classroom_number VARCHAR(20) NOT NULL,
    CONSTRAINT uq_class_division UNIQUE (class_id, division_name)
);

-- ----------------------------------------------------------------------------
-- 7. COURSES
-- Subjects offered within departments (Theory, Practical/Lab, Tutorial)
-- ----------------------------------------------------------------------------
CREATE TABLE courses (
    course_id SERIAL PRIMARY KEY,
    course_code VARCHAR(20) NOT NULL UNIQUE,
    course_name VARCHAR(100) NOT NULL,
    department_id INT NOT NULL REFERENCES departments(department_id) ON DELETE RESTRICT,
    semester INT NOT NULL CHECK (semester BETWEEN 1 AND 8),
    lecture_type VARCHAR(20) NOT NULL CHECK (lecture_type IN ('THEORY', 'LAB', 'TUTORIAL')),
    credits NUMERIC(3, 1) NOT NULL CHECK (credits > 0),
    weekly_hours INT NOT NULL CHECK (weekly_hours > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 8. STUDENTS
-- Enrolled engineering students assigned to a specific academic division
-- ----------------------------------------------------------------------------
CREATE TABLE students (
    student_id SERIAL PRIMARY KEY,
    prn VARCHAR(20) NOT NULL UNIQUE,       -- Permanent Registration Number
    roll_number INT NOT NULL,              -- Division roll number (e.g., 101, 102)
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    parent_phone VARCHAR(20) NOT NULL,
    parent_email VARCHAR(100),
    division_id INT NOT NULL REFERENCES divisions(division_id) ON DELETE RESTRICT,
    admission_year INT NOT NULL CHECK (admission_year >= 2000),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_division_roll UNIQUE (division_id, roll_number)
);

-- ----------------------------------------------------------------------------
-- 9. COURSE ALLOCATIONS (FACULTY TO COURSE & DIVISION)
-- Resolves M:N relationship between Faculty, Courses, and Divisions
-- ----------------------------------------------------------------------------
CREATE TABLE course_allocations (
    allocation_id SERIAL PRIMARY KEY,
    course_id INT NOT NULL REFERENCES courses(course_id) ON DELETE RESTRICT,
    faculty_id INT NOT NULL REFERENCES faculty(faculty_id) ON DELETE RESTRICT,
    division_id INT NOT NULL REFERENCES divisions(division_id) ON DELETE RESTRICT,
    academic_year_id INT NOT NULL REFERENCES academic_years(academic_year_id) ON DELETE RESTRICT,
    allocation_role VARCHAR(20) NOT NULL DEFAULT 'PRIMARY' CHECK (allocation_role IN ('PRIMARY', 'SECONDARY', 'SUBSTITUTE')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_allocation UNIQUE (course_id, faculty_id, division_id, academic_year_id)
);

-- ----------------------------------------------------------------------------
-- 10. TEACHER GUARDIANS (TG)
-- Mentorship groups established within departments per academic year
-- ----------------------------------------------------------------------------
CREATE TABLE teacher_guardians (
    tg_id SERIAL PRIMARY KEY,
    faculty_id INT NOT NULL REFERENCES faculty(faculty_id) ON DELETE RESTRICT,
    department_id INT NOT NULL REFERENCES departments(department_id) ON DELETE RESTRICT,
    academic_year_id INT NOT NULL REFERENCES academic_years(academic_year_id) ON DELETE RESTRICT,
    batch_name VARCHAR(50) NOT NULL, -- e.g., 'COMP-SE-TG-Group-1'
    max_mentees INT NOT NULL DEFAULT 25 CHECK (max_mentees > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tg_batch UNIQUE (faculty_id, academic_year_id, batch_name)
);

-- ----------------------------------------------------------------------------
-- 11. TG STUDENT MAPPING
-- Associates individual students to their designated Teacher Guardian
-- ----------------------------------------------------------------------------
CREATE TABLE tg_student_mapping (
    mapping_id SERIAL PRIMARY KEY,
    tg_id INT NOT NULL REFERENCES teacher_guardians(tg_id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    counseling_notes TEXT,
    counseling_flag BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tg_student UNIQUE (student_id) -- A student has exactly one active TG in a given cycle
);

-- ----------------------------------------------------------------------------
-- 12. LECTURE SCHEDULES
-- Scheduled or conducted time slots for a course allocation
-- Slot uniqueness: Guarantees no dual booking for the same division/allocation
-- ----------------------------------------------------------------------------
CREATE TABLE lecture_schedules (
    schedule_id SERIAL PRIMARY KEY,
    allocation_id INT NOT NULL REFERENCES course_allocations(allocation_id) ON DELETE RESTRICT,
    lecture_date DATE NOT NULL,
    slot_number INT NOT NULL CHECK (slot_number BETWEEN 1 AND 8),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL CHECK (end_time > start_time),
    room_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' 
        CHECK (status IN ('SCHEDULED', 'CONDUCTED', 'CANCELLED', 'RESCHEDULED')),
    topic_covered VARCHAR(200),
    substitute_faculty_id INT REFERENCES faculty(faculty_id) ON DELETE SET NULL,
    rescheduled_from_schedule_id INT REFERENCES lecture_schedules(schedule_id) ON DELETE SET NULL,
    cancellation_reason VARCHAR(255),
    conducted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Prevent duplicate slots for the same allocation on the same date
    CONSTRAINT uq_schedule_slot UNIQUE (allocation_id, lecture_date, slot_number)
);

-- ----------------------------------------------------------------------------
-- 13. ATTENDANCE RECORDS
-- Atomic attendance entries recorded per student per lecture schedule
-- Constraint: Exactly ONE status entry per student per schedule!
-- ----------------------------------------------------------------------------
CREATE TABLE attendance_records (
    attendance_id SERIAL PRIMARY KEY,
    schedule_id INT NOT NULL REFERENCES lecture_schedules(schedule_id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,
    status VARCHAR(15) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    marked_by_faculty_id INT NOT NULL REFERENCES faculty(faculty_id) ON DELETE RESTRICT,
    remarks VARCHAR(255),
    -- MANDATORY UNIQUE CONSTRAINT to prevent duplicate attendance entries
    CONSTRAINT uq_attendance_entry UNIQUE (schedule_id, student_id)
);

-- ----------------------------------------------------------------------------
-- 14. ATTENDANCE AUDIT TRAIL
-- Implements immutable auditing for all attendance record modifications
-- Captures original status, modified status, operator, timestamp, and MANDATORY reason
-- ----------------------------------------------------------------------------
CREATE TABLE attendance_audit_trail (
    audit_id SERIAL PRIMARY KEY,
    attendance_id INT NOT NULL REFERENCES attendance_records(attendance_id) ON DELETE CASCADE,
    schedule_id INT NOT NULL REFERENCES lecture_schedules(schedule_id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    original_status VARCHAR(15) NOT NULL,
    modified_status VARCHAR(15) NOT NULL,
    modified_by_faculty_id INT NOT NULL REFERENCES faculty(faculty_id) ON DELETE RESTRICT,
    modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reason_for_modification VARCHAR(255) NOT NULL CHECK (LENGTH(TRIM(reason_for_modification)) >= 5)
);

-- ----------------------------------------------------------------------------
-- AUTOMATED AUDIT TRIGGER
-- Guarantees that any UPDATE to attendance_records automatically persists to audit trail
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_attendance_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log when status or remarks change
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
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
            CURRENT_TIMESTAMP,
            COALESCE(NEW.remarks, 'Attendance status adjusted via authorized faculty override')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_attendance_update
AFTER UPDATE ON attendance_records
FOR EACH ROW
EXECUTE FUNCTION fn_audit_attendance_update();

-- ----------------------------------------------------------------------------
-- 15. USER CREDENTIALS & AUTHENTICATION
-- Multi-role credentials for Student, Teacher, TG, HOD, and Faculty
-- ----------------------------------------------------------------------------
CREATE TABLE user_credentials (
    credential_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) NOT NULL CHECK (role IN ('STUDENT', 'COURSE_TEACHER', 'TG', 'HOD', 'FACULTY', 'CLASS_TEACHER')),
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    student_id INT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    faculty_id INT NULL REFERENCES faculty(faculty_id) ON DELETE CASCADE,
    department_id INT NOT NULL DEFAULT 1 REFERENCES departments(department_id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

