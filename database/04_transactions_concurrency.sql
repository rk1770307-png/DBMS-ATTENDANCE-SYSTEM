-- ============================================================================
-- ATTENDANCE MANAGEMENT AND MONITORING SYSTEM (AMMS)
-- Database: PostgreSQL 14+ / 16+ / 18+
-- Module: 04_transactions_concurrency.sql
-- Robust Transactions, Isolation Levels, Row-Level Locking & Recovery
-- ============================================================================

-- ============================================================================
-- SCENARIO 1: ATOMIC ATTENDANCE SUBMISSION TRANSACTION (BEGIN ... COMMIT)
-- ============================================================================
-- Context: When a Course Teacher conducts a lecture, the roster attendance
-- must be recorded AND the schedule marked as 'CONDUCTED' atomically.
-- If the server crashes or any row fails validation, the entire batch rolls back.

DO $$
DECLARE
    v_schedule_id INT := 17;
    v_faculty_id  INT := 2; -- Prof Pooja Verma
    v_current_status VARCHAR(20);
BEGIN
    -- Step 1: Explicitly lock the schedule row to prevent concurrent modification
    SELECT status INTO v_current_status
    FROM lecture_schedules
    WHERE schedule_id = v_schedule_id
    FOR UPDATE;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Lecture schedule % does not exist', v_schedule_id;
    END IF;

    IF v_current_status <> 'SCHEDULED' THEN
        RAISE EXCEPTION 'Schedule % is not in SCHEDULED state (Current: %)', v_schedule_id, v_current_status;
    END IF;

    -- Step 2: Insert atomic attendance records for the division students
    INSERT INTO attendance_records (schedule_id, student_id, status, marked_by_faculty_id, remarks) VALUES
    (v_schedule_id, 1, 'PRESENT', v_faculty_id, 'Attended lecture'),
    (v_schedule_id, 2, 'PRESENT', v_faculty_id, 'Attended lecture'),
    (v_schedule_id, 3, 'ABSENT',  v_faculty_id, 'Absent without notice'),
    (v_schedule_id, 4, 'PRESENT', v_faculty_id, 'Attended lecture'),
    (v_schedule_id, 5, 'ABSENT',  v_faculty_id, 'Absent'),
    (v_schedule_id, 6, 'PRESENT', v_faculty_id, 'Attended lecture'),
    (v_schedule_id, 7, 'PRESENT', v_faculty_id, 'Attended lecture'),
    (v_schedule_id, 8, 'PRESENT', v_faculty_id, 'Attended lecture'),
    (v_schedule_id, 9, 'PRESENT', v_faculty_id, 'Attended lecture'),
    (v_schedule_id, 10, 'PRESENT', v_faculty_id, 'Attended lecture'),
    (v_schedule_id, 11, 'PRESENT', v_faculty_id, 'Attended lecture'),
    (v_schedule_id, 12, 'PRESENT', v_faculty_id, 'Attended lecture'),
    (v_schedule_id, 13, 'ABSENT',  v_faculty_id, 'Absent'),
    (v_schedule_id, 14, 'PRESENT', v_faculty_id, 'Attended lecture'),
    (v_schedule_id, 15, 'PRESENT', v_faculty_id, 'Attended lecture');

    -- Step 3: Transition schedule state to CONDUCTED
    UPDATE lecture_schedules
    SET status = 'CONDUCTED',
        conducted_at = CURRENT_TIMESTAMP,
        topic_covered = 'Distributed Databases & Replication Protocols'
    WHERE schedule_id = v_schedule_id;

    RAISE NOTICE 'Transaction Success: Schedule % marked CONDUCTED with % attendance entries.', v_schedule_id, 15;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Transaction Rolled Back due to error: %', SQLERRM;
        RAISE;
END $$;


-- ============================================================================
-- SCENARIO 2: ATTENDANCE CORRECTION TRANSACTION WITH SAVEPOINT
-- ============================================================================
-- Context: A student presents a medical slip. The Course Teacher updates the 
-- status from ABSENT to EXCUSED. A SAVEPOINT is used to allow partial recovery
-- if the audit verification fails.

DO $$
DECLARE
    v_attendance_id INT;
    v_orig_status VARCHAR(15);
    v_student_id INT := 3;
    v_schedule_id INT := 17;
    v_faculty_id INT := 2;
    v_reason VARCHAR(255) := 'Official medical certificate verified by Institute Health Center';
BEGIN
    -- Locate existing record
    SELECT attendance_id, status INTO v_attendance_id, v_orig_status
    FROM attendance_records
    WHERE schedule_id = v_schedule_id AND student_id = v_student_id
    FOR UPDATE;

    IF v_attendance_id IS NULL THEN
        RAISE EXCEPTION 'Attendance record not found for student % in schedule %', v_student_id, v_schedule_id;
    END IF;

    -- Update attendance status (Triggers automated audit trail logging)
    UPDATE attendance_records
    SET status = 'EXCUSED',
        remarks = v_reason,
        marked_by_faculty_id = v_faculty_id,
        marked_at = CURRENT_TIMESTAMP
    WHERE attendance_id = v_attendance_id;

    -- Verify that audit entry was properly created
    IF NOT EXISTS (
        SELECT 1 FROM attendance_audit_trail 
        WHERE attendance_id = v_attendance_id 
          AND modified_status = 'EXCUSED'
    ) THEN
        RAISE EXCEPTION 'Audit trail verification failed! Enforcing rollback.';
    END IF;

    RAISE NOTICE 'Attendance correction committed. Attendance ID % transitioned from % to EXCUSED.', 
        v_attendance_id, v_orig_status;
