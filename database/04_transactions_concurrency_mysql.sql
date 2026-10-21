-- ============================================================================
-- ATTENDANCE MANAGEMENT AND MONITORING SYSTEM (AMMS)
-- Database: MySQL 8.0+ (InnoDB Engine)
-- Module: 04_transactions_concurrency_mysql.sql
-- Transactions, Concurrency Control, Row-Level Locking & Crash Recovery
-- ============================================================================

USE amms;

-- ============================================================================
-- SCENARIO 1: ATOMIC ATTENDANCE SUBMISSION (START TRANSACTION ... COMMIT)
-- ============================================================================
-- Demonstrates atomic conduction of a lecture and bulk attendance insertion.
-- Row-level locking on lecture_schedules prevents concurrent duplicate submissions.

START TRANSACTION;

-- Step 1: Acquire exclusive row-level lock on the schedule slot
SELECT schedule_id, status 
FROM lecture_schedules 
WHERE schedule_id = 17 
FOR UPDATE;

-- Step 2: Insert roster attendance
INSERT INTO attendance_records (schedule_id, student_id, status, marked_by_faculty_id, remarks) VALUES
(17, 1, 'PRESENT', 2, 'Recorded via AMMS portal'),
(17, 2, 'PRESENT', 2, 'Recorded via AMMS portal'),
(17, 3, 'ABSENT',  2, 'Unexcused leave'),
(17, 4, 'PRESENT', 2, 'Recorded via AMMS portal'),
(17, 5, 'ABSENT',  2, 'Unexcused leave')
ON DUPLICATE KEY UPDATE 
    status = VALUES(status),
    remarks = VALUES(remarks),
    marked_at = NOW();

-- Step 3: Transition schedule status to CONDUCTED
UPDATE lecture_schedules
SET status = 'CONDUCTED',
    conducted_at = NOW(),
    topic_covered = 'Distributed Database Architecture & 2PC Protocols'
WHERE schedule_id = 17;

COMMIT;


-- ============================================================================
-- SCENARIO 2: ATTENDANCE CORRECTION TRANSACTION WITH SAVEPOINT
-- ============================================================================
-- Demonstrates SAVEPOINT and partial rollback handling during reconciliation.

START TRANSACTION;

-- Acquire lock on student's attendance record
SELECT attendance_id, status 
FROM attendance_records 
WHERE schedule_id = 17 AND student_id = 3
FOR UPDATE;

-- Establish Savepoint before correction
SAVEPOINT sp_before_correction;

-- Update status (Triggers automated audit logging to attendance_audit_trail)
UPDATE attendance_records
SET status = 'EXCUSED',
    remarks = 'Official medical slip approved by Institute Clinic'
WHERE schedule_id = 17 AND student_id = 3;

-- Verification: Ensure audit row exists
SELECT audit_id, original_status, modified_status, reason_for_modification 
FROM attendance_audit_trail 
WHERE schedule_id = 17 AND student_id = 3
ORDER BY audit_id DESC LIMIT 1;

-- If satisfied, release savepoint and commit
RELEASE SAVEPOINT sp_before_correction;
COMMIT;


-- ============================================================================
-- SCENARIO 3: CONCURRENT FACULTY SUBSTITUTION WITH ROW-LEVEL LOCKING
-- ============================================================================
-- Prevents lost updates when primary teacher and HOD assign substitute simultaneously.

SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
START TRANSACTION;

-- Lock target lecture row exclusively
SELECT schedule_id, allocation_id, lecture_date, slot_number, status, substitute_faculty_id
FROM lecture_schedules
WHERE schedule_id = 10
FOR UPDATE;

-- Safely assign substitute faculty member
UPDATE lecture_schedules
SET substitute_faculty_id = 4,
    cancellation_reason = 'Official faculty duty substitution authorized by HOD'
WHERE schedule_id = 10;

COMMIT;


-- ============================================================================
-- SCENARIO 4: INNODB CONCURRENCY CONTROL & ACID GUARANTEES
-- ============================================================================
/*
1. Lost Updates:
   - Mitigated in InnoDB via 2-Phase Locking (2PL) and `SELECT ... FOR UPDATE`.
   - Conflicting transactions wait on row locks rather than silently overwriting.

2. Inconsistent Reads (Non-Repeatable Reads):
   - MySQL InnoDB defaults to REPEATABLE READ isolation level.
   - Consistent non-locking reads (MVCC ReadView) ensure that all SELECT queries 
     within the same transaction see the exact same snapshot of data.

3. Phantom Reads:
   - InnoDB uses Next-Key Locking (combining index-row lock with gap lock on 
     the index gap preceding the record) to prevent phantom row insertions.
*/


-- ============================================================================
-- SCENARIO 5: DATABASE RECOVERY & WRITE-AHEAD LOGGING (REDO / UNDO LOGS)
-- ============================================================================
/*
INNODB CRASH RECOVERY ARCHITECTURE:

1. Redo Log (WAL Equivalent):
   - InnoDB uses a circular physical-to-logical write-ahead log (ib_logfile0, ib_logfile1).
   - Invariant: A dirty page buffer in the InnoDB Buffer Pool is never written to tablespace
     disk files until the corresponding Redo log records have been flushed to disk.
   - ACID Durability: When COMMIT executes, `innodb_flush_log_at_trx_commit = 1` flushes 
     the Redo log buffer to disk with an OS fsync call.

2. Undo Log:
   - Maintains before-images of records modified by active transactions.
   - Powers MVCC (Multi-Version Concurrency Control) for non-blocking reads.
   - On crash recovery, any uncommitted transaction identified during Redo is 
     undone using Undo log records, enforcing complete Atomicity.

3. Checkpointing & Doublewrite Buffer:
   - Fuzzy checkpointing records the LSN (Log Sequence Number) up to which all dirty 
     pages have been flushed to disk, bounding crash recovery time.
   - The Doublewrite buffer prevents half-written page corruption on OS/hardware crashes.
*/
