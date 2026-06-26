import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import './styles/global.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const demoAccounts = [
  { role: 'Admin', email: 'admin@hmss.com', password: 'admin123' },
  { role: 'Doctor', email: 'doctor@hmss.com', password: 'doctor123' },
  { role: 'Nurse', email: 'nurse@hmss.com', password: 'nurse123' },
  { role: 'Pharmacy', email: 'pharmacy@hmss.com', password: 'pharmacy123' },
  { role: 'Insurance', email: 'insurance@hmss.com', password: 'insurance123' },
  { role: 'TPA', email: 'tpa@hmss.com', password: 'tpa123' },
  { role: 'Reception', email: 'reception@hmss.com', password: 'reception123' },
  { role: 'Lab', email: 'lab@hmss.com', password: 'lab123' }
];

const roleCards = [
  { title: 'Admin Dashboard', icon: '🏥', text: 'Users, branches, audit logs, analytics and security controls.' },
  { title: 'Doctor Dashboard', icon: '👨‍⚕️', text: 'Patient records, prescriptions, consultation notes and lab reports.' },
  { title: 'Nurse Dashboard', icon: '🧑‍⚕️', text: 'Assigned patients, vitals, test updates and report uploads.' },
  { title: 'Pharmacy Dashboard', icon: '💊', text: 'Prescriptions, medicine issue, stock and supplier overview.' },
  { title: 'Insurance Dashboard', icon: '🧾', text: 'Claims, invoices, billing records and payment status.' },
  { title: 'Reception Dashboard', icon: '🛎️', text: 'Patient registration, appointment queue and basic patient details.' }
];

const sidebarMenus = {
  ADMIN: ['Overview', 'Patients', 'Users', 'Page Access', 'Branches', 'Audit Logs', 'Settings'],
  DOCTOR: ['Overview', 'Patients', 'Consultations', 'Prescriptions', 'Lab Reports', 'Referrals'],
  NURSE: ['Overview', 'Assigned Patients', 'Vitals', 'Upload Reports', 'Patient IDs'],
  PHARMACY: ['Overview', 'Prescriptions', 'Medicine Issue', 'Stock', 'Patient IDs'],
  INSURANCE: ['Overview', 'Claims', 'Invoices', 'Payment Status', 'Patient IDs'],
  TPA: ['Overview', 'Claim Verification', 'Approval Status', 'Documents'],
  RECEPTION: ['Overview', 'Register Patient', 'Appointments', 'Queue', 'Basic Details'],
  LAB: ['Overview', 'Lab Requests', 'Upload Reports', 'Test Status']
};

const permissions = {
  ADMIN: ['Full branch control', 'User management', 'Admin analytics', 'Audit logs', 'Security settings'],
  DOCTOR: ['Patient name after verification', 'Diagnosis notes', 'Prescriptions', 'Lab reports', 'Referrals'],
  NURSE: ['Patient ID only', 'Assigned tests', 'Vitals update', 'Report upload', 'No diagnosis notes'],
  PHARMACY: ['Patient ID only', 'Prescription view', 'Medicine issue', 'Stock update', 'No medical history'],
  INSURANCE: ['Patient ID only', 'Claim ID', 'Invoice copies', 'Payment status', 'No diagnosis'],
  TPA: ['Claim verification', 'Claim status', 'Invoice review', 'No medical notes'],
  RECEPTION: ['Register patient', 'Manage appointments', 'Basic patient details only'],
  LAB: ['Lab requests', 'Upload reports', 'Update test status', 'No billing access']
};

const defaultPageAccess = {
  DOCTOR: ['Overview', 'Patients', 'Consultations', 'Prescriptions', 'Lab Reports', 'Referrals'],
  NURSE: ['Overview', 'Assigned Patients'],
  PHARMACY: ['Overview', 'Prescriptions', 'Medicine Issue'],
  INSURANCE: ['Overview', 'Claims', 'Invoices', 'Payment Status'],
  TPA: ['Overview', 'Claim Verification', 'Approval Status'],
  RECEPTION: ['Overview', 'Register Patient', 'Appointments', 'Queue'],
  LAB: ['Overview', 'Lab Requests', 'Upload Reports', 'Test Status']
};

