const { query } = require('./db');

async function migrateCredentials() {
  console.log('--- Starting Credentials & Student Migration ---');

  // 1. Check or insert Student 26 (Ram Joshi)
  await query(`
    INSERT INTO students (student_id, prn, roll_number, first_name, last_name, email, phone_number, parent_phone, parent_email, division_id, admission_year, is_active)
    VALUES (26, 'PRN20240116', 116, 'Ram', 'Joshi', 'ram.joshi@student.engg.edu', '+91 9900010116', '+91 9811100026', 'p.joshi.ram@gmail.com', 1, 2024, TRUE)
    ON DUPLICATE KEY UPDATE first_name = VALUES(first_name), last_name = VALUES(last_name), email = VALUES(email);
  `);
  console.log('✓ Student Ram Joshi (ID 26) seeded in students table');

  // 2. Insert attendance records for Ram
  const schedules = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  for (const sid of schedules) {
    const facId = sid <= 10 ? 2 : (sid <= 13 ? 3 : 4);
    await query(`
      INSERT INTO attendance_records (schedule_id, student_id, status, marked_by_faculty_id, remarks)
      VALUES (?, 26, 'PRESENT', ?, 'On time')
      ON DUPLICATE KEY UPDATE status = VALUES(status);
    `, [sid, facId]);
  }
  console.log('✓ Attendance records for Ram Joshi (ID 26) seeded');

  // 3. TG mapping for Ram
  await query(`
    INSERT INTO tg_student_mapping (tg_id, student_id, assigned_date, counseling_notes, counseling_flag)
    VALUES (1, 26, '2025-07-15', 'Consistent academic progress and high attendance record', FALSE)
    ON DUPLICATE KEY UPDATE counseling_notes = VALUES(counseling_notes);
  `);
  console.log('✓ TG mapping for Ram Joshi seeded');

  // 4. Update the 5 generic test accounts in user_credentials to have demo emails
  await query(`
    UPDATE user_credentials SET email = 'demo.student@amms.edu' WHERE username = 'student';
  `);
  await query(`
    UPDATE user_credentials SET email = 'demo.teacher@amms.edu' WHERE username = 'teacher';
  `);
  await query(`
    UPDATE user_credentials SET email = 'demo.tg@amms.edu' WHERE username = 'tg';
  `);
  await query(`
    UPDATE user_credentials SET email = 'demo.hod@amms.edu' WHERE username = 'hod';
  `);
  await query(`
    UPDATE user_credentials SET email = 'demo.faculty@amms.edu' WHERE username = 'faculty';
  `);
  console.log('✓ Updated generic demo accounts with unique demo emails');

  // 5. Seed every student (all 26 students)
  const studentsRes = await query(`
    SELECT student_id, prn, roll_number, first_name, last_name, email, division_id
    FROM students
    ORDER BY student_id;
  `);

  console.log(`Found ${studentsRes.rows.length} students to seed credentials for`);

  for (const s of studentsRes.rows) {
    const username = s.first_name.toLowerCase();
    const password = `${s.first_name.toLowerCase()}123`;
    const displayName = `${s.first_name} ${s.last_name}`;

    await query(`
      INSERT INTO user_credentials (username, password_hash, role, display_name, email, student_id, faculty_id, department_id, is_active)
      VALUES (?, ?, 'STUDENT', ?, ?, ?, NULL, 1, TRUE)
      ON DUPLICATE KEY UPDATE 
        password_hash = VALUES(password_hash),
        display_name = VALUES(display_name),
        student_id = VALUES(student_id),
        email = VALUES(email);
    `, [username, password, displayName, s.email, s.student_id]);
  }
  console.log('✓ All 26 students credentials seeded');

  // 6. Seed every faculty (all 15 faculty)
  const facultyRes = await query(`
    SELECT faculty_id, employee_code, first_name, last_name, email, designation, department_id
    FROM faculty
    ORDER BY faculty_id;
  `);

  console.log(`Found ${facultyRes.rows.length} faculty to seed credentials for`);

  for (const f of facultyRes.rows) {
    let username = f.first_name.toLowerCase();
    // Neha Patil vs Neha Gupte student:
    if (username === 'neha') {
      username = 'nehap';
    }
    const password = `${f.first_name.toLowerCase()}123`;
    const role = f.designation === 'HOD' ? 'HOD' : (f.faculty_id === 3 ? 'TG' : (f.faculty_id === 2 ? 'COURSE_TEACHER' : 'FACULTY'));
    const title = f.designation === 'HOD' ? 'Dr.' : 'Prof.';
    const displayName = `${title} ${f.first_name} ${f.last_name}`;

    await query(`
      INSERT INTO user_credentials (username, password_hash, role, display_name, email, student_id, faculty_id, department_id, is_active)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE 
        password_hash = VALUES(password_hash),
        role = VALUES(role),
        display_name = VALUES(display_name),
        faculty_id = VALUES(faculty_id),
        department_id = VALUES(department_id),
        email = VALUES(email);
    `, [username, password, role, displayName, f.email, f.faculty_id, f.department_id]);
  }
  console.log('✓ All 15 faculty credentials seeded');

  // Also insert alias 'neha_faculty' so both nehap and neha_faculty work
  await query(`
    INSERT INTO user_credentials (username, password_hash, role, display_name, email, student_id, faculty_id, department_id, is_active)
    VALUES ('neha_faculty', 'neha123', 'FACULTY', 'Prof. Neha Patil', 'neha.patil.alt@engg-institute.edu', NULL, 4, 1, TRUE)
    ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash);
  `);

  // Count total credentials
  const countRes = await query(`SELECT COUNT(*) AS total FROM user_credentials;`);
  console.log(`✓ Total active credentials in database: ${countRes.rows[0].total}`);
  console.log('--- Migration Finished Successfully ---');
}

migrateCredentials().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
}).then(() => process.exit(0));
