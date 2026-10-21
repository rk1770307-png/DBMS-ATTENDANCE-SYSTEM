# ATTENDANCE MANAGEMENT AND MONITORING SYSTEM (AMMS)
## Comprehensive Database Specification, Formal Relational Theory, & Architecture Manual
**Target Architecture:** MySQL 8.0+ (InnoDB Engine) & PostgreSQL 14+/18+  
**Domain:** Engineering Institute with Six Academic Departments (Computer, IT, ENTC, Mechanical, Civil, Electrical)  
**Normalization Target:** Third Normal Form (3NF) / Boyce-Codd Normal Form (BCNF)

---

## 1. Executive Summary & Institute Architecture

The Attendance Management and Monitoring System (AMMS) is an enterprise-grade academic information system engineered to govern attendance workflows across six academic engineering departments:
1. **Computer Engineering (`COMP`)**
2. **Information Technology (`IT`)**
3. **Electronics & Telecommunication Engineering (`ENTC`)**
4. **Mechanical Engineering (`MECH`)**
5. **Civil Engineering (`CIVIL`)**
6. **Electrical Engineering (`ELEC`)**

The system models multi-tier academic hierarchies, semester calendars, course allocations, mentorship structures (Teacher Guardians), atomic lecture conduction, immutable audit trails, and multi-role analytical reporting.

---

## 2. Relational Schema, Entities, & Participation Constraints

### 2.1 Entity Relationship (ER) Structural Specification

```
[DEPARTMENTS] 1 ────< offers >──── N [PROGRAMS]
      │                                  │
      │ 1                              1 │
      │                                  │
  < employs >                        < enrolls >
      │                                  │
      v N                                v N
  [FACULTY]                          [CLASSES]
      │                                  │
      │ 1                              1 │
      │                                  │
  < teaches >                        < divides >
      │                                  │
      v M                                v N
[COURSE_ALLOCATIONS] >────< attends >── [DIVISIONS]
      │                                      │
      │ 1                                  1 │
      │                                      │
  < schedules >                          < contains >
      │                                      │
      v N                                    v N
[LECTURE_SCHEDULES]                       [STUDENTS]
      │                                      │
      │ 1                                  1 │
      └─────────┐                  ┌─────────┘
                │                  │
                v N                v N
             [ATTENDANCE_RECORDS]
                      │
                      │ 1
                      v N
          [ATTENDANCE_AUDIT_TRAIL]
```

### 2.2 Data Dictionary & Entity Specifications

| Entity / Table | Primary Key | Alternate / Unique Keys | Foreign Keys | Participation Constraints & Business Rules |
| :--- | :--- | :--- | :--- | :--- |
| `departments` | `department_id` | `department_code`, `contact_email` | `hod_faculty_id` $\to$ `faculty(faculty_id)` | Mandatory 1:N with programs; 1:1 optional with HOD faculty. |
| `programs` | `program_id` | `program_code` | `department_id` $\to$ `departments(department_id)` | Total participation in `departments`. Degree levels: UG, PG, Doctoral. |
| `academic_years` | `academic_year_id` | `year_label` | None | Defines institute operational calendar periods. Exactly one is current. |
| `classes` | `class_id` | `(program_id, academic_year_id, class_level, semester)` | `program_id`, `academic_year_id` | Year cohort (FE, SE, TE, BE). Constrained to semesters 1..8. |
| `divisions` | `division_id` | `(class_id, division_name)` | `class_id`, `class_teacher_faculty_id` | Division cohorts ('A', 'B') assigned a dedicated Class Teacher. |
| `faculty` | `faculty_id` | `employee_code`, `email` | `department_id` $\to$ `departments` | Staff employed in an engineering department. Designation constraints. |
| `courses` | `course_id` | `course_code` | `department_id` $\to$ `departments` | Subjects (Theory, Lab, Tutorial) with defined academic credits and hours. |
| `course_allocations` | `allocation_id` | `(course_id, faculty_id, division_id, academic_year_id)` | `course_id`, `faculty_id`, `division_id`, `academic_year_id` | Resolves ternary association between Faculty, Course, Division. |
| `students` | `student_id` | `prn`, `(division_id, roll_number)` | `division_id` $\to$ `divisions` | Enrolled students. Division roll number uniqueness strictly enforced. |
| `teacher_guardians` | `tg_id` | `(faculty_id, academic_year_id, batch_name)` | `faculty_id`, `department_id`, `academic_year_id` | Mentorship batches headed by designated faculty mentors. |
| `tg_student_mapping`| `mapping_id` | `(student_id)` | `tg_id`, `student_id` | Functional constraint: A student has exactly ONE active TG at any time. |
| `lecture_schedules` | `schedule_id` | `(allocation_id, lecture_date, slot_number)` | `allocation_id`, `substitute_faculty_id`, `rescheduled_from_schedule_id` | Prevents slot collisions. State machine: SCHEDULED, CONDUCTED, CANCELLED, RESCHEDULED. |
| `attendance_records`| `attendance_id`| `(schedule_id, student_id)` | `schedule_id`, `student_id`, `marked_by_faculty_id` | Atomic status entry (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`). Guaranteed 1 status per student per lecture. |
| `attendance_audit_trail` | `audit_id` | None (append-only ledger) | `attendance_id`, `schedule_id`, `student_id`, `modified_by_faculty_id` | Immutable audit log capturing original status, modified status, operator, timestamp, and mandatory reason string. |

---

## 3. Formal Normalization Theory & Proof of Third Normal Form (3NF)

A relational schema $R$ is in **Third Normal Form (3NF)** with respect to a set of Functional Dependencies $F$ if and only if for every non-trivial functional dependency $X \to Y \in F^+$:
1. $X$ is a superkey of $R$, **OR**
2. Every attribute $A \in Y \setminus X$ is a prime attribute (part of some candidate key of $R$).

### 3.1 Functional Dependency (FD) Analysis Table-by-Table

#### 1. `departments`
- **Attributes:** $\{ \text{department\_id}, \text{department\_code}, \text{department\_name}, \text{established\_year}, \text{contact\_email}, \text{building\_location}, \text{hod\_faculty\_id} \}$
- **Candidate Keys:** $K_1 = \{ \text{department\_id} \}$, $K_2 = \{ \text{department\_code} \}$, $K_3 = \{ \text{contact\_email} \}$
- **Functional Dependencies:**
  - $\text{department\_id} \to \text{department\_code}, \text{department\_name}, \text{established\_year}, \text{contact\_email}, \text{building\_location}, \text{hod\_faculty\_id}$
  - $\text{department\_code} \to \text{department\_id}, \text{department\_name}, \text{established\_year}, \text{contact\_email}, \text{building\_location}, \text{hod\_faculty\_id}$
- **3NF Proof:** Every left-hand side is a superkey. There are no transitive dependencies between non-prime attributes. Hence, 3NF and BCNF are satisfied.

#### 2. `classes` & `divisions`
- **Classes FDs:**
  - $K = \{ \text{class\_id} \}$
  - $\text{class\_id} \to \text{program\_id}, \text{academic\_year\_id}, \text{class\_level}, \text{semester}$
  - $\{ \text{program\_id}, \text{academic\_year\_id}, \text{class\_level}, \text{semester} \} \to \text{class\_id}$
  - Left-hand sides are superkeys. 3NF satisfied.
- **Divisions FDs:**
  - $K = \{ \text{division\_id} \}$
  - $\text{division\_id} \to \text{class\_id}, \text{division\_name}, \text{class\_teacher\_faculty\_id}, \text{classroom\_number}$
  - $\{ \text{class\_id}, \text{division\_name} \} \to \text{division\_id}, \text{class\_teacher\_faculty\_id}, \text{classroom\_number}$
  - Left-hand sides are superkeys. No non-prime attribute determines another non-prime attribute. 3NF satisfied.

#### 3. `students`
- **Candidate Keys:** $K_1 = \{ \text{student\_id} \}$, $K_2 = \{ \text{prn} \}$, $K_3 = \{ \text{division\_id}, \text{roll\_number} \}$, $K_4 = \{ \text{email} \}$
- **FDs:**
  - $\text{student\_id} \to \text{prn}, \text{roll\_number}, \text{first\_name}, \text{last\_name}, \text{email}, \text{phone\_number}, \text{parent\_phone}, \text{division\_id}, \text{admission\_year}, \text{is\_active}$
  - $\text{prn} \to \text{all attributes}$
  - $\{ \text{division\_id}, \text{roll\_number} \} \to \text{all attributes}$
- **3NF Proof:** Because all determinants are superkeys, every non-prime attribute is fully functionally dependent on candidate keys.

#### 4. `course_allocations`
- **Candidate Key:** $K = \{ \text{allocation\_id} \}$, alternate $K_2 = \{ \text{course\_id}, \text{faculty\_id}, \text{division\_id}, \text{academic\_year\_id} \}$
- **FDs:**
  - $\text{allocation\_id} \to \text{course\_id}, \text{faculty\_id}, \text{division\_id}, \text{academic\_year\_id}, \text{allocation\_role}$
  - $\{ \text{course\_id}, \text{faculty\_id}, \text{division\_id}, \text{academic\_year\_id} \} \to \text{allocation\_id}, \text{allocation\_role}$
- **3NF Proof:** Decomposing faculty teaching assignments from courses prevents multi-value update anomalies.

#### 5. `attendance_records`
- **Candidate Keys:** $K_1 = \{ \text{attendance\_id} \}$, $K_2 = \{ \text{schedule\_id}, \text{student\_id} \}$
- **FDs:**
  - $\text{attendance\_id} \to \text{schedule\_id}, \text{student\_id}, \text{status}, \text{marked\_at}, \text{marked\_by\_faculty\_id}, \text{remarks}$
  - $\{ \text{schedule\_id}, \text{student\_id} \} \to \text{attendance\_id}, \text{status}, \text{marked\_at}, \text{marked\_by\_faculty\_id}, \text{remarks}$
- **Anomaly Elimination:**
  - **Insertion Anomaly:** Cannot record attendance without an existing student and scheduled lecture.
  - **Deletion Anomaly:** Deleting a cancelled lecture schedule cascades only to attendance for that lecture without deleting student or faculty master records.
  - **Update Anomaly:** Because status is tied strictly to $(schedule\_id, student\_id)$, an update modifies exactly one atomic tuple.

---

## 4. Formal Query Formulations (Relational Algebra & Calculus Mappings)

### 4.1 Selection ($\sigma$) and Projection ($\pi$)
*Business Goal:* Retrieve student roster in Computer Engineering department.
- **Relational Algebra (RA):**
  $$\pi_{student\_id, roll\_number, first\_name, last\_name, email} \left( \sigma_{department\_code = 'COMP' \land is\_active = TRUE} (students \bowtie divisions \bowtie classes \bowtie programs \bowtie departments) \right)$$
- **Tuple Relational Calculus (TRC):**
  $$\{ t \mid \exists s \in students, \exists d \in divisions, \exists c \in classes, \exists p \in programs, \exists dept \in departments (t[id] = s.student\_id \land t[roll] = s.roll\_number \land s.division\_id = d.division\_id \land d.class\_id = c.class\_id \land c.program\_id = p.program\_id \land p.department\_id = dept.department\_id \land dept.department\_code = 'COMP' \land s.is\_active = TRUE) \}$$

### 4.2 Relational Division ($\div$) / Universal Quantification ($\forall$)
*Business Goal:* Find students who have attended ALL conducted sessions in course CS301.
- **Relational Algebra (RA):**
  $$TargetStudents = AttendedSessions \div ConductedSessions_{CS301}$$
  $$\equiv \pi_{student\_id}(students) - \pi_{student\_id} \left( (\pi_{student\_id}(students) \times \pi_{schedule\_id}(\sigma_{course=CS301}(lecture\_schedules))) - \pi_{student\_id, schedule\_id}(\sigma_{status=PRESENT}(attendance\_records)) \right)$$
- **TRC Equivalent:**
  $$\{ s \mid s \in students \land \forall l \in lecture\_schedules (is\_conducted\_CS301(l) \implies \exists a \in attendance\_records (a.student\_id = s.student\_id \land a.schedule\_id = l.schedule\_id \land a.status = 'PRESENT')) \}$$
- **SQL Implementation:** Double `NOT EXISTS` correlated subquery (implemented in `03_queries_and_views.sql`).

---

## 5. Transactions, Concurrency Control, & Recovery Protocols

### 5.1 ACID Transaction Execution

Critical operations utilize atomic transaction envelopes with explicit recovery boundaries:
```sql
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- 1. Acquire exclusive lock on target lecture schedule
SELECT status FROM lecture_schedules WHERE schedule_id = 17 FOR UPDATE;

-- 2. Insert attendance rows
INSERT INTO attendance_records (schedule_id, student_id, status, marked_by_faculty_id, remarks)
VALUES (17, 1, 'PRESENT', 2, 'Roster marked')
ON CONFLICT (schedule_id, student_id) DO UPDATE SET status = EXCLUDED.status;

-- 3. Transition lecture state
UPDATE lecture_schedules SET status = 'CONDUCTED', conducted_at = CURRENT_TIMESTAMP WHERE schedule_id = 17;

COMMIT;
```

### 5.2 Concurrency Anomalies & Mitigations

| Anomaly | Real-World Institute Scenario | Database Concurrency Mitigation in AMMS |
| :--- | :--- | :--- |
| **Lost Update** | Two teachers simultaneously correcting attendance for the same student in a lab slot. | Exclusive row-level locking via `SELECT ... FOR UPDATE`. The second transaction blocks until the first completes. |
| **Non-Repeatable Read** | HOD generates a department-wide aggregate report while teachers submit attendance batches. | Reports can run under `REPEATABLE READ` snapshot isolation, reading from an immutable MVCC snapshot. |
| **Phantom Read** | A defaulter query counts students with $< 75\%$ while new student enrollment occurs. | Prevented via unique constraints `uq_attendance_entry` and PostgreSQL MVCC predicate tracking. |

### 5.3 Crash Consistency & Write-Ahead Logging (WAL)
PostgreSQL's Write-Ahead Logging engine implements the **ARIES (Algorithms for Recovery and Isolation Exploiting Semantics)** protocol:
1. **WAL-Before-Data Invariant:** Before any dirty buffer page is flushed to disk, the corresponding log record in `pg_wal` must be written and fsynced.
2. **Log Sequence Numbers (LSN):** Every page header contains `PageLSN`. Recovery compares `PageLSN` against `RedoLSN` to prevent redundant writes.
3. **Recovery Phases:**
   - **Analysis Phase:** Identifies dirty pages in the buffer pool and active uncommitted transactions at crash time.
   - **Redo Phase (Repeating History):** Replays all committed transactions from the checkpoint REDO point forward.
   - **Undo Phase:** Rolls back all uncommitted transactions active at the crash moment in reverse chronological order, guaranteeing **Atomicity** and **Durability**.

---

## 6. Performance Optimization & EXPLAIN ANALYZE Benchmarks

### 6.1 Indexing Architecture

To support large datasets (100,000+ attendance records per academic term), composite and partial B-Tree indexes were designed:
1. `idx_attendance_student_status` on `attendance_records(student_id, status)`: Enables Index-Only Scans when aggregating attendance percentage per student.
2. `idx_attendance_schedule_id` on `attendance_records(schedule_id)`: Accelerates schedule roster lookups and joins.
3. `idx_lecture_schedules_alloc_date` on `lecture_schedules(allocation_id, lecture_date)`: Accelerates date-range filtering.
4. `idx_attendance_partial_absent` on `attendance_records(student_id, schedule_id) WHERE status = 'ABSENT'`: Highly compact partial index providing instantaneous defaulter list scans.

### 6.2 Empirical Benchmark Results (PostgreSQL Engine Output)

The benchmarks were executed directly on the database engine using synthetic scale data (1,215 attendance records).

#### Benchmark Query 1: Defaulter List Extraction ($< 75\%$ Threshold)
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT s.student_id, s.roll_number, s.first_name || ' ' || s.last_name AS student_name,
       COUNT(ar.attendance_id) AS total_marked,
       COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END) AS present_count,
       ROUND((COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END)::DECIMAL / 
              NULLIF(COUNT(ar.attendance_id), 0)) * 100.0, 2) AS attendance_pct
FROM students s
JOIN attendance_records ar ON s.student_id = ar.student_id
GROUP BY s.student_id, s.roll_number, s.first_name, s.last_name
HAVING (COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(ar.attendance_id), 0)) * 100.0 < 75.0;
```

**Results Comparison:**
- **Before Indexing (Sequential Scan):**
  - Query Plan: `HashAggregate -> Hash Join -> Seq Scan on attendance_records`
  - Execution Time: **8.831 ms**
  - Planning Time: 0.534 ms
  - Buffers: Shared Hit = 15 pages
- **After Indexing (Composite & Partial Indexing):**
  - Execution Time: **2.871 ms**
  - **Speedup: 3.07x faster (67.5% reduction in execution time)**

---

#### Benchmark Query 2: Student Specific Date-Range Retrieval
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT ar.attendance_id, c.course_code, c.course_name, ls.lecture_date, ls.slot_number, ar.status
FROM attendance_records ar
JOIN lecture_schedules ls ON ar.schedule_id = ls.schedule_id
JOIN course_allocations ca ON ls.allocation_id = ca.allocation_id
JOIN courses c ON ca.course_id = c.course_id
WHERE ar.student_id = 5
  AND ls.lecture_date BETWEEN '2025-09-01' AND '2025-09-30'
ORDER BY ls.lecture_date, ls.slot_number;
```

**Results Comparison:**
- **Before Indexing:**
  - Query Plan: Nested Loop with `Seq Scan on attendance_records (Filter: student_id = 5, Rows Removed by Filter: 1134)` and `Seq Scan on lecture_schedules`
  - Execution Time: **2.864 ms**
  - Buffers: Shared Hit = **223 pages**
- **After Indexing:**
  - Query Plan: Nested Loop using `Index Scan using uq_attendance_entry on attendance_records` with zero filter discards
  - Execution Time: **0.311 ms**
  - Buffers: Shared Hit = **91 pages (59.2% I/O buffer reduction)**
  - **Speedup: 9.21x faster**

---

## 7. Role-Based Access Control (RBAC) Matrix

| User Role | Accessible Views & Endpoints | Permitted Operations |
| :--- | :--- | :--- |
| **Student** | `GET /api/student/:id/summary` | Read personal course percentage, conducted sessions, and warnings. |
| **Course Teacher** | `GET /api/course-teacher/:id/allocations`<br>`GET /api/schedules/:id/roster`<br>`POST /api/attendance/submit`<br>`POST /api/attendance/update-record`<br>`POST /api/schedules/:id/reschedule`<br>`POST /api/schedules/:id/substitute`<br>`POST /api/schedules/:id/cancel` | Mark lecture attendance, reschedule slots, assign substitutes with row locking, correct attendance with mandatory audit reasons. |
| **Teacher Guardian (TG)** | `GET /api/tg/:id/mentees`<br>`POST /api/tg/counseling` | Monitor assigned student batches, continuous absence flags, update counseling intervention notes. |
| **Class Teacher** | `GET /api/class-teacher/:id/division`<br>Export CSV | Monitor complete division-level attendance, defaulter lists, and classroom parity metrics. |
| **Head of Department (HOD)** | `GET /api/hod/:deptId/dashboard`<br>`GET /api/audit-trail`<br>`GET /api/alerts`<br>`GET /api/benchmarks/run` | Institute-wide 6-department matrix, course metrics, audit log review, live database benchmark execution. |

---

## 8. Verification & Execution Instructions

### Running the Application:
```bash
# 1. Install dependencies
cd d:\DBMS
npm install

# 2. Initialize and Seed PostgreSQL Database
node backend/init_db.js

# 3. Run Performance Benchmark (EXPLAIN ANALYZE)
node backend/benchmark_runner.js

# 4. Run Automated End-to-End Test Suite
node backend/test_suite.js

# 5. Start AMMS Production Web Server
node backend/server.js
# Access the web UI at: http://localhost:4000
```
