/**
 * AMMS Enterprise Academic Suite & MySQL Database Studio
 * Production Client Controller: RBAC, Live Table Manager, and MySQL 8.0 InnoDB Integration
 */

const API_BASE = '/api';

const state = {
  currentUser: null,
  currentRole: 'HOD',
  currentUserId: 1,
  currentDepartmentId: 1,
  presets: null,
  activeScheduleId: null,
  activeRoster: [],
  // Academic Administration State (HOD / Admin exclusive)
  admin: {
    activeSection: 'students',
    metadata: null,
    students: [],
    faculty: [],
    courses: [],
    allocations: []
  }
};

function getAuthHeaders(extra = {}) {
  const role = state.currentUser ? state.currentUser.role : (state.currentRole || 'STUDENT');
  const userId = state.currentUser ? (state.currentUser.userId || state.currentUser.facultyId || state.currentUser.studentId || 1) : (state.currentUserId || 1);
  return {
    'x-user-role': role,
    'x-user-id': String(userId),
    ...extra
  };
}

// ----------------------------------------------------------------------------
// INITIALIZATION & EVENT LISTENERS
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();

  // Check if an authenticated user session already exists in sessionStorage
  const savedUserJson = sessionStorage.getItem('amms_authenticated_user');
  if (savedUserJson) {
    try {
      const user = JSON.parse(savedUserJson);
      if (user && user.role) {
        await enterAuthenticatedApp(user);
        return;
      }
    } catch (e) {
      sessionStorage.removeItem('amms_authenticated_user');
    }
  }

  // Not authenticated: Show ONLY the login screen, hide the application workspace completely
  showLoginGatewayScreen();
});

function initTheme() {
  const savedTheme = localStorage.getItem('amms_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  const themeName = isLight ? 'light' : 'dark';
  localStorage.setItem('amms_theme', themeName);
  showToast(isLight ? 'Switched to Official White / Light Theme' : 'Switched to Institutional Dark Mode', 'info');
}

function setupEventListeners() {
  // Theme Toggle Button (Dark / White Theme)
  const btnTheme = document.getElementById('btnThemeToggle');
  if (btnTheme) {
    btnTheme.addEventListener('click', toggleTheme);
  }

  // Gateway Initial Login Form & Tiles
  const formGateway = document.getElementById('formGatewayLogin');
  if (formGateway) {
    formGateway.addEventListener('submit', (e) => {
      e.preventDefault();
      submitGatewayLogin();
    });
  }

  const btnGatewaySubmit = document.getElementById('btnGatewaySubmit');
  if (btnGatewaySubmit) {
    btnGatewaySubmit.addEventListener('click', (e) => {
      e.preventDefault();
      submitGatewayLogin();
    });
  }

  document.querySelectorAll('.login-role-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      const u = tile.getAttribute('data-login-user');
      const p = tile.getAttribute('data-login-pwd');
      fillAndSubmitGatewayQuickCred(u, p);
    });
  });

  // Sign Out Button in Authenticated Header
  const btnSignOut = document.getElementById('btnSignOutApp');
  if (btnSignOut) {
    btnSignOut.addEventListener('click', signOut);
  }

  // Authentication Switcher Modal Triggers (inside authenticated view)
  const btnLogin = document.getElementById('btnOpenLoginModal');
  if (btnLogin) btnLogin.addEventListener('click', openLoginModal);

  const btnCloseLogin = document.getElementById('btnCloseLoginModal');
  if (btnCloseLogin) btnCloseLogin.addEventListener('click', closeLoginModal);

  const btnCancelLogin = document.getElementById('btnCancelLoginModal');
  if (btnCancelLogin) btnCancelLogin.addEventListener('click', closeLoginModal);

  const btnSubmitLogin = document.getElementById('btnSubmitLoginAuth');
  if (btnSubmitLogin) btnSubmitLogin.addEventListener('click', submitLoginAuth);

  // Quick Test Credentials Cards inside modal (1-click fill & switch)
  document.querySelectorAll('.role-auth-card').forEach(card => {
    card.addEventListener('click', () => {
      const u = card.getAttribute('data-auth-user');
      const p = card.getAttribute('data-auth-pwd');
      fillAndSubmitQuickCred(u, p);
    });
  });

  // Navigation Tabs (Role-Based Dynamic Access)
  document.querySelectorAll('.nav-tab-btn').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetRole = tab.getAttribute('data-role');
      const currentUserRole = state.currentUser ? state.currentUser.role : state.currentRole;
      if (targetRole === 'ADMIN_MANAGEMENT' && currentUserRole !== 'HOD' && currentUserRole !== 'ADMIN') {
        showToast('Access restricted: Only HOD / Institutional Admin can access Academic Administration.', 'error');
        return;
      }
      switchRole(targetRole);
    });
  });

  // Persona Switcher Dropdown (if present)
  const presetSelect = document.getElementById('presetSelect');
  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => {
      const [role, id] = e.target.value.split(':');
      switchRole(role, parseInt(id, 10));
    });
  }

  // Department Selector (HOD)
  document.getElementById('deptSelect').addEventListener('change', (e) => {
    state.currentDepartmentId = parseInt(e.target.value, 10);
    loadHODDashboard();
  });

  // Header Alert Drawer Controls
  document.getElementById('btnAlertsToggle').addEventListener('click', toggleAlertsDrawer);
  document.getElementById('btnCloseAlerts').addEventListener('click', toggleAlertsDrawer);

  // Marking Attendance Modal Actions
  document.getElementById('btnCloseMarkModal').addEventListener('click', () => closeModal('modalAttendanceMarking'));
  document.getElementById('btnCancelMarking').addEventListener('click', () => closeModal('modalAttendanceMarking'));
  document.getElementById('btnMarkAllPresent').addEventListener('click', () => setAllRosterStatus('PRESENT'));
  document.getElementById('btnMarkAllAbsent').addEventListener('click', () => setAllRosterStatus('ABSENT'));
  document.getElementById('btnSubmitAttendanceTransaction').addEventListener('click', submitAttendanceTransaction);
  document.getElementById('btnMarkLectureShortcut').addEventListener('click', () => {
    const firstScheduled = document.querySelector('[data-action="mark-sched"]');
    if (firstScheduled) {
      firstScheduled.click();
    } else {
      showToast('No scheduled sessions currently pending attendance.', 'info');
    }
  });

  // Correction Modal Actions
  document.getElementById('btnCloseCorrectionModal').addEventListener('click', () => closeModal('modalCorrection'));
  document.getElementById('btnCancelCorrection').addEventListener('click', () => closeModal('modalCorrection'));
  document.getElementById('btnSaveCorrection').addEventListener('click', saveCorrection);

  // Reschedule Modal Actions
  document.getElementById('btnCloseRescheduleModal').addEventListener('click', () => closeModal('modalReschedule'));
  document.getElementById('btnCancelReschedule').addEventListener('click', () => closeModal('modalReschedule'));
  document.getElementById('btnConfirmReschedule').addEventListener('click', confirmReschedule);

  // Substitute Modal Actions
  document.getElementById('btnCloseSubstituteModal').addEventListener('click', () => closeModal('modalSubstitute'));
  document.getElementById('btnCancelSubstitute').addEventListener('click', () => closeModal('modalSubstitute'));
  document.getElementById('btnConfirmSubstitute').addEventListener('click', confirmSubstitute);

  // Counseling Modal Actions
  document.getElementById('btnCloseCounselingModal').addEventListener('click', () => closeModal('modalCounseling'));
  document.getElementById('btnCancelCounseling').addEventListener('click', () => closeModal('modalCounseling'));
  document.getElementById('btnSaveCounseling').addEventListener('click', saveCounseling);

  // Export CSV (Class Teacher)
  document.getElementById('btnExportDivisionCSV').addEventListener('click', exportDivisionCSV);

  // --------------------------------------------------------------------------
  // ACADEMIC ADMINISTRATION EVENT LISTENERS
  // --------------------------------------------------------------------------
  const stdSearch = document.getElementById('adminStudentSearch');
  if (stdSearch) {
    stdSearch.addEventListener('input', filterAdminStudents);
  }
}

