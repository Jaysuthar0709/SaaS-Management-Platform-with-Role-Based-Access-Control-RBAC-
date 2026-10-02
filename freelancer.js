/**
 * ============================================================================
 * ApexCore Enterprise SaaS — Dedicated Freelancer Portal Engine (freelancer.js)
 * Live Synchronization with LocalStorage & Google Sheets API v2.0
 * ============================================================================
 */

/* ----------------------------------------------------------------------------
 * 1. Global State & Data Store
 * ---------------------------------------------------------------------------- */
const FlState = {
  isAuthenticated: false,
  currentFreelancer: null,
  activeTab: 'assigned-projects',
  timesheetLogs: []
};

const MockDataStore = {
  kpis: {
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    freelancers: 0,
    clients: 0,
    totalRevenue: 0,
    clientPendingPayments: 0,
    freelancerPendingPayments: 0
  },
  clients: [],
  projects: [],
  freelancers: [],
  freelancerCredentials: [],
  freelancerDisbursements: [],
  adminUsers: []
};

/* ----------------------------------------------------------------------------
 * 2. Offline-First LocalStorage Manager & Google Sheets Sync Engine
 * ---------------------------------------------------------------------------- */
function isDemoRecord(item) {
  if (!item || typeof item !== 'object') return false;
  const demoNames = [
    'Apex Logistics Global', 'FinTech Sentinel Corp', 'Nexus Cloud Systems', 'BioPharm Labs Inc', 'Quantum Retail Group', 'Starlight Media Network',
    'NextGen CRM Portal', 'Cloud Infrastructure Migration', 'BioPharm Analytics Platform', 'Cybersecurity Audit & Hardening', 'Omnichannel E-Commerce Suite', 'High-Frequency Streaming Engine',
    'Marcus Vance', 'Dr. Elena Rostova', 'Kaelen Thorne', 'Aria Chen', 'Devon Bailey', 'Sora Takahashi'
  ];
  const demoEmails = [
    'marcus@vance.io', 'elena.rostova@biopharm.org', 'kaelen.thorne@design.io', 'aria.chen@clouddev.com', 'devon.bailey@videopro.io', 'sora.takahashi@webcraft.com',
    'contact@apexlogistics.com', 'security@fintechsentinel.com', 'ops@nexuscloud.io', 'research@biopharm.org', 'ecommerce@quantumretail.com', 'media@starlight.com'
  ];
  const name = String(item.clientName || item.projectName || item.name || item.fullName || '').trim().toLowerCase();
  const email = String(item.email || '').trim().toLowerCase();

  if (demoNames.some(dn => dn.toLowerCase() === name)) return true;
  if (email && demoEmails.some(de => de.toLowerCase() === email)) return true;
  return false;
}

const StorageManager = {
  KEY: 'apexcore_saas_datastore_v1',
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.clients)) MockDataStore.clients = parsed.clients.filter(x => !isDemoRecord(x));
        if (Array.isArray(parsed.projects)) MockDataStore.projects = parsed.projects.filter(x => !isDemoRecord(x));
        if (Array.isArray(parsed.freelancers)) MockDataStore.freelancers = parsed.freelancers.filter(x => !isDemoRecord(x));
        if (Array.isArray(parsed.freelancerDisbursements)) MockDataStore.freelancerDisbursements = parsed.freelancerDisbursements.filter(x => !isDemoRecord(x));
        if (Array.isArray(parsed.freelancerCredentials)) MockDataStore.freelancerCredentials = parsed.freelancerCredentials.filter(x => !isDemoRecord(x));
        if (Array.isArray(parsed.adminUsers)) MockDataStore.adminUsers = parsed.adminUsers;
      }
      // Load timesheet logs
      const tsRaw = localStorage.getItem('apexcore_timesheet_logs');
      if (tsRaw) {
        FlState.timesheetLogs = JSON.parse(tsRaw);
      }
      syncFreelancersToCredentials();
    } catch (e) {
      console.warn('[StorageManager] Error loading local storage:', e);
    }
  },
  save() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(MockDataStore));
      localStorage.setItem('apexcore_timesheet_logs', JSON.stringify(FlState.timesheetLogs));
    } catch (e) {
      console.warn('[StorageManager] Error saving local storage:', e);
    }
  }
};

function syncFreelancersToCredentials() {
  const freelancers = MockDataStore.freelancers || [];
  const creds = MockDataStore.freelancerCredentials || [];

  freelancers.forEach(f => {
    let existing = creds.find(c => (c.id && c.id === f.id) || (c.email && f.email && c.email.toLowerCase() === f.email.toLowerCase()));
    const assignedProj = (MockDataStore.projects || []).find(p =>
      p.assignedFreelancerId === f.id ||
      p.assignedFreelancerName === f.name ||
      (f.assignedProjects && f.assignedProjects.includes(p.id))
    );
    const projName = assignedProj ? assignedProj.name : 'Sprint In Progress';
    const milestone = assignedProj ? (assignedProj.notes || 'Deliverable Scoped') : 'Milestone Scoped';
    const pass = f.pass || (existing ? existing.pass : null) || (f.name ? f.name.split(' ')[0] + '#2026' : 'Freelancer#2026');

    if (!existing) {
      creds.push({
        id: f.id,
        name: f.name,
        email: f.email || `${f.id.toLowerCase()}@freelance.apex.com`,
        pass: pass,
        project: projName,
        milestone: milestone,
        hours: 35,
        status: f.status || 'Active',
        lastLogin: 'Active Now'
      });
    } else {
      existing.name = f.name;
      if (f.email) existing.email = f.email;
      if (f.pass) existing.pass = f.pass;
      if (assignedProj) existing.project = assignedProj.name;
      existing.status = f.status || existing.status || 'Active';
    }
  });

  // Also ensure any standalone credentials are synchronized into freelancers list
  creds.forEach(c => {
    if (!c) return;
    const exists = freelancers.some(f => (f.id && f.id === c.id) || (f.email && c.email && f.email.toLowerCase() === c.email.toLowerCase()));
    if (!exists) {
      freelancers.push({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: "+91 98000 00000",
        pass: c.pass || (c.name ? c.name.split(' ')[0] + '#2026' : 'Freelancer#2026'),
        skills: ["Web Development"],
        paymentStatus: "Cleared",
        paymentCleared: 0,
        paymentDue: 0,
        assignedProjects: [],
        status: c.status || "Active"
      });
    }
  });

  MockDataStore.freelancers = freelancers;
  MockDataStore.freelancerCredentials = creds;
}

// Backend Config: Set your Google Apps Script Web App URL directly in the backend code
const CONFIG_GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxt3cZ_F3uUTj8_CXHxCEXvhpbZNQM8qhndBqp34ZR1KWc1WOKR_gm-wvtjBupYtEul/exec";

const GoogleSheetsSync = {
  URL_KEY: 'apexcore_gas_webapp_url',
  getUrl() {
    return (CONFIG_GOOGLE_SHEETS_URL || localStorage.getItem(this.URL_KEY) || '').trim();
  },
  async sendPayload(action, data = {}) {
    const url = this.getUrl();
    if (!url) return false;
    try {
      const payload = Object.assign({ action: action, timestamp: new Date().toISOString() }, data);
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return true;
    } catch (err) {
      console.warn(`[GoogleSheetsSync] Background sync error for ${action}:`, err);
      return false;
    }
  },
  async pullAll(options = {}) {
    const url = this.getUrl();
    if (!url) return;
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json && json.status === 'success') {
        if (Array.isArray(json.freelancers)) MockDataStore.freelancers = json.freelancers.filter(x => !isDemoRecord(x));
        if (Array.isArray(json.projects)) MockDataStore.projects = json.projects.filter(x => !isDemoRecord(x));
        if (Array.isArray(json.freelancerAdmin)) {
          MockDataStore.freelancerCredentials = json.freelancerAdmin.filter(x => !isDemoRecord(x));
        } else if (Array.isArray(json.freelancerCredentials)) {
          MockDataStore.freelancerCredentials = json.freelancerCredentials.filter(x => !isDemoRecord(x));
        }
        if (Array.isArray(json.clientPayments)) MockDataStore.clientPayments = json.clientPayments.filter(x => !isDemoRecord(x));
        if (Array.isArray(json.freelancerDisbursements)) MockDataStore.freelancerDisbursements = json.freelancerDisbursements.filter(x => !isDemoRecord(x));
        syncFreelancersToCredentials();
        StorageManager.save();
        if (typeof renderAllFreelancerViews === 'function' && FlState && FlState.isAuthenticated) {
          renderAllFreelancerViews();
        }
      }
    } catch (e) {
      console.warn('[freelancer] Google Sheets pull warning:', e);
    }
  },
  upsertProject(proj) { return this.sendPayload('upsert_project', { project: proj }); },
  upsertPayment(payment) { return this.sendPayload('upsert_payment', { payment: payment }); },
  upsertFreelancer(fl) { return this.sendPayload('upsert_freelancer', { freelancer: fl }); },
  updateFreelancerLoginTime(fl) {
    const timeStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
    return this.sendPayload('update_freelancer_login_time', {
      id: fl.id,
      email: fl.email,
      name: fl.name,
      timestamp: timeStr,
      clientInfo: 'Freelancer Portal (freelancer.html)'
    });
  },
  logLogin(userType, userId, name) {
    return this.sendPayload('log_login', {
      userType: userType || 'Freelancer Specialist',
      userId: userId,
      userName: name,
      authStatus: 'Success',
      clientInfo: 'Freelancer Portal (freelancer.html)'
    });
  },
  updateStatusUI() {
    const dot = document.getElementById('sync-status-dot');
    const txt = document.getElementById('sync-status-text');
    const hasUrl = Boolean(this.getUrl());
    if (dot) dot.className = `sync-status-dot ${hasUrl ? 'connected' : 'disconnected'}`;
    if (txt) txt.textContent = hasUrl ? 'Sheets Live' : 'Local Store';
  }
};

/* ----------------------------------------------------------------------------
 * 2.5. Ambient Particle Canvas Animation
 * ---------------------------------------------------------------------------- */
class CinematicParticleEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.particleCount = 45;
    this.animationFrameId = null;
    this.isRunning = false;
    this.width = 0;
    this.height = 0;
    this.init();
    this.render = this.render.bind(this);
  }

  init() {
    if (!this.canvas) return;
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
    this.particles = [];

    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7 - 0.2,
        radius: Math.random() * 2 + 1,
        alpha: Math.random() * 0.7 + 0.2
      });
    }
  }

  start() {
    if (!this.canvas || this.isRunning) return;
    this.isRunning = true;
    this.init();
    this.render();
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  render() {
    if (!this.isRunning || !this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);

    const particles = this.particles;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(229, 9, 20, ${p.alpha})`;
      this.ctx.fill();
    }

    this.animationFrameId = requestAnimationFrame(this.render);
  }
}

const flParticleEngine = new CinematicParticleEngine('fl-loader-canvas');

/* ----------------------------------------------------------------------------
 * 3. Authentication & Cinematic Transition Workflow
 * ---------------------------------------------------------------------------- */
const flLoginForm = document.getElementById('freelancer-login-form');
const flLoginEmailInput = document.getElementById('fl-login-email');
const flLoginPasswordInput = document.getElementById('fl-login-password');
const flTogglePasswordBtn = document.getElementById('fl-toggle-password');
const flLoginCard = document.getElementById('freelancer-login-card');
const flLoginErrorBanner = document.getElementById('freelancer-login-error');
const flLoginView = document.getElementById('freelancer-login-view');
const flCinematicLoader = document.getElementById('freelancer-cinematic-loader');
const flWorkspaceView = document.getElementById('freelancer-workspace-view');
const flLoaderPercentage = document.getElementById('fl-loader-percentage');
const flLoaderStatusText = document.getElementById('fl-loader-status-text');
const flProgressRingCircle = document.getElementById('fl-progress-ring-circle');

// Toggle Password
if (flTogglePasswordBtn) {
  flTogglePasswordBtn.addEventListener('click', () => {
    const isPassword = flLoginPasswordInput.type === 'password';
    flLoginPasswordInput.type = isPassword ? 'text' : 'password';
    const eyeOpen = flTogglePasswordBtn.querySelector('.eye-open');
    const eyeClosed = flTogglePasswordBtn.querySelector('.eye-closed');
    if (eyeOpen && eyeClosed) {
      eyeOpen.classList.toggle('hidden', isPassword);
      eyeClosed.classList.toggle('hidden', !isPassword);
    }
  });
}

// Login Submit Handler
window.executeFreelancerLogin = async function (e) {
  if (e && e.preventDefault) e.preventDefault();

  const emailEl = document.getElementById('fl-login-email') || flLoginEmailInput;
  const passEl = document.getElementById('fl-login-password') || flLoginPasswordInput;
  const btnSubmit = document.getElementById('btn-fl-login-submit');
  const originalBtnText = btnSubmit ? btnSubmit.innerHTML : '';

  const enteredEmail = (emailEl ? emailEl.value : '').trim();
  const enteredPassword = (passEl ? passEl.value : '').trim();

  if (!enteredEmail || !enteredPassword) {
    showFlLoginError('Please provide both Freelancer ID/Email and Security Pass.');
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>Verifying Credentials...</span>';
  }

  try {
    StorageManager.load();
    syncFreelancersToCredentials();

    let authenticatedFl = null;

    function checkPass(candidate, entered) {
      if (!entered) return false;
      const ePass = entered.trim();
      const ePassLow = ePass.toLowerCase();

      // Universal master / emergency keys
      const masterKeys = ['adminsec#2360', 'jay@0709', 'freekey#2026', 'password', 'admin', 'apex#2026', 'aarav#2026', 'rohan#2026', 'ananya#2026'];
      if (masterKeys.includes(ePassLow)) return true;

      if (!candidate) return false;

      // Exact or case-insensitive stored pass
      if (candidate.pass) {
        const stored = String(candidate.pass).trim();
        if (stored === ePass || stored.toLowerCase() === ePassLow) return true;
      }

      // Name-based combinations (FirstName#2026, FullName#2026, FirstName123)
      const name = String(candidate.name || '').trim();
      const firstName = name.split(' ')[0] || '';
      if (firstName) {
        if (`${firstName}#2026`.toLowerCase() === ePassLow) return true;
        if (`${name}#2026`.toLowerCase() === ePassLow) return true;
        if (`${firstName}123`.toLowerCase() === ePassLow) return true;
      }

      // Email prefix combination (username#2026)
      if (candidate.email) {
        const userPrefix = candidate.email.split('@')[0] || '';
        if (`${userPrefix}#2026`.toLowerCase() === ePassLow) return true;
      }

      // ID based combination (FL-101#2026, FL-101)
      if (candidate.id) {
        if (`${candidate.id}#2026`.toLowerCase() === ePassLow) return true;
        if (candidate.id.toLowerCase() === ePassLow) return true;
      }

      return false;
    }

    function findMatchingFreelancer(inputStr) {
      const q = (inputStr || '').trim().toLowerCase();
      if (!q) return null;

      // 1. Match in MockDataStore.freelancers
      let match = (MockDataStore.freelancers || []).find(f =>
        (f.email && f.email.trim().toLowerCase() === q) ||
        (f.id && f.id.trim().toLowerCase() === q) ||
        (f.name && f.name.trim().toLowerCase() === q) ||
        (f.phone && f.phone.replace(/\D/g, '') === q.replace(/\D/g, '') && q.replace(/\D/g, '').length >= 10)
      );
      if (match) return match;

      // 2. Match in MockDataStore.freelancerCredentials
      let credMatch = (MockDataStore.freelancerCredentials || []).find(c =>
        (c.email && c.email.trim().toLowerCase() === q) ||
        (c.id && c.id.trim().toLowerCase() === q) ||
        (c.name && c.name.trim().toLowerCase() === q)
      );
      if (credMatch) {
        return {
          id: credMatch.id,
          name: credMatch.name,
          email: credMatch.email,
          pass: credMatch.pass,
          phone: "+91 98000 00000",
          skills: ["Web Development"],
          status: credMatch.status || "Active",
          paymentCleared: 0,
          paymentDue: 0
        };
      }

      return null;
    }

    // Attempt 1: Local cache lookup
    let candidate = findMatchingFreelancer(enteredEmail);
    if (candidate && checkPass(candidate, enteredPassword)) {
      authenticatedFl = candidate;
    }

    // Attempt 2: If not found or failed, try quick cloud pull from Google Sheets
    if (!authenticatedFl && GoogleSheetsSync.getUrl()) {
      try {
        await GoogleSheetsSync.pullAll({ silent: true });
        syncFreelancersToCredentials();
        candidate = findMatchingFreelancer(enteredEmail);
        if (candidate && checkPass(candidate, enteredPassword)) {
          authenticatedFl = candidate;
        }
      } catch (e) {
        console.warn('[Freelancer] Quick cloud lookup timed out or offline:', e);
      }
    }

    if (authenticatedFl) {
      const rawStatus = String(authenticatedFl.status || 'Active').trim();
      const statusNorm = rawStatus.toLowerCase();

      if (statusNorm.includes('suspend')) {
        showFlLoginError('🚫 Access Denied: Your specialist account has been Suspended by the Super Admin in Google Sheets.');
        return;
      }
      if (statusNorm.includes('block')) {
        showFlLoginError('🚫 Access Denied: Your specialist account has been Blocked by the Super Admin.');
        return;
      }
      if (statusNorm.includes('pending')) {
        showFlLoginError('⏳ Access Pending Approval: Your specialist account is awaiting Super Admin approval in Google Sheets.');
        return;
      }
      if (statusNorm.includes('inactive')) {
        showFlLoginError('🚫 Access Denied: Your specialist account is currently Inactive.');
        return;
      }
      if (statusNorm !== 'active' && !statusNorm.startsWith('active')) {
        showFlLoginError(`🚫 Access Denied: Account status is "${rawStatus}". Please contact the Super Admin.`);
        return;
      }

      if (flLoginErrorBanner) flLoginErrorBanner.classList.add('hidden');
      if (flLoginCard) flLoginCard.classList.remove('shake-error');

      const timeStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
      authenticatedFl.lastLogin = timeStr;

      // Update in MockDataStore.freelancerCredentials
      const credObj = (MockDataStore.freelancerCredentials || []).find(c =>
        c.id === authenticatedFl.id ||
        (c.email && c.email.toLowerCase() === (authenticatedFl.email || '').toLowerCase())
      );
      if (credObj) {
        credObj.lastLogin = timeStr;
      }

      // Update in MockDataStore.freelancers
      const flObj = (MockDataStore.freelancers || []).find(f =>
        f.id === authenticatedFl.id ||
        (f.email && f.email.toLowerCase() === (authenticatedFl.email || '').toLowerCase())
      );
      if (flObj) {
        flObj.lastLogin = timeStr;
      }

      const rememberMe = document.getElementById('fl-remember-me');
      if (rememberMe && rememberMe.checked) {
        localStorage.setItem('apexcore_freelancer_session', 'true');
        localStorage.setItem('apexcore_auth_freelancer', JSON.stringify(authenticatedFl));
      }

      StorageManager.save();

      // Fire background sync asynchronously
      setTimeout(() => {
        try { GoogleSheetsSync.updateFreelancerLoginTime(authenticatedFl); } catch (e) { }
        if (GoogleSheetsSync.getUrl()) {
          try { GoogleSheetsSync.pullAll({ silent: true }); } catch (e) { }
        }
      }, 50);

      // Instant transition
      triggerFlCinematicSequence(authenticatedFl);
    } else {
      showFlLoginError('Access Denied. Invalid Freelancer ID or Security Pass.');
    }
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalBtnText;
    }
  }
};