function App() {
  const [page, setPage] = useState('home');
  const [activeMenu, setActiveMenu] = useState('Overview');
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('hmss_user') || 'null'));
  const [token, setToken] = useState(() => localStorage.getItem('hmss_token') || '');
  const [verifiedAccess, setVerifiedAccess] = useState(() => localStorage.getItem('hmss_verified') === 'true');
  const [dashboard, setDashboard] = useState(null);
  const [patients, setPatients] = useState([]);
  const [googleUsers, setGoogleUsers] = useState(() =>
    JSON.parse(localStorage.getItem('hmss_google_users') || '[]')
  );
  const [pageAccess, setPageAccess] = useState(() =>
    JSON.parse(localStorage.getItem('hmss_page_access') || JSON.stringify(defaultPageAccess))
  );
  const [toast, setToast] = useState('');
  const [loginForm, setLoginForm] = useState({
    email: 'admin@hmss.com',
    password: 'admin123',
    hospitalCode: 'HMSS001',
    branch: 'Andhra Pradesh',
    role: 'Admin',
    fullName: ''
  });
  const [patientForm, setPatientForm] = useState({
    name: '',
    age: '',
    gender: 'Male',
    branch: 'Andhra Pradesh',
    diagnosis: '',
    bill: '',
    doctor: 'Dr. Sharma'
  });

  const isLoggedIn = Boolean(user && token);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-verified-access': verifiedAccess ? 'true' : 'false'
    }),
    [token, verifiedAccess]
  );

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(''), 2800);
  }

  async function safeJson(res) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  function saveGoogleUser(googleUser) {
    const existingUsers = JSON.parse(localStorage.getItem('hmss_google_users') || '[]');

    const userRecord = {
      ...googleUser,
      loginMethod: 'Google',
      lastLogin: new Date().toLocaleString(),
      status: 'Online'
    };

    const updatedUsers = [
      userRecord,
      ...existingUsers.filter((u) => u.email !== googleUser.email)
    ];

    localStorage.setItem('hmss_google_users', JSON.stringify(updatedUsers));
    setGoogleUsers(updatedUsers);
  }

  function updatePageAccess(role, pageName) {
    const currentPages = pageAccess[role] || [];
    const updatedRolePages = currentPages.includes(pageName)
      ? currentPages.filter((page) => page !== pageName)
      : [...currentPages, pageName];

    const updatedAccess = {
      ...pageAccess,
      [role]: updatedRolePages
    };

    localStorage.setItem('hmss_page_access', JSON.stringify(updatedAccess));
    setPageAccess(updatedAccess);
    showToast(`${role} page access updated`);
  }

  function resetPageAccess() {
    localStorage.setItem('hmss_page_access', JSON.stringify(defaultPageAccess));
    setPageAccess(defaultPageAccess);
    showToast('Default page access restored');
  }

  async function loginWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) showToast(error.message);
  }

  useEffect(() => {
    async function checkGoogleSession() {
      const { data } = await supabase.auth.getUser();

      if (data?.user) {
        const googleUser = {
          id: data.user.id,
          name: data.user.user_metadata?.full_name || data.user.email,
          email: data.user.email,
          role: 'ADMIN',
          branch: 'Google Login'
        };

        localStorage.setItem('hmss_user', JSON.stringify(googleUser));
        localStorage.setItem('hmss_token', data.user.id);
        localStorage.removeItem('hmss_verified');

        setUser(googleUser);
        setToken(data.user.id);
        setVerifiedAccess(false);
        setActiveMenu('Overview');
        saveGoogleUser(googleUser);
        setPage('dashboard');
      }
    }

    checkGoogleSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const googleUser = {
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email,
          email: session.user.email,
          role: 'ADMIN',
          branch: 'Google Login'
        };

        localStorage.setItem('hmss_user', JSON.stringify(googleUser));
        localStorage.setItem('hmss_token', session.user.id);
        localStorage.removeItem('hmss_verified');

        setUser(googleUser);
        setToken(session.user.id);
        setVerifiedAccess(false);
        setActiveMenu('Overview');
        saveGoogleUser(googleUser);
        setPage('dashboard');
      }
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  async function loadSecureData() {
    if (!token) return;

    try {
      const [dashRes, patientRes] = await Promise.all([
        fetch(`${API_URL}/api/dashboard`, { headers: authHeaders }),
        fetch(`${API_URL}/api/patients`, { headers: authHeaders })
      ]);

      if (!dashRes.ok || !patientRes.ok) {
        throw new Error('Backend not ready, using demo dashboard');
      }

      setDashboard(await dashRes.json());
      setPatients(await patientRes.json());
    } catch (error) {
      setDashboard(getDemoDashboard());
      setPatients(getDemoPatients(user?.role || 'ADMIN', verifiedAccess));
      showToast(error.message || 'Demo data loaded');
    }
  }

  useEffect(() => {
    if (isLoggedIn) loadSecureData();
  }, [isLoggedIn, token, verifiedAccess]);

  async function handleLogin(event) {
    event.preventDefault();

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginForm.email, password: loginForm.password })
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.message || 'Backend login unavailable, using demo login');
      }

      localStorage.setItem('hmss_token', data.token);
      localStorage.setItem('hmss_user', JSON.stringify(data.user));
      localStorage.removeItem('hmss_verified');

      setToken(data.token);
      setUser(data.user);
      setVerifiedAccess(false);
      setActiveMenu('Overview');
      setPage('dashboard');

      showToast(`Welcome ${data.user.name}`);
    } catch (error) {
      const demo = demoAccounts.find((a) => a.email === loginForm.email && a.password === loginForm.password);

      if (!demo) return showToast(error.message || 'Invalid demo credentials');

      const demoUser = {
        id: demo.email,
        name: demo.role === 'Admin' ? 'Central Admin' : `${demo.role} User`,
        email: demo.email,
        role: demo.role.toUpperCase(),
        branch: loginForm.branch
      };

      localStorage.setItem('hmss_token', 'demo-token');
      localStorage.setItem('hmss_user', JSON.stringify(demoUser));
      localStorage.removeItem('hmss_verified');

      setToken('demo-token');
      setUser(demoUser);
      setVerifiedAccess(false);
      setActiveMenu('Overview');
      setDashboard(getDemoDashboard());
      setPatients(getDemoPatients(demoUser.role, false));
      setPage('dashboard');

      showToast(`Demo login active: ${demoUser.role}`);
    }
  }

  function verifyDoctorAccess(method) {
    if (user?.role !== 'DOCTOR') {
      showToast('Only doctors can unlock patient names using secure verification.');
      return;
    }

    localStorage.setItem('hmss_verified', 'true');
    setVerifiedAccess(true);
    setPatients(getDemoPatients('DOCTOR', true));
    showToast(`${method} verification successful. Patient names unlocked.`);
  }

  async function logout() {
    await supabase.auth.signOut();

    localStorage.removeItem('hmss_token');
    localStorage.removeItem('hmss_user');
    localStorage.removeItem('hmss_verified');

    setUser(null);
    setToken('');
    setVerifiedAccess(false);
    setDashboard(null);
    setPatients([]);
    setPage('home');

    showToast('Logged out successfully');
  }

  async function addPatient(event) {
    event.preventDefault();

    try {
      const res = await fetch(`${API_URL}/api/patients`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          ...patientForm,
          tests: ['CBC', 'Vitals'],
          prescription: ['Doctor review pending'],
          status: 'Registered'
        })
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.message || 'Demo mode: patient added locally');
      }

      setPatientForm({
        name: '',
        age: '',
        gender: 'Male',
        branch: 'Andhra Pradesh',
        diagnosis: '',
        bill: '',
        doctor: 'Dr. Sharma'
      });

      await loadSecureData();

      showToast('Patient registered successfully');
    } catch (error) {
      const newPatient = {
        id: `P-${Date.now().toString().slice(-5)}`,
        name: user?.role === 'DOCTOR' && verifiedAccess ? patientForm.name : `PID-${Date.now().toString().slice(-5)}`,
        age: patientForm.age,
        gender: patientForm.gender,
        branch: patientForm.branch,
        diagnosis: ['ADMIN', 'DOCTOR'].includes(user?.role) ? patientForm.diagnosis || 'Pending' : 'Restricted',
        bill: patientForm.bill || '0',
        doctor: patientForm.doctor,
        status: 'Registered'
      };

      setPatients((prev) => [newPatient, ...prev]);

      setPatientForm({
        name: '',
        age: '',
        gender: 'Male',
        branch: 'Andhra Pradesh',
        diagnosis: '',
        bill: '',
        doctor: 'Dr. Sharma'
      });

      showToast(error.message);
    }
  }

  function fillDemo(account) {
    setLoginForm({
      ...loginForm,
      email: account.email,
      password: account.password,
      role: account.role
    });

    showToast(`${account.role} demo account selected`);
  }

  return (
    <div className="app-shell">
      {toast && <div className="toast">{toast}</div>}

      <nav className="navbar">
        <button className="brand" onClick={() => setPage('home')}>
          <span>HMSS</span> SecureCare
        </button>

        <div className="nav-links">
          <button onClick={() => setPage('home')}>Home</button>
          {isLoggedIn && <button onClick={() => setPage('dashboard')}>Dashboard</button>}
        </div>

        <div className="nav-actions">
          {isLoggedIn ? (
            <>
              <span className="user-pill">{user.role}</span>
              <button className="outline-btn" onClick={logout}>Logout</button>
            </>
          ) : (
            <button className="primary-btn" onClick={() => setPage('login')}>Login</button>
          )}
        </div>
      </nav>

      {page === 'home' && <HomePage setPage={setPage} />}

      {page === 'login' && (
        <LoginPage
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          handleLogin={handleLogin}
          fillDemo={fillDemo}
          showToast={showToast}
          setPage={setPage}
          loginWithGoogle={loginWithGoogle}
        />
      )}

      {page === 'dashboard' && isLoggedIn && (
        <DashboardPage
          user={user}
          dashboard={dashboard}
          patients={patients}
          patientForm={patientForm}
          setPatientForm={setPatientForm}
          addPatient={addPatient}
          refresh={loadSecureData}
          activeMenu={activeMenu}
          setActiveMenu={setActiveMenu}
          verifiedAccess={verifiedAccess}
          verifyDoctorAccess={verifyDoctorAccess}
          googleUsers={googleUsers}
          pageAccess={pageAccess}
          updatePageAccess={updatePageAccess}
          resetPageAccess={resetPageAccess}
        />
      )}

      {page === 'dashboard' && !isLoggedIn && (
        <LoginPage
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          handleLogin={handleLogin}
          fillDemo={fillDemo}
          showToast={showToast}
          setPage={setPage}
          loginWithGoogle={loginWithGoogle}
        />
      )}

      {page !== 'dashboard' && (
        <footer className="footer">
          <strong>HMSS SecureCare</strong>
          <span>Hospital Management Software Solution • Secure role-based hospital ERP</span>
        </footer>
      )}
    </div>
  );
}

function HomePage({ setPage }) {
  return (
    <main>
      <section className="hero-section">
        <div className="hero-copy">
          <div className="badge">Enterprise Hospital ERP</div>
          <h1>Simple, secure and professional hospital management software.</h1>
          <p>
            Manage patients, doctors, nurses, pharmacy, insurance billing, lab reports,
            claims, audit logs and secure access from one clean dashboard.
          </p>

          <div className="hero-buttons">
            <button className="primary-btn large" onClick={() => setPage('login')}>Open Demo Login</button>
            <button className="secondary-btn large" onClick={() => setPage('login')}>Login / Sign Up</button>
          </div>

          <div className="stats-grid">
            <div><strong>8</strong><span>Role Dashboards</span></div>
            <div><strong>JWT</strong><span>Secure Login</span></div>
            <div><strong>RBAC</strong><span>Access Control</span></div>
          </div>
        </div>

        <div className="command-card">
          <div className="scan-ring">✚</div>
          <h3>Today’s Hospital Flow</h3>
          <div className="flow-row"><span>Registrations</span><b>42</b></div>
          <div className="flow-row"><span>Consultations</span><b>31</b></div>
          <div className="flow-row"><span>Claims Pending</span><b>12</b></div>
          <div className="mini-bars"><i></i><i></i><i></i><i></i><i></i></div>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <span className="badge">Role Dashboards</span>
          <h2>Built for real hospital departments</h2>
        </div>

        <div className="cards-grid">
          {roleCards.map((card) => (
            <InfoCard key={card.title} {...card} onClick={() => setPage('login')} />
          ))}
        </div>
      </section>
    </main>
  );
}