// ----------------------------------------------------------------------------
// SYSTEM CLOCK
// ----------------------------------------------------------------------------
function startSystemClock() {
  function update() {
    const now = new Date();
    const clockEl = document.getElementById('systemClock');
    if (clockEl) {
      clockEl.textContent = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    }
  }
  update();
  setInterval(update, 1000);
}

// ----------------------------------------------------------------------------
// ROLE & PERSONA SWITCHING
// ----------------------------------------------------------------------------
async function loadPresets() {
  try {
    const res = await fetch(`${API_BASE}/presets`);
    const data = await res.json();
    state.presets = data;

    // Populate Department Selector (HOD)
    const deptSelect = document.getElementById('deptSelect');
    if (deptSelect && data.departments) {
      deptSelect.innerHTML = data.departments.map(d => 
        `<option value="${d.department_id}">${d.department_code} - ${d.department_name}</option>`
      ).join('');
    }

    // Populate Substitute Faculty Select
    const substSelect = document.getElementById('substFacultySelect');
    if (substSelect && data.faculty) {
      substSelect.innerHTML = data.faculty.map(f => 
        `<option value="${f.faculty_id}">${f.name} (${f.designation} - ${f.department_code})</option>`
      ).join('');
    }

  } catch (error) {
    console.error('Failed to load presets:', error);
  }
}

function applyRolePermissions() {
  // CRITICAL: Permissions MUST be based on the authenticated user's role (state.currentUser.role),
  // NEVER on the currently viewed tab/workspace!
  const role = state.currentUser ? state.currentUser.role : (state.currentRole || 'STUDENT');

  // Strictly enforce role-based tab access
  document.querySelectorAll('.nav-tab-btn').forEach(tab => {
    const tabRole = tab.getAttribute('data-role');
    if (role === 'HOD' || role === 'ADMIN') {
      // HOD / Institutional Administrator has universal governance:
      // ALL navigation tabs MUST stay visible so HOD can freely switch between tabs!
      tab.style.display = 'inline-flex';
    } else if (role === 'STUDENT') {
      tab.style.display = (tabRole === 'STUDENT') ? 'inline-flex' : 'none';
    } else if (role === 'COURSE_TEACHER') {
      tab.style.display = (tabRole === 'COURSE_TEACHER') ? 'inline-flex' : 'none';
    } else if (role === 'TG') {
      tab.style.display = (tabRole === 'TG') ? 'inline-flex' : 'none';
    } else if (role === 'CLASS_TEACHER' || role === 'FACULTY') {
      tab.style.display = (tabRole === 'CLASS_TEACHER' || tabRole === 'COURSE_TEACHER') ? 'inline-flex' : 'none';
    } else {
      tab.style.display = 'inline-flex';
    }
  });

  const personaGroup = document.querySelector('.persona-switch-group');
  if (personaGroup) {
    personaGroup.style.display = 'none';
  }
}

function openLoginModal() {
  const errEl = document.getElementById('loginAuthError');
  if (errEl) errEl.style.display = 'none';
  openModal('modalAuthentication');
}

function closeLoginModal() {
  closeModal('modalAuthentication');
}

async function submitLoginAuth() {
  const userInp = document.getElementById('loginUsername');
  const pwdInp = document.getElementById('loginPassword');
  const errEl = document.getElementById('loginAuthError');

  const username = userInp ? userInp.value.trim() : '';
  const password = pwdInp ? pwdInp.value.trim() : '';

  if (!username || !password) {
    if (errEl) {
      errEl.textContent = 'Please enter both username and password.';
      errEl.style.display = 'block';
    }
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      if (errEl) {
        errEl.textContent = data.error || 'Authentication failed. Please verify credentials.';
        errEl.style.display = 'block';
      }
      return;
    }

    state.currentUser = data.user;
    sessionStorage.setItem('amms_authenticated_user', JSON.stringify(data.user));
    closeLoginModal();
    switchRole(data.user.role, data.user.userId, data.user);
    showToast(`Switched role to ${data.user.displayName} (${data.user.role})`, 'success');
  } catch (err) {
    if (errEl) {
      errEl.textContent = 'Server connection error during login.';
      errEl.style.display = 'block';
    }
  }
}

function fillAndSubmitQuickCred(username, password) {
  const userInp = document.getElementById('loginUsername');
  const pwdInp = document.getElementById('loginPassword');
  if (userInp) userInp.value = username;
  if (pwdInp) pwdInp.value = password;
  submitLoginAuth();
}

// ----------------------------------------------------------------------------
// INITIAL LOGIN GATEWAY SCREEN CONTROLLERS
// ----------------------------------------------------------------------------

function showLoginGatewayScreen() {
  const gateway = document.getElementById('screenLoginGateway');
  const app = document.getElementById('authenticatedApp');
  if (gateway) gateway.classList.remove('hidden');
  if (app) app.classList.add('hidden');

  const errEl = document.getElementById('gatewayLoginError');
  if (errEl) errEl.style.display = 'none';

  const uInp = document.getElementById('gatewayUsername');
  const pInp = document.getElementById('gatewayPassword');
  if (uInp) uInp.value = '';
  if (pInp) pInp.value = '';
}

async function enterAuthenticatedApp(user) {
  state.currentUser = user;
  state.currentRole = user.role;
  state.currentUserId = user.userId;
  state.currentDepartmentId = user.departmentId || 1;

  // Persist session so refreshing the page preserves the role
  sessionStorage.setItem('amms_authenticated_user', JSON.stringify(user));

  const gateway = document.getElementById('screenLoginGateway');
  const app = document.getElementById('authenticatedApp');
  if (gateway) gateway.classList.add('hidden');
  if (app) app.classList.remove('hidden');

  startSystemClock();
  await loadPresets();
  await refreshAlerts();
  switchRole(user.role, user.userId, user);
}

function signOut() {
  sessionStorage.removeItem('amms_authenticated_user');
  state.currentUser = null;
  state.currentRole = 'STUDENT';
  state.currentUserId = null;

  showLoginGatewayScreen();
  showToast('You have been signed out. Please authenticate to access the portal.', 'info');
}

async function submitGatewayLogin() {
  const userInp = document.getElementById('gatewayUsername');
  const pwdInp = document.getElementById('gatewayPassword');
  const errEl = document.getElementById('gatewayLoginError');

  const username = userInp ? userInp.value.trim() : '';
  const password = pwdInp ? pwdInp.value.trim() : '';

  if (!username || !password) {
    if (errEl) {
      errEl.textContent = 'Please enter both username and password.';
      errEl.style.display = 'block';
    }
    return;
  }

  const btn = document.getElementById('btnGatewaySubmit');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>Verifying Credentials...</span>';
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      if (errEl) {
        errEl.textContent = data.error || 'Authentication failed. Please verify credentials.';
        errEl.style.display = 'block';
      }
      return;
    }

    if (errEl) errEl.style.display = 'none';
    await enterAuthenticatedApp(data.user);
    showToast(`Signed in successfully as ${data.user.displayName} (${data.user.role})`, 'success');
  } catch (err) {
    if (errEl) {
      errEl.textContent = 'Server connection error during login.';
      errEl.style.display = 'block';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg><span>Sign In to AMMS Portal</span>`;
    }
  }
}

function fillAndSubmitGatewayQuickCred(username, password) {
  const userInp = document.getElementById('gatewayUsername');
  const pwdInp = document.getElementById('gatewayPassword');
  if (userInp) userInp.value = username;
  if (pwdInp) pwdInp.value = password;
  submitGatewayLogin();
}

function switchRole(targetRole, userId = null, userObj = null) {
  if (userObj) {
    state.currentUser = userObj;
    state.currentRole = userObj.role;
    state.currentUserId = userObj.userId;
    state.currentDepartmentId = userObj.departmentId || 1;
  }

  // Ensure state.currentRole always reflects the authenticated user's role, not the active tab
  if (state.currentUser) {
    state.currentRole = state.currentUser.role;
    state.currentUserId = state.currentUser.userId || state.currentUserId;
  }

  // Enforce tab visibility based on the logged in user's role
  applyRolePermissions();

  // Update Tab Styling
  document.querySelectorAll('.nav-tab-btn').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-role') === targetRole);
  });

  // Hide all views
  document.querySelectorAll('.workspace-view').forEach(v => v.classList.add('hidden'));

  // Update current user card in header
  updateHeaderUserCard();

  // Show active view and trigger fetch
  switch (targetRole) {
    case 'STUDENT':
      document.getElementById('viewStudent').classList.remove('hidden');
      loadStudentDashboard();
      break;
    case 'COURSE_TEACHER':
      document.getElementById('viewCourseTeacher').classList.remove('hidden');
      loadCourseTeacherDashboard();
      break;
    case 'TG':
      document.getElementById('viewTG').classList.remove('hidden');
      loadTGDashboard();
      break;
    case 'CLASS_TEACHER':
    case 'FACULTY':
      document.getElementById('viewClassTeacher').classList.remove('hidden');
      loadClassTeacherDashboard();
      break;
    case 'HOD':
      document.getElementById('viewHOD').classList.remove('hidden');
      loadHODDashboard();
      break;
    case 'ADMIN_MANAGEMENT':
      const userRole = state.currentUser ? state.currentUser.role : state.currentRole;
      if (userRole !== 'HOD' && userRole !== 'ADMIN') {
        showToast('Only Head of Department has access to Academic Administration.', 'error');
        switchRole(userRole);
        return;
      }
      document.getElementById('viewAdminManagement').classList.remove('hidden');
      loadAdminManagement();
      break;
  }
}

function updateHeaderUserCard() {
  const avatar = document.getElementById('userAvatar');
  const nameLabel = document.getElementById('userNameLabel');
  const roleTag = document.getElementById('userRoleTag');
  const loginBtn = document.getElementById('loginBtnLabel');

  if (loginBtn) {
    loginBtn.textContent = `Sign In / Switch (${state.currentRole})`;
  }

  if (state.currentUser) {
    const u = state.currentUser;
    if (u.role === 'STUDENT') {
      avatar.textContent = 'ST';
      avatar.style.backgroundColor = '#0284c7';
      nameLabel.textContent = u.displayName || 'Student Candidate';
      roleTag.textContent = `Student Candidate (${u.classInfo || 'Enrolled'}) • PRN: ${u.prn || '--'}`;
    } else if (u.role === 'COURSE_TEACHER') {
      avatar.textContent = 'CT';
      avatar.style.backgroundColor = '#2563eb';
      nameLabel.textContent = u.displayName || 'Course Teacher';
      roleTag.textContent = 'Associate Professor • Course Teacher';
    } else if (u.role === 'TG') {
      avatar.textContent = 'TG';
      avatar.style.backgroundColor = '#7c3aed';
      nameLabel.textContent = u.displayName || 'Teacher Guardian';
      roleTag.textContent = 'Faculty Mentor • Teacher Guardian';
    } else if (u.role === 'CLASS_TEACHER' || u.role === 'FACULTY') {
      avatar.textContent = 'FC';
      avatar.style.backgroundColor = '#059669';
      nameLabel.textContent = u.displayName || 'Faculty Member';
      roleTag.textContent = 'Faculty Member • Class Teacher';
    } else if (u.role === 'HOD') {
      avatar.textContent = 'HD';
      avatar.style.backgroundColor = '#dc2626';
      nameLabel.textContent = u.displayName || 'Dr. Namdev Sawant';
      roleTag.textContent = 'Head of Department • Full Governance';
    }
    return;
  }

  // Fallback default
  avatar.textContent = 'HD';
  avatar.style.backgroundColor = '#dc2626';
  nameLabel.textContent = 'Dr. Namdev Sawant';
  roleTag.textContent = 'Head of Department (Computer Engg)';
}

// ----------------------------------------------------------------------------
// VIEW 1: STUDENT DASHBOARD CONTROLLER
// ----------------------------------------------------------------------------
async function loadStudentDashboard() {
  try {
    const res = await fetch(`${API_BASE}/student/${state.currentUserId}/summary`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();

    const { student, cumulative, courses, recentLogs } = data;

    document.getElementById('studentHeaderBadge').textContent = 
      `${student.first_name} ${student.last_name} • ${student.class_level}-${student.division_name} • PRN: ${student.prn}`;

    const totalConducted = parseInt(cumulative?.total_lectures || 0, 10);
    const totalAttended = parseInt(cumulative?.attended_lectures || 0, 10);
    // User Requirement: If conducted is 20 and attended is 0, absent must display 20!
    // Formula: conducted = attended + absent => absent = Math.max(0, conducted - attended)
    const totalAbsent = Math.max(0, totalConducted - totalAttended);
    const cumPct = totalConducted > 0 ? parseFloat(((totalAttended / totalConducted) * 100).toFixed(1)) : 0.0;

    document.getElementById('studentOverallPct').textContent = `${cumPct.toFixed(1)}%`;
    document.getElementById('studentTotalConducted').textContent = totalConducted;
    document.getElementById('studentTotalAttended').textContent = totalAttended;
    document.getElementById('studentTotalAbsent').textContent = totalAbsent;

    const progBar = document.getElementById('studentProgressBar');
    progBar.style.width = `${Math.min(cumPct, 100)}%`;

    const pill = document.getElementById('studentStatusPill');
    if (cumPct >= 75) {
      pill.textContent = 'Compliant';
      pill.className = 'status-pill pill-success';
      progBar.style.backgroundColor = 'var(--success)';
    } else {
      pill.textContent = 'Critical Warning (<75%)';
      pill.className = 'status-pill pill-danger';
      progBar.style.backgroundColor = 'var(--danger)';
    }

    const coursesTbody = document.querySelector('#studentCoursesTable tbody');
    if (!courses || courses.length === 0) {
      coursesTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">No courses allocated for this curriculum division.</td></tr>`;
    } else {
      coursesTbody.innerHTML = courses.map(c => {
        const conducted = parseInt(c.total_conducted_lectures || 0, 10);
        const attended = parseInt(c.attended_lectures || 0, 10);
        // Formula: absent = conducted - attended
        const absent = Math.max(0, conducted - attended);
        const pct = conducted > 0 ? ((attended / conducted) * 100).toFixed(2) : '0.00';
        const isSatisfactory = parseFloat(pct) >= 75.0;
        return `
          <tr>
            <td class="cell-mono cell-bold">${c.course_code}</td>
            <td><strong>${c.course_name}</strong></td>
            <td>${c.credits}</td>
            <td>${conducted}</td>
            <td style="color: var(--success); font-weight: 600;">${attended}</td>
            <td style="color: var(--danger); font-weight: 600;">${absent}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="cell-mono font-bold">${pct}%</span>
                <div style="flex: 1; max-width: 80px; height: 5px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden;">
                  <div style="width: ${Math.min(parseFloat(pct), 100)}%; height: 100%; background: ${isSatisfactory ? 'var(--success)' : 'var(--danger)'};"></div>
                </div>
              </div>
            </td>
            <td>
              <span class="status-pill ${isSatisfactory ? 'pill-success' : 'pill-danger'}">
                ${isSatisfactory ? 'Eligible' : 'Defaulter'}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }

    const logsTbody = document.querySelector('#studentRecentLogsTable tbody');
    if (!recentLogs || recentLogs.length === 0) {
      logsTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No session logs recorded yet.</td></tr>`;
    } else {
      logsTbody.innerHTML = recentLogs.map(l => `
        <tr>
          <td class="cell-mono">${l.lecture_date}</td>
          <td>Slot ${l.slot_number}</td>
          <td class="cell-mono cell-bold">${l.course_code}</td>
          <td>
            <span class="status-pill ${getStatusPillClass(l.status)}">${l.status}</span>
          </td>
          <td>${l.marked_by_faculty}</td>
          <td><small style="color: var(--text-muted);">${l.remarks || 'Regular Curriculum Lecture'}</small></td>
        </tr>
      `).join('');
    }

  } catch (error) {
    console.error('Failed to load student dashboard:', error);
    showToast('Failed to load student attendance data', 'error');
  }
}

// ----------------------------------------------------------------------------
// VIEW 2: COURSE TEACHER DASHBOARD CONTROLLER
// ----------------------------------------------------------------------------
async function loadCourseTeacherDashboard() {
  try {
    const res = await fetch(`${API_BASE}/course-teacher/${state.currentUserId}/allocations`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();

    const { allocations, schedules } = data;

    const allocGrid = document.getElementById('teacherAllocationsGrid');
    if (!allocations || allocations.length === 0) {
      allocGrid.innerHTML = '<div style="color: var(--text-muted); padding: 16px;">No course allocations assigned.</div>';
    } else {
      allocGrid.innerHTML = allocations.map(a => `
        <div class="alloc-card-item">
          <div class="alloc-top-row">
            <span class="alloc-code-pill">${a.course_code}</span>
            <span class="status-pill pill-info">${a.lecture_type}</span>
          </div>
          <div class="alloc-title-text">${a.course_name}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 6px;">
            Cohort: <strong>${a.class_level} • Div ${a.division_name}</strong> (${a.classroom_number})
            ${a.faculty_name ? `<br><small style="color: var(--primary);">Faculty: ${a.faculty_name}</small>` : ''}
          </div>
          <div class="alloc-stats-row">
            <span>👥 ${a.student_count} Enrolled</span>
            <span>📅 ${a.conducted_count} Conducted</span>
            <span>⏳ ${a.scheduled_count} Scheduled</span>
          </div>
        </div>
      `).join('');
    }

    renderTeacherSchedulesTable(schedules);

  } catch (error) {
    console.error('Failed to load teacher allocations:', error);
    showToast('Failed to load teacher courses', 'error');
  }
}

function renderTeacherSchedulesTable(schedules) {
  const tbody = document.querySelector('#teacherSchedulesTable tbody');
  if (!schedules || schedules.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px;">No lecture schedules found.</td></tr>`;
    return;
  }

  tbody.innerHTML = schedules.map(s => `
    <tr>
      <td class="cell-mono font-bold">#${s.schedule_id}</td>
      <td class="cell-mono cell-bold">${s.course_code}</td>
      <td>Div ${s.division_name}</td>
      <td class="cell-mono">${s.lecture_date}</td>
      <td>Slot ${s.slot_number} (${(s.start_time || '').slice(0,5)} - ${(s.end_time || '').slice(0,5)})</td>
      <td>${s.room_number || '--'}</td>
      <td>
        <span class="status-pill ${getScheduleStatusPill(s.status)}">${s.status}</span>
      </td>
      <td>
        <small style="color: var(--text-muted);">
          ${s.faculty_name ? `<strong>${s.faculty_name}</strong><br>` : ''}
          ${s.substitute_faculty_name ? `Sub: ${s.substitute_faculty_name}` : (s.cancellation_reason || s.topic_covered || '—')}
        </small>
      </td>
      <td>
        <div style="display: flex; gap: 6px;">
          ${s.status === 'SCHEDULED' ? `
            <button class="btn btn-primary btn-sm" data-action="mark-sched" onclick="openMarkingModal(${s.schedule_id})">
              Mark Attendance
            </button>
            <button class="btn btn-secondary btn-sm" onclick="openRescheduleModal(${s.schedule_id}, '${s.lecture_date}', ${s.slot_number})">
              Reschedule
            </button>
            <button class="btn btn-secondary btn-sm" onclick="openSubstituteModal(${s.schedule_id})">
              Substitute
            </button>
          ` : `
            <button class="btn btn-secondary btn-sm" onclick="openMarkingModal(${s.schedule_id})">
              Review Roster
            </button>
          `}
        </div>
      </td>
    </tr>
  `).join('');
}

// ----------------------------------------------------------------------------
// ATOMIC ATTENDANCE MARKING MODAL
// ----------------------------------------------------------------------------
async function openMarkingModal(scheduleId) {
  state.activeScheduleId = scheduleId;

  try {
    const res = await fetch(`${API_BASE}/schedules/${scheduleId}/roster`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();

    const { schedule, roster } = data;
    state.activeRoster = roster;

    document.getElementById('markModalTitle').textContent = `Conduct & Mark Lecture #${schedule.schedule_id}`;
    document.getElementById('markModalSubtitle').textContent = 
      `${schedule.course_code}: ${schedule.course_name} • Div ${schedule.division_name} • ${schedule.lecture_date} (Slot ${schedule.slot_number})`;
    
    document.getElementById('inputTopicCovered').value = schedule.topic_covered || '';

    renderMarkingRoster(roster);
    openModal('modalAttendanceMarking');

  } catch (error) {
    console.error('Failed to open roster:', error);
    showToast('Failed to fetch schedule roster', 'error');
  }
}

function renderMarkingRoster(roster) {
  const tbody = document.getElementById('markingRosterTbody');
  tbody.innerHTML = roster.map((student, idx) => `
    <tr>
      <td class="cell-mono cell-bold">${student.roll_number}</td>
      <td>
        <strong>${student.student_name}</strong>
        ${student.attendance_id ? `<br><a href="javascript:void(0)" onclick="openCorrectionModal(${student.attendance_id}, '${escapeQuotes(student.student_name)}', '${student.status}')" style="font-size:0.72rem; color:var(--primary); text-decoration:underline;">[Override with Regulatory Reason]</a>` : ''}
      </td>
      <td class="cell-mono text-muted">${student.prn}</td>
      <td>
        <div class="status-pill-selector">
          ${['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map(st => `
            <button type="button" 
                    class="status-opt-btn ${student.status === st ? 'active-' + st : ''}"
                    onclick="setStudentStatus(${idx}, '${st}')">
              ${st}
            </button>
          `).join('')}
        </div>
      </td>
    </tr>
  `).join('');
}

function setStudentStatus(idx, status) {
  state.activeRoster[idx].status = status;
  renderMarkingRoster(state.activeRoster);
}

function setAllRosterStatus(status) {
  state.activeRoster.forEach(s => s.status = status);
  renderMarkingRoster(state.activeRoster);
}

async function submitAttendanceTransaction() {
  const topicCovered = document.getElementById('inputTopicCovered').value.trim();
  
  if (!topicCovered) {
    showToast('Please specify the Topic Covered for this lecture session.', 'error');
    return;
  }

  const payload = {
    scheduleId: state.activeScheduleId,
    facultyId: state.currentUserId,
    topicCovered,
    records: state.activeRoster.map(s => ({
      studentId: s.student_id,
      status: s.status,
      remarks: `Recorded via faculty #${state.currentUserId}`
    }))
  };

  try {
    const res = await fetch(`${API_BASE}/attendance/submit`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Attendance commit failed');

    showToast(`✓ MySQL InnoDB Transaction Committed: ${data.markedCount} attendance records recorded.`, 'success');
    closeModal('modalAttendanceMarking');
    
    // Refresh teacher schedules and alerts
    loadCourseTeacherDashboard();
    refreshAlerts();

  } catch (error) {
    console.error('Submission failed:', error);
    showToast(error.message, 'error');
  }
}

// ----------------------------------------------------------------------------
// ATTENDANCE CORRECTION WITH TRIGGERED AUDIT TRAIL
// ----------------------------------------------------------------------------
function openCorrectionModal(attendanceId, studentName, originalStatus) {
  document.getElementById('corrAttendanceId').value = attendanceId;
  document.getElementById('corrStudentName').textContent = studentName;
  document.getElementById('corrOriginalStatus').textContent = originalStatus;
  document.getElementById('corrNewStatus').value = originalStatus === 'PRESENT' ? 'ABSENT' : 'PRESENT';
  document.getElementById('corrReason').value = '';
  openModal('modalCorrection');
}

async function saveCorrection() {
  const attendanceId = parseInt(document.getElementById('corrAttendanceId').value, 10);
  const newStatus = document.getElementById('corrNewStatus').value;
  const reason = document.getElementById('corrReason').value.trim();

  if (reason.length < 5) {
    showToast('A mandatory regulatory justification (minimum 5 characters) is required.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/attendance/update-record`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        attendanceId,
        newStatus,
        reason,
        facultyId: state.currentUserId
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Correction failed');

    showToast(`✓ Attendance updated in MySQL. Regulatory audit entry #${data.auditEntry?.audit_id || 'LOGGED'} captured.`, 'success');
    closeModal('modalCorrection');

    // Refresh active roster
    if (state.activeScheduleId) {
      openMarkingModal(state.activeScheduleId);
    }
    refreshAlerts();

  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ----------------------------------------------------------------------------
// RESCHEDULE LECTURE
// ----------------------------------------------------------------------------
function openRescheduleModal(scheduleId, currentDate, currentSlot) {
  document.getElementById('reschedScheduleId').value = scheduleId;
  document.getElementById('reschedNewDate').value = currentDate;
  document.getElementById('reschedNewSlot').value = currentSlot;
  document.getElementById('reschedReason').value = '';
  openModal('modalReschedule');
}

async function confirmReschedule() {
  const scheduleId = parseInt(document.getElementById('reschedScheduleId').value, 10);
  const newDate = document.getElementById('reschedNewDate').value;
  const newSlot = parseInt(document.getElementById('reschedNewSlot').value, 10);
  const newRoom = document.getElementById('reschedNewRoom').value.trim();
  const reason = document.getElementById('reschedReason').value.trim();

  if (!newDate) {
    showToast('Please select a valid new lecture date.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/schedules/${scheduleId}/reschedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': state.currentRole,
        'x-user-id': state.currentUserId
      },
      body: JSON.stringify({ newDate, newSlot, newRoom, reason })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Reschedule failed');

    showToast(`✓ Lecture rescheduled to ${newDate} Slot ${newSlot} in MySQL.`, 'success');
    closeModal('modalReschedule');
    loadCourseTeacherDashboard();

  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ----------------------------------------------------------------------------
// FACULTY SUBSTITUTION
// ----------------------------------------------------------------------------
function openSubstituteModal(scheduleId) {
  document.getElementById('substScheduleId').value = scheduleId;
  document.getElementById('substReason').value = '';
  openModal('modalSubstitute');
}

async function confirmSubstitute() {
  const scheduleId = parseInt(document.getElementById('substScheduleId').value, 10);
  const substituteFacultyId = parseInt(document.getElementById('substFacultySelect').value, 10);
  const reason = document.getElementById('substReason').value.trim();

  try {
    const res = await fetch(`${API_BASE}/schedules/${scheduleId}/substitute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': state.currentRole,
        'x-user-id': state.currentUserId
      },
      body: JSON.stringify({ substituteFacultyId, reason })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Substitution assignment failed');

    showToast('✓ Substitute faculty assigned with SELECT ... FOR UPDATE row lock.', 'success');
    closeModal('modalSubstitute');
    loadCourseTeacherDashboard();

  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ----------------------------------------------------------------------------
// VIEW 3: TEACHER GUARDIAN (TG) CONTROLLER
// ----------------------------------------------------------------------------
async function loadTGDashboard() {
  try {
    const res = await fetch(`${API_BASE}/tg/${state.currentUserId}/mentees`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();

    const { mentees } = data;

    const tbody = document.querySelector('#tgMenteesTable tbody');
    if (!mentees || mentees.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px;">No mentees assigned under this mentor batch.</td></tr>`;
      return;
    }

    tbody.innerHTML = mentees.map(m => {
      const conducted = m.total_conducted_lectures ?? m.total_lectures_all_courses ?? 0;
      const attended = m.attended_lectures ?? m.total_attended ?? 0;
      const pct = parseFloat(m.cumulative_attendance_pct || 0);
      return `
        <tr>
          <td class="cell-mono cell-bold">${m.roll_number}</td>
          <td>
            <strong>${m.student_name}</strong>
            ${m.counseling_flag ? `<br><span class="status-pill pill-warning">Vigilance Active</span>` : ''}
          </td>
          <td class="cell-mono text-muted">${m.student_phone || '--'}</td>
          <td class="cell-mono">${m.parent_phone || '--'}</td>
          <td>${conducted}</td>
          <td style="color: var(--success); font-weight: 600;">${attended}</td>
          <td>
            <span class="cell-mono" style="font-weight: 700; color: ${pct >= 75 ? 'var(--success)' : 'var(--danger)'};">
              ${pct}%
            </span>
          </td>
          <td>
            <span class="status-pill ${m.defaulter_status === 'NORMAL' ? 'pill-success' : 'pill-danger'}">
              ${m.defaulter_status === 'NORMAL' ? 'Compliant' : 'Defaulter (<75%)'}
            </span>
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="openCounselingModal(${m.student_id}, '${escapeQuotes(m.student_name)}', ${m.counseling_flag}, '${escapeQuotes(m.counseling_notes || '')}')">
              Document Counseling
            </button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (error) {
    console.error('Failed to load TG dashboard:', error);
    showToast('Failed to load TG mentees', 'error');
  }
}

function openCounselingModal(studentId, studentName, counselingFlag, counselingNotes) {
  document.getElementById('counselingStudentId').value = studentId;
  document.getElementById('counselingStudentName').textContent = studentName;
  document.getElementById('counselingFlagCheck').checked = Boolean(counselingFlag);
  document.getElementById('counselingNotes').value = counselingNotes || '';
  openModal('modalCounseling');
}

async function saveCounseling() {
  const studentId = parseInt(document.getElementById('counselingStudentId').value, 10);
  const counselingFlag = document.getElementById('counselingFlagCheck').checked;
  const counselingNotes = document.getElementById('counselingNotes').value.trim();

  try {
    const res = await fetch(`${API_BASE}/tg/counseling`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ studentId, counselingFlag, counselingNotes })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update counseling notes');

    showToast('✓ Mentee counseling record committed to MySQL.', 'success');
    closeModal('modalCounseling');
    loadTGDashboard();

  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ----------------------------------------------------------------------------
// VIEW 4: CLASS TEACHER CONTROLLER
// ----------------------------------------------------------------------------
async function loadClassTeacherDashboard() {
  try {
    const res = await fetch(`${API_BASE}/class-teacher/${state.currentUserId}/division`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();

    const { summary, students } = data;

    if (summary) {
      document.getElementById('classTeacherDivBadge').textContent = 
        `${summary.class_level} • Division ${summary.division_name} (${summary.classroom_number})`;
      document.getElementById('ctTotalStudents').textContent = summary.total_students;
      document.getElementById('ctDivisionAverage').textContent = `${summary.division_average_attendance_pct}%`;
      document.getElementById('ctDefaulterCount').textContent = summary.defaulters_below_75;
    }

    const tbody = document.querySelector('#classTeacherStudentsTable tbody');
    const stdList = Array.isArray(students) ? students : [];
    if (stdList.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">No students enrolled in this division cohort.</td></tr>`;
      return;
    }

    tbody.innerHTML = stdList.map(s => `
      <tr>
        <td class="cell-mono cell-bold">${s.roll_number}</td>
        <td><strong>${s.student_name}</strong><br><small style="color:var(--text-muted);">${s.email}</small></td>
        <td class="cell-mono text-muted">${s.student_id + 20240000}</td>
        <td>${s.total_sessions}</td>
        <td style="color: var(--success); font-weight: 600;">${s.attended_sessions}</td>
        <td>
          <strong class="cell-mono" style="color: ${s.attendance_pct >= 75 ? 'var(--success)' : 'var(--danger)'};">
            ${s.attendance_pct}%
          </strong>
        </td>
        <td>
          <span class="status-pill ${s.is_defaulter ? 'pill-danger' : 'pill-success'}">
            ${s.is_defaulter ? 'Defaulter' : 'Compliant'}
          </span>
        </td>
        <td class="cell-mono text-muted">${s.parent_phone || '--'}</td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Failed to load class teacher view:', error);
    showToast('Failed to load class teacher report', 'error');
  }
}

function exportDivisionCSV() {
  const rows = [
    ['Roll', 'Name', 'Total Sessions', 'Attended', 'Attendance %', 'Status', 'Parent Contact']
  ];

  document.querySelectorAll('#classTeacherStudentsTable tbody tr').forEach(tr => {
    const cols = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.replace(/\n/g, ' '));
    rows.push([cols[0], cols[1], cols[3], cols[4], cols[5], cols[6], cols[7]]);
  });

  const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `division_attendance_roster_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ----------------------------------------------------------------------------
// VIEW 5: HEAD OF DEPARTMENT (HOD) EXECUTIVE COMMAND
// ----------------------------------------------------------------------------
async function loadHODDashboard() {
  try {
    const res = await fetch(`${API_BASE}/hod/${state.currentDepartmentId}/dashboard`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();

    const { department, courses, allDepartments, defaulters } = data;

    if (department) {
      document.getElementById('hodDeptPct').textContent = `${department.department_overall_attendance_pct}%`;
      document.getElementById('hodDeptNameLabel').textContent = `${department.department_name} (HOD: ${department.hod_name})`;
      document.getElementById('hodFacultyCount').textContent = department.total_faculty_count;
      document.getElementById('hodStudentsCount').textContent = department.total_enrolled_students;
      document.getElementById('hodConductedCount').textContent = department.total_conducted_sessions;
    }

    const allDeptTbody = document.querySelector('#allDepartmentsTable tbody');
    allDeptTbody.innerHTML = allDepartments.map(d => `
      <tr class="${d.department_id === state.currentDepartmentId ? 'highlight-row' : ''}">
        <td class="cell-mono cell-bold">${d.department_code}</td>
        <td><strong>${d.department_name}</strong></td>
        <td>${d.hod_name || 'Prof In-Charge'}</td>
        <td>${d.total_faculty_count}</td>
        <td>${d.total_active_courses}</td>
        <td>${d.total_enrolled_students}</td>
        <td>${d.total_conducted_sessions}</td>
        <td>
          <strong class="cell-mono" style="color: ${d.department_overall_attendance_pct >= 75 ? 'var(--success)' : 'var(--danger)'};">
            ${d.department_overall_attendance_pct}%
          </strong>
        </td>
      </tr>
    `).join('');

    const coursesTbody = document.querySelector('#hodCoursesTable tbody');
    coursesTbody.innerHTML = courses.map(c => `
      <tr>
        <td class="cell-mono cell-bold">${c.course_code}</td>
        <td><strong>${c.course_name}</strong></td>
        <td><span class="status-pill pill-neutral">${c.lecture_type}</span></td>
        <td>${c.faculty_name}</td>
        <td>${c.conducted_count}</td>
        <td>
          <strong class="cell-mono" style="color: ${c.average_attendance_pct >= 75 ? 'var(--success)' : 'var(--danger)'};">
            ${c.average_attendance_pct}%
          </strong>
        </td>
        <td>
          <span class="status-pill ${c.average_attendance_pct >= 75 ? 'pill-success' : 'pill-danger'}">
            ${c.average_attendance_pct >= 75 ? 'Optimal' : 'Needs Review'}
          </span>
        </td>
      </tr>
    `).join('');

    const defTbody = document.querySelector('#hodDefaultersTable tbody');
    defTbody.innerHTML = defaulters.map(d => `
      <tr>
        <td class="cell-mono cell-bold">${d.roll_number}</td>
        <td>${d.class_level} • Div ${d.division_name}</td>
        <td><strong>${d.student_name}</strong></td>
        <td class="cell-mono" style="color: var(--danger); font-weight: 700;">${d.attendance_pct}%</td>
        <td style="color: var(--warning);">${(75.0 - d.attendance_pct).toFixed(1)}% Deficit</td>
        <td><span class="status-pill pill-danger">Warning Mandatory</span></td>
      </tr>
    `).join('');

  } catch (error) {
    console.error('Failed to load HOD dashboard:', error);
    showToast('Failed to load HOD executive dashboard', 'error');
  }
}

// ----------------------------------------------------------------------------
// VIEW 6: ACADEMIC ADMINISTRATION & GOVERNANCE (HOD EXCLUSIVE)
// ----------------------------------------------------------------------------
async function loadAdminManagement() {
  if (state.currentUser && state.currentUser.role !== 'HOD') {
    showToast('Unauthorized: Academic Administration is restricted exclusively to HOD / Admin.', 'error');
    switchRole(state.currentUser.role, state.currentUserId);
    return;
  }

  await loadAdminMetadata();
  switchAdminSection(state.admin.activeSection || 'students');
}

function switchAdminSection(section) {
  state.admin.activeSection = section;

  // Update pill navigation buttons
  const pills = {
    students: document.getElementById('btnPillStudents'),
    faculty: document.getElementById('btnPillFaculty'),
    courses: document.getElementById('btnPillCourses'),
    allocations: document.getElementById('btnPillAllocations')
  };
  Object.keys(pills).forEach(key => {
    if (pills[key]) pills[key].classList.toggle('active', key === section);
  });

  // Update subpanels
  const panels = {
    students: document.getElementById('adminPanelStudents'),
    faculty: document.getElementById('adminPanelFaculty'),
    courses: document.getElementById('adminPanelCourses'),
    allocations: document.getElementById('adminPanelAllocations')
  };
  Object.keys(panels).forEach(key => {
    if (panels[key]) panels[key].classList.toggle('hidden', key !== section);
  });

  if (section === 'students') loadAdminStudents();
  else if (section === 'faculty') loadAdminFaculty();
  else if (section === 'courses') loadAdminCourses();
  else if (section === 'allocations') loadAdminAllocations();
}

async function loadAdminMetadata() {
  try {
    const res = await fetch(`${API_BASE}/admin/metadata`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch admin metadata');
    const data = await res.json();
    state.admin.metadata = data;

    // 1. Division selects (Add Student & Add Allocation)
    const stdDivSelect = document.getElementById('newStdDivision');
    const divisions = Array.isArray(data.divisions) ? data.divisions : [];
    if (stdDivSelect && divisions.length > 0) {
      stdDivSelect.innerHTML = divisions.map(d =>
        `<option value="${d.division_id}">${d.class_level} - Div ${d.division_name} (${d.department_code || 'COMP'})</option>`
      ).join('');
    }
    const allocDivSelect = document.getElementById('newAllocDivision');
    if (allocDivSelect && divisions.length > 0) {
      allocDivSelect.innerHTML = divisions.map(d =>
        `<option value="${d.division_id}">${d.class_level} - Div ${d.division_name} (${d.department_code || 'COMP'})</option>`
      ).join('');
    }

    // 2. Department selects (Add Faculty & Add Course)
    const facDeptSelect = document.getElementById('newFacDept');
    const departments = Array.isArray(data.departments) ? data.departments : [];
    if (facDeptSelect && departments.length > 0) {
      facDeptSelect.innerHTML = departments.map(d =>
        `<option value="${d.department_id}">${d.department_code} - ${d.department_name}</option>`
      ).join('');
    }
    const courseDeptSelect = document.getElementById('newCourseDept');
    if (courseDeptSelect && departments.length > 0) {
      courseDeptSelect.innerHTML = departments.map(d =>
        `<option value="${d.department_id}">${d.department_code} - ${d.department_name}</option>`
      ).join('');
    }

    // 3. Faculty select (Add Allocation)
    const allocFacSelect = document.getElementById('newAllocFaculty');
    const faculty = Array.isArray(data.faculty) ? data.faculty : [];
    if (allocFacSelect && faculty.length > 0) {
      allocFacSelect.innerHTML = faculty.map(f =>
        `<option value="${f.faculty_id}">${f.name || f.full_name} (${f.designation} - ${f.department_code})</option>`
      ).join('');
    }

    // 4. Course select (Add Allocation)
    const allocCourseSelect = document.getElementById('newAllocCourse');
    const courses = Array.isArray(data.courses) ? data.courses : [];
    if (allocCourseSelect && courses.length > 0) {
      allocCourseSelect.innerHTML = courses.map(c =>
        `<option value="${c.course_id}">${c.course_code} - ${c.course_name} (${c.course_type || c.lecture_type || 'THEORY'})</option>`
      ).join('');
    }

  } catch (err) {
    console.error('Error loading admin metadata:', err);
    showToast('Failed to load metadata: ' + err.message, 'error');
  }
}

// --- STUDENTS ---
async function loadAdminStudents() {
  const tbody = document.getElementById('adminStudentsTbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">Loading students directory...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/admin/students`, { headers: getAuthHeaders() });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch students');
    }
    const raw = await res.json();
    const students = Array.isArray(raw) ? raw : (raw?.students || []);
    state.admin.students = students;
    renderAdminStudentsTable(students);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 24px;">Error: ${err.message}</td></tr>`;
  }
}

function renderAdminStudentsTable(students) {
  const tbody = document.getElementById('adminStudentsTbody');
  if (!tbody) return;
  const list = Array.isArray(students) ? students : [];
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No students enrolled yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(s => `
    <tr>
      <td class="cell-mono cell-bold">${s.roll_number}</td>
      <td class="cell-mono">${s.prn}</td>
      <td><strong>${s.first_name} ${s.last_name}</strong></td>
      <td><span class="status-pill pill-neutral">${s.class_level || ''} Div ${s.division_name || ''}</span></td>
      <td class="cell-mono text-muted">${s.email}</td>
      <td>
        <button class="btn btn-danger btn-del-sm" onclick="deleteAdminStudent(${s.student_id}, '${escapeQuotes(s.first_name + ' ' + s.last_name)}')" title="Remove Student">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          <span>Delete</span>
        </button>
      </td>
    </tr>
  `).join('');
}

function filterAdminStudents() {
  const query = (document.getElementById('adminStudentSearch')?.value || '').toLowerCase().trim();
  const list = Array.isArray(state.admin.students) ? state.admin.students : [];
  if (!query) {
    renderAdminStudentsTable(list);
    return;
  }
  const filtered = list.filter(s =>
    ((s.first_name || '') + ' ' + (s.last_name || '')).toLowerCase().includes(query) ||
    (s.prn && s.prn.toLowerCase().includes(query)) ||
    (s.email && s.email.toLowerCase().includes(query)) ||
    String(s.roll_number || '').includes(query)
  );
  renderAdminStudentsTable(filtered);
}

async function submitAdminAddStudent() {
  const prn = document.getElementById('newStdPrn').value.trim();
  const rollNumber = parseInt(document.getElementById('newStdRoll').value, 10);
  const firstName = document.getElementById('newStdFirstName').value.trim();
  const lastName = document.getElementById('newStdLastName').value.trim();
  const email = document.getElementById('newStdEmail').value.trim();
  const phone = document.getElementById('newStdPhone').value.trim();
  const divisionId = parseInt(document.getElementById('newStdDivision').value, 10);
  const password = document.getElementById('newStdPassword').value.trim();

  if (!prn || !rollNumber || !firstName || !lastName || !email || !divisionId) {
    showToast('Please fill all mandatory fields for student enrollment.', 'error');
    return;
  }

  const btn = document.getElementById('btnAdminSaveStudent');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/admin/students`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prn, rollNumber, firstName, lastName, email, phone, divisionId, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to enroll student');

    showToast(`✓ Student ${firstName} ${lastName} enrolled! Login: ${data.username}`, 'success');
    document.getElementById('formAdminAddStudent').reset();
    await loadAdminStudents();
  } catch (err) {
    showToast('Enrollment Error: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteAdminStudent(studentId, name) {
  if (!confirm(`Are you sure you want to delete student "${name}"? This will remove all associated attendance records and login credentials.`)) {
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/admin/students/${studentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete student');
    showToast(`✓ Student record removed successfully.`, 'success');
    await loadAdminStudents();
  } catch (err) {
    showToast('Deletion Error: ' + err.message, 'error');
  }
}

// --- FACULTY ---
async function loadAdminFaculty() {
  const tbody = document.getElementById('adminFacultyTbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">Loading faculty directory...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/admin/faculty`, { headers: getAuthHeaders() });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch faculty');
    }
    const raw = await res.json();
    const faculty = Array.isArray(raw) ? raw : (raw?.faculty || []);
    state.admin.faculty = faculty;
    if (faculty.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No faculty appointed yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = faculty.map(f => `
      <tr>
        <td class="cell-mono cell-bold">${f.employee_code}</td>
        <td><strong>${f.first_name} ${f.last_name}</strong></td>
        <td><span class="status-pill pill-info">${f.designation}</span></td>
        <td>${f.department_code || ''}</td>
        <td class="cell-mono text-muted">${f.email}</td>
        <td>
          <button class="btn btn-danger btn-del-sm" onclick="deleteAdminFaculty(${f.faculty_id}, '${escapeQuotes(f.first_name + ' ' + f.last_name)}')" title="Remove Faculty">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span>Delete</span>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 24px;">Error: ${err.message}</td></tr>`;
  }
}

async function submitAdminAddFaculty() {
  const employeeCode = document.getElementById('newFacCode').value.trim();
  const departmentId = parseInt(document.getElementById('newFacDept').value, 10);
  const firstName = document.getElementById('newFacFirstName').value.trim();
  const lastName = document.getElementById('newFacLastName').value.trim();
  const email = document.getElementById('newFacEmail').value.trim();
  const phone = document.getElementById('newFacPhone').value.trim();
  const designation = document.getElementById('newFacDesignation').value.trim();
  const password = document.getElementById('newFacPassword').value.trim();

  if (!employeeCode || !departmentId || !firstName || !lastName || !email || !designation) {
    showToast('Please fill all mandatory fields for faculty appointment.', 'error');
    return;
  }

  const btn = document.getElementById('btnAdminSaveFaculty');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/admin/faculty`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ employeeCode, departmentId, firstName, lastName, email, phone, designation, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to appoint faculty');

    showToast(`✓ Faculty Prof. ${firstName} ${lastName} appointed! Login: ${data.username}`, 'success');
    document.getElementById('formAdminAddFaculty').reset();
    await loadAdminFaculty();
    await loadAdminMetadata();
  } catch (err) {
    showToast('Appointment Error: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteAdminFaculty(facultyId, name) {
  if (!confirm(`Are you sure you want to remove faculty "${name}"? This will reassign/delete their courses, allocations, and login credentials.`)) {
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/admin/faculty/${facultyId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to remove faculty');
    showToast(`✓ Faculty removed successfully.`, 'success');
    await loadAdminFaculty();
    await loadAdminMetadata();
  } catch (err) {
    showToast('Deletion Error: ' + err.message, 'error');
  }
}

// --- COURSES ---
async function loadAdminCourses() {
  const tbody = document.getElementById('adminCoursesTbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">Loading curriculum subjects...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/admin/courses`, { headers: getAuthHeaders() });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch courses');
    }
    const raw = await res.json();
    const courses = Array.isArray(raw) ? raw : (raw?.courses || []);
    state.admin.courses = courses;
    if (courses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No curriculum subjects added yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = courses.map(c => `
      <tr>
        <td class="cell-mono cell-bold">${c.course_code}</td>
        <td><strong>${c.course_name}</strong></td>
        <td>${c.department_code || ''}</td>
        <td>Sem ${c.semester}</td>
        <td><span class="status-pill ${c.course_type === 'LAB' || c.lecture_type === 'LAB' ? 'pill-warning' : 'pill-info'}">${c.course_type || c.lecture_type || 'THEORY'}</span></td>
        <td class="cell-mono">${c.credits}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 24px;">Error: ${err.message}</td></tr>`;
  }
}

async function submitAdminAddCourse() {
  const courseCode = document.getElementById('newCourseCode').value.trim();
  const departmentId = parseInt(document.getElementById('newCourseDept').value, 10);
  const courseName = document.getElementById('newCourseName').value.trim();
  const semester = parseInt(document.getElementById('newCourseSemester').value, 10);
  const courseType = document.getElementById('newCourseType').value.trim();
  const credits = parseFloat(document.getElementById('newCourseCredits').value);

  if (!courseCode || !departmentId || !courseName || !semester || !courseType) {
    showToast('Please fill all mandatory fields to add curriculum subject.', 'error');
    return;
  }

  const btn = document.getElementById('btnAdminSaveCourse');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/admin/courses`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ courseCode, departmentId, courseName, semester, courseType, credits })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add course');

    showToast(`✓ Subject ${courseCode} - ${courseName} successfully added!`, 'success');
    document.getElementById('formAdminAddCourse').reset();
    await loadAdminCourses();
    await loadAdminMetadata();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// --- ALLOCATIONS ---
async function loadAdminAllocations() {
  const tbody = document.getElementById('adminAllocationsTbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">Loading allocations...</td></tr>`;

  try {
    const res = await fetch(`${API_BASE}/admin/allocations`, { headers: getAuthHeaders() });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to fetch allocations');
    }
    const raw = await res.json();
    const allocs = Array.isArray(raw) ? raw : (raw?.allocations || []);
    state.admin.allocations = allocs;
    if (allocs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No teaching allocations assigned yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = allocs.map(a => `
      <tr>
        <td><strong>${a.course_code}</strong> - ${a.course_name} <span class="status-pill pill-neutral" style="font-size:0.65rem;">${a.course_type || a.lecture_type || 'THEORY'}</span></td>
        <td>${a.faculty_name} <span style="font-size:0.75rem; color:var(--text-muted);">(${a.designation || 'Faculty'})</span></td>
        <td><span class="status-pill pill-info">${a.class_level} Div ${a.division_name}</span></td>
        <td>${a.department_code || ''}</td>
        <td>
          <button class="btn btn-danger btn-del-sm" onclick="deleteAdminAllocation(${a.allocation_id})" title="Delete Allocation">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span>Delete</span>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger); padding: 24px;">Error: ${err.message}</td></tr>`;
  }
}

async function submitAdminAddAllocation() {
  const courseId = parseInt(document.getElementById('newAllocCourse').value, 10);
  const facultyId = parseInt(document.getElementById('newAllocFaculty').value, 10);
  const divisionId = parseInt(document.getElementById('newAllocDivision').value, 10);

  if (!courseId || !facultyId || !divisionId) {
    showToast('Please select Course, Faculty, and Division to assign teaching load.', 'error');
    return;
  }

  const btn = document.getElementById('btnAdminSaveAllocation');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/admin/allocations`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ courseId, facultyId, divisionId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to assign allocation');

    showToast(`✓ Teaching allocation assigned successfully!`, 'success');
    await loadAdminAllocations();
  } catch (err) {
    showToast('Allocation Error: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteAdminAllocation(allocationId) {
  if (!confirm(`Are you sure you want to revoke this course teaching allocation?`)) {
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/admin/allocations/${allocationId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete allocation');
    showToast(`✓ Teaching allocation revoked.`, 'success');
    await loadAdminAllocations();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ----------------------------------------------------------------------------
// AUTOMATED ALERTS ENGINE
// ----------------------------------------------------------------------------
async function refreshAlerts() {
  try {
    const res = await fetch(`${API_BASE}/alerts`);
    const data = await res.json();

    const { defaulterAlerts, consecutiveAbsenceAlerts, totalAlertsCount } = data;

    document.getElementById('alertCountBadge').textContent = totalAlertsCount;

    const drawer = document.getElementById('alertsDrawerContent');
    let html = '';

    if (consecutiveAbsenceAlerts.length > 0) {
      html += `<div style="font-size:0.72rem; font-weight:700; color:var(--text-subtle); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.04em;">CONTINUOUS ABSENCE PATTERNS (3+ CONSECUTIVE)</div>`;
      html += consecutiveAbsenceAlerts.map(a => `
        <div class="alert-item-card">
          <div class="alert-item-title">
            <span>Roll ${a.roll_number} • ${a.student_name}</span>
            <span class="status-pill pill-danger">CRITICAL</span>
          </div>
          <div class="alert-item-desc">
            Missed 3 consecutive lectures in <strong>${a.course_code}</strong> on ${a.trigger_date}. Immediate TG counseling required.
          </div>
        </div>
      `).join('');
    }

    if (defaulterAlerts.length > 0) {
      html += `<div style="font-size:0.72rem; font-weight:700; color:var(--text-subtle); margin:16px 0 8px; text-transform:uppercase; letter-spacing:0.04em;">STATUTORY DEFAULTERS (&lt; 75.0% THRESHOLD)</div>`;
      html += defaulterAlerts.map(a => `
        <div class="alert-item-card" style="border-left-color: var(--warning);">
          <div class="alert-item-title">
            <span>Roll ${a.roll_number} • ${a.student_name} (${a.division_name})</span>
            <span class="status-pill pill-warning">${a.attendance_pct}%</span>
          </div>
          <div class="alert-item-desc">
            Statutory deficit. Parent notification required. Contact: <span class="cell-mono">${a.email}</span>
          </div>
        </div>
      `).join('');
    }

    drawer.innerHTML = html || '<div style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:30px;">No active alerts. All cohorts within bounds.</div>';

  } catch (error) {
    console.error('Failed to refresh alerts:', error);
  }
}

function toggleAlertsDrawer() {
  const drawer = document.getElementById('alertsDrawer');
  drawer.classList.toggle('hidden');
}



// ----------------------------------------------------------------------------
// MODAL & UTILITY HELPERS
// ----------------------------------------------------------------------------
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast-message toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 4500);
}

function getStatusPillClass(status) {
  switch (status) {
    case 'PRESENT': return 'pill-success';
    case 'ABSENT': return 'pill-danger';
    case 'LATE': return 'pill-warning';
    case 'EXCUSED': return 'pill-info';
    default: return 'pill-neutral';
  }
}

function getScheduleStatusPill(status) {
  switch (status) {
    case 'CONDUCTED': return 'pill-success';
    case 'SCHEDULED': return 'pill-info';
    case 'CANCELLED': return 'pill-danger';
    case 'RESCHEDULED': return 'pill-warning';
    default: return 'pill-neutral';
  }
}

function escapeQuotes(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
