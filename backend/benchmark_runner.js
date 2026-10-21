const { query, exec } = require('./db');
const { initializeMySQL } = require('./init_db_mysql');

async function runBenchmark() {
  console.log('===============================================================');
  console.log('     MYSQL 8.0 INNODB PERFORMANCE BENCHMARK & EXPLAIN ANALYZE  ');
  console.log('===============================================================\n');

  // Ensure DB and seed are ready
  await initializeMySQL({ loadSeed: true, verbose: false });

  // Generate synthetic scale data for benchmarking
  console.log('Generating additional scale data for benchmarking (1,000 attendance records)...');
  await exec(`
    -- Bulk generate schedules
    INSERT INTO lecture_schedules (allocation_id, lecture_date, slot_number, start_time, end_time, room_number, status, topic_covered)
    SELECT 
      1, 
      DATE_ADD('2025-10-01', INTERVAL FLOOR(seq / 4) DAY),
      (seq % 4) + 1,
      '09:00', '10:00', 'Room A-301', 'CONDUCTED', CONCAT('Benchmark Lecture ', seq)
    FROM (
      SELECT a.N + b.N * 10 + 1 AS seq
      FROM (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a
      CROSS JOIN (SELECT 0 AS N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) b
      WHERE (a.N + b.N * 10 + 1) <= 70
    ) numbers
    ON DUPLICATE KEY UPDATE status = VALUES(status);
  `);

  await exec(`
    -- Bulk generate attendance records
    INSERT INTO attendance_records (schedule_id, student_id, status, marked_by_faculty_id, remarks)
    SELECT 
      ls.schedule_id,
      s.student_id,
      CASE 
        WHEN s.student_id IN (3, 5, 13) AND (ls.schedule_id % 3) = 0 THEN 'ABSENT'
        WHEN (s.student_id + ls.schedule_id) % 7 = 0 THEN 'ABSENT'
        ELSE 'PRESENT'
      END,
      2,
      'Benchmark test record'
    FROM lecture_schedules ls
    CROSS JOIN students s
    WHERE ls.schedule_id > 17 AND s.student_id <= 15
    ON DUPLICATE KEY UPDATE status = VALUES(status);
  `);

  const benchmarkQueries = [
    {
      name: 'Query 1: Defaulter List Scanning (< 75% threshold)',
      sql: `
        EXPLAIN ANALYZE
        SELECT 
            s.student_id,
            s.roll_number,
            CONCAT(s.first_name, ' ', s.last_name) AS student_name,
            COUNT(ar.attendance_id) AS total_marked,
            COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END) AS present_count,
            ROUND(
                (COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END) / 
                 NULLIF(COUNT(ar.attendance_id), 0)) * 100.0, 2
            ) AS attendance_pct
        FROM students s
        JOIN attendance_records ar ON s.student_id = ar.student_id
        GROUP BY s.student_id, s.roll_number, s.first_name, s.last_name
        HAVING (COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END) / 
                NULLIF(COUNT(ar.attendance_id), 0)) * 100.0 < 75.0;
      `
    },
    {
      name: 'Query 2: Student Date-Range Attendance Retrieval',
      sql: `
        EXPLAIN ANALYZE
        SELECT 
            ar.attendance_id,
            c.course_code,
            c.course_name,
            ls.lecture_date,
            ls.slot_number,
            ar.status
        FROM attendance_records ar
        JOIN lecture_schedules ls ON ar.schedule_id = ls.schedule_id
        JOIN course_allocations ca ON ls.allocation_id = ca.allocation_id
        JOIN courses c ON ca.course_id = c.course_id
        WHERE ar.student_id = 5
          AND ls.lecture_date BETWEEN '2025-09-01' AND '2025-09-30'
        ORDER BY ls.lecture_date, ls.slot_number;
      `
    }
  ];

  console.log('\n--- PHASE 1: BENCHMARK BEFORE INDEXES (COLD / TABLE SCAN) ---');
  // Drop potential indexes first
  const dropIndexes = [
    'DROP INDEX IF EXISTS idx_attendance_student_status ON attendance_records;',
    'DROP INDEX IF EXISTS idx_attendance_schedule_id ON attendance_records;',
    'DROP INDEX IF EXISTS idx_lecture_schedules_alloc_date ON lecture_schedules;',
    'DROP INDEX IF EXISTS idx_students_division_id ON students;',
    'DROP INDEX IF EXISTS idx_audit_attendance_id ON attendance_audit_trail;'
  ];
  for (const d of dropIndexes) {
    try { await exec(d); } catch (e) { /* ignore */ }
  }

  const resultsBefore = [];
  for (const q of benchmarkQueries) {
    const res = await query(q.sql);
    const planText = res.rows.map(r => Object.values(r)[0]).join('\n');
    resultsBefore.push({ name: q.name, plan: planText });
    console.log(`\n[BEFORE] ${q.name}:`);
    console.log(planText);
  }

  console.log('\n--- APPLYING PRODUCTION B-TREE COMPOSITE INDEXES ---');
  const addIndexes = [
    'CREATE INDEX idx_attendance_student_status ON attendance_records (student_id, status);',
    'CREATE INDEX idx_attendance_schedule_id ON attendance_records (schedule_id);',
    'CREATE INDEX idx_lecture_schedules_alloc_date ON lecture_schedules (allocation_id, lecture_date);',
    'CREATE INDEX idx_students_division_id ON students (division_id, roll_number);',
    'CREATE INDEX idx_audit_attendance_id ON attendance_audit_trail (attendance_id, modified_at);'
  ];
  for (const a of addIndexes) {
    try { await exec(a); } catch (e) { /* ignore */ }
  }
  console.log('✓ All composite B-Tree indexes applied to MySQL InnoDB.');

  console.log('\n--- PHASE 2: BENCHMARK AFTER INDEXES (INDEX SCAN) ---');
  const resultsAfter = [];
  for (const q of benchmarkQueries) {
    const res = await query(q.sql);
    const planText = res.rows.map(r => Object.values(r)[0]).join('\n');
    resultsAfter.push({ name: q.name, plan: planText });
    console.log(`\n[AFTER] ${q.name}:`);
    console.log(planText);
  }

  console.log('\n===============================================================');
  console.log('                 MYSQL BENCHMARK COMPLETE                      ');
  console.log('===============================================================');
  return { resultsBefore, resultsAfter };
}

if (require.main === module) {
  runBenchmark()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Benchmark failed:', err);
      process.exit(1);
    });
}

module.exports = { runBenchmark };