function LoginPage({
  loginForm,
  setLoginForm,
  handleLogin,
  fillDemo,
  showToast,
  setPage,
  loginWithGoogle
}) {
  const [mode, setMode] = useState('login');

  function handleSignup(event) {
    event.preventDefault();
    showToast('Signup UI ready. Backend signup can be connected next.');
  }

  return (
    <section className="auth-page">
      <div className="auth-left">
        <div className="brand-box">
          <div className="brand-icon">✚</div>
          <div>
            <h3>HMSS</h3>
            <span>HOSPITAL CENTRAL</span>
          </div>
        </div>

        <div className="left-content">
          <div className="badge light-badge">Secure Hospital ERP</div>
          <h1>Access your hospital operating system securely.</h1>
          <p>
            Unified records · Multi-branch management · Patient privacy · Role-based visibility · Fingerprint-ready access
          </p>

          <div className="security-tags">
            <span>TLS/SSL</span>
            <span>AES-256</span>
            <span>RBAC</span>
            <span>Audit Logs</span>
            <span>Fingerprint Ready</span>
            <span>Google Auth</span>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <form className="auth-card" onSubmit={mode === 'login' ? handleLogin : handleSignup}>
          <h2>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
          <p className="auth-subtitle">Use demo credentials or continue with Google.</p>

          {mode === 'signup' && (
            <>
              <label>FULL NAME</label>
              <input
                type="text"
                placeholder="Enter Full Name"
                value={loginForm.fullName}
                onChange={(e) => setLoginForm({ ...loginForm, fullName: e.target.value })}
              />
            </>
          )}

          <label>HOSPITAL CODE</label>
          <input
            type="text"
            placeholder="HMSS001"
            value={loginForm.hospitalCode}
            onChange={(e) => setLoginForm({ ...loginForm, hospitalCode: e.target.value })}
          />

          <label>USERNAME / EMAIL</label>
          <input
            type="email"
            placeholder="admin@hmss.com"
            value={loginForm.email}
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
            required
          />

          <label>PASSWORD</label>
          <input
            type="password"
            placeholder="Enter Password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            required
          />

          <div className="row-fields">
            <div>
              <label>BRANCH</label>
              <select
                value={loginForm.branch}
                onChange={(e) => setLoginForm({ ...loginForm, branch: e.target.value })}
              >
                <option>Andhra Pradesh</option>
                <option>Arunachal Pradesh</option>
                <option>AIIMS Delhi</option>
                <option>Apollo Hyderabad</option>
              </select>
            </div>

            <div>
              <label>ROLE</label>
              <select
                value={loginForm.role}
                onChange={(e) => setLoginForm({ ...loginForm, role: e.target.value })}
              >
                {['Admin', 'Doctor', 'Nurse', 'Pharmacy', 'Insurance', 'TPA', 'Reception', 'Lab'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <button className="secure-login-btn" type="submit">
            {mode === 'login' ? 'Sign In Securely' : 'Create Account'}
          </button>

          <button type="button" className="google-btn" onClick={loginWithGoogle}>
            Continue with Google
          </button>

          <button
            type="button"
            className="fingerprint-btn"
            onClick={() => showToast('Fingerprint will unlock patient names after doctor login.')}
          >
            🛡 Fingerprint Access
          </button>

          <button
            type="button"
            className="otp-btn"
            onClick={() => showToast('OTP will unlock patient names after doctor login.')}
          >
            Login With OTP
          </button>

          <div className="demo-box">
            <h3>Demo Credentials</h3>
            {demoAccounts.map((account) => (
              <button type="button" key={account.email} onClick={() => fillDemo(account)}>
                <strong>{account.role}</strong>
                <span>{account.email}</span>
                <small>{account.password}</small>
              </button>
            ))}
          </div>

          <p className="switch-text">
            {mode === 'login' ? 'New User?' : 'Already Have Account?'}
            <span onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? ' Create Account' : ' Sign In'}
            </span>
          </p>

          <button type="button" className="back-home" onClick={() => setPage('home')}>
            Back To Home
          </button>
        </form>
      </div>
    </section>
  );
}

function DashboardPage({
  user,
  dashboard,
  patients,
  patientForm,
  setPatientForm,
  addPatient,
  refresh,
  activeMenu,
  setActiveMenu,
  verifiedAccess,
  verifyDoctorAccess,
  googleUsers,
  pageAccess,
  updatePageAccess,
  resetPageAccess
}) {
  const stats = dashboard?.stats || {};
  const list = permissions[user.role] || [];
  const menus = user.role === 'ADMIN' ? sidebarMenus.ADMIN : (pageAccess[user.role] || sidebarMenus[user.role] || ['Overview']);
  const canAddPatient = ['ADMIN', 'DOCTOR', 'RECEPTION'].includes(user.role);
  const isAdmin = user.role === 'ADMIN';
  const isDoctor = user.role === 'DOCTOR';

  return (
    <main className="erp-layout">
      <aside className="erp-sidebar">
        <div className="erp-logo"><div>✚</div><span>HMSS ERP</span></div>

        <div className="profile-card">
          <div className="avatar">{user.name.charAt(0)}</div>
          <h3>{user.name}</h3>
          <p>{user.branch}</p>
          <span>{user.role}</span>
        </div>

        <nav className="side-menu">
          {menus.map((item) => (
            <button
              key={item}
              className={activeMenu === item ? 'active' : ''}
              onClick={() => setActiveMenu(item)}
            >
              {getMenuIcon(item)} {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-note">
          <strong>Privacy Mode</strong>
          <p>{isDoctor && verifiedAccess ? 'Patient names unlocked' : 'Patient names protected'}</p>
        </div>
      </aside>

      <section className="erp-main">
        <div className="erp-topbar">
          <div>
            <span className="badge">{activeMenu}</span>
            <h1>{user.role} Dashboard</h1>
          </div>

          <div className="top-actions">
            {isDoctor && !verifiedAccess && (
              <>
                <button className="secondary-btn" onClick={() => verifyDoctorAccess('Fingerprint')}>👆 Verify Fingerprint</button>
                <button className="secondary-btn" onClick={() => verifyDoctorAccess('OTP')}>📲 Verify OTP</button>
              </>
            )}
            <button className="primary-btn" onClick={refresh}>Refresh</button>
          </div>
        </div>

        {activeMenu === 'Overview' && (
          <Overview stats={stats} isAdmin={isAdmin} patients={patients} list={list} />
        )}

        {activeMenu === 'Patients' && (
          <PatientsPanel
            patients={patients}
            canAddPatient={canAddPatient}
            patientForm={patientForm}
            setPatientForm={setPatientForm}
            addPatient={addPatient}
          />
        )}

        {activeMenu === 'Users' && isAdmin && (
          <GoogleUsersPanel googleUsers={googleUsers} />
        )}

        {activeMenu === 'Page Access' && isAdmin && (
          <PageAccessPanel
            pageAccess={pageAccess}
            updatePageAccess={updatePageAccess}
            resetPageAccess={resetPageAccess}
          />
        )}

        {activeMenu !== 'Overview' && activeMenu !== 'Patients' && activeMenu !== 'Users' && activeMenu !== 'Page Access' && (
          <RoleModule title={activeMenu} user={user} patients={patients} />
        )}
      </section>
    </main>
  );
}

function Overview({ stats, isAdmin, patients, list }) {
  return (
    <>
      <div className="kpi-grid">
        <Kpi title="Patients" value={stats.totalPatients || patients.length || 0} />
        <Kpi title="Active Cases" value={stats.activeCases || 0} />
        <Kpi title="Users" value={stats.totalUsers || 8} />
        <Kpi title="Claims" value={stats.pendingClaims || 0} />
      </div>

      {isAdmin && <AdminAnalytics />}

      {!isAdmin && (
        <div className="content-grid">
          <div className="panel">
            <h2>Your Permissions</h2>
            {list.map((item) => <div className="permission" key={item}>✓ {item}</div>)}
          </div>

          <div className="panel">
            <h2>Today’s Work</h2>
            <p className="muted">Assigned cases and department workflow appear here based on your role.</p>
            <div className="work-count">{patients.length}</div>
            <span className="muted">Visible patient records</span>
          </div>
        </div>
      )}
    </>
  );
}

function AdminAnalytics() {
  const analytics = {
    monthlyPatients: [20, 30, 25, 42, 51, 63],
    departmentLoad: [
      { name: 'OPD', value: 38 },
      { name: 'Lab', value: 24 },
      { name: 'Pharmacy', value: 18 },
      { name: 'Claims', value: 12 }
    ]
  };

  return (
    <div className="analytics-grid">
      <div className="panel chart-panel">
        <h2>Monthly Patient Growth</h2>
        <div className="line-chart">
          {analytics.monthlyPatients.map((value, index) => (
            <span key={index} style={{ height: `${value + 20}px` }}><b>{value}</b></span>
          ))}
        </div>
        <div className="chart-labels">
          <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
        </div>
      </div>

      <div className="panel chart-panel">
        <h2>Department Load</h2>
        {analytics.departmentLoad.map((item) => (
          <div className="progress-row" key={item.name}>
            <div><span>{item.name}</span><b>{item.value}%</b></div>
            <i><em style={{ width: `${item.value}%` }}></em></i>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Admin Controls</h2>
        <div className="admin-actions">
          <button onClick={() => alert('User management placeholder')}>Manage Users</button>
          <button onClick={() => alert('Audit log placeholder')}>Audit Logs</button>
          <button onClick={() => alert('Branch settings placeholder')}>Branch Settings</button>
          <button onClick={() => alert('Security policy placeholder')}>Security Policy</button>
        </div>
      </div>
    </div>
  );
}

function PatientsPanel({ patients, canAddPatient, patientForm, setPatientForm, addPatient }) {
  return (
    <div className="content-grid">
      <div className="panel wide-panel">
        <h2>Patient Records</h2>
        <PatientTable patients={patients} />
      </div>

      {canAddPatient && (
        <form className="panel" onSubmit={addPatient}>
          <h2>Register Patient</h2>

          <input placeholder="Patient name" value={patientForm.name} onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })} required />
          <input placeholder="Age" type="number" value={patientForm.age} onChange={(e) => setPatientForm({ ...patientForm, age: e.target.value })} required />

          <select value={patientForm.gender} onChange={(e) => setPatientForm({ ...patientForm, gender: e.target.value })}>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>

          <select value={patientForm.branch} onChange={(e) => setPatientForm({ ...patientForm, branch: e.target.value })}>
            <option>Andhra Pradesh</option>
            <option>Arunachal Pradesh</option>
          </select>

          <input placeholder="Assigned doctor" value={patientForm.doctor} onChange={(e) => setPatientForm({ ...patientForm, doctor: e.target.value })} />
          <input placeholder="Diagnosis" value={patientForm.diagnosis} onChange={(e) => setPatientForm({ ...patientForm, diagnosis: e.target.value })} />
          <input placeholder="Bill amount" type="number" value={patientForm.bill} onChange={(e) => setPatientForm({ ...patientForm, bill: e.target.value })} />

          <button className="primary-btn full">Add Patient</button>
        </form>
      )}
    </div>
  );
}

function RoleModule({ title, user, patients }) {
  return (
    <div className="content-grid">
      <div className="panel wide-panel">
        <h2>{title}</h2>
        <p className="muted">This module is available for {user.role}. Patient data is filtered according to role permissions.</p>
        <PatientTable patients={patients} />
      </div>

      <div className="panel">
        <h2>Role Access</h2>
        {(permissions[user.role] || []).map((p) => (
          <div className="permission" key={p}>✓ {p}</div>
        ))}
      </div>
    </div>
  );
}

function PatientTable({ patients }) {
  if (!patients.length) return <p className="muted">No patient records available.</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{Object.keys(patients[0]).map((key) => <th key={key}>{key}</th>)}</tr>
        </thead>
        <tbody>
          {patients.map((patient) => (
            <tr key={patient.id || patient._id}>
              {Object.values(patient).map((value, index) => (
                <td key={index}>{Array.isArray(value) ? value.join(', ') : String(value)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PageAccessPanel({ pageAccess, updatePageAccess, resetPageAccess }) {
  const managedRoles = ['DOCTOR', 'NURSE', 'PHARMACY', 'INSURANCE', 'TPA', 'RECEPTION', 'LAB'];

  return (
    <div className="content-grid">
      <div className="panel wide-panel">
        <h2>Role Page Access Control</h2>
        <p className="muted">
          Admin can decide which dashboard pages are visible for every role.
          Checked means page is visible. Unchecked means page will be hidden from that role's sidebar.
        </p>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Visible Pages</th>
              </tr>
            </thead>
            <tbody>
              {managedRoles.map((role) => (
                <tr key={role}>
                  <td><strong>{role}</strong></td>
                  <td>
                    <div className="access-check-grid">
                      {(sidebarMenus[role] || []).map((pageName) => (
                        <label className="access-check" key={`${role}-${pageName}`}>
                          <input
                            type="checkbox"
                            checked={(pageAccess[role] || []).includes(pageName)}
                            onChange={() => updatePageAccess(role, pageName)}
                          />
                          <span>{pageName}</span>
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button type="button" className="secondary-btn access-reset-btn" onClick={resetPageAccess}>
          Reset Default Access
        </button>
      </div>

      <div className="panel">
        <h2>How It Works</h2>
        <div className="permission">✓ Only Admin can open this page</div>
        <div className="permission">✓ Checkbox checked = page visible</div>
        <div className="permission">✓ Checkbox unchecked = page hidden</div>
        <div className="permission">✓ Saved in browser local storage</div>
      </div>
    </div>
  );
}

function GoogleUsersPanel({ googleUsers }) {
  return (
    <div className="content-grid">
      <div className="panel wide-panel">
        <h2>Google Login Users</h2>
        <p className="muted">Users who login using Google authentication will appear here on the Admin dashboard.</p>

        {!googleUsers.length ? (
          <p className="muted">No Google users logged in yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Branch</th>
                  <th>Login Method</th>
                  <th>Last Login</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {googleUsers.map((u) => (
                  <tr key={u.email}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.branch}</td>
                    <td>{u.loginMethod || 'Google'}</td>
                    <td>{u.lastLogin || '-'}</td>
                    <td>{u.status || 'Online'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Google Auth Status</h2>
        <div className="permission">✓ Supabase Google Auth enabled</div>
        <div className="permission">✓ Vercel environment variables connected</div>
        <div className="permission">✓ Google users visible in Admin Users page</div>
        <div className="permission">✓ New Google users become ADMIN by default</div>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, text, onClick }) {
  return (
    <div className="info-card">
      <div>{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      <button onClick={onClick}>Open →</button>
    </div>
  );
}

function Kpi({ title, value }) {
  return (
    <div className="kpi-card">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getMenuIcon(item) {
  const icons = {
    Overview: '📊',
    Patients: '🧑‍🤝‍🧑',
    Users: '👥',
    Branches: '🏢',
    'Audit Logs': '🕒',
    Settings: '⚙️',
    Consultations: '🩺',
    Prescriptions: '📋',
    'Lab Reports': '🧪',
    Referrals: '🔁',
    'Assigned Patients': '✅',
    Vitals: '❤️',
    'Upload Reports': '⬆️',
    'Patient IDs': '🆔',
    'Medicine Issue': '📦',
    Stock: '🏷️',
    Invoices: '📄',
    'Payment Status': '💳',
    Claims: '📁',
    Appointments: '📅',
    Queue: '🎫',
    'Register Patient': '➕',
    'Basic Details': '📌',
    'Page Access': '✅',
    'Lab Requests': '🧪',
    'Test Status': '✅',
    Documents: '📄',
    'Claim Verification': '🧾',
    'Approval Status': '✅'
  };

  return icons[item] || '•';
}

function getDemoDashboard() {
  return {
    stats: {
      totalPatients: 42,
      activeCases: 18,
      totalUsers: 8,
      pendingClaims: 6
    }
  };
}

function getDemoPatients(role, verified) {
  const canSeeName = role === 'ADMIN' || (role === 'DOCTOR' && verified);

  return [
    {
      id: 'P-1001',
      name: canSeeName ? 'Aarav Sharma' : 'PID-1001',
      age: 32,
      gender: 'Male',
      branch: 'Andhra Pradesh',
      diagnosis: ['ADMIN', 'DOCTOR'].includes(role) ? 'Fever' : 'Restricted',
      bill: '1200',
      doctor: 'Dr. Sharma',
      status: 'Active'
    },
    {
      id: 'P-1002',
      name: canSeeName ? 'Meera Gupta' : 'PID-1002',
      age: 44,
      gender: 'Female',
      branch: 'Arunachal Pradesh',
      diagnosis: ['ADMIN', 'DOCTOR'].includes(role) ? 'Diabetes review' : 'Restricted',
      bill: '2500',
      doctor: 'Dr. Rao',
      status: 'Lab Pending'
    }
  ];
}

export default App;