const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'hmss_local_secret';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 500 }));

const users = [
  { id: 1, name: 'Central Admin', role: 'ADMIN', email: 'admin@hmss.com', password: 'admin123', branch: 'Head Office' },
  { id: 2, name: 'Dr. Sharma', role: 'DOCTOR', email: 'doctor@hmss.com', password: 'doctor123', branch: 'Andhra Pradesh' },
  { id: 3, name: 'Nurse Anjali', role: 'NURSE', email: 'nurse@hmss.com', password: 'nurse123', branch: 'Andhra Pradesh' },
  { id: 4, name: 'Pharmacy Desk', role: 'PHARMACY', email: 'pharmacy@hmss.com', password: 'pharmacy123', branch: 'Andhra Pradesh' },
  { id: 5, name: 'Insurance Desk', role: 'INSURANCE', email: 'insurance@hmss.com', password: 'insurance123', branch: 'Andhra Pradesh' },
  { id: 6, name: 'TPA Verifier', role: 'TPA', email: 'tpa@hmss.com', password: 'tpa123', branch: 'Partner Portal' },
  { id: 7, name: 'Reception Desk', role: 'RECEPTION', email: 'reception@hmss.com', password: 'reception123', branch: 'Andhra Pradesh' },
  { id: 8, name: 'Lab Technician', role: 'LAB', email: 'lab@hmss.com', password: 'lab123', branch: 'Andhra Pradesh' }
].map((u) => ({
  ...u,
  passwordHash: bcrypt.hashSync(u.password, 8),
  password: undefined
}));

let fallbackPatients = [
  {
    id: 'P-1001',
    name: 'Rahul Mehta',
    age: 42,
    gender: 'Male',
    branch: 'Andhra Pradesh',
    doctor: 'Dr. Sharma',
    diagnosis: 'Hypertension follow-up',
    tests: ['CBC', 'ECG'],
    prescription: ['Amlodipine 5mg'],
    bill: 2400,
    claimId: 'CLM-9001',
    status: 'OPD'
  },
  {
    id: 'P-1002',
    name: 'Neha Verma',
    age: 35,
    gender: 'Female',
    branch: 'Arunachal Pradesh',
    doctor: 'Dr. Sharma',
    diagnosis: 'Fever screening',
    tests: ['CBC', 'CRP'],
    prescription: ['Paracetamol'],
    bill: 1800,
    claimId: 'CLM-9002',
    status: 'Lab Pending'
  },
  {
    id: 'P-1003',
    name: 'Aman Gill',
    age: 58,
    gender: 'Male',
    branch: 'Andhra Pradesh',
    doctor: 'Dr. Sharma',
    diagnosis: 'Diabetes review',
    tests: ['HbA1c'],
    prescription: ['Metformin'],
    bill: 4200,
    claimId: 'CLM-9003',
    status: 'Insurance Review'
  }
];

let auditLogs = [
  {
    id: 1,
    action: 'System boot',
    user: 'SYSTEM',
    role: 'SYSTEM',
    time: new Date().toLocaleString(),
    details: 'Local server started'
  }
];

const permissions = {
  ADMIN: ['Full branch control', 'Manage users', 'Admin analytics', 'Audit logs', 'Security settings'],
  DOCTOR: ['Complete patient profile after verification', 'Diagnosis notes', 'Prescription', 'Lab reports', 'Referrals'],
  NURSE: ['Patient ID only', 'Vitals upload', 'Assigned tests', 'Report upload', 'No diagnosis notes'],
  PHARMACY: ['Patient ID only', 'Prescription view', 'Medicine issue', 'Stock update', 'No medical history'],
  INSURANCE: ['Patient ID only', 'Claim ID', 'Invoice copies', 'Payment status', 'No diagnosis'],
  TPA: ['Claim verification', 'Claim status', 'Invoice review', 'No medical notes'],
  RECEPTION: ['Register patient', 'Manage appointments', 'Basic patient details only'],
  LAB: ['Lab requests', 'Upload reports', 'Update test status', 'No billing access']
};

function issueToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role
    },
    JWT_SECRET,
    {
      expiresIn: '8h'
    }
  );
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    branch: user.branch
  };
}

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({
      message: 'Token missing'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find((u) => u.id === decoded.id);

    if (!user) {
      return res.status(401).json({
        message: 'Invalid user'
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({
      message: 'Invalid token'
    });
  }
}

function log(action, req, details = '') {
  auditLogs.unshift({
    id: Date.now(),
    action,
    user: req.user?.name || 'Public',
    role: req.user?.role || 'PUBLIC',
    time: new Date().toLocaleString(),
    details
  });
}

function visiblePatient(patient, req) {
  const verified = req.headers['x-verified-access'] === 'true';

  if (req.user.role === 'ADMIN' || (req.user.role === 'DOCTOR' && verified)) {
    return patient;
  }

  if (req.user.role === 'DOCTOR') {
    return {
      ...patient,
      name: 'LOCKED - verify fingerprint/OTP'
    };
  }

  return {
    id: patient.id,
    patientId: patient.id,
    age: patient.age,
    gender: patient.gender,
    branch: patient.branch,
    claimId: patient.claimId,
    status: patient.status,
    bill: patient.bill,
    tests: ['NURSE', 'LAB'].includes(req.user.role) ? patient.tests : undefined,
    prescription: req.user.role === 'PHARMACY' ? patient.prescription : undefined
  };
}

function mapSupabasePatient(row) {
  return {
    id: row.patient_id,
    name: row.name,
    age: row.age,
    gender: row.gender,
    branch: row.branch,
    doctor: row.doctor,
    diagnosis: row.diagnosis,
    tests: row.tests || ['CBC', 'Vitals'],
    prescription: row.prescription || ['Doctor review pending'],
    bill: Number(row.bill || 0),
    claimId: row.claim_id || `CLM-${row.patient_id || 'NA'}`,
    status: row.status || 'Registered'
  };
}

async function getPatientsFromSupabase() {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map(mapSupabasePatient);
}

async function savePatientToSupabase(req) {
  const patientId = `P-${Date.now().toString().slice(-5)}`;
  const claimId = `CLM-${Date.now().toString().slice(-5)}`;

  const payload = {
    patient_id: patientId,
    name: req.body.name,
    age: Number(req.body.age || 0),
    gender: req.body.gender || 'Male',
    branch: req.body.branch || 'Andhra Pradesh',
    doctor: req.body.doctor || 'Dr. Sharma',
    diagnosis: req.body.diagnosis || 'Pending',
    bill: Number(req.body.bill || 0),
    status: req.body.status || 'Registered'
  };

  const { data, error } = await supabase
    .from('patients')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;

  return {
    ...mapSupabasePatient(data),
    claimId
  };
}

app.get('/', (req, res) => {
  res.json({
    message: 'HMSS clean backend running with Supabase support',
    routes: [
      '/api/auth/login',
      '/api/auth/me',
      '/api/dashboard',
      '/api/patients',
      '/api/audit-logs'
    ],
    supabaseConnected: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  const user = users.find((u) => u.email === email);

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({
      message: 'Invalid credentials'
    });
  }

  auditLogs.unshift({
    id: Date.now(),
    action: 'Login',
    user: user.name,
    role: user.role,
    time: new Date().toLocaleString(),
    details: 'JWT session created'
  });

  res.json({
    token: issueToken(user),
    user: safeUser(user)
  });
});

app.get('/api/auth/me', auth, (req, res) => {
  res.json({
    user: safeUser(req.user)
  });
});

app.get('/api/dashboard', auth, async (req, res) => {
  try {
    log('Dashboard viewed', req);

    let patientList = fallbackPatients;

    try {
      patientList = await getPatientsFromSupabase();
    } catch {
      patientList = fallbackPatients;
    }

    res.json({
      stats: {
        totalPatients: patientList.length,
        activeCases: patientList.filter((p) => p.status !== 'Discharged').length,
        totalUsers: users.length,
        pendingClaims: patientList.filter((p) => String(p.status).includes('Insurance')).length
      },
      permissions: permissions[req.user.role] || [],
      auditLogs: auditLogs.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({
      message: 'Dashboard error',
      error: error.message
    });
  }
});

app.get('/api/patients', auth, async (req, res) => {
  try {
    log('Patients viewed', req);

    let patientList = fallbackPatients;

    try {
      patientList = await getPatientsFromSupabase();
    } catch (error) {
      console.log('Supabase patient load failed, using fallback:', error.message);
      patientList = fallbackPatients;
    }

    res.json(patientList.map((p) => visiblePatient(p, req)));
  } catch (error) {
    res.status(500).json({
      message: 'Unable to load patients',
      error: error.message
    });
  }
});

app.post('/api/patients', auth, async (req, res) => {
  try {
    if (!['ADMIN', 'DOCTOR', 'RECEPTION'].includes(req.user.role)) {
      return res.status(403).json({
        message: 'Only admin, doctor or receptionist can register patients'
      });
    }

    let patient;

    try {
      patient = await savePatientToSupabase(req);
    } catch (error) {
      console.log('Supabase save failed, using fallback:', error.message);

      patient = {
        id: `P-${1000 + fallbackPatients.length + 1}`,
        claimId: `CLM-${9000 + fallbackPatients.length + 1}`,
        status: 'Registered',
        tests: req.body.tests || ['CBC', 'Vitals'],
        prescription: req.body.prescription || ['Doctor review pending'],
        ...req.body,
        bill: Number(req.body.bill || 0)
      };

      fallbackPatients.unshift(patient);
    }

    log('Patient registered', req, patient.id);

    res.status(201).json(patient);
  } catch (error) {
    res.status(500).json({
      message: 'Unable to save patient',
      error: error.message
    });
  }
});

app.get('/api/audit-logs', auth, (req, res) => {
  if (req.user.role === 'ADMIN') {
    return res.json(auditLogs);
  }

  return res.status(403).json({
    message: 'Admin only'
  });
});

app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl
  });
});

app.listen(PORT, () => {
  console.log(`HMSS API running on ${PORT}`);
});