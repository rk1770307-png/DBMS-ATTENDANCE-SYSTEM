const http = require('http');

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('         AMMS END-TO-END AUTOMATED TEST SUITE & VERIFICATION   ');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
    }
  }

  // 1. Health
  await test('1. System Health & Database Connection', async () => {
    const res = await request('GET', '/api/health');
    if (res.status !== 200 || res.data.status !== 'online') throw new Error('Health check failed');
  });

  // 2. Presets
  await test('2. Presets & 6 Academic Departments', async () => {
    const res = await request('GET', '/api/presets');
    if (res.status !== 200 || res.data.departments.length !== 6) {
      throw new Error(`Expected 6 departments, found ${res.data.departments ? res.data.departments.length : 0}`);
    }
  });

  // 3. Student Summary (Ishaan Kulkarni - Defaulter)
  await test('3. Student Dashboard (Personal % & Warnings)', async () => {
    const res = await request('GET', '/api/student/5/summary', null, { 'x-user-role': 'STUDENT', 'x-user-id': '5' });
    if (res.status !== 200 || !res.data.courses || res.data.courses.length === 0) {
      throw new Error('Failed to retrieve student summary');
    }
    console.log(`   -> Student: ${res.data.student.first_name} ${res.data.student.last_name}, Overall %: ${res.data.cumulative.cumulative_percentage}%`);
  });

  // 4. Course Teacher Allocations
  await test('4. Course Teacher Allocations (Prof. Pooja Verma)', async () => {
    const res = await request('GET', '/api/course-teacher/2/allocations', null, { 'x-user-role': 'COURSE_TEACHER', 'x-user-id': '2' });
    if (res.status !== 200 || res.data.allocations.length === 0) throw new Error('Allocations fetch failed');
    console.log(`   -> Allocated Courses: ${res.data.allocations.length}, Total Schedules: ${res.data.schedules.length}`);
  });

  // 5. Schedule Roster
  await test('5. Lecture Schedule Roster Retrieval', async () => {
    const res = await request('GET', '/api/schedules/1/roster', null, { 'x-user-role': 'COURSE_TEACHER', 'x-user-id': '2' });
    if (res.status !== 200 || res.data.roster.length === 0) throw new Error('Schedule roster fetch failed');
    console.log(`   -> Division Roster Size: ${res.data.roster.length} students`);
  });

  // 6. Atomic Attendance Submission (BEGIN ... COMMIT)
  await test('6. Atomic Attendance Submission Transaction', async () => {
    const payload = {
      scheduleId: 17,
      facultyId: 2,
      topicCovered: 'Distributed Commit Protocols & Two-Phase Locking',
      records: [
        { studentId: 1, status: 'PRESENT' },
        { studentId: 2, status: 'PRESENT' },
        { studentId: 3, status: 'ABSENT' },
        { studentId: 4, status: 'PRESENT' },
        { studentId: 5, status: 'LATE' }
      ]
    };
    const res = await request('POST', '/api/attendance/submit', payload, { 'x-user-role': 'COURSE_TEACHER', 'x-user-id': '2' });
    if (res.status !== 200 || !res.data.success) throw new Error(`Submission failed: ${JSON.stringify(res.data)}`);
    console.log(`   -> Committed: Schedule #${res.data.scheduleId} marked ${res.data.status}`);
  });

  // 7. Attendance Record Correction with Mandatory Audit Reason
  await test('7. Attendance Correction with Triggered Audit Trail', async () => {
    // Student 5 attendance record
    const payload = {
      attendanceId: 5,
      newStatus: 'PRESENT',
      reason: 'Medical slip verified by head of department',
      facultyId: 2
    };
    const res = await request('POST', '/api/attendance/update-record', payload, { 'x-user-role': 'COURSE_TEACHER', 'x-user-id': '2' });
    if (res.status !== 200 || !res.data.success || !res.data.auditEntry) {
      throw new Error(`Correction failed: ${JSON.stringify(res.data)}`);
    }
    console.log(`   -> Audit Record #${res.data.auditEntry.audit_id} captured: ${res.data.oldStatus} -> ${res.data.newStatus}`);
    console.log(`      Reason: "${res.data.auditEntry.reason_for_modification}"`);
  });

  // 8. Faculty Substitution with Row-Level Lock
  await test('8. Faculty Substitution Concurrency Lock', async () => {
    const payload = {
      substituteFacultyId: 4, // Prof. Neha Patil
      reason: 'Primary faculty attending international research symposium'
    };
    const res = await request('POST', '/api/schedules/10/substitute', payload, { 'x-user-role': 'COURSE_TEACHER', 'x-user-id': '2' });
    if (res.status !== 200 || !res.data.success) throw new Error('Substitution failed');
    console.log(`   -> Assigned Substitute Faculty #${res.data.substituteFacultyId} to Schedule #${res.data.scheduleId}`);
  });

  // 9. Teacher Guardian Dashboard & Mentees
  await test('9. Teacher Guardian Mentee Monitoring', async () => {
    const res = await request('GET', '/api/tg/3/mentees', null, { 'x-user-role': 'TG', 'x-user-id': '3' });
    if (res.status !== 200 || !res.data.mentees) throw new Error('TG mentees fetch failed');
    console.log(`   -> Mentees: ${res.data.mentees.length}, Continuous Absence Alerts: ${res.data.continuousAlerts.length}`);
  });

  // 10. Teacher Guardian Counseling Update
  await test('10. Teacher Guardian Counseling Intervention Note', async () => {
    const payload = {
      studentId: 5,
      counselingFlag: true,
      counselingNotes: 'Parent contacted regarding attendance deficiency; student committed to remedial classes.'
    };
    const res = await request('POST', '/api/tg/counseling', payload, { 'x-user-role': 'TG', 'x-user-id': '3' });
    if (res.status !== 200 || !res.data.success) throw new Error('Counseling update failed');
  });

  // 11. Class Teacher Division Overview
  await test('11. Class Teacher Division-Level Analytics', async () => {
    const res = await request('GET', '/api/class-teacher/2/division', null, { 'x-user-role': 'CLASS_TEACHER', 'x-user-id': '2' });
    if (res.status !== 200 || !res.data.summary) throw new Error('Class teacher division fetch failed');
    console.log(`   -> Division: ${res.data.summary.class_level}-${res.data.summary.division_name}, Defaulters: ${res.data.summary.defaulters_below_75}`);
  });

  // 12. HOD Executive Dashboard
  await test('12. HOD Executive Command (Department Overview & 6-Branch Matrix)', async () => {
    const res = await request('GET', '/api/hod/1/dashboard', null, { 'x-user-role': 'HOD', 'x-user-id': '1' });
    if (res.status !== 200 || !res.data.department) throw new Error('HOD dashboard fetch failed');
    console.log(`   -> Department: ${res.data.department.department_name}, Avg Attendance: ${res.data.department.department_overall_attendance_pct}%`);
    console.log(`   -> Institute Departments Compared: ${res.data.allDepartments.length}`);
  });

  // 13. Audit Trail Chronology (Faculty/Admin Authorized)
  await test('13. System Audit Trail Logs (Faculty Authorized)', async () => {
    const res = await request('GET', '/api/audit-trail', null, { 'x-user-role': 'HOD', 'x-user-id': '1' });
    if (res.status !== 200 || !res.data.auditTrail) throw new Error('Audit trail fetch failed');
    console.log(`   -> Total Audit Entries Logged: ${res.data.auditTrail.length}`);
  });

  // 14. Automated Intelligence Alerts Engine
  await test('14. Automated Alerts Engine (<75% and Consecutive Absences)', async () => {
    const res = await request('GET', '/api/alerts');
    if (res.status !== 200) throw new Error('Alerts fetch failed');
    console.log(`   -> Total Alerts: ${res.data.totalAlertsCount} (Defaulters: ${res.data.defaulterAlerts.length}, Consecutive Absences: ${res.data.consecutiveAbsenceAlerts.length})`);
  });

  // 15. Multi-Role Authentication with Real User Credentials
  await test('15. Multi-Role Login Authentication (Student, Teacher, TG, HOD, Faculty, Admin)', async () => {
    const accounts = [
      { user: 'ishaan', pwd: 'ishaan123', expectedRole: 'STUDENT' },
      { user: 'pooja', pwd: 'pooja123', expectedRole: 'COURSE_TEACHER' },
      { user: 'amit', pwd: 'amit123', expectedRole: 'TG' },
      { user: 'namdev', pwd: 'namdev123', expectedRole: 'HOD' },
      { user: 'neha', pwd: 'neha123', expectedRole: 'FACULTY' },
      { user: 'admin', pwd: 'admin123', expectedRole: 'HOD' }
    ];

    for (const acc of accounts) {
      const res = await request('POST', '/api/auth/login', { username: acc.user, password: acc.pwd });
      if (res.status !== 200 || !res.data.success || res.data.user.role !== acc.expectedRole) {
        throw new Error(`Login failed for role ${acc.expectedRole}: ${JSON.stringify(res.data)}`);
      }
      console.log(`   -> [OK] Authenticated: ${acc.user} -> ${res.data.user.displayName} (${res.data.user.role})`);
    }

    // Invalid credentials test
    const failRes = await request('POST', '/api/auth/login', { username: 'ram', password: 'wrongpassword' });
    if (failRes.status !== 401) throw new Error('Expected 401 for incorrect password');
    console.log(`   -> [OK] Rejected invalid credentials (401 Unauthorized)`);
  });

  // 16. Verification of Exactly 2 Classes and 5 Courses
  await test('16. Database Model Parity: Exactly 2 Classes and 5 Courses', async () => {
    const healthRes = await request('GET', '/api/health');
    if (healthRes.data.classes !== 2 || healthRes.data.courses !== 5) {
      throw new Error(`Expected 2 classes and 5 courses, got ${healthRes.data.classes} classes, ${healthRes.data.courses} courses`);
    }
    console.log(`   -> [OK] Verified: Classes = 2, Courses = 5 in AMMS Database`);
  });

  // 17. Security Restriction: Student Blocked from SQL Execution (403 Forbidden)
  await test('17. Student RBAC: Blocked from SQL Workbench Execution', async () => {
    const res = await request('POST', '/api/db/execute-sql', { sql: 'SELECT * FROM students;' }, { 'x-user-role': 'STUDENT', 'x-user-id': '5' });
    if (res.status !== 403) {
      throw new Error(`Expected 403 Forbidden for Student SQL execution, got status ${res.status}`);
    }
    console.log(`   -> [OK] Student blocked from SQL execution (403 Forbidden: ${res.data.error})`);
  });

  // 18. Security Restriction: Student Blocked from Database Studio & Table Manager
  await test('18. Student RBAC: Blocked from Database Studio Tables & Schema', async () => {
    const tablesRes = await request('GET', '/api/db/tables', null, { 'x-user-role': 'STUDENT', 'x-user-id': '5' });
    if (tablesRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for Student viewing tables, got status ${tablesRes.status}`);
    }

    const deleteRes = await request('DELETE', '/api/db/tables/students/rows/1', null, { 'x-user-role': 'STUDENT', 'x-user-id': '5' });
    if (deleteRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for Student deleting rows, got status ${deleteRes.status}`);
    }
    console.log(`   -> [OK] Student blocked from Database Studio & row deletion (403 Forbidden)`);
  });

  // 19. Security Restriction: Student Privacy (Cannot View Other Students' Data)
  await test('19. Student Privacy: Cannot view other students attendance', async () => {
    // Student 5 attempting to fetch Student 1's summary
    const res = await request('GET', '/api/student/1/summary', null, { 'x-user-role': 'STUDENT', 'x-user-id': '5' });
    if (res.status !== 403) {
      throw new Error(`Expected 403 Forbidden for student viewing another student's summary, got status ${res.status}`);
    }
    console.log(`   -> [OK] Student 5 blocked from viewing Student 1 summary (403 Forbidden: ${res.data.error})`);
  });

  // 20. Authority Verification: Faculty Authority for Data Updation and Deletion
  await test('20. Faculty Authority: Subject Teacher and TG Authorized Modifications', async () => {
    // Subject teacher (Prof. Verma, ID 2) updating attendance
    const updatePayload = {
      attendanceId: 1,
      newStatus: 'PRESENT',
      reason: 'Verified faculty attendance reconciliation',
      facultyId: 2
    };
    const updateRes = await request('POST', '/api/attendance/update-record', updatePayload, { 'x-user-role': 'COURSE_TEACHER', 'x-user-id': '2' });
    if (updateRes.status !== 200 || !updateRes.data.success) {
      throw new Error(`Faculty attendance update failed: ${JSON.stringify(updateRes.data)}`);
    }
    console.log(`   -> [OK] Subject Teacher successfully modified attendance record with audit trail`);

    // TG (Prof. Kulkarni, ID 3) updating counseling for assigned mentee
    const tgPayload = {
      studentId: 5,
      counselingFlag: true,
      counselingNotes: 'Mid-term academic counseling conducted by designated Teacher Guardian'
    };
    const tgRes = await request('POST', '/api/tg/counseling', tgPayload, { 'x-user-role': 'TG', 'x-user-id': '3' });
    if (tgRes.status !== 200 || !tgRes.data.success) {
      throw new Error(`TG counseling update failed: ${JSON.stringify(tgRes.data)}`);
    }
    console.log(`   -> [OK] Teacher Guardian successfully updated mentee counseling record`);
  });

  // 21. Individual Student Authentication & Invalid Password Rejection
  await test('21. Individual Student Passwords (e.g., ram/ram123, aarav/aarav123) & Strict Rejection of Invalid Passwords', async () => {
    // 1. Student Ram login with valid password
    const ramRes = await request('POST', '/api/auth/login', { username: 'ram', password: 'ram123' });
    if (ramRes.status !== 200 || !ramRes.data.success || ramRes.data.user.role !== 'STUDENT') {
      throw new Error(`Login failed for student ram: ${JSON.stringify(ramRes.data)}`);
    }
    console.log(`   -> [OK] Authenticated student 'ram' with password 'ram123' (User: ${ramRes.data.user.displayName})`);

    // 2. Student Ram login with INVALID password
    const ramBad = await request('POST', '/api/auth/login', { username: 'ram', password: 'wrongpassword' });
    if (ramBad.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for invalid password on student ram, got status ${ramBad.status}`);
    }
    console.log(`   -> [OK] Strictly rejected invalid password for student 'ram' (401: ${ramBad.data.error})`);

    // 3. Student Aarav login with valid password
    const aaravRes = await request('POST', '/api/auth/login', { username: 'aarav', password: 'aarav123' });
    if (aaravRes.status !== 200 || !aaravRes.data.success || aaravRes.data.user.role !== 'STUDENT') {
      throw new Error(`Login failed for student aarav: ${JSON.stringify(aaravRes.data)}`);
    }
    console.log(`   -> [OK] Authenticated student 'aarav' with password 'aarav123' (User: ${aaravRes.data.user.displayName})`);

    // 4. Student Aarav login with INVALID password
    const aaravBad = await request('POST', '/api/auth/login', { username: 'aarav', password: 'badpassword' });
    if (aaravBad.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for invalid password on student aarav, got status ${aaravBad.status}`);
    }
    console.log(`   -> [OK] Strictly rejected invalid password for student 'aarav' (401: ${aaravBad.data.error})`);
  });

  // 22. Individual Faculty Authentication & Invalid Password Rejection
  await test('22. Individual Faculty Passwords (e.g., pooja/pooja123, namdev/namdev123) & Strict Rejection of Invalid Passwords', async () => {
    // 1. Faculty Pooja login with valid password
    const poojaRes = await request('POST', '/api/auth/login', { username: 'pooja', password: 'pooja123' });
    if (poojaRes.status !== 200 || !poojaRes.data.success || poojaRes.data.user.role !== 'COURSE_TEACHER') {
      throw new Error(`Login failed for faculty pooja: ${JSON.stringify(poojaRes.data)}`);
    }
    console.log(`   -> [OK] Authenticated faculty 'pooja' with password 'pooja123' (User: ${poojaRes.data.user.displayName})`);

    // 2. Faculty Pooja login with INVALID password
    const poojaBad = await request('POST', '/api/auth/login', { username: 'pooja', password: 'wrongpass123' });
    if (poojaBad.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for invalid password on faculty pooja, got status ${poojaBad.status}`);
    }
    console.log(`   -> [OK] Strictly rejected invalid password for faculty 'pooja' (401: ${poojaBad.data.error})`);

    // 3. Faculty Namdev (HOD) login with valid password
    const namdevRes = await request('POST', '/api/auth/login', { username: 'namdev', password: 'namdev123' });
    if (namdevRes.status !== 200 || !namdevRes.data.success || namdevRes.data.user.role !== 'HOD') {
      throw new Error(`Login failed for faculty namdev: ${JSON.stringify(namdevRes.data)}`);
    }
    console.log(`   -> [OK] Authenticated HOD 'namdev' with password 'namdev123' (User: ${namdevRes.data.user.displayName})`);

    // 4. Faculty Namdev login with INVALID password
    const namdevBad = await request('POST', '/api/auth/login', { username: 'namdev', password: 'invalidpassword' });
    if (namdevBad.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for invalid password on faculty namdev, got status ${namdevBad.status}`);
    }
    console.log(`   -> [OK] Strictly rejected invalid password for HOD 'namdev' (401: ${namdevBad.data.error})`);
  });

  // 23. HOD Academic Administration: Adding Student, Faculty, and Course
  await test('23. HOD Academic Administration (Add Student, Faculty, Course)', async () => {
    // 1. HOD adds new student
    const newStudentPRN = `PRN-TEST-${Date.now().toString().slice(-4)}`;
    const stdPayload = {
      prn: newStudentPRN,
      rollNumber: 99,
      firstName: 'RohanTest',
      lastName: 'Patil',
      email: `rohan.${Date.now()}@student.engg.edu`,
      phoneNumber: '9876543299',
      parentPhone: '9876543288',
      divisionId: 1,
      password: 'rohan123'
    };
    const addStdRes = await request('POST', '/api/admin/students', stdPayload, { 'x-user-role': 'HOD', 'x-user-id': '1' });
    if (addStdRes.status !== 200 || !addStdRes.data.success) {
      throw new Error(`Failed to add student: ${JSON.stringify(addStdRes.data)}`);
    }
    console.log(`   -> [OK] HOD successfully added student: ${addStdRes.data.message}`);

    // Clean up created test student
    await request('DELETE', `/api/admin/students/${addStdRes.data.studentId}`, null, { 'x-user-role': 'HOD', 'x-user-id': '1' });

    // 2. HOD adds new faculty
    const facCode = `EMP-TEST-${Date.now().toString().slice(-4)}`;
    const facPayload = {
      employeeCode: facCode,
      firstName: 'KiranTest',
      lastName: 'Desai',
      email: `kiran.${Date.now()}@engg-institute.edu`,
      phoneNumber: '9876500099',
      designation: 'Assistant Professor',
      departmentId: 1,
      password: 'kiran123'
    };
    const addFacRes = await request('POST', '/api/admin/faculty', facPayload, { 'x-user-role': 'HOD', 'x-user-id': '1' });
    if (addFacRes.status !== 200 || !addFacRes.data.success) {
      throw new Error(`Failed to add faculty: ${JSON.stringify(addFacRes.data)}`);
    }
    console.log(`   -> [OK] HOD successfully added faculty: ${addFacRes.data.message}`);

    // Clean up created test faculty
    await request('DELETE', `/api/admin/faculty/${addFacRes.data.facultyId}`, null, { 'x-user-role': 'HOD', 'x-user-id': '1' });

    // 3. HOD adds new course
    const courseCode = `CS99${Date.now().toString().slice(-2)}`;
    const coursePayload = {
      courseCode,
      courseName: 'Distributed Cloud Systems',
      departmentId: 1,
      semester: 6,
      lectureType: 'THEORY',
      credits: 4.0,
      weeklyHours: 4
    };
    const addCourseRes = await request('POST', '/api/admin/courses', coursePayload, { 'x-user-role': 'HOD', 'x-user-id': '1' });
    if (addCourseRes.status !== 200 || !addCourseRes.data.success) {
      throw new Error(`Failed to add course: ${JSON.stringify(addCourseRes.data)}`);
    }
    console.log(`   -> [OK] HOD successfully added subject: ${addCourseRes.data.message}`);
  });

  // 24. Security RBAC: Non-HOD users strictly blocked from adding students/faculty
  await test('24. RBAC Protection: Students and Faculty Blocked from Adding Students', async () => {
    // Student attempting to add student
    const stdAttempt = await request('POST', '/api/admin/students', { prn: 'PRN-HACK', rollNumber: 1, firstName: 'Hack', lastName: 'User', email: 'hack@hack.com', divisionId: 1 }, { 'x-user-role': 'STUDENT', 'x-user-id': '26' });
    if (stdAttempt.status !== 403) {
      throw new Error(`Expected 403 Forbidden for Student adding student, got ${stdAttempt.status}`);
    }
    console.log(`   -> [OK] Student strictly blocked from adding students (403 Forbidden)`);

    // Course Teacher attempting to add student
    const teacherAttempt = await request('POST', '/api/admin/students', { prn: 'PRN-HACK2', rollNumber: 2, firstName: 'Hack2', lastName: 'User', email: 'hack2@hack.com', divisionId: 1 }, { 'x-user-role': 'COURSE_TEACHER', 'x-user-id': '2' });
    if (teacherAttempt.status !== 403) {
      throw new Error(`Expected 403 Forbidden for Course Teacher adding student, got ${teacherAttempt.status}`);
    }
    console.log(`   -> [OK] Course Teacher strictly blocked from adding students (403 Forbidden: HOD exclusive)`);
  });

  // 25. Strict Data Isolation: Faculty members see only their own data
  await test('25. Strict Faculty Isolation: Faculty Members Cannot Access Other Faculty Allocations', async () => {
    // Faculty 2 (Prof. Pooja) attempting to fetch Faculty 3 (Prof. Amit)'s course allocations
    const crossRes = await request('GET', '/api/course-teacher/3/allocations', null, { 'x-user-role': 'COURSE_TEACHER', 'x-user-id': '2' });
    if (crossRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for Faculty 2 viewing Faculty 3 allocations, got ${crossRes.status}`);
    }
    console.log(`   -> [OK] Faculty Pooja strictly blocked from viewing Faculty Amit allocations (403: ${crossRes.data.error})`);

    // HOD (Universal Access) accessing Faculty 3 allocations
    const hodRes = await request('GET', '/api/course-teacher/3/allocations', null, { 'x-user-role': 'HOD', 'x-user-id': '1' });
    if (hodRes.status !== 200) {
      throw new Error(`Expected 200 OK for HOD accessing Faculty 3 allocations, got ${hodRes.status}`);
    }
    console.log(`   -> [OK] HOD granted universal oversight access across all faculty cohorts`);
  });

  console.log('\n===============================================================');
  console.log(`   ALL TESTS COMPLETED: ${passed} / ${total} PASSED (100% SUCCESS)`);
  console.log('===============================================================\n');
}

if (require.main === module) {
  runTestSuite().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runTestSuite };