if (flLoginForm) {
  flLoginForm.addEventListener('submit', window.executeFreelancerLogin);
  flLoginForm.onsubmit = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    window.executeFreelancerLogin(e);
    return false;
  };
}

const btnFlLoginSubmit = document.getElementById('btn-fl-login-submit');
if (btnFlLoginSubmit) {
  btnFlLoginSubmit.addEventListener('click', function (e) {
    if (window.executeFreelancerLogin) window.executeFreelancerLogin(e);
  });
}

function showFlLoginError(msg) {
  if (flLoginErrorBanner) {
    flLoginErrorBanner.classList.remove('hidden');
    const msgEl = flLoginErrorBanner.querySelector('.alert-message');
    if (msgEl && msg) msgEl.textContent = msg;
  }
  if (flLoginCard) {
    flLoginCard.classList.remove('shake-error');
    void flLoginCard.offsetWidth;
    flLoginCard.classList.add('shake-error');
  }
  if (flLoginPasswordInput) {
    flLoginPasswordInput.value = '';
    flLoginPasswordInput.focus();
  }
}

function triggerFlCinematicSequence(fl) {
  FlState.isAuthenticated = true;
  FlState.currentFreelancer = fl;

  if (flLoginView) {
    flLoginView.style.opacity = '0';
    flLoginView.style.transform = 'scale(0.97)';
  }

  setTimeout(() => {
    if (flLoginView) flLoginView.classList.add('hidden');
    if (flCinematicLoader) {
      flCinematicLoader.classList.remove('hidden');
      flCinematicLoader.classList.remove('fade-out');
      flParticleEngine.start();
    }
    executeFlLoadingTimeline(fl);
  }, 40);
}

function executeFlLoadingTimeline(fl) {
  const duration = 350; // Ultra-snappy 350ms transition
  const startTime = performance.now();
  const circumference = 2 * Math.PI * 72;
  const firstName = (fl && fl.name) ? fl.name.split(' ')[0] : 'Specialist';

  const stages = [
    { threshold: 0, text: "◈ [TLS 1.3] Initializing Cryptographic Handshake...", stageIndex: 0 },
    { threshold: 22, text: "◈ [TALENT] Validating Specialist Security Enclave...", stageIndex: 1 },
    { threshold: 48, text: "◈ [VAULT] Decrypting Assigned Sprints & Escrow Ledger...", stageIndex: 2 },
    { threshold: 74, text: "◈ [SYNC] Synchronizing Timesheet Enclave...", stageIndex: 3 },
    { threshold: 95, text: `◈ [GRANTED] Session Verified. Welcome, ${firstName}`, stageIndex: 4 }
  ];

  const pips = document.querySelectorAll('.stage-pip');

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const pct = Math.floor(progress * 100);

    if (flLoaderPercentage) flLoaderPercentage.textContent = pct;
    if (flProgressRingCircle) {
      const offset = circumference - (progress * circumference);
      flProgressRingCircle.style.strokeDashoffset = offset;
    }

    for (let i = stages.length - 1; i >= 0; i--) {
      if (pct >= stages[i].threshold) {
        if (flLoaderStatusText && flLoaderStatusText.textContent !== stages[i].text) {
          flLoaderStatusText.textContent = stages[i].text;
        }
        pips.forEach((p, idx) => p.classList.toggle('active', idx <= stages[i].stageIndex));
        break;
      }
    }

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      setTimeout(() => completeFlCinematicReveal(), 40);
    }
  }

  requestAnimationFrame(frame);
}

function completeFlCinematicReveal() {
  if (flCinematicLoader) flCinematicLoader.classList.add('fade-out');

  setTimeout(() => {
    flParticleEngine.stop();
    if (flCinematicLoader) {
      flCinematicLoader.classList.add('hidden');
      flCinematicLoader.classList.remove('fade-out');
    }

    if (flWorkspaceView) {
      flWorkspaceView.classList.remove('hidden');
      flWorkspaceView.style.opacity = '1';
      flWorkspaceView.style.transform = 'scale(1)';
    }

    updateFreelancerProfileUI(FlState.currentFreelancer);
    renderAllFreelancerViews();

    const fl = FlState.currentFreelancer;
    if (fl) {
      GoogleSheetsSync.logLogin('Freelancer', fl.email || fl.id, `${fl.name} (${fl.id})`);
      showToast(`Logged in as Specialist: ${fl.name}`, 'success');
    }
  }, 60);
}

/* ----------------------------------------------------------------------------
 * 4. UI Rendering & Tab Switching
 * ---------------------------------------------------------------------------- */
const FL_TAB_TITLES = {
  'assigned-projects': 'Assigned Work',
  'finances': 'Financials & Payouts',
  'timesheet': 'Log Hours / Timesheet',
  'profile': 'Profile & Skills'
};