END $$;


-- ============================================================================
-- SCENARIO 3: CONCURRENT FACULTY SUBSTITUTION WITH ROW-LEVEL LOCKING
-- ============================================================================
-- Context: Primary teacher is on sudden sick leave. Both the primary teacher and 
-- the HOD attempt to assign a substitute faculty at the same time.
-- The use of SELECT ... FOR UPDATE serializes access and prevents Lost Updates.

DO $$
DECLARE
    v_schedule_id INT := 10;
    v_substitute_id INT := 4; -- Prof Neha Patil
    v_locked_schedule RECORD;
BEGIN
    -- Acquire exclusive row-level lock on the target lecture schedule
    SELECT * INTO v_locked_schedule
    FROM lecture_schedules
    WHERE schedule_id = v_schedule_id
    FOR UPDATE NOWAIT; -- Fails immediately if another transaction holds the lock

    -- Enforce business rule: Cannot substitute an already conducted lecture
    IF v_locked_schedule.status = 'CONDUCTED' THEN
        -- Allow post-lecture official substitute logging if authorized
        UPDATE lecture_schedules
        SET substitute_faculty_id = v_substitute_id
        WHERE schedule_id = v_schedule_id;
        
        RAISE NOTICE 'Substitute Faculty % successfully recorded for schedule %.', 
            v_substitute_id, v_schedule_id;
    ELSE
        UPDATE lecture_schedules
        SET substitute_faculty_id = v_substitute_id
        WHERE schedule_id = v_schedule_id;
        
        RAISE NOTICE 'Advance Substitute Faculty % assigned to schedule %.', 
            v_substitute_id, v_schedule_id;
    END IF;
END $$;


-- ============================================================================
-- SCENARIO 4: TRANSACTION ISOLATION DEMONSTRATIONS & ANOMALY PREVENTION
-- ============================================================================

/*
ANOMALIES PREVENTED:
1. Lost Update:
   - Problem: Faculty A and Faculty B both read Student 5's status as 'ABSENT' at t0.
     Faculty A changes to 'LATE' at t1. Faculty B changes to 'PRESENT' at t2.
     Faculty A's update is completely overwritten and lost without audit.
   - Solution: In AMMS, all mutation transactions use 'SELECT ... FOR UPDATE' on
     the record. The second transaction blocks until the first commits, reading
     the updated status and appending to the audit trail.

2. Inconsistent Analysis (Non-Repeatable Read):
   - Problem: An HOD generates a department-wide attendance report summing all
     present students. Simultaneously, a Course Teacher submits attendance for
     Division A. The HOD's query gets inconsistent totals across different courses.
   - Solution: AMMS analytical reporting can execute under:
     SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
     This provides a transaction-consistent snapshot taken at the query start.

3. Phantom Reads:
   - Problem: A query counts all students in Division A with < 75% attendance.
     During execution, a new student enrollment or schedule insertion occurs,
     causing subsequent aggregation in the same transaction to yield extra rows.
   - Solution: Handled by PostgreSQL Repeatable Read (which uses snapshot isolation
     precluding phantom reads) and unique constraints `uq_attendance_entry`
     `uq_schedule_slot`.
*/


-- ============================================================================
-- SCENARIO 5: DATABASE RECOVERY & WRITE-AHEAD LOGGING (WAL)
-- ============================================================================
/*
POSTGRESQL RECOVERY MECHANISM & ARIES PROTOCOL IN AMMS:

1. Write-Ahead Logging (WAL) Protocol:
   - Core Rule: Every modification to a data page (such as updating attendance_records
     or inserting an attendance_audit_trail row) MUST be recorded in the WAL buffer 
     and flushed to persistent disk (pg_wal/) BEFORE the modified data page is written
     to disk (Write-Ahead principle).
   - Log Sequence Number (LSN): Every data page header contains the LSN of the 
     latest WAL record modifying it (PageLSN). Disk writes ensure FlushedLSN >= PageLSN.

2. Transaction Atomicity & Crash Consistency:
   - When a faculty submits attendance, PostgreSQL writes a COMMIT WAL record and flushes
     it synchronously to disk (fsync).
   - If a power outage or server crash occurs:
     a) Before COMMIT record is flushed: The transaction is considered aborted. 
        On startup, any uncommitted changes in data pages are UNDONE.
     b) After COMMIT record is flushed: The transaction is guaranteed durable.
        Even if dirty data pages were not yet flushed to disk, the REDO engine 
        replays the WAL from the last checkpoint to reconstruct all changes.

3. Checkpointing:
   - PostgreSQL background writer periodically writes a CHECKPOINT record.
   - The checkpoint records the position of the REDO point in the WAL.
   - During recovery, PostgreSQL only needs to scan WAL records starting from the 
     checkpoint's REDO point, dramatically reducing recovery time (Mean Time to Recover - MTTR).
*/
