const express = require('express');
const cors = require('cors');
const path = require('path');
const { query, exec, withTransaction, getPool } = require('./db');
const { enforceRBAC } = require('./middleware/rbac');
const { runBenchmark } = require('./benchmark_runner');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve frontend static assets
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ----------------------------------------------------------------------------
// 0. AUTHENTICATION & MULTI-ROLE CREDENTIALS
// ----------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();

  try {
    // 1. Look up in user_credentials with full metadata join
    const userRes = await query(`
      SELECT u.*, 
             CONCAT(f.first_name, ' ', f.last_name) AS faculty_full_name,
             f.first_name AS faculty_first_name,
             f.employee_code,
             f.designation,
             CONCAT(s.first_name, ' ', s.last_name) AS student_full_name,
             s.first_name AS student_first_name,
             s.prn, s.roll_number, d.division_name, cl.class_level
      FROM user_credentials u
      LEFT JOIN faculty f ON u.faculty_id = f.faculty_id
      LEFT JOIN students s ON u.student_id = s.student_id
      LEFT JOIN divisions d ON s.division_id = d.division_id
      LEFT JOIN classes cl ON d.class_id = cl.class_id
      WHERE LOWER(u.username) = ? 
         OR LOWER(u.email) = ?
         OR LOWER(s.prn) = ?
         OR LOWER(f.employee_code) = ?
      ORDER BY u.credential_id ASC;
    `, [cleanUser, cleanUser, cleanUser, cleanUser]);

    let user = null;

    if (userRes.rows.length > 0) {
      user = userRes.rows[0];
    } else {
      // 2. Dynamic Fallback: Check students table directly (for any newly added students)
      const stdCheck = await query(`
        SELECT s.student_id, s.prn, s.roll_number, s.first_name, s.last_name, s.email,
               d.division_name, cl.class_level, p.department_id
        FROM students s
        JOIN divisions d ON s.division_id = d.division_id
        JOIN classes cl ON d.class_id = cl.class_id
        JOIN programs p ON cl.program_id = p.program_id
        WHERE LOWER(s.first_name) = ? OR LOWER(s.prn) = ? OR LOWER(s.email) = ?;
      `, [cleanUser, cleanUser, cleanUser]);

      if (stdCheck.rows.length > 0) {
        const s = stdCheck.rows[0];
        user = {
          credential_id: 1000 + s.student_id,
          username: s.first_name.toLowerCase(),
          password_hash: `${s.first_name.toLowerCase()}123`,
          role: 'STUDENT',
          display_name: `${s.first_name} ${s.last_name}`,
          email: s.email,
          student_id: s.student_id,
          faculty_id: null,
          department_id: s.department_id,
          prn: s.prn,
          roll_number: s.roll_number,
          class_level: s.class_level,
          division_name: s.division_name
        };
      } else {
        // 3. Dynamic Fallback: Check faculty table directly (for any newly added faculty)
        const facCheck = await query(`
          SELECT f.faculty_id, f.employee_code, f.first_name, f.last_name, f.email,
                 f.designation, f.department_id
          FROM faculty f
          WHERE LOWER(f.first_name) = ? OR LOWER(f.employee_code) = ? OR LOWER(f.email) = ?;
        `, [cleanUser, cleanUser, cleanUser]);

        if (facCheck.rows.length > 0) {
          const f = facCheck.rows[0];
          const assignedRole = f.designation === 'HOD' ? 'HOD' : 'COURSE_TEACHER';
          user = {
            credential_id: 2000 + f.faculty_id,
            username: f.first_name.toLowerCase(),
            password_hash: `${f.first_name.toLowerCase()}123`,
            role: assignedRole,
            display_name: `${f.designation === 'HOD' ? 'Dr.' : 'Prof.'} ${f.first_name} ${f.last_name}`,
            email: f.email,
            student_id: null,
            faculty_id: f.faculty_id,
            department_id: f.department_id,
            designation: f.designation
          };
        }
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // STRICT PASSWORD VERIFICATION: Do not accept invalid passwords
    if (user.password_hash !== cleanPass) {
      return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
    }

    const effectiveId = user.role === 'STUDENT' ? user.student_id : (user.faculty_id || user.credential_id);

    res.json({
      success: true,
      message: `Authenticated successfully as ${user.display_name} (${user.role})`,
      user: {
        credentialId: user.credential_id,
        username: user.username,
        role: user.role,
        displayName: user.display_name,
        email: user.email,
        userId: effectiveId,
        studentId: user.student_id,
        facultyId: user.faculty_id,
        designation: user.designation || null,
        departmentId: user.department_id,
        prn: user.prn || null,
        rollNumber: user.roll_number || null,
        classInfo: user.class_level ? `${user.class_level}-${user.division_name}` : null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/profiles', async (req, res) => {
  try {
    const profiles = await query(`
      SELECT credential_id, username, password_hash AS demo_password, role, display_name, email, student_id, faculty_id
      FROM user_credentials
      ORDER BY credential_id;
    `);
    res.json({ profiles: profiles.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 1. SYSTEM HEALTH & PRESET PROFILES FOR EASY TESTING
// ----------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Attendance Management & Monitoring System (AMMS)',
    version: '1.0.0-production',
    database: 'MySQL 8.0 (InnoDB Engine with ACID & Redo/Undo Logging)',
    classes: 2,
    courses: 5,
    departments: 6
  });
});

app.get('/api/presets', async (req, res) => {
  try {
    const studentsRes = await query(`
      SELECT s.student_id, s.roll_number, CONCAT(s.first_name, ' ', s.last_name) AS name, 
             s.email, d.division_name, dept.department_code, dept.department_name
      FROM students s
      JOIN divisions d ON s.division_id = d.division_id
      JOIN classes cl ON d.class_id = cl.class_id
      JOIN programs p ON cl.program_id = p.program_id
      JOIN departments dept ON p.department_id = dept.department_id
      ORDER BY s.student_id LIMIT 6;
    `);

    const facultyRes = await query(`
      SELECT f.faculty_id, f.employee_code, CONCAT(f.first_name, ' ', f.last_name) AS name, 
             f.designation, dept.department_code, dept.department_id, dept.department_name
      FROM faculty f
      JOIN departments dept ON f.department_id = dept.department_id
      ORDER BY f.faculty_id LIMIT 15;
    `);

    const departmentsRes = await query(`
      SELECT department_id, department_code, department_name 
      FROM departments ORDER BY department_id;
    `);

    const credentialsRes = await query(`
      SELECT credential_id, username, password_hash AS password, role, display_name, email, student_id, faculty_id
      FROM user_credentials ORDER BY credential_id;
    `);

    res.json({
      students: studentsRes.rows,
      faculty: facultyRes.rows,
      departments: departmentsRes.rows,
      credentials: credentialsRes.rows,
      recommendedPresets: {
        student: { id: 26, name: 'Ram Joshi (SE-COMP Div A)', role: 'STUDENT', username: 'ram', password: 'ram123' },
        courseTeacher: { id: 2, name: 'Prof. Pooja Verma (DBMS Subject Lead)', role: 'COURSE_TEACHER', username: 'pooja', password: 'pooja123' },
        tg: { id: 3, name: 'Prof. Amit Kulkarni (Teacher Guardian Batch 1)', role: 'TG', username: 'amit', password: 'amit123' },
        classTeacher: { id: 4, name: 'Prof. Neha Patil (Class Teacher TE-COMP Div A)', role: 'CLASS_TEACHER', username: 'neha', password: 'neha123' },
        faculty: { id: 4, name: 'Prof. Neha Patil (Faculty Member)', role: 'FACULTY', username: 'neha', password: 'neha123' },
        hod: { id: 1, name: 'Dr. Namdev Sawant (Head of Department)', role: 'HOD', departmentId: 1, username: 'namdev', password: 'namdev123' },
        admin: { id: 1, name: 'Institutional Administrator', role: 'HOD', departmentId: 1, username: 'admin', password: 'admin123' }
      }
    });
  } catch (error) {
    console.error('Error fetching presets:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 2. ROLE 1: STUDENT DASHBOARD
// ----------------------------------------------------------------------------
app.get('/api/student/:id/summary', enforceRBAC(['STUDENT', 'TG', 'CLASS_TEACHER', 'HOD']), async (req, res) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    
    // Privacy protection: Students are strictly permitted to view only their own record
    if (req.user.role === 'STUDENT' && req.user.id !== studentId) {
      return res.status(403).json({
        error: 'Forbidden: Privacy Violation',
        message: 'Students are strictly permitted to view only their own personal academic attendance records.'
      });
    }
    
    // Personal details
    const studentInfo = await query(`
      SELECT s.student_id, s.prn, s.roll_number, s.first_name, s.last_name, s.email,
             d.division_name, cl.class_level, p.program_name, dept.department_name
      FROM students s
      JOIN divisions d ON s.division_id = d.division_id
      JOIN classes cl ON d.class_id = cl.class_id
      JOIN programs p ON cl.program_id = p.program_id
      JOIN departments dept ON p.department_id = dept.department_id
      WHERE s.student_id = ?;
    `, [studentId]);

    if (studentInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Per-course attendance breakdown
    const courseBreakdown = await query(`
      SELECT * FROM view_student_attendance_summary 
      WHERE student_id = ? 
      ORDER BY course_code;
    `, [studentId]);

    // Cumulative aggregate
    const aggregate = await query(`
      SELECT 
        COUNT(ls.schedule_id) AS total_lectures,
        COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END) AS attended_lectures,
        (COUNT(ls.schedule_id) - COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END)) AS absent_lectures,
        COUNT(CASE WHEN ar.status = 'LATE' THEN 1 END) AS late_lectures,
        ROUND(
          COALESCE(
            (COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END) / 
             NULLIF(COUNT(ls.schedule_id), 0)) * 100.0, 
            0.0
          ), 2
        ) AS cumulative_percentage
      FROM students s
      JOIN divisions d ON s.division_id = d.division_id
      JOIN course_allocations ca ON ca.division_id = d.division_id
      JOIN lecture_schedules ls ON ls.allocation_id = ca.allocation_id AND ls.status = 'CONDUCTED'
      LEFT JOIN attendance_records ar ON ar.schedule_id = ls.schedule_id AND ar.student_id = s.student_id
      WHERE s.student_id = ?;
    `, [studentId]);

    // Recent session logs
    const recentLogs = await query(`
      SELECT 
        ar.attendance_id,
        c.course_code,
        c.course_name,
        ls.lecture_date,
        ls.slot_number,
        ar.status,
        ar.remarks,
        CONCAT(f.first_name, ' ', f.last_name) AS marked_by_faculty
      FROM attendance_records ar
      JOIN lecture_schedules ls ON ar.schedule_id = ls.schedule_id
      JOIN course_allocations ca ON ls.allocation_id = ca.allocation_id
      JOIN courses c ON ca.course_id = c.course_id
      JOIN faculty f ON ar.marked_by_faculty_id = f.faculty_id
      WHERE ar.student_id = ?
      ORDER BY ls.lecture_date DESC, ls.slot_number DESC
      LIMIT 15;
    `, [studentId]);

    res.json({
      student: studentInfo.rows[0],
      cumulative: aggregate.rows[0],
      courses: courseBreakdown.rows,
      recentLogs: recentLogs.rows
    });
  } catch (error) {
    console.error('Error fetching student summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 3. ROLE 2: COURSE TEACHER DASHBOARD & OPERATIONS
// ----------------------------------------------------------------------------
app.get('/api/course-teacher/:facultyId/allocations', enforceRBAC(['COURSE_TEACHER', 'HOD']), async (req, res) => {
  try {
    const facultyId = parseInt(req.params.facultyId, 10);
    
    // Strict Data Isolation: Faculty members can strictly view only their own assigned courses and schedules
    if (req.user.role !== 'HOD' && req.user.id !== facultyId) {
      return res.status(403).json({
        error: 'Forbidden: Unauthorized Access',
        message: 'Faculty members are strictly restricted to viewing only their own assigned courses and lecture schedules.'
      });
    }

    // Allocations
    let allocSql = `
      SELECT 
        ca.allocation_id,
        c.course_id,
        c.course_code,
        c.course_name,
        c.lecture_type,
        cl.class_level,
        d.division_id,
        d.division_name,
        d.classroom_number,
        CONCAT(f.first_name, ' ', f.last_name) AS faculty_name,
        COUNT(DISTINCT s.student_id) AS student_count,
        COUNT(DISTINCT CASE WHEN ls.status = 'CONDUCTED' THEN ls.schedule_id END) AS conducted_count,
        COUNT(DISTINCT CASE WHEN ls.status = 'SCHEDULED' THEN ls.schedule_id END) AS scheduled_count
      FROM course_allocations ca
      JOIN courses c ON ca.course_id = c.course_id
      JOIN divisions d ON ca.division_id = d.division_id
      JOIN classes cl ON d.class_id = cl.class_id
      JOIN faculty f ON ca.faculty_id = f.faculty_id
      LEFT JOIN students s ON s.division_id = d.division_id AND s.is_active = TRUE
      LEFT JOIN lecture_schedules ls ON ls.allocation_id = ca.allocation_id
    `;
    let allocParams = [];
    if (req.user.role === 'HOD') {
      if (facultyId && facultyId !== req.user.id) {
        allocSql += ` WHERE ca.faculty_id = ? `;
        allocParams.push(facultyId);
      }
    } else {
      allocSql += ` WHERE ca.faculty_id = ? `;
      allocParams.push(facultyId);
    }
    allocSql += `
      GROUP BY ca.allocation_id, c.course_id, c.course_code, c.course_name, c.lecture_type,
               cl.class_level, d.division_id, d.division_name, d.classroom_number, f.first_name, f.last_name;
    `;
    const allocations = await query(allocSql, allocParams);

    // Schedules
    let schedSql = `
      SELECT 
        ls.schedule_id,
        ls.allocation_id,
        c.course_code,
        c.course_name,
        d.division_name,
        ls.lecture_date,
        ls.slot_number,
        ls.start_time,
        ls.end_time,
        ls.room_number,
        ls.status,
        ls.topic_covered,
        ls.cancellation_reason,
        CONCAT(f.first_name, ' ', f.last_name) AS faculty_name,
        CONCAT(sub.first_name, ' ', sub.last_name) AS substitute_faculty_name
      FROM lecture_schedules ls
      JOIN course_allocations ca ON ls.allocation_id = ca.allocation_id
      JOIN courses c ON ca.course_id = c.course_id
      JOIN divisions d ON ca.division_id = d.division_id
      JOIN faculty f ON ca.faculty_id = f.faculty_id
      LEFT JOIN faculty sub ON ls.substitute_faculty_id = sub.faculty_id
    `;
    let schedParams = [];
    if (req.user.role === 'HOD') {
      if (facultyId && facultyId !== req.user.id) {
        schedSql += ` WHERE ca.faculty_id = ? OR ls.substitute_faculty_id = ? `;
        schedParams.push(facultyId, facultyId);
      }
    } else {
      schedSql += ` WHERE ca.faculty_id = ? OR ls.substitute_faculty_id = ? `;
      schedParams.push(facultyId, facultyId);
    }
    schedSql += ` ORDER BY ls.lecture_date DESC, ls.slot_number ASC; `;
    const schedules = await query(schedSql, schedParams);

    res.json({
      allocations: allocations.rows,
      schedules: schedules.rows
    });
  } catch (error) {
    console.error('Error fetching teacher allocations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get division student roster for a lecture schedule (to mark/view attendance)
app.get('/api/schedules/:scheduleId/roster', enforceRBAC(['COURSE_TEACHER', 'HOD']), async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.scheduleId, 10);

    const scheduleRes = await query(`
      SELECT 
        ls.schedule_id, ls.allocation_id, ls.lecture_date, ls.slot_number, ls.status, ls.topic_covered,
        c.course_code, c.course_name, d.division_name, ca.faculty_id, ls.substitute_faculty_id
      FROM lecture_schedules ls
      JOIN course_allocations ca ON ls.allocation_id = ca.allocation_id
      JOIN courses c ON ca.course_id = c.course_id
      JOIN divisions d ON ca.division_id = d.division_id
      WHERE ls.schedule_id = ?;
    `, [scheduleId]);

    if (scheduleRes.rows.length === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const schedule = scheduleRes.rows[0];

    // Strict Data Isolation: Faculty can only view roster if they teach this course or are assigned substitute
    if (req.user.role !== 'HOD') {
      if (schedule.faculty_id !== req.user.id && schedule.substitute_faculty_id !== req.user.id) {
        return res.status(403).json({
          error: 'Forbidden: Insufficient Authority',
          message: 'Access Denied: You are only authorized to view rosters for your own allocated courses.'
        });
      }
    }

    // Fetch students of that division with their current attendance status if already marked
    const roster = await query(`
      SELECT 
        s.student_id,
        s.roll_number,
        CONCAT(s.first_name, ' ', s.last_name) AS student_name,
        s.prn,
        COALESCE(ar.status, 'PRESENT') AS status,
        ar.attendance_id,
        ar.remarks
      FROM course_allocations ca
      JOIN students s ON s.division_id = ca.division_id AND s.is_active = TRUE
      LEFT JOIN attendance_records ar ON ar.schedule_id = ? AND ar.student_id = s.student_id
      WHERE ca.allocation_id = ?
      ORDER BY s.roll_number ASC;
    `, [scheduleId, schedule.allocation_id]);

    res.json({
      schedule,
      roster: roster.rows
    });
  } catch (error) {
    console.error('Error fetching schedule roster:', error);
    res.status(500).json({ error: error.message });
  }
});

// Atomic Attendance Submission with Concurrency Locking (START TRANSACTION ... COMMIT)
app.post('/api/attendance/submit', enforceRBAC(['COURSE_TEACHER', 'HOD']), async (req, res) => {
  const { scheduleId, facultyId, topicCovered, records } = req.body;

  if (!scheduleId || !facultyId || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Invalid payload. scheduleId, facultyId, and records array required.' });
  }

  try {
    // Subject Teacher authority verification: only the allocated teacher (or HOD) can submit attendance
    if (req.user.role === 'COURSE_TEACHER') {
      const ownerRes = await query(`
        SELECT ca.faculty_id 
        FROM lecture_schedules ls
        JOIN course_allocations ca ON ls.allocation_id = ca.allocation_id
        WHERE ls.schedule_id = ?;
      `, [scheduleId]);
      if (ownerRes.rows.length === 0 || ownerRes.rows[0].faculty_id !== req.user.id) {
        return res.status(403).json({
          error: 'Forbidden: Insufficient Authority',
          message: 'Only the allocated course teacher (or HOD) has authority to submit attendance for this course.'
        });
      }
    }
    const result = await withTransaction(async (db) => {
      // 1. Acquire row-level lock on the schedule to prevent race conditions
      const lockRes = await db.query(
        'SELECT schedule_id, status FROM lecture_schedules WHERE schedule_id = ? FOR UPDATE;',
        [scheduleId]
      );

      if (lockRes.rows.length === 0) {
        throw new Error(`Schedule ${scheduleId} not found`);
      }

      // 2. Insert attendance records with unique conflict handling (ON DUPLICATE KEY UPDATE)
      for (const rec of records) {
        await db.query(`
          INSERT INTO attendance_records (schedule_id, student_id, status, marked_by_faculty_id, remarks)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            status = VALUES(status),
            marked_by_faculty_id = VALUES(marked_by_faculty_id),
            remarks = VALUES(remarks),
            marked_at = NOW();
        `, [scheduleId, rec.studentId, rec.status, facultyId, rec.remarks || 'Recorded via portal']);
      }

      // 3. Mark schedule as CONDUCTED
      await db.query(`
        UPDATE lecture_schedules
        SET status = 'CONDUCTED',
            topic_covered = ?,
            conducted_at = NOW()
        WHERE schedule_id = ?;
      `, [topicCovered || 'Regular Curriculum Session', scheduleId]);

      return {
        success: true,
        scheduleId,
        markedCount: records.length,
        status: 'CONDUCTED'
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Transaction rollback in attendance submission:', error);
    res.status(500).json({ error: error.message });
  }
});

// Attendance Record Correction with Mandatory Audit Reason
app.post('/api/attendance/update-record', enforceRBAC(['COURSE_TEACHER', 'HOD']), async (req, res) => {
  const { attendanceId, newStatus, reason, facultyId } = req.body;

  if (!attendanceId || !newStatus || !reason || reason.trim().length < 5) {
    return res.status(400).json({ 
      error: 'Invalid input. attendanceId, newStatus, and a mandatory reason (minimum 5 chars) are required.' 
    });
  }

  try {
    // Subject Teacher authority verification: only the allocated course teacher (or HOD) can correct attendance
    if (req.user.role === 'COURSE_TEACHER') {
      const ownerRes = await query(`
        SELECT ca.faculty_id 
        FROM attendance_records ar
        JOIN lecture_schedules ls ON ar.schedule_id = ls.schedule_id
        JOIN course_allocations ca ON ls.allocation_id = ca.allocation_id
        WHERE ar.attendance_id = ?;
      `, [attendanceId]);
      if (ownerRes.rows.length === 0 || ownerRes.rows[0].faculty_id !== req.user.id) {
        return res.status(403).json({
          error: 'Forbidden: Insufficient Authority',
          message: 'Only the allocated course teacher (or HOD) has authority to modify attendance for this course.'
        });
      }
    }
    const result = await withTransaction(async (db) => {
      // Acquire row-level lock on the attendance record
      const oldRecRes = await db.query(
        'SELECT * FROM attendance_records WHERE attendance_id = ? FOR UPDATE;',
        [attendanceId]
      );

      if (oldRecRes.rows.length === 0) {
        throw new Error(`Attendance record ${attendanceId} not found`);
      }

      const oldRec = oldRecRes.rows[0];

      // Update record (MySQL trigger `trg_audit_attendance_update` automatically inserts audit log)
      await db.query(`
        UPDATE attendance_records
        SET status = ?,
            marked_by_faculty_id = ?,
            remarks = ?,
            marked_at = NOW()
        WHERE attendance_id = ?;
      `, [newStatus, facultyId || 1, reason.trim(), attendanceId]);

      // Return newly created audit row for verification
      const auditRes = await db.query(`
        SELECT * FROM attendance_audit_trail 
        WHERE attendance_id = ? 
        ORDER BY audit_id DESC LIMIT 1;
      `, [attendanceId]);

      return {
        success: true,
        attendanceId,
        oldStatus: oldRec.status,
        newStatus,
        auditEntry: auditRes.rows[0]
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error updating attendance record:', error);
    res.status(500).json({ error: error.message });
  }
});

// Lecture Rescheduling with Conflict Checking
app.post('/api/schedules/:scheduleId/reschedule', enforceRBAC(['COURSE_TEACHER', 'HOD']), async (req, res) => {
  const scheduleId = parseInt(req.params.scheduleId, 10);
  const { newDate, newSlot, newRoom, reason } = req.body;

  if (!newDate || !newSlot) {
    return res.status(400).json({ error: 'newDate and newSlot are required' });
  }

  try {
    const result = await withTransaction(async (db) => {
      // Lock target schedule
      const schedRes = await db.query('SELECT * FROM lecture_schedules WHERE schedule_id = ? FOR UPDATE;', [scheduleId]);
      if (schedRes.rows.length === 0) throw new Error('Schedule not found');
      const oldSched = schedRes.rows[0];

      // Check slot conflict for the allocation
      const conflictRes = await db.query(`
        SELECT schedule_id FROM lecture_schedules 
        WHERE allocation_id = ? AND lecture_date = ? AND slot_number = ? AND schedule_id <> ?;
      `, [oldSched.allocation_id, newDate, newSlot, scheduleId]);

      if (conflictRes.rows.length > 0) {
        throw new Error(`Slot collision: Allocation already has a lecture on ${newDate} at slot ${newSlot}`);
      }

      // Mark current as RESCHEDULED
      await db.query(`
        UPDATE lecture_schedules 
        SET status = 'RESCHEDULED', cancellation_reason = ?
        WHERE schedule_id = ?;
      `, [reason || 'Rescheduled to alternate slot', scheduleId]);

      // Create new scheduled slot
      const newSlotRes = await db.query(`
        INSERT INTO lecture_schedules (
          allocation_id, lecture_date, slot_number, start_time, end_time, room_number, 
          status, rescheduled_from_schedule_id
        ) VALUES (
          ?, ?, ?, '14:00', '15:00', ?, 'SCHEDULED', ?
        );
      `, [oldSched.allocation_id, newDate, newSlot, newRoom || oldSched.room_number, scheduleId]);

      return {
        success: true,
        oldScheduleId: scheduleId,
        newScheduleId: newSlotRes.rows.insertId,
        newDate,
        newSlot
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Faculty Substitution with Row-Level Locking
app.post('/api/schedules/:scheduleId/substitute', enforceRBAC(['COURSE_TEACHER', 'HOD']), async (req, res) => {
  const scheduleId = parseInt(req.params.scheduleId, 10);
  const { substituteFacultyId, reason } = req.body;

  if (!substituteFacultyId) {
    return res.status(400).json({ error: 'substituteFacultyId is required' });
  }

  try {
    const result = await withTransaction(async (db) => {
      // Row-level lock on schedule
      const sched = await db.query('SELECT * FROM lecture_schedules WHERE schedule_id = ? FOR UPDATE;', [scheduleId]);
      if (sched.rows.length === 0) throw new Error('Schedule not found');

      await db.query(`
        UPDATE lecture_schedules 
        SET substitute_faculty_id = ?, cancellation_reason = ?
        WHERE schedule_id = ?;
      `, [substituteFacultyId, reason || 'Authorized faculty substitution', scheduleId]);

      return { success: true, scheduleId, substituteFacultyId };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Lecture Cancellation
app.post('/api/schedules/:scheduleId/cancel', enforceRBAC(['COURSE_TEACHER', 'HOD']), async (req, res) => {
  const scheduleId = parseInt(req.params.scheduleId, 10);
  const { reason } = req.body;

  try {
    await query(`
      UPDATE lecture_schedules 
      SET status = 'CANCELLED', cancellation_reason = ?
      WHERE schedule_id = ?;
    `, [reason || 'Academic schedule adjustment', scheduleId]);

    res.json({ success: true, scheduleId, status: 'CANCELLED' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 4. ROLE 3: TEACHER GUARDIAN (TG) MONITORING
// ----------------------------------------------------------------------------
app.get('/api/tg/:facultyId/mentees', enforceRBAC(['TG', 'HOD']), async (req, res) => {
  try {
    const facultyId = parseInt(req.params.facultyId, 10);

    // Strict Data Isolation: TG can only see their own assigned mentees
    if (req.user.role !== 'HOD' && req.user.id !== facultyId) {
      return res.status(403).json({
        error: 'Forbidden: Insufficient Authority',
        message: 'Teacher Guardians are strictly restricted to viewing only their own assigned mentees.'
      });
    }

    let mentees;
    if (req.user.role === 'HOD') {
      const direct = await query(`
        SELECT * FROM view_tg_mentee_monitoring 
        WHERE tg_faculty_id = ? 
        ORDER BY cumulative_attendance_pct ASC;
      `, [facultyId]);
      if (direct.rows.length > 0) {
        mentees = direct;
      } else {
        // HOD governance: universal oversight of all mentees across batches
        mentees = await query(`
          SELECT * FROM view_tg_mentee_monitoring 
          ORDER BY cumulative_attendance_pct ASC;
        `);
      }
    } else {
      mentees = await query(`
        SELECT * FROM view_tg_mentee_monitoring 
        WHERE tg_faculty_id = ? 
        ORDER BY cumulative_attendance_pct ASC;
      `, [facultyId]);
    }

    const continuousAlerts = await query(`
      SELECT * FROM view_continuous_absence_alerts;
    `);

    res.json({
      mentees: mentees.rows,
      continuousAlerts: continuousAlerts.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle counseling flag & update notes
app.post('/api/tg/counseling', enforceRBAC(['TG', 'HOD']), async (req, res) => {
  const { studentId, counselingFlag, counselingNotes } = req.body;

  try {
    // Teacher Guardian authority verification: only the assigned TG (or HOD) can update counseling notes
    if (req.user.role === 'TG') {
      const tgOwner = await query(`
        SELECT tgm.mapping_id
        FROM tg_student_mapping tgm
        JOIN teacher_guardians tg ON tgm.tg_id = tg.tg_id
        WHERE tgm.student_id = ? AND tg.faculty_id = ?;
      `, [studentId, req.user.id]);
      if (tgOwner.rows.length === 0) {
        return res.status(403).json({
          error: 'Forbidden: Insufficient Authority',
          message: 'Only the designated Teacher Guardian (or HOD) has authority to modify counseling records for this mentee.'
        });
      }
    }
    await query(`
      UPDATE tg_student_mapping
      SET counseling_flag = ?,
          counseling_notes = ?
      WHERE student_id = ?;
    `, [Boolean(counselingFlag), counselingNotes || '', studentId]);

    res.json({ success: true, studentId, counselingFlag });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 5. ROLE 4: CLASS TEACHER DASHBOARD
// ----------------------------------------------------------------------------
app.get('/api/class-teacher/:facultyId/division', enforceRBAC(['CLASS_TEACHER', 'HOD']), async (req, res) => {
  try {
    const facultyId = parseInt(req.params.facultyId, 10);

    // Strict Data Isolation: Class Teacher can only see their own assigned division
    if (req.user.role !== 'HOD' && req.user.id !== facultyId) {
      return res.status(403).json({
        error: 'Forbidden: Insufficient Authority',
        message: 'Class Teachers can only access their own designated division analytics.'
      });
    }

    let divisionId;
    const divCheck = await query(`
      SELECT division_id FROM divisions WHERE class_teacher_faculty_id = ?;
    `, [facultyId]);
    if (divCheck.rows.length > 0) {
      divisionId = divCheck.rows[0].division_id;
    } else if (req.user.role === 'HOD') {
      divisionId = 1; // Default to Division 1 (SE-COMP Div A) for HOD governance
    }

    let divisionSummary = { rows: [] };
    let students = { rows: [] };
    if (divisionId) {
      divisionSummary = await query(`
        SELECT * FROM view_division_attendance_matrix 
        WHERE division_id = ?;
      `, [divisionId]);

      // Roster of students in this division with cumulative attendance
      students = await query(`
        SELECT 
          s.student_id,
          s.roll_number,
          CONCAT(s.first_name, ' ', s.last_name) AS student_name,
          s.email,
          s.phone_number,
          s.parent_phone,
          COUNT(ls.schedule_id) AS total_sessions,
          COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END) AS attended_sessions,
          ROUND(
            COALESCE(
              (COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END) / 
               NULLIF(COUNT(ls.schedule_id), 0)) * 100.0, 
              0.0
            ), 2
          ) AS attendance_pct,
          CASE 
            WHEN (COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END) / 
                  NULLIF(COUNT(ls.schedule_id), 0)) * 100.0 < 75.0 
            THEN TRUE ELSE FALSE 
          END AS is_defaulter
        FROM students s
        JOIN divisions d ON s.division_id = d.division_id
        JOIN course_allocations ca ON ca.division_id = d.division_id
        LEFT JOIN lecture_schedules ls ON ls.allocation_id = ca.allocation_id AND ls.status = 'CONDUCTED'
        LEFT JOIN attendance_records ar ON ar.schedule_id = ls.schedule_id AND ar.student_id = s.student_id
        WHERE d.division_id = ?
        GROUP BY s.student_id, s.roll_number, s.first_name, s.last_name, s.email, s.phone_number, s.parent_phone
        ORDER BY s.roll_number ASC;
      `, [divisionId]);
    }

    res.json({
      summary: divisionSummary.rows[0] || null,
      students: students.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 6. ROLE 5: HEAD OF DEPARTMENT (HOD) EXECUTIVE DASHBOARD
// ----------------------------------------------------------------------------
app.get('/api/hod/:departmentId/dashboard', enforceRBAC(['HOD']), async (req, res) => {
  try {
    const departmentId = parseInt(req.params.departmentId, 10) || 1;

    // Macro Overview
    const overview = await query(`
      SELECT * FROM view_hod_department_overview WHERE department_id = ?;
    `, [departmentId]);

    // Course breakdown
    const courses = await query(`
      SELECT 
        c.course_id,
        c.course_code,
        c.course_name,
        c.lecture_type,
        CONCAT(f.first_name, ' ', f.last_name) AS faculty_name,
        COUNT(DISTINCT CASE WHEN ls.status = 'CONDUCTED' THEN ls.schedule_id END) AS conducted_count,
        ROUND(
          COALESCE(
            AVG(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 100.0 WHEN ar.status = 'ABSENT' THEN 0.0 END), 
            0.0
          ), 2
        ) AS average_attendance_pct
      FROM courses c
      JOIN course_allocations ca ON ca.course_id = c.course_id
      JOIN faculty f ON ca.faculty_id = f.faculty_id
      LEFT JOIN lecture_schedules ls ON ls.allocation_id = ca.allocation_id
      LEFT JOIN attendance_records ar ON ar.schedule_id = ls.schedule_id
      WHERE c.department_id = ?
      GROUP BY c.course_id, c.course_code, c.course_name, c.lecture_type, f.first_name, f.last_name
      ORDER BY c.course_code;
    `, [departmentId]);

    // All 6 departments summary for institute comparison
    const allDepartments = await query(`
      SELECT * FROM view_hod_department_overview ORDER BY department_id;
    `);

    // Top Defaulters in Department
    const defaulters = await query(`
      SELECT 
        s.student_id,
        s.roll_number,
        CONCAT(s.first_name, ' ', s.last_name) AS student_name,
        d.division_name,
        cl.class_level,
        ROUND(
          (COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END) / 
           NULLIF(COUNT(ls.schedule_id), 0)) * 100.0, 2
        ) AS attendance_pct
      FROM students s
      JOIN divisions d ON s.division_id = d.division_id
      JOIN classes cl ON d.class_id = cl.class_id
      JOIN programs p ON cl.program_id = p.program_id
      JOIN course_allocations ca ON ca.division_id = d.division_id
      JOIN lecture_schedules ls ON ls.allocation_id = ca.allocation_id AND ls.status = 'CONDUCTED'
      LEFT JOIN attendance_records ar ON ar.schedule_id = ls.schedule_id AND ar.student_id = s.student_id
      WHERE p.department_id = ?
      GROUP BY s.student_id, s.roll_number, s.first_name, s.last_name, d.division_name, cl.class_level
      HAVING (COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END) / 
              NULLIF(COUNT(ls.schedule_id), 0)) * 100.0 < 75.0
      ORDER BY attendance_pct ASC;
    `, [departmentId]);

    res.json({
      department: overview.rows[0] || null,
      courses: courses.rows,
      allDepartments: allDepartments.rows,
      defaulters: defaulters.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 7. AUDIT TRAIL LOG VIEWER
// ----------------------------------------------------------------------------
app.get('/api/audit-trail', enforceRBAC(['FACULTY']), async (req, res) => {
  try {
    const logs = await query(`
      SELECT 
        aat.audit_id,
        aat.attendance_id,
        aat.schedule_id,
        aat.student_id,
        s.roll_number,
        CONCAT(s.first_name, ' ', s.last_name) AS student_name,
        c.course_code,
        c.course_name,
        ls.lecture_date,
        aat.original_status,
        aat.modified_status,
        CONCAT(f.first_name, ' ', f.last_name) AS modified_by,
        aat.modified_at,
        aat.reason_for_modification
      FROM attendance_audit_trail aat
      JOIN students s ON aat.student_id = s.student_id
      JOIN lecture_schedules ls ON aat.schedule_id = ls.schedule_id
      JOIN course_allocations ca ON ls.allocation_id = ca.allocation_id
      JOIN courses c ON ca.course_id = c.course_id
      JOIN faculty f ON aat.modified_by_faculty_id = f.faculty_id
      ORDER BY aat.modified_at DESC
      LIMIT 100;
    `);

    res.json({ auditTrail: logs.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 8. AUTOMATED ALERTS ENGINE
// ----------------------------------------------------------------------------
app.get('/api/alerts', async (req, res) => {
  try {
    // 1. Students < 75% threshold
    const lowAttendance = await query(`
      SELECT 
        s.student_id,
        s.roll_number,
        CONCAT(s.first_name, ' ', s.last_name) AS student_name,
        s.email,
        d.division_name,
        ROUND(
          (COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END) / 
           NULLIF(COUNT(ls.schedule_id), 0)) * 100.0, 2
        ) AS attendance_pct,
        'ATTENDANCE_DEFICIENCY' AS alert_type,
        'CRITICAL' AS severity
      FROM students s
      JOIN divisions d ON s.division_id = d.division_id
      JOIN course_allocations ca ON ca.division_id = d.division_id
      JOIN lecture_schedules ls ON ls.allocation_id = ca.allocation_id AND ls.status = 'CONDUCTED'
      LEFT JOIN attendance_records ar ON ar.schedule_id = ls.schedule_id AND ar.student_id = s.student_id
      GROUP BY s.student_id, s.roll_number, s.first_name, s.last_name, s.email, d.division_name
      HAVING (COUNT(CASE WHEN ar.status IN ('PRESENT', 'EXCUSED') THEN 1 END) / 
              NULLIF(COUNT(ls.schedule_id), 0)) * 100.0 < 75.0
      ORDER BY attendance_pct ASC;
    `);

    // 2. 3+ Consecutive Absences
    const consecutive = await query(`
      SELECT 
        student_id, roll_number, student_name, course_code, trigger_date,
        alert_message, 'CONSECUTIVE_ABSENCE' AS alert_type, 'HIGH' AS severity
      FROM view_continuous_absence_alerts;
    `);

    res.json({
      defaulterAlerts: lowAttendance.rows,
      consecutiveAbsenceAlerts: consecutive.rows,
      totalAlertsCount: lowAttendance.rows.length + consecutive.rows.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 9. PERFORMANCE BENCHMARK TRIGGER (EXPLAIN ANALYZE)
// ----------------------------------------------------------------------------
app.get('/api/benchmarks/run', enforceRBAC(['FACULTY']), async (req, res) => {
  try {
    const report = await runBenchmark();
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 9.5 ACADEMIC ADMINISTRATION (HOD & ADMIN EXCLUSIVE)
// Direct management of Students, Faculty, Subjects, and Course Allocations
// ----------------------------------------------------------------------------

// 1. Get Administrative Metadata
app.get('/api/admin/metadata', enforceRBAC(['HOD']), async (req, res) => {
  try {
    const departments = await query('SELECT department_id, department_code, department_name FROM departments ORDER BY department_name;');
    const classes = await query(`
      SELECT cl.class_id, cl.class_level, cl.semester, p.program_name, p.department_id, ay.year_label
      FROM classes cl
      JOIN programs p ON cl.program_id = p.program_id
      JOIN academic_years ay ON cl.academic_year_id = ay.academic_year_id
      ORDER BY cl.class_id;
    `);
    const divisions = await query(`
      SELECT d.division_id, d.division_name, d.class_id, d.classroom_number, 
             cl.class_level, p.department_id, dept.department_code
      FROM divisions d
      JOIN classes cl ON d.class_id = cl.class_id
      JOIN programs p ON cl.program_id = p.program_id
      JOIN departments dept ON p.department_id = dept.department_id
      ORDER BY d.division_id;
    `);
    const faculty = await query(`
      SELECT f.faculty_id, f.employee_code, CONCAT(f.first_name, ' ', f.last_name) AS full_name,
             CONCAT(f.first_name, ' ', f.last_name) AS name,
             f.designation, f.department_id, dept.department_code
      FROM faculty f
      JOIN departments dept ON f.department_id = dept.department_id
      WHERE f.is_active = TRUE
      ORDER BY f.first_name;
    `);
    const courses = await query(`
      SELECT course_id, course_code, course_name, lecture_type, lecture_type AS course_type
      FROM courses
      ORDER BY course_code;
    `);
    const academicYears = await query('SELECT academic_year_id, year_label, is_current FROM academic_years;');

    res.json({
      departments: departments.rows,
      classes: classes.rows,
      divisions: divisions.rows,
      faculty: faculty.rows,
      courses: courses.rows,
      academicYears: academicYears.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Add New Student (Done by HOD only)
app.post('/api/admin/students', enforceRBAC(['HOD']), async (req, res) => {
  const { prn, rollNumber, firstName, lastName, email, phoneNumber, parentPhone, divisionId, password } = req.body;

  if (!prn || !rollNumber || !firstName || !lastName || !email || !divisionId) {
    return res.status(400).json({ error: 'Missing required student fields: PRN, Roll Number, First Name, Last Name, Email, and Division are required.' });
  }

  try {
    const result = await withTransaction(async (db) => {
      // 1. Insert into students table
      const insertStd = await db.query(`
        INSERT INTO students (prn, roll_number, first_name, last_name, email, phone_number, parent_phone, division_id, admission_year, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, YEAR(CURDATE()), TRUE);
      `, [
        prn.trim(),
        parseInt(rollNumber, 10),
        firstName.trim(),
        lastName.trim(),
        email.trim().toLowerCase(),
        phoneNumber ? phoneNumber.trim() : '9876543210',
        parentPhone ? parentPhone.trim() : '9876543211',
        parseInt(divisionId, 10)
      ]);

      const studentId = insertStd.rows.insertId;

      // 2. Automatically generate login credential for the student
      const username = firstName.trim().toLowerCase();
      const pwd = (password && password.trim()) ? password.trim() : `${username}123`;
      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      // Get department_id for this division
      const divDept = await db.query(`
        SELECT p.department_id 
        FROM divisions d
        JOIN classes cl ON d.class_id = cl.class_id
        JOIN programs p ON cl.program_id = p.program_id
        WHERE d.division_id = ?;
      `, [divisionId]);
      const deptId = divDept.rows[0]?.department_id || 1;

      await db.query(`
        INSERT INTO user_credentials (username, password_hash, role, display_name, email, student_id, faculty_id, department_id)
        VALUES (?, ?, 'STUDENT', ?, ?, ?, NULL, ?)
        ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), student_id = VALUES(student_id);
      `, [username, pwd, fullName, email.trim().toLowerCase(), studentId, deptId]);

      return {
        success: true,
        message: `Student '${fullName}' (PRN: ${prn}) registered successfully by HOD. Login account: '${username}'`,
        studentId,
        username,
        initialPassword: pwd
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error adding student:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      const msg = error.sqlMessage || '';
      const field = msg.includes('prn') ? 'PRN' : msg.includes('email') ? 'Email' : msg.includes('roll_number') ? 'Roll Number' : 'record';
      return res.status(400).json({ error: `A student with this ${field} already exists.` });
    }
    res.status(500).json({ error: error.message, sqlMessage: error.sqlMessage });
  }
});

// 3. List Students
app.get('/api/admin/students', enforceRBAC(['HOD']), async (req, res) => {
  try {
    const studentsRes = await query(`
      SELECT s.student_id, s.prn, s.roll_number, s.first_name, s.last_name, s.email, 
             s.phone_number, s.is_active, d.division_id, d.division_name, 
             cl.class_level, cl.semester, dept.department_code, dept.department_name
      FROM students s
      JOIN divisions d ON s.division_id = d.division_id
      JOIN classes cl ON d.class_id = cl.class_id
      JOIN programs p ON cl.program_id = p.program_id
      JOIN departments dept ON p.department_id = dept.department_id
      ORDER BY s.student_id DESC;
    `);
    res.json(studentsRes.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Delete Student (HOD Only)
app.delete('/api/admin/students/:studentId', enforceRBAC(['HOD']), async (req, res) => {
  const studentId = parseInt(req.params.studentId, 10);
  try {
    await withTransaction(async (db) => {
      await db.query('DELETE FROM attendance_records WHERE student_id = ?;', [studentId]);
      await db.query('DELETE FROM tg_student_mapping WHERE student_id = ?;', [studentId]);
      await db.query('DELETE FROM user_credentials WHERE student_id = ?;', [studentId]);
      await db.query('DELETE FROM students WHERE student_id = ?;', [studentId]);
    });
    res.json({ success: true, message: `Student #${studentId} deleted successfully by HOD.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Add New Faculty (Done by HOD only)
app.post('/api/admin/faculty', enforceRBAC(['HOD']), async (req, res) => {
  const { employeeCode, firstName, lastName, email, phoneNumber, designation, departmentId, qualification, password } = req.body;

  if (!employeeCode || !firstName || !lastName || !email || !departmentId || !designation) {
    return res.status(400).json({ error: 'Missing required faculty fields: Employee Code, Name, Email, Designation, Department.' });
  }

  try {
    const result = await withTransaction(async (db) => {
      const insertFac = await db.query(`
        INSERT INTO faculty (employee_code, first_name, last_name, email, phone_number, department_id, designation, qualification, joining_date, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), TRUE);
      `, [
        employeeCode.trim(),
        firstName.trim(),
        lastName.trim(),
        email.trim().toLowerCase(),
        phoneNumber ? phoneNumber.trim() : '9876500000',
        parseInt(departmentId, 10),
        designation.trim(),
        qualification ? qualification.trim() : 'M.Tech / Ph.D. in Engineering'
      ]);

      const facultyId = insertFac.rows.insertId;
      const username = firstName.trim().toLowerCase();
      const pwd = (password && password.trim()) ? password.trim() : `${username}123`;
      const prefix = designation === 'HOD' ? 'Dr.' : 'Prof.';
      const fullName = `${prefix} ${firstName.trim()} ${lastName.trim()}`;
      const role = designation === 'HOD' ? 'HOD' : 'COURSE_TEACHER';

      await db.query(`
        INSERT INTO user_credentials (username, password_hash, role, display_name, email, student_id, faculty_id, department_id)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
        ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), faculty_id = VALUES(faculty_id);
      `, [username, pwd, role, fullName, email.trim().toLowerCase(), facultyId, parseInt(departmentId, 10)]);

      return {
        success: true,
        message: `Faculty '${fullName}' (${employeeCode}) added successfully by HOD. Login: '${username}'`,
        facultyId,
        username,
        initialPassword: pwd
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error adding faculty:', error);
    res.status(500).json({ error: error.message, sqlMessage: error.sqlMessage });
  }
});

// 6. List Faculty
app.get('/api/admin/faculty', enforceRBAC(['HOD']), async (req, res) => {
  try {
    const facultyRes = await query(`
      SELECT f.faculty_id, f.employee_code, f.first_name, f.last_name, f.email, 
             f.phone_number, f.designation, f.qualification, f.is_active,
             dept.department_id, dept.department_code, dept.department_name
      FROM faculty f
      JOIN departments dept ON f.department_id = dept.department_id
      ORDER BY f.faculty_id DESC;
    `);
    res.json(facultyRes.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Delete Faculty (HOD Only)
app.delete('/api/admin/faculty/:facultyId', enforceRBAC(['HOD']), async (req, res) => {
  const facultyId = parseInt(req.params.facultyId, 10);
  try {
    await withTransaction(async (db) => {
      await db.query('DELETE FROM user_credentials WHERE faculty_id = ?;', [facultyId]);
      await db.query('UPDATE lecture_schedules SET substitute_faculty_id = NULL WHERE substitute_faculty_id = ?;', [facultyId]);
      await db.query('DELETE FROM course_allocations WHERE faculty_id = ?;', [facultyId]);
      await db.query('DELETE FROM faculty WHERE faculty_id = ?;', [facultyId]);
    });
    res.json({ success: true, message: `Faculty #${facultyId} removed successfully by HOD.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Add New Course / Subject (HOD Only)
app.post('/api/admin/courses', enforceRBAC(['HOD']), async (req, res) => {
  const { courseCode, courseName, departmentId, semester, lectureType, credits, weeklyHours } = req.body;

  if (!courseCode || !courseName || !departmentId || !semester) {
    return res.status(400).json({ error: 'Missing required course fields: Course Code, Course Name, Department, Semester.' });
  }

  try {
    const insertRes = await query(`
      INSERT INTO courses (course_code, course_name, department_id, semester, lecture_type, credits, weekly_hours)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `, [
      courseCode.trim().toUpperCase(),
      courseName.trim(),
      parseInt(departmentId, 10),
      parseInt(semester, 10),
      lectureType || 'THEORY',
      parseFloat(credits || 4.0),
      parseInt(weeklyHours || 4, 10)
    ]);

    res.json({
      success: true,
      message: `Course '${courseCode.trim().toUpperCase()} - ${courseName.trim()}' added successfully to catalog.`,
      courseId: insertRes.rows.insertId
    });
  } catch (error) {
    console.error('Error adding course:', error);
    res.status(500).json({ error: error.message, sqlMessage: error.sqlMessage });
  }
});

// 9. List Courses
app.get('/api/admin/courses', enforceRBAC(['HOD']), async (req, res) => {
  try {
    const coursesRes = await query(`
      SELECT c.*, dept.department_code, dept.department_name
      FROM courses c
      JOIN departments dept ON c.department_id = dept.department_id
      ORDER BY c.course_id DESC;
    `);
    res.json(coursesRes.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Allocate Course to Faculty & Division (HOD Only)
app.post('/api/admin/allocations', enforceRBAC(['HOD']), async (req, res) => {
  const { courseId, facultyId, divisionId, academicYearId } = req.body;

  if (!courseId || !facultyId || !divisionId) {
    return res.status(400).json({ error: 'courseId, facultyId, and divisionId are required.' });
  }

  try {
    const result = await withTransaction(async (db) => {
      let ayId = academicYearId;
      if (!ayId) {
        const ayRes = await db.query('SELECT academic_year_id FROM academic_years WHERE is_current = TRUE LIMIT 1;');
        ayId = ayRes.rows[0]?.academic_year_id || 1;
      }

      const insertAlloc = await db.query(`
        INSERT INTO course_allocations (course_id, faculty_id, division_id, academic_year_id)
        VALUES (?, ?, ?, ?);
      `, [parseInt(courseId, 10), parseInt(facultyId, 10), parseInt(divisionId, 10), parseInt(ayId, 10)]);

      const allocationId = insertAlloc.rows.insertId;

      // Automatically create a few initial upcoming lecture schedule slots for this allocation
      const today = new Date();
      for (let i = 1; i <= 3; i++) {
        const slotDate = new Date(today);
        slotDate.setDate(today.getDate() + i);
        const dateStr = slotDate.toISOString().slice(0, 10);
        await db.query(`
          INSERT INTO lecture_schedules (allocation_id, lecture_date, slot_number, start_time, end_time, room_number, status)
          VALUES (?, ?, ?, '10:00', '11:00', 'Room A-201', 'SCHEDULED');
        `, [allocationId, dateStr, (i % 6) + 1]);
      }

      return {
        success: true,
        message: 'Course successfully allocated to faculty & division with initial schedule slots created.',
        allocationId
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error allocating course:', error);
    res.status(500).json({ error: error.message, sqlMessage: error.sqlMessage });
  }
});

// 11. List Allocations
app.get('/api/admin/allocations', enforceRBAC(['HOD']), async (req, res) => {
  try {
    const allocsRes = await query(`
      SELECT ca.allocation_id, ca.course_id, ca.faculty_id, ca.division_id,
             c.course_code, c.course_name, c.lecture_type,
             CONCAT(f.first_name, ' ', f.last_name) AS faculty_name,
             f.employee_code,
             d.division_name, cl.class_level, dept.department_code
      FROM course_allocations ca
      JOIN courses c ON ca.course_id = c.course_id
      JOIN faculty f ON ca.faculty_id = f.faculty_id
      JOIN divisions d ON ca.division_id = d.division_id
      JOIN classes cl ON d.class_id = cl.class_id
      JOIN programs p ON cl.program_id = p.program_id
      JOIN departments dept ON p.department_id = dept.department_id
      ORDER BY ca.allocation_id DESC;
    `);
    res.json(allocsRes.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 12. Delete Course Allocation (HOD Only)
app.delete('/api/admin/allocations/:allocationId', enforceRBAC(['HOD']), async (req, res) => {
  const allocationId = parseInt(req.params.allocationId, 10);
  try {
    await withTransaction(async (db) => {
      await db.query(`
        DELETE ar FROM attendance_records ar
        JOIN lecture_schedules ls ON ar.schedule_id = ls.schedule_id
        WHERE ls.allocation_id = ?;
      `, [allocationId]);
      await db.query('DELETE FROM lecture_schedules WHERE allocation_id = ?;', [allocationId]);
      await db.query('DELETE FROM course_allocations WHERE allocation_id = ?;', [allocationId]);
    });
    res.json({ success: true, message: `Course allocation #${allocationId} deleted successfully.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------------------------------
// 10. DIRECT DATABASE MANAGEMENT & SQL WORKBENCH (FULL MYSQL CRUD)
// ----------------------------------------------------------------------------

// Helper to validate table name against amms tables
async function validateTableName(tableName) {
  const res = await query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
    ['amms', tableName]
  );
  return res.rows.length > 0;
}

// 10.1 List all tables with live row counts, engine, and comments
app.get('/api/db/tables', enforceRBAC(['FACULTY']), async (req, res) => {
  try {
    const tablesRes = await query(`
      SELECT 
        TABLE_NAME AS tableName,
        TABLE_TYPE AS tableType,
        ENGINE AS engine,
        TABLE_ROWS AS estimatedRows,
        DATA_LENGTH AS dataLength,
        INDEX_LENGTH AS indexLength,
        CREATE_TIME AS createTime,
        TABLE_COMMENT AS comment
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = 'amms' 
      ORDER BY TABLE_TYPE, TABLE_NAME;
    `);

    // For base tables, fetch exact COUNT(*) for precise GUI display
    const tablesWithExactCounts = await Promise.all(
      tablesRes.rows.map(async (t) => {
        if (t.tableType === 'BASE TABLE') {
          try {
            const countRes = await query("SELECT COUNT(*) AS exactCount FROM `" + t.tableName + "`");
            return {
              ...t,
              rowCount: countRes.rows[0].exactCount
            };
          } catch (e) {
            return { ...t, rowCount: t.estimatedRows };
          }
        }
        return { ...t, rowCount: t.estimatedRows };
      })
    );

    res.json({
      database: 'amms',
      engine: 'MySQL 8.0 InnoDB',
      tables: tablesWithExactCounts
    });
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ error: error.message });
  }
});

// 10.2 Get schema for a specific table
app.get('/api/db/tables/:tableName/schema', enforceRBAC(['FACULTY']), async (req, res) => {
  const { tableName } = req.params;
  try {
    const isValid = await validateTableName(tableName);
    if (!isValid) {
      return res.status(404).json({ error: `Table '${tableName}' not found in database 'amms'` });
    }

    const columnsRes = await query(`
      SELECT 
        COLUMN_NAME AS columnName,
        DATA_TYPE AS dataType,
        COLUMN_TYPE AS columnType,
        IS_NULLABLE AS isNullable,
        COLUMN_KEY AS columnKey,
        COLUMN_DEFAULT AS columnDefault,
        EXTRA AS extra,
        ORDINAL_POSITION AS ordinalPosition,
        COLUMN_COMMENT AS comment
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'amms' AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION;
    `, [tableName]);

    // Foreign keys
    const fkRes = await query(`
      SELECT 
        COLUMN_NAME AS columnName,
        REFERENCED_TABLE_NAME AS referencedTable,
        REFERENCED_COLUMN_NAME AS referencedColumn
      FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = 'amms' AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL;
    `, [tableName]);

    const primaryKeyCol = columnsRes.rows.find(c => c.columnKey === 'PRI')?.columnName || null;

    res.json({
      tableName,
      primaryKey: primaryKeyCol,
      columns: columnsRes.rows,
      foreignKeys: fkRes.rows
    });
  } catch (error) {
    console.error('Error fetching table schema:', error);
    res.status(500).json({ error: error.message });
  }
});

// 10.3 Get paginated table rows with optional search & sorting
app.get('/api/db/tables/:tableName/data', enforceRBAC(['FACULTY']), async (req, res) => {
  const { tableName } = req.params;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 15));
  const search = req.query.search ? req.query.search.trim() : '';
  const sortCol = req.query.sortCol || '';
  const sortDir = (req.query.sortDir || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  try {
    const isValid = await validateTableName(tableName);
    if (!isValid) {
      return res.status(404).json({ error: `Table '${tableName}' not found in database 'amms'` });
    }

    const columnsRes = await query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_KEY, COLUMN_TYPE
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'amms' AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION;
    `, [tableName]);

    const validColNames = columnsRes.rows.map(c => c.COLUMN_NAME);
    const primaryKey = columnsRes.rows.find(c => c.COLUMN_KEY === 'PRI')?.COLUMN_NAME || validColNames[0];

    // Build WHERE clause for search
    let whereSql = '';
    const params = [];
    if (search) {
      const textCols = columnsRes.rows.filter(c => 
        ['varchar', 'char', 'text', 'mediumtext', 'enum'].includes(c.DATA_TYPE.toLowerCase()) ||
        ['int', 'bigint', 'tinyint'].includes(c.DATA_TYPE.toLowerCase())
      );
      if (textCols.length > 0) {
        const searchConditions = textCols.map(c => `\`${c.COLUMN_NAME}\` LIKE ?`);
        whereSql = ` WHERE (${searchConditions.join(' OR ')})`;
        const wildCard = `%${search}%`;
        textCols.forEach(() => params.push(wildCard));
      }
    }

    // Total count query
    const countSql = `SELECT COUNT(*) AS total FROM \`${tableName}\`${whereSql}`;
    const countRes = await query(countSql, params);
    const totalRows = countRes.rows[0].total;

    // Sorting
    let orderBySql = '';
    if (sortCol && validColNames.includes(sortCol)) {
      orderBySql = ` ORDER BY \`${sortCol}\` ${sortDir}`;
    } else if (primaryKey) {
      orderBySql = ` ORDER BY \`${primaryKey}\` DESC`;
    }

    // Rows query with integer limit/offset
    const offset = (page - 1) * pageSize;
    const dataSql = `SELECT * FROM \`${tableName}\`${whereSql}${orderBySql} LIMIT ${parseInt(pageSize, 10)} OFFSET ${parseInt(offset, 10)}`;
    const dataRes = await query(dataSql, params);

    res.json({
      tableName,
      primaryKey,
      columns: columnsRes.rows,
      page,
      pageSize,
      totalRows,
      totalPages: Math.ceil(totalRows / pageSize) || 1,
      rows: dataRes.rows
    });
  } catch (error) {
    console.error('Error fetching table data:', error);
    res.status(500).json({ error: error.message });
  }
});

// 10.4 Insert a new record into any table in MySQL (Faculty authority only)
app.post('/api/db/tables/:tableName/rows', enforceRBAC(['FACULTY']), async (req, res) => {
  const { tableName } = req.params;
  const rowData = req.body;

  try {
    const isValid = await validateTableName(tableName);
    if (!isValid) {
      return res.status(404).json({ error: `Table '${tableName}' not found in database 'amms'` });
    }

    const columnsRes = await query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'amms' AND TABLE_NAME = ?;
    `, [tableName]);

    const validCols = new Set(columnsRes.rows.map(c => c.COLUMN_NAME));
    const autoIncCols = new Set(columnsRes.rows.filter(c => c.EXTRA.includes('auto_increment')).map(c => c.COLUMN_NAME));

    const insertCols = [];
    const insertVals = [];
    const placeholders = [];

    for (const [key, val] of Object.entries(rowData)) {
      if (validCols.has(key) && !autoIncCols.has(key)) {
        insertCols.push(`\`${key}\``);
        if (val === '' || val === null || val === undefined) {
          const colMeta = columnsRes.rows.find(c => c.COLUMN_NAME === key);
          if (colMeta && colMeta.IS_NULLABLE === 'YES') {
            insertVals.push(null);
          } else if (colMeta && colMeta.COLUMN_DEFAULT !== null) {
            insertVals.push(colMeta.COLUMN_DEFAULT);
          } else {
            insertVals.push(val === '' ? '' : null);
          }
        } else {
          insertVals.push(val);
        }
        placeholders.push('?');
      }
    }

    if (insertCols.length === 0) {
      return res.status(400).json({ error: 'No valid columns provided for insertion' });
    }

    const insertSql = `INSERT INTO \`${tableName}\` (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const [result] = await getPool().query(insertSql, insertVals);

    res.json({
      success: true,
      message: `Record successfully inserted into MySQL table '${tableName}'`,
      insertId: result.insertId,
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Error inserting row:', error);
    res.status(500).json({ error: error.message, sqlMessage: error.sqlMessage });
  }
});

// 10.5 Update an existing record in any table in MySQL (Faculty authority only)
app.put('/api/db/tables/:tableName/rows/:id', enforceRBAC(['FACULTY']), async (req, res) => {
  const { tableName, id } = req.params;
  const rowData = req.body;

  try {
    const isValid = await validateTableName(tableName);
    if (!isValid) {
      return res.status(404).json({ error: `Table '${tableName}' not found in database 'amms'` });
    }

    const columnsRes = await query(`
      SELECT COLUMN_NAME, COLUMN_KEY, DATA_TYPE, IS_NULLABLE
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'amms' AND TABLE_NAME = ?;
    `, [tableName]);

    const primaryKeyCol = columnsRes.rows.find(c => c.COLUMN_KEY === 'PRI')?.COLUMN_NAME;
    if (!primaryKeyCol) {
      return res.status(400).json({ error: `Table '${tableName}' has no primary key defined` });
    }

    const validCols = new Set(columnsRes.rows.map(c => c.COLUMN_NAME));
    const setClauses = [];
    const values = [];

    for (const [key, val] of Object.entries(rowData)) {
      if (validCols.has(key) && key !== primaryKeyCol) {
        setClauses.push(`\`${key}\` = ?`);
        if (val === '' || val === null || val === undefined) {
          const colMeta = columnsRes.rows.find(c => c.COLUMN_NAME === key);
          values.push(colMeta && colMeta.IS_NULLABLE === 'YES' ? null : (val === '' ? '' : val));
        } else {
          values.push(val);
        }
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No updatable columns provided' });
    }

    values.push(id);
    const updateSql = `UPDATE \`${tableName}\` SET ${setClauses.join(', ')} WHERE \`${primaryKeyCol}\` = ?`;
    const [result] = await getPool().query(updateSql, values);

    res.json({
      success: true,
      message: `Record #${id} in MySQL table '${tableName}' updated successfully`,
      affectedRows: result.affectedRows,
      changedRows: result.changedRows
    });
  } catch (error) {
    console.error('Error updating row:', error);
    res.status(500).json({ error: error.message, sqlMessage: error.sqlMessage });
  }
});

// 10.6 Delete a record from any table in MySQL (Faculty authority only)
app.delete('/api/db/tables/:tableName/rows/:id', enforceRBAC(['FACULTY']), async (req, res) => {
  const { tableName, id } = req.params;

  try {
    const isValid = await validateTableName(tableName);
    if (!isValid) {
      return res.status(404).json({ error: `Table '${tableName}' not found in database 'amms'` });
    }

    const columnsRes = await query(`
      SELECT COLUMN_NAME, COLUMN_KEY 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = 'amms' AND TABLE_NAME = ? AND COLUMN_KEY = 'PRI';
    `, [tableName]);

    const primaryKeyCol = columnsRes.rows[0]?.COLUMN_NAME;
    if (!primaryKeyCol) {
      return res.status(400).json({ error: `Table '${tableName}' has no primary key defined` });
    }

    const deleteSql = `DELETE FROM \`${tableName}\` WHERE \`${primaryKeyCol}\` = ?`;
    const [result] = await getPool().query(deleteSql, [id]);

    res.json({
      success: true,
      message: `Record #${id} deleted from MySQL table '${tableName}'`,
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Error deleting row:', error);
    res.status(500).json({ error: error.message, sqlMessage: error.sqlMessage });
  }
});

// 10.7 Interactive SQL Console / Workbench Execution (Faculty authority only)
app.post('/api/db/execute-sql', enforceRBAC(['FACULTY']), async (req, res) => {
  const { sql } = req.body;

  if (!sql || typeof sql !== 'string' || !sql.trim()) {
    return res.status(400).json({ error: 'SQL query string is required' });
  }

  const trimmedSql = sql.trim();
  const startTime = process.hrtime.bigint();

  try {
    const p = getPool();
    const [result, fields] = await p.query(trimmedSql);
    const endTime = process.hrtime.bigint();
    const durationMs = Number((endTime - startTime) / 1000000n);

    if (Array.isArray(result)) {
      // SELECT, SHOW, DESCRIBE, EXPLAIN
      const fieldNames = fields ? fields.map(f => f.name) : (result.length > 0 ? Object.keys(result[0]) : []);
      res.json({
        success: true,
        commandType: 'SELECT',
        rowCount: result.length,
        rows: result,
        fields: fieldNames,
        durationMs
      });
    } else {
      // INSERT, UPDATE, DELETE, ALTER, CREATE, DROP
      res.json({
        success: true,
        commandType: 'DML',
        affectedRows: result.affectedRows || 0,
        insertId: result.insertId || null,
        changedRows: result.changedRows || 0,
        message: result.message || 'SQL executed successfully against MySQL 8.0 InnoDB',
        durationMs
      });
    }
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const durationMs = Number((endTime - startTime) / 1000000n);

    res.status(400).json({
      success: false,
      error: error.message,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      durationMs
    });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(`  AMMS Production Server Running at: http://localhost:${PORT}`);
  console.log(`  Role-Based Access Control (RBAC): ENABLED (5 User Roles)`);
  console.log(`  Database: MySQL 8.0 (InnoDB Engine with ACID & Redo/Undo)`);
  console.log(`=============================================================`);
});