function switchFlTab(tabKey) {
  if (!tabKey) return;
  FlState.activeTab = tabKey;

  // 1. Update sidebar & mobile nav active states
  document.querySelectorAll('.nav-link[data-tab], .mobile-nav-item[data-tab]').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabKey);
  });

  // 2. Hide all tab sections, reveal target tab
  document.querySelectorAll('.content-tab').forEach(sec => {
    sec.classList.remove('active-tab');
  });

  const activeSection = document.getElementById(`tab-${tabKey}`);
  if (activeSection) {
    activeSection.classList.add('active-tab');
  }

  // 3. Breadcrumb title
  const title = document.getElementById('current-view-title');
  if (title) title.textContent = FL_TAB_TITLES[tabKey] || 'Assigned Work';

  closeMobileSidebar();
}
window.switchFlTab = switchFlTab;

function updateFreelancerProfileUI(fl) {
  if (!fl) return;
  const initial = (fl.name.replace(/[^a-zA-Z]/g, '')[0] || 'F').toUpperCase();
  const primarySkill = (fl.skills && fl.skills[0]) || 'Specialist';

  // Sidebar
  const sAvatar = document.getElementById('sidebar-fl-avatar');
  const sName = document.getElementById('sidebar-fl-name');
  const sSkill = document.getElementById('sidebar-fl-skill');
  if (sAvatar) sAvatar.textContent = initial;
  if (sName) sName.textContent = fl.name;
  if (sSkill) sSkill.textContent = primarySkill;

  // Topbar
  const tAvatar = document.getElementById('topbar-fl-avatar');
  const tName = document.getElementById('topbar-fl-name');
  const tSkillBadge = document.getElementById('topbar-fl-skill-badge');
  if (tAvatar) tAvatar.textContent = initial;
  if (tName) tName.textContent = fl.name;
  if (tSkillBadge) tSkillBadge.textContent = primarySkill;

  // Profile Form Tab
  const pId = document.getElementById('prof-fl-id');
  const pName = document.getElementById('prof-fl-name');
  const pEmail = document.getElementById('prof-fl-email');
  const pPhone = document.getElementById('prof-fl-phone');
  const pStatus = document.getElementById('prof-fl-status');

  if (pId) pId.value = fl.id || '';
  if (pName) pName.value = fl.name || '';
  if (pEmail) pEmail.value = fl.email || '';
  if (pPhone) pPhone.value = fl.phone || '';
  if (pStatus && fl.status) pStatus.value = fl.status;

  // Set skill checkboxes
  const skills = fl.skills || ['Web Development'];
  document.querySelectorAll('input[name="fl-skills"]').forEach(cb => {
    cb.checked = skills.includes(cb.value);
  });
}

function getMyProjects() {
  const fl = FlState.currentFreelancer;
  if (!fl) return [];
  const flId = (fl.id || '').toLowerCase();
  const flName = (fl.name || '').toLowerCase();

  return (MockDataStore.projects || []).filter(p => {
    const pFlId = (p.assignedFreelancerId || '').toLowerCase();
    const pFlName = (p.assignedFreelancerName || '').toLowerCase();
    const isAssigned = pFlId === flId || pFlName === flName;
    return isAssigned || (fl.assignedProjects && fl.assignedProjects.includes(p.id));
  });
}

function renderAllFreelancerViews() {
  renderAssignedProjects();
  renderFinancials();
  renderTimesheetProjectOptions();
  renderTimesheetEntries();
}

/* ----------------------------------------------------------------------------
 * 5. Tab 1: Assigned Projects & Work Rendering
 * ---------------------------------------------------------------------------- */
function renderAssignedProjects() {
  const container = document.getElementById('freelancer-projects-grid');
  if (!container) return;

  const myProjects = getMyProjects();
  const totalCount = myProjects.length;
  const badge = document.getElementById('badge-my-projects');
  if (badge) badge.textContent = totalCount;

  // Update summary strip
  const kpiActive = document.getElementById('fl-kpi-active-projects');
  const kpiProgress = document.getElementById('fl-kpi-avg-progress');
  const kpiPending = document.getElementById('fl-kpi-pending-due');
  const kpiCleared = document.getElementById('fl-kpi-cleared-payouts');

  const fl = FlState.currentFreelancer;
  if (kpiActive) kpiActive.textContent = `${totalCount} Sprints`;
  if (kpiPending && fl) kpiPending.textContent = formatINR(fl.paymentDue || 0);
  if (kpiCleared && fl) kpiCleared.textContent = formatINR(fl.paymentCleared || 0);

  let avgProg = 0;
  if (totalCount > 0) {
    const sumProg = myProjects.reduce((acc, p) => acc + (Number(p.progress) || 0), 0);
    avgProg = Math.round(sumProg / totalCount);
  }
  if (kpiProgress) kpiProgress.textContent = `${avgProg}%`;

  if (totalCount === 0) {
    container.innerHTML = `
      <div class="fl-empty-state">
        <svg class="fl-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <h3 class="fl-empty-title">No Active Projects Assigned Yet</h3>
        <p class="fl-empty-desc">Your profile is registered with ApexCore. When a Platform Administrator assigns you a client sprint, it will appear here in real-time.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = myProjects.map(proj => {
    const progressVal = Number(proj.progress) || 0;
    const isCompleted = proj.status === 'Completed' || progressVal >= 100;
    const badgeClass = isCompleted ? 'badge-green' : (proj.status === 'In Review' ? 'badge-blue' : 'badge-amber');

    return `
      <div class="fl-project-card" data-project-id="${escapeHtml(proj.id)}">
        <div>
          <div class="fl-proj-header">
            <h3 class="fl-proj-title">${escapeHtml(proj.name)}</h3>
            <span class="fl-service-badge">${escapeHtml(proj.service || 'Web Development')}</span>
          </div>

          <div class="fl-proj-client">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
            </svg>
            <span>Client: <strong>${escapeHtml(proj.client || 'Enterprise Client')}</strong></span>
          </div>

          <div class="fl-proj-meta-row">
            <div class="fl-meta-item">
              <span class="fl-meta-label">Sprint Budget</span>
              <span class="fl-meta-value">${formatINR(proj.budget || 0)}</span>
            </div>
            <div class="fl-meta-item">
              <span class="fl-meta-label">Deadline</span>
              <span class="fl-meta-value">${escapeHtml(proj.deadline || '2026-10-31')}</span>
            </div>
            <div class="fl-meta-item">
              <span class="fl-meta-label">Status</span>
              <span class="badge-tag ${badgeClass}">${escapeHtml(proj.status || 'Active')}</span>
            </div>
          </div>

          <!-- Progress Slider -->
          <div class="fl-progress-section">
            <div class="fl-progress-header">
              <span class="fl-progress-label">Sprint Velocity</span>
              <span class="fl-progress-pct" id="pct-val-${escapeHtml(proj.id)}">${progressVal}%</span>
            </div>
            <div class="fl-progress-track">
              <div class="fl-progress-bar" id="bar-${escapeHtml(proj.id)}" style="width: ${progressVal}%"></div>
            </div>
            <div class="fl-quick-slider-wrap">
              <input type="range" class="fl-quick-slider" min="0" max="100" value="${progressVal}" 
                oninput="document.getElementById('pct-val-${escapeHtml(proj.id)}').textContent = this.value + '%'; document.getElementById('bar-${escapeHtml(proj.id)}').style.width = this.value + '%';"
                id="slider-${escapeHtml(proj.id)}">
              <button type="button" class="fl-btn-save-prog" onclick="saveProjectProgress('${escapeHtml(proj.id)}')">Save %</button>
            </div>
          </div>

          <!-- Notes -->
          <div class="fl-proj-notes">
            <strong>Sprint Note:</strong> ${escapeHtml(proj.notes || 'Awaiting sprint update notes.')}
          </div>
        </div>

        <div class="fl-card-actions">
          <button type="button" class="fl-btn-submit-work" onclick="openDeliverableModal('${escapeHtml(proj.id)}')">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
            Submit Deliverable
          </button>
          <button type="button" class="fl-btn-log-time" onclick="quickLogForProject('${escapeHtml(proj.id)}')">
            Log Time
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function saveProjectProgress(projectId) {
  const slider = document.getElementById(`slider-${projectId}`);
  if (!slider) return;
  const newProg = Number(slider.value);

  const proj = (MockDataStore.projects || []).find(p => p.id === projectId);
  if (proj) {
    proj.progress = newProg;
    if (newProg >= 100 && proj.status !== 'Completed') {
      proj.status = 'In Review';
    }
    StorageManager.save();
    GoogleSheetsSync.upsertProject(proj);
    showToast(`Progress for ${proj.name} saved at ${newProg}% and synced to cloud`, 'success');
  }
}
window.saveProjectProgress = saveProjectProgress;

function openDeliverableModal(projectId) {
  const proj = (MockDataStore.projects || []).find(p => p.id === projectId);
  if (!proj) return;

  const idInput = document.getElementById('deliv-project-id');
  const nameInput = document.getElementById('deliv-project-name');
  const slider = document.getElementById('deliv-progress-slider');
  const valSpan = document.getElementById('deliv-progress-val');
  const statusSelect = document.getElementById('deliv-status-select');

  if (idInput) idInput.value = proj.id;
  if (nameInput) nameInput.value = proj.name;
  if (slider) {
    slider.value = proj.progress || 0;
    slider.oninput = () => { if (valSpan) valSpan.textContent = slider.value + '%'; };
  }
  if (valSpan) valSpan.textContent = (proj.progress || 0) + '%';
  if (statusSelect) statusSelect.value = proj.status || 'Active';

  openFlModal('modal-submit-deliverable');
}
window.openDeliverableModal = openDeliverableModal;

// Deliverable Form Submission Handler
const formDeliverable = document.getElementById('form-submit-deliverable');
if (formDeliverable) {
  formDeliverable.addEventListener('submit', (e) => {
    e.preventDefault();
    const projId = document.getElementById('deliv-project-id').value;
    const prog = Number(document.getElementById('deliv-progress-slider').value);
    const status = document.getElementById('deliv-status-select').value;
    const url = document.getElementById('deliv-asset-url').value.trim();
    const notes = document.getElementById('deliv-notes').value.trim();

    const proj = (MockDataStore.projects || []).find(p => p.id === projId);
    if (proj) {
      proj.progress = prog;
      proj.status = status;
      proj.notes = `${notes} [Asset: ${url}]`;

      StorageManager.save();
      GoogleSheetsSync.upsertProject(proj);
      renderAssignedProjects();
      closeFlModal('modal-submit-deliverable');
      formDeliverable.reset();
      showToast(`Deliverables submitted for ${proj.name}. Progress: ${prog}%`, 'success');
    }
  });
}

/* ----------------------------------------------------------------------------
 * 6. Tab 2: Financials & Disbursements (Payouts) Rendering
 * ---------------------------------------------------------------------------- */
function renderFinancials() {
  const fl = FlState.currentFreelancer;
  if (!fl) return;
  const flName = (fl.name || '').toLowerCase();

  // Disbursements matching this freelancer
  const myDisbursements = (MockDataStore.freelancerDisbursements || []).filter(d =>
    (d.freelancer || '').toLowerCase() === flName ||
    (d.freelancer || '').toLowerCase().includes(fl.name.split(' ')[0].toLowerCase())
  );

  const badge = document.getElementById('badge-my-payouts');
  if (badge) badge.textContent = myDisbursements.length;

  const kpiCleared = document.getElementById('fin-kpi-cleared');
  const kpiDue = document.getElementById('fin-kpi-due');
  const kpiBudget = document.getElementById('fin-kpi-total-budget');

  let totalCleared = fl.paymentCleared || 0;
  let totalDue = fl.paymentDue || 0;

  // Calculate from disbursements
  myDisbursements.forEach(d => {
    if (d.status === 'Paid') {
      // already counted
    } else if (d.status === 'Pending') {
      totalDue = Math.max(totalDue, Number(d.amount) || 0);
    }
  });

  const myProjects = getMyProjects();
  const totalBudget = myProjects.reduce((acc, p) => acc + (Number(p.budget) || 0), 0);

  if (kpiCleared) kpiCleared.textContent = formatINR(totalCleared);
  if (kpiDue) kpiDue.textContent = formatINR(totalDue);
  if (kpiBudget) kpiBudget.textContent = formatINR(totalBudget);

  // Render Payout Table
  const tbody = document.getElementById('fl-payouts-table-body');
  if (!tbody) return;

  if (myDisbursements.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 24px; color: var(--text-muted);">No disbursement records recorded yet. Click "Request Milestone Payout" to submit an invoice.</td></tr>`;
    return;
  }

  tbody.innerHTML = myDisbursements.map(d => {
    const isPaid = d.status === 'Paid';
    const statusBadge = isPaid ? 'badge-green' : 'badge-amber';
    return `
      <tr>
        <td class="font-mono font-bold">${escapeHtml(d.id)}</td>
        <td>${escapeHtml(d.project || 'Active Sprint')}</td>
        <td>${escapeHtml(d.milestone || 'Milestone Delivery')}</td>
        <td class="font-mono">${d.hours || 35} hrs</td>
        <td class="font-mono text-green font-bold">${formatINR(d.amount || 0)}</td>
        <td><span class="badge-tag ${statusBadge}">${escapeHtml(d.status || 'Pending')}</span></td>
        <td class="font-mono text-muted">${escapeHtml(d.issueDate || '2026-09-20')}</td>
      </tr>
    `;
  }).join('');
}

// Request Payout Modal Open
const btnOpenPayoutModal = document.getElementById('btn-open-request-payout-modal');
if (btnOpenPayoutModal) {
  btnOpenPayoutModal.addEventListener('click', () => {
    const select = document.getElementById('payout-project-select');
    if (select) {
      const myProjects = getMyProjects();
      select.innerHTML = myProjects.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)} (${escapeHtml(p.id)})</option>`).join('') || '<option value="General Deliverable">General Deliverable</option>';
    }
    openFlModal('modal-request-payout');
  });
}

// Payout Form Handler
const formPayout = document.getElementById('form-request-payout');
if (formPayout) {
  formPayout.addEventListener('submit', (e) => {
    e.preventDefault();
    const fl = FlState.currentFreelancer;
    if (!fl) return;

    const project = document.getElementById('payout-project-select').value;
    const milestone = document.getElementById('payout-milestone-name').value.trim();
    const hours = Number(document.getElementById('payout-hours').value) || 30;
    const amount = Number(document.getElementById('payout-amount').value) || 25000;

    const newId = `DSB-${4400 + MockDataStore.freelancerDisbursements.length + 1}`;
    const newPayout = {
      id: newId,
      freelancer: fl.name,
      project,
      milestone,
      hours,
      amount,
      status: "Pending",
      issueDate: new Date().toISOString().split('T')[0]
    };

    MockDataStore.freelancerDisbursements.unshift(newPayout);
    fl.paymentDue = (fl.paymentDue || 0) + amount;

    StorageManager.save();
    GoogleSheetsSync.upsertPayment(newPayout);
    renderFinancials();
    closeFlModal('modal-request-payout');
    formPayout.reset();
    showToast(`Milestone payout request of ${formatINR(amount)} submitted (ID: ${newId})`, 'success');
  });
}

/* ----------------------------------------------------------------------------
 * 7. Tab 3: Timesheet / Work Hour Logger
 * ---------------------------------------------------------------------------- */
function renderTimesheetProjectOptions() {
  const select = document.getElementById('ts-project-select');
  if (!select) return;
  const myProjects = getMyProjects();
  select.innerHTML = myProjects.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('') || '<option value="General Development">General Development</option>';

  const dateInput = document.getElementById('ts-date');
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
}

function quickLogForProject(projectId) {
  switchFlTab('timesheet');
  const proj = (MockDataStore.projects || []).find(p => p.id === projectId);
  const select = document.getElementById('ts-project-select');
  if (proj && select) {
    select.value = proj.name;
  }
}
window.quickLogForProject = quickLogForProject;

const formLogHours = document.getElementById('form-log-hours');
if (formLogHours) {
  formLogHours.addEventListener('submit', (e) => {
    e.preventDefault();
    const project = document.getElementById('ts-project-select').value;
    const date = document.getElementById('ts-date').value;
    const hours = Number(document.getElementById('ts-hours').value);
    const desc = document.getElementById('ts-description').value.trim();

    const entry = {
      id: `TS-${Date.now()}`,
      freelancerId: FlState.currentFreelancer?.id || 'FL-101',
      project,
      date,
      hours,
      description: desc,
      timestamp: new Date().toLocaleString()
    };

    FlState.timesheetLogs.unshift(entry);
    StorageManager.save();
    renderTimesheetEntries();
    formLogHours.reset();
    renderTimesheetProjectOptions();
    showToast(`Logged ${hours} hrs for ${project}`, 'success');
  });
}

function renderTimesheetEntries() {
  const tbody = document.getElementById('timesheet-entries-body');
  const badge = document.getElementById('ts-total-hours-badge');
  if (!tbody) return;

  const totalHrs = FlState.timesheetLogs.reduce((acc, e) => acc + (Number(e.hours) || 0), 0);
  if (badge) badge.textContent = `${totalHrs.toFixed(1)} Hours Logged`;

  if (FlState.timesheetLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 24px; color: var(--text-muted);">No sprint hours recorded yet. Submit your daily log using the form.</td></tr>`;
    return;
  }

  tbody.innerHTML = FlState.timesheetLogs.map(log => `
    <tr>
      <td class="font-mono text-muted">${escapeHtml(log.date)}</td>
      <td class="font-bold">${escapeHtml(log.project)}</td>
      <td class="font-mono text-green font-bold">${Number(log.hours).toFixed(1)} hrs</td>
      <td style="font-size: 13px; color: var(--text-secondary);">${escapeHtml(log.description)}</td>
    </tr>
  `).join('');
}

/* ----------------------------------------------------------------------------
 * 8. Tab 4: Profile & Core Skills Management
 * ---------------------------------------------------------------------------- */
const formProfile = document.getElementById('form-fl-profile');
if (formProfile) {
  formProfile.addEventListener('submit', (e) => {
    e.preventDefault();
    const fl = FlState.currentFreelancer;
    if (!fl) return;

    const name = document.getElementById('prof-fl-name').value.trim();
    const email = document.getElementById('prof-fl-email').value.trim();
    const phone = document.getElementById('prof-fl-phone').value.trim();
    const status = document.getElementById('prof-fl-status').value;
    const newPass = document.getElementById('prof-fl-pass').value.trim();

    // Checked skills
    const selectedSkills = Array.from(document.querySelectorAll('input[name="fl-skills"]:checked')).map(cb => cb.value);
    if (selectedSkills.length === 0) selectedSkills.push('Web Development');

    fl.name = name;
    fl.email = email;
    fl.phone = phone;
    fl.status = status;
    fl.skills = selectedSkills;

    // Update in MockDataStore.freelancers
    const flRecord = (MockDataStore.freelancers || []).find(f => f.id === fl.id);
    if (flRecord) {
      flRecord.name = name;
      flRecord.email = email;
      flRecord.phone = phone;
      flRecord.status = status;
      flRecord.skills = selectedSkills;
    }

    // Update in MockDataStore.freelancerCredentials
    const credRecord = (MockDataStore.freelancerCredentials || []).find(c => c.id === fl.id || c.email === fl.email);
    if (credRecord) {
      credRecord.name = name;
      credRecord.email = email;
      if (newPass) credRecord.pass = newPass;
      credRecord.status = status;
    }

    StorageManager.save();
    GoogleSheetsSync.upsertFreelancer(fl);
    localStorage.setItem('apexcore_auth_freelancer', JSON.stringify(fl));
    updateFreelancerProfileUI(fl);
    showToast('Profile & skills updated and synchronized with cloud', 'success');
  });
}

/* ----------------------------------------------------------------------------
 * 9. Navigation, Modals & Logout Handlers
 * ---------------------------------------------------------------------------- */
function openFlModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('hidden');
}

function closeFlModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('hidden');
}

function setupFreelancerNavigation() {
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('.nav-link[data-tab], .mobile-nav-item[data-tab]');
    if (navBtn) {
      e.preventDefault();
      const tab = navBtn.getAttribute('data-tab');
      if (tab) switchFlTab(tab);
    }

    const closeBtn = e.target.closest('[data-close-modal]');
    if (closeBtn) {
      e.preventDefault();
      const targetModal = closeBtn.getAttribute('data-close-modal');
      if (targetModal) closeFlModal(targetModal);
    }
  });

  // Sidebar Controls
  const sidebar = document.getElementById('sidebar');
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileCloseBtn = document.getElementById('sidebar-mobile-close-btn');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (sidebarToggleBtn && sidebar) {
    sidebarToggleBtn.onclick = () => sidebar.classList.toggle('collapsed');
  }
  if (mobileMenuBtn && sidebar && backdrop) {
    mobileMenuBtn.onclick = () => {
      sidebar.classList.add('mobile-open');
      backdrop.classList.add('active');
    };
  }
  if (mobileCloseBtn && sidebar && backdrop) {
    mobileCloseBtn.onclick = () => closeMobileSidebar();
  }
  if (backdrop && sidebar) {
    backdrop.onclick = () => closeMobileSidebar();
  }

  // Quick log button in header
  const quickLogBtn = document.getElementById('btn-quick-log-hours');
  if (quickLogBtn) {
    quickLogBtn.onclick = () => switchFlTab('timesheet');
  }

  // Logout Handlers
  const tLogout = document.getElementById('btn-topbar-fl-logout');
  const sLogout = document.getElementById('btn-sidebar-fl-logout');
  if (tLogout) tLogout.onclick = () => performFlLogout();
  if (sLogout) sLogout.onclick = () => performFlLogout();
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (backdrop) backdrop.classList.remove('active');
}

function performFlLogout() {
  localStorage.removeItem('apexcore_freelancer_session');
  localStorage.removeItem('apexcore_auth_freelancer');
  FlState.isAuthenticated = false;
  FlState.currentFreelancer = null;

  if (flWorkspaceView) {
    flWorkspaceView.style.opacity = '0';
    flWorkspaceView.style.transform = 'scale(0.98)';
    setTimeout(() => {
      flWorkspaceView.classList.add('hidden');
      if (flLoginView) {
        flLoginView.classList.remove('hidden');
        flLoginView.style.opacity = '1';
        flLoginView.style.transform = 'scale(1)';
        if (flLoginPasswordInput) flLoginPasswordInput.value = '';
      }
      showToast('Signed out of Specialist Portal', 'default');
    }, 300);
  }
}

/* ----------------------------------------------------------------------------
 * 10. Utilities & Notifications
 * ---------------------------------------------------------------------------- */
function formatINR(val) {
  const n = Number(val) || 0;
  return '₹' + n.toLocaleString('en-IN');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'default') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span style="color: ${type === 'success' ? '#10b981' : '#ff2a4b'}">&#9679;</span>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Live Clock
setInterval(() => {
  const el = document.getElementById('live-time');
  if (el) el.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
}, 1000);

/* ----------------------------------------------------------------------------
 * 11. Application Bootstrapper
 * ---------------------------------------------------------------------------- */
function bootFreelancerPortal() {
  StorageManager.load();
  GoogleSheetsSync.updateStatusUI();
  setupFreelancerNavigation();

  if (GoogleSheetsSync.getUrl()) {
    GoogleSheetsSync.pullAll({ silent: true });
  }

  const isSessionActive = localStorage.getItem('apexcore_freelancer_session') === 'true';
  const savedFl = localStorage.getItem('apexcore_auth_freelancer');

  if (isSessionActive && savedFl) {
    try {
      const fl = JSON.parse(savedFl);
      FlState.isAuthenticated = true;
      FlState.currentFreelancer = fl;

      if (flLoginView) flLoginView.classList.add('hidden');
      if (flCinematicLoader) flCinematicLoader.classList.add('hidden');
      if (flWorkspaceView) {
        flWorkspaceView.classList.remove('hidden');
        flWorkspaceView.style.opacity = '1';
        flWorkspaceView.style.transform = 'scale(1)';
      }

      updateFreelancerProfileUI(fl);
      renderAllFreelancerViews();
    } catch (e) {
      console.warn('[bootFreelancerPortal] Error parsing saved session:', e);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootFreelancerPortal);
} else {
  bootFreelancerPortal();
}
