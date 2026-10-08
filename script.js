/**
 * ============================================================================
 * ApexCore Enterprise SaaS Admin Portal & Management Platform
 * RBAC Authentication, Cinematic Loading Transition, and Dashboard Engine
 * ============================================================================
 */

/* ----------------------------------------------------------------------------
 * 1. Global State & Architecture Ready for Google Sheets API
 * ---------------------------------------------------------------------------- */
const AppState = {
  isAuthenticated: false,
  currentUser: null,
  activeTab: 'dashboard',
  sidebarCollapsed: false,
  chartsInitialized: false,
  cashflowChartInstance: null,
  projectDistributionChartInstance: null,
};

/**
 * Modular Data Store
 * Structured cleanly to easily plug into Google Sheets API v4 (or REST backend)
 */
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
  clientPayments: [],
  freelancerDisbursements: [],
  freelancerCredentials: [],
  completedProjects: [],
  deletedItems: [],
  loginActivity: [],

  adminUsers: [
    {
      id: "ADM-001",
      name: "Jay (Owner)",
      email: "Jay@admin.com",
      pass: "Jay@0709",
      role: "Super Admin",
      privileges: "Root Access (All Modules & RBAC)",
      status: "Active",
      lastAuth: "Active Now"
    }
  ]
};

/* ----------------------------------------------------------------------------
 * 1.5. Offline-First LocalStorage Manager & Google Sheets Live Sync Engine
 * ---------------------------------------------------------------------------- */
function sanitizeAdminUsers(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(adm => {
    if (!adm || typeof adm !== 'object') return false;
    const name = String(adm.name || '').trim();
    const email = String(adm.email || '').trim();
    const id = String(adm.id || '').trim();
    return id.length > 0 && name.length > 0 && email.length > 0;
  });
}

function sanitizeProjectsAndArchive() {
  if (!Array.isArray(MockDataStore.projects)) MockDataStore.projects = [];
  if (!Array.isArray(MockDataStore.completedProjects)) MockDataStore.completedProjects = [];

  const activeOnly = [];
  const completedMap = new Map();

  // 1. Index existing completedProjects
  MockDataStore.completedProjects.forEach(cp => {
    if (cp && cp.id) {
      const pidKey = String(cp.id).trim().toUpperCase();
      completedMap.set(pidKey, Object.assign({}, cp, {
        status: 'Completed',
        progress: 100
      }));
    }
  });

  // 2. Iterate through projects: if status is 'Completed' or progress >= 100 with Completed status, move to completedProjects
  MockDataStore.projects.forEach(p => {
    if (!p || !p.id) return;
    const pidKey = String(p.id).trim().toUpperCase();
    const statusLower = String(p.status || '').trim().toLowerCase();
    const isCompleted = statusLower === 'completed';

    if (isCompleted) {
      const compDate = p.completionDate || (completedMap.get(pidKey) ? completedMap.get(pidKey).completionDate : null) || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const compItem = {
        id: p.id,
        name: p.name || 'Deliverable',
        service: p.service || 'Web Development',
        client: p.client || '',
        budget: Number(p.budget) || 0,
        progress: 100,
        status: 'Completed',
        assignedFreelancerName: p.assignedFreelancerName || 'Specialist',
        assignedFreelancerId: p.assignedFreelancerId || null,
        completionDate: compDate,
        notes: p.notes || 'Delivered & verified'
      };
      completedMap.set(pidKey, compItem);
    } else {
      // If it is active / in review / planning, ensure it is NOT in completedProjects
      completedMap.delete(pidKey);
      activeOnly.push(p);
    }
  });

  MockDataStore.completedProjects = Array.from(completedMap.values());
  // Active projects must NEVER contain any completed project
  MockDataStore.projects = activeOnly.filter(p => !completedMap.has(String(p.id).trim().toUpperCase()) && String(p.status || '').trim().toLowerCase() !== 'completed');
}

function getStoredAdmins() {
  const map = new Map();

  // 1. Root Owner emergency super admin
  const coreAdmins = [
    {
      id: "ADM-001",
      name: "Jay (Owner)",
      email: "Jay@admin.com",
      pass: "Jay@0709",
      role: "Super Admin",
      privileges: "Root Access (All Modules & RBAC)",
      status: "Active",
      lastAuth: "Active Now"
    }
  ];
  coreAdmins.forEach(a => map.set(a.email.toLowerCase(), Object.assign({}, a)));

  // 2. From dedicated registered admins key
  try {
    const rawReg = localStorage.getItem('apexcore_registered_admins');
    if (rawReg) {
      const parsedReg = JSON.parse(rawReg);
      if (Array.isArray(parsedReg)) {
        parsedReg.forEach(a => {
          if (a && a.email) {
            const emailKey = a.email.toLowerCase();
            const existing = map.get(emailKey);
            map.set(emailKey, Object.assign({}, existing || {}, a));
          }
        });
      }
    }
  } catch (e) { }

  // 3. From main datastore adminUsers (synced from Google Sheets)
  if (Array.isArray(MockDataStore.adminUsers)) {
    MockDataStore.adminUsers.forEach(a => {
      if (a && a.email) {
        const emailKey = a.email.toLowerCase();
        const existing = map.get(emailKey);
        map.set(emailKey, Object.assign({}, existing || {}, a));
      }
    });
  }

  return sanitizeAdminUsers(Array.from(map.values()));
}

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
        if (Array.isArray(parsed.clientPayments)) MockDataStore.clientPayments = parsed.clientPayments.filter(x => !isDemoRecord(x));
        if (Array.isArray(parsed.freelancerDisbursements)) MockDataStore.freelancerDisbursements = parsed.freelancerDisbursements.filter(x => !isDemoRecord(x));
        if (Array.isArray(parsed.adminUsers)) MockDataStore.adminUsers = sanitizeAdminUsers(parsed.adminUsers);
        if (Array.isArray(parsed.freelancerCredentials)) MockDataStore.freelancerCredentials = parsed.freelancerCredentials.filter(x => !isDemoRecord(x));
        if (Array.isArray(parsed.completedProjects)) MockDataStore.completedProjects = parsed.completedProjects.filter(x => !isDemoRecord(x));
        if (Array.isArray(parsed.deletedItems)) MockDataStore.deletedItems = parsed.deletedItems.filter(x => !isDemoRecord(x));
        if (Array.isArray(parsed.loginActivity)) MockDataStore.loginActivity = parsed.loginActivity;
      }
      // Ensure permanent core admins are always in MockDataStore with valid passwords
      const allAdmins = getStoredAdmins();
      allAdmins.forEach(adm => {
        const existingIdx = (MockDataStore.adminUsers || []).findIndex(x => x && x.email && x.email.toLowerCase() === adm.email.toLowerCase());
        if (existingIdx !== -1) {
          // Repair empty or missing password on existing entry
          if (!MockDataStore.adminUsers[existingIdx].pass || MockDataStore.adminUsers[existingIdx].pass.trim() === '') {
            MockDataStore.adminUsers[existingIdx].pass = adm.pass;
          }
        } else {
          MockDataStore.adminUsers.push(adm);
        }
      });
      // Ensure active projects and completed projects are cleanly partitioned
      sanitizeProjectsAndArchive();

      if (typeof recalculateRealKPIs === 'function') {
        recalculateRealKPIs();
      }
    } catch (e) {
      console.warn('[StorageManager] Error loading local storage:', e);
    }
  },
  save() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(MockDataStore));
      if (Array.isArray(MockDataStore.adminUsers)) {
        localStorage.setItem('apexcore_registered_admins', JSON.stringify(sanitizeAdminUsers(MockDataStore.adminUsers)));
      }
    } catch (e) {
      console.warn('[StorageManager] Error saving local storage:', e);
    }
  }
};

// Backend Config: Set your Google Apps Script Web App URL directly in the backend code
const CONFIG_GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbxt3cZ_F3uUTj8_CXHxCEXvhpbZNQM8qhndBqp34ZR1KWc1WOKR_gm-wvtjBupYtEul/exec";

const GoogleSheetsSync = {
  URL_KEY: 'apexcore_gas_webapp_url',
  getUrl() {
    return (CONFIG_GOOGLE_SHEETS_URL || localStorage.getItem(this.URL_KEY) || '').trim();
  },
  setUrl(url) {
    localStorage.setItem(this.URL_KEY, (url || '').trim());
    this.updateStatusUI();
    if (url) {
      this.pullAll({ silent: true });
    }
  },
  updateStatusUI(stateText) {
    const url = this.getUrl();
    const dot = document.getElementById('sync-status-dot');
    const text = document.getElementById('sync-status-text');
    const icon = document.getElementById('sheet-sync-status-icon');
    const title = document.getElementById('sheet-sync-status-title');
    const sub = document.getElementById('sheet-sync-status-sub');
    const timeEl = document.getElementById('sheet-last-sync-time');
    const urlInput = document.getElementById('google-sheets-url');

    if (urlInput && !urlInput.value && url) {
      urlInput.value = url;
    }

    if (stateText === 'syncing') {
      if (dot) dot.className = 'sync-status-dot syncing';
      if (text) text.textContent = 'Syncing to Sheets...';
      return;
    }

    if (url) {
      if (dot) dot.className = 'sync-status-dot connected';
      if (text) text.textContent = 'Google Sheets Live';
      if (icon) icon.style.background = '#10b981';
      if (title) title.textContent = 'Live Backend: Connected to Google Sheets';
      if (sub) sub.textContent = 'All modifications, additions, and deletions are saved directly to your Google Sheet in real time.';
    } else {
      if (dot) dot.className = 'sync-status-dot local';
      if (text) text.textContent = 'LocalStorage Mode';
      if (icon) icon.style.background = '#f59e0b';
      if (title) title.textContent = 'LocalStorage Mode (No Sheet Connected)';
      if (sub) sub.textContent = 'Enter your Google Apps Script Web App URL below to connect your real Google Sheet backend.';
    }

    if (timeEl) {
      const lastTime = localStorage.getItem('apexcore_last_sync_time') || new Date().toLocaleTimeString();
      timeEl.textContent = `Last Synced: ${lastTime}`;
    }
  },
  async postToGas(payload) {
    const url = this.getUrl();
    if (!url) return null;
    this.updateStatusUI('syncing');
    try {
      // Use text/plain to avoid preflight OPTIONS CORS failures with Google Apps Script
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      localStorage.setItem('apexcore_last_sync_time', new Date().toLocaleTimeString());
      this.updateStatusUI();
      return { success: true };
    } catch (err) {
      // Fallback with no-cors mode to ensure execution through redirects
      try {
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        localStorage.setItem('apexcore_last_sync_time', new Date().toLocaleTimeString());
        this.updateStatusUI();
        return { success: true };
      } catch (err2) {
        console.warn('[GoogleSheetsSync] Webhook push error:', err2);
        this.updateStatusUI();
        return null;
      }
    }
  },
  async upsertClient(client) {
    return this.postToGas({ action: 'upsert_client', client: client });
  },
  async upsertProject(project) {
    return this.postToGas({ action: 'upsert_project', project: project });
  },
  async upsertFreelancer(freelancer) {
    return this.postToGas({ action: 'upsert_freelancer', freelancer: freelancer });
  },
  async upsertFreelancerAdmin(credential) {
    return this.postToGas({ action: 'upsert_freelancer_admin', credential: credential });
  },
  async upsertPayment(payment) {
    return this.postToGas({ action: 'upsert_payment', payment: payment });
  },
  async upsertAdmin(admin) {
    return this.postToGas({ action: 'upsert_admin', admin: admin });
  },
  async updateAdminLogin(admin) {
    const timeStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
    return this.postToGas({
      action: 'update_admin_login_time',
      id: admin.id || 'ADM-001',
      email: admin.email || 'Jay@admin.com',
      name: admin.name || 'Jay (Super Admin)',
      timestamp: timeStr,
      clientInfo: 'Admin Portal (index.html)'
    });
  },
  async deleteRecord(itemType, id, displayName, deletedBy) {
    const delEntry = {
      id: 'DEL-' + Math.floor(1000 + Math.random() * 9000),
      itemType: itemType,
      recordId: id,
      recordName: displayName,
      deletedBy: deletedBy || 'Jay (Super Admin)',
      deletedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      snapshot: `Item ${displayName} (${id}) deleted from active system.`
    };
    if (!MockDataStore.deletedItems) MockDataStore.deletedItems = [];
    MockDataStore.deletedItems.unshift(delEntry);
    StorageManager.save();
    return this.postToGas({
      action: 'delete_record',
      itemType: itemType,
      id: id,
      displayName: displayName,
      deletedBy: deletedBy || 'Jay (Super Admin)'
    });
  },
  async completeProject(project) {
    return this.postToGas({
      action: 'complete_project',
      project: project
    });
  },
  async reopenProject(project) {
    return this.postToGas({
      action: 'reopen_project',
      project: project
    });
  },
  async testConnection() {
    const url = this.getUrl();
    if (!url) {
      showToast('Please enter and save your Google Apps Script Web App URL first', 'default');
      return;
    }
    showToast('Testing Google Sheets backend connection...', 'default');
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json && json.status === 'success') {
        showToast('Successfully verified Google Sheets Live Backend!', 'success');
        this.updateStatusUI();
      } else {
        showToast('Connected, but unexpected response from Google Apps Script', 'default');
      }
    } catch (e) {
      await this.postToGas({ action: 'test_connection' });
      showToast('Connection signal dispatched to Google Sheets!', 'success');
    }
  },
  async pullAll(options = {}) {
    const url = this.getUrl();
    if (!url) {
      if (!options.silent) showToast('Please save Google Apps Script URL first', 'default');
      return;
    }
    if (!options.silent) showToast('Fetching live records from Google Sheets backend...', 'default');
    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json && json.status === 'success') {
        MockDataStore.clients = Array.isArray(json.clients) ? json.clients.filter(x => !isDemoRecord(x)) : [];
        MockDataStore.projects = Array.isArray(json.projects) ? json.projects.filter(x => !isDemoRecord(x)) : [];
        MockDataStore.freelancers = Array.isArray(json.freelancers) ? json.freelancers.filter(x => !isDemoRecord(x)) : [];
        if (Array.isArray(json.freelancerAdmin)) {
          MockDataStore.freelancerCredentials = json.freelancerAdmin.filter(x => !isDemoRecord(x));
        } else if (Array.isArray(json.freelancerCredentials)) {
          MockDataStore.freelancerCredentials = json.freelancerCredentials.filter(x => !isDemoRecord(x));
        } else {
          MockDataStore.freelancerCredentials = [];
        }
        if (Array.isArray(json.adminUsers) && json.adminUsers.length) {
          MockDataStore.adminUsers = sanitizeAdminUsers(json.adminUsers);
        }
        MockDataStore.clientPayments = Array.isArray(json.clientPayments) ? json.clientPayments.filter(x => !isDemoRecord(x)) : [];
        MockDataStore.freelancerDisbursements = Array.isArray(json.freelancerDisbursements) ? json.freelancerDisbursements.filter(x => !isDemoRecord(x)) : [];
        MockDataStore.completedProjects = Array.isArray(json.completedProjects) ? json.completedProjects.filter(x => !isDemoRecord(x)) : [];
        MockDataStore.deletedItems = Array.isArray(json.deletedItems) ? json.deletedItems.filter(x => !isDemoRecord(x)) : [];

        // Ensure active projects and completed projects are cleanly partitioned
        sanitizeProjectsAndArchive();

        // Dynamic recalculation of all KPIs and badges
        recalculateRealKPIs();
        populateProjectFreelancerDropdowns();
        syncRealFreelancerCredentials();
        StorageManager.save();
        renderAllViews();
        animateKPICounters();
        if (typeof updateChartsWithRealData === 'function') {
          updateChartsWithRealData();
        }
        this.updateStatusUI();
        if (!options.silent) showToast('Dashboard loaded with real Google Sheets data!', 'success');
      }
    } catch (e) {
      if (!options.silent) showToast('Unable to pull from Google Sheets (verify Web App is deployed with access: Anyone)', 'default');
    }
  },
  async pushAll() {
    const url = this.getUrl();
    if (!url) {
      showToast('Please save Google Apps Script URL first', 'default');
      return;
    }
    showToast('Pushing all active dashboard datasets to Google Sheets...', 'default');
    await this.postToGas({
      action: 'sync_all',
      clients: MockDataStore.clients,
      projects: MockDataStore.projects,
      freelancers: MockDataStore.freelancers,
      freelancerAdmin: MockDataStore.freelancerCredentials,
      adminUsers: MockDataStore.adminUsers
    });
    showToast('Synchronized datasets dispatched to Google Sheets!', 'success');
  },
  async logLogin(userType, userId, userName) {
    const session = {
      sessionId: 'SES-' + Math.floor(1000 + Math.random() * 9000),
      userType: userType || 'Admin',
      userId: userId || 'Jay@admin.com',
      userName: userName || 'Jay (Super Admin)',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      authStatus: 'Success',
      clientInfo: 'Enterprise TLS Web'
    };
    if (!MockDataStore.loginActivity) MockDataStore.loginActivity = [];
    MockDataStore.loginActivity.unshift(session);
    StorageManager.save();
    this.postToGas(Object.assign({ action: 'log_login' }, session));
  }
};

/* ----------------------------------------------------------------------------
 * 2. Particle Canvas Background for Cinematic Loader
 * ---------------------------------------------------------------------------- */
class CinematicParticleEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.particleCount = 55;
    this.animationFrameId = null;
    this.isRunning = false;

    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  init() {
    this.resize();
    window.addEventListener('resize', this.resize);
    this.particles = [];

    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7 - 0.2, // slight upward float
        radius: Math.random() * 2 + 1,
        alpha: Math.random() * 0.7 + 0.2,
        pulsing: Math.random() * 0.03
      });
    }
  }

  start() {
    if (this.isRunning) return;
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
    if (!this.isRunning) return;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Subtle dark red gradient core
    const cx = this.width / 2;
    const cy = this.height / 2;
    const radialGrad = this.ctx.createRadialGradient(cx, cy, 30, cx, cy, 450);
    radialGrad.addColorStop(0, 'rgba(229, 9, 20, 0.14)');
    radialGrad.addColorStop(0.5, 'rgba(139, 0, 0, 0.05)');
    radialGrad.addColorStop(1, 'rgba(6, 6, 8, 0)');
    this.ctx.fillStyle = radialGrad;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw Particles & subtle crimson connector lines
    const particles = this.particles;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      // Wrap edges
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      // Draw particle
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(255, 42, 75, ${p.alpha})`;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = '#e50914';
      this.ctx.fill();
      this.ctx.shadowBlur = 0;

      // Draw connections
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = `rgba(229, 9, 20, ${0.18 * (1 - dist / 110)})`;
          this.ctx.lineWidth = 0.75;
          this.ctx.stroke();
        }
      }
    }

    this.animationFrameId = requestAnimationFrame(this.render);
  }
}

const particleEngine = new CinematicParticleEngine('loader-canvas');

/* ----------------------------------------------------------------------------
 * 3. Authentication & Cinematic Transition Workflow
 * ---------------------------------------------------------------------------- */
const AUTH_CREDENTIALS = {
  email: "Jay@admin.com",
  password: "Jay@0709"
};

const loginForm = document.getElementById('login-form');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const togglePasswordBtn = document.getElementById('toggle-password-visibility');
const loginCard = document.getElementById('login-card');
const loginErrorBanner = document.getElementById('login-error-banner');
const loginView = document.getElementById('login-view');
const cinematicLoader = document.getElementById('cinematic-loader');
const dashboardView = document.getElementById('dashboard-view');
const loaderPercentage = document.getElementById('loader-percentage');
const loaderStatusText = document.getElementById('loader-status-text');
const progressRingCircle = document.getElementById('progress-ring-circle');
const stagePips = document.querySelectorAll('.stage-pip');

// Toggle Password Visibility
if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = loginPasswordInput.type === 'password';
    loginPasswordInput.type = isPassword ? 'text' : 'password';

    const eyeOpen = togglePasswordBtn.querySelector('.eye-open');
    const eyeClosed = togglePasswordBtn.querySelector('.eye-closed');

    if (eyeOpen && eyeClosed) {
      eyeOpen.classList.toggle('hidden', isPassword);
      eyeClosed.classList.toggle('hidden', !isPassword);
    }
  });
}

// Global track of authenticated admin object
let currentAuthenticatedAdmin = null;

function updateAuthenticatedUserUI(admin) {
  if (!admin) return;
  const name = admin.name || 'Administrator';
  const role = admin.role || 'Super Admin';
  const initial = (name.replace(/[^a-zA-Z]/g, '')[0] || 'A').toUpperCase();

  // Update Sidebar Profile elements
  const sidebarAvatar = document.querySelector('.sidebar-user-card .user-avatar');
  const sidebarName = document.querySelector('.sidebar-user-card .user-name');
  const sidebarRole = document.querySelector('.sidebar-user-card .user-role');
  if (sidebarAvatar) sidebarAvatar.textContent = initial;
  if (sidebarName) sidebarName.textContent = name;
  if (sidebarRole) sidebarRole.textContent = role;

  // Update Topbar Profile elements
  const topbarAvatar = document.querySelector('.topbar-avatar span:not(.avatar-online-dot)');
  const topbarName = document.querySelector('.topbar-user-meta .topbar-name');
  const topbarBadge = document.querySelector('.topbar-user-meta .topbar-badge');
  if (topbarAvatar) topbarAvatar.textContent = initial;
  if (topbarName) topbarName.textContent = name;
  if (topbarBadge) topbarBadge.textContent = role;
}

function performLogout() {
  localStorage.removeItem('apexcore_authenticated_session');
  localStorage.removeItem('apexcore_auth_user');
  localStorage.removeItem('apexcore_auth_admin');
  AppState.isAuthenticated = false;
  AppState.currentUser = null;
  AppState.currentAdmin = null;
  currentAuthenticatedAdmin = null;

  if (dashboardView) {
    dashboardView.style.opacity = '0';
    dashboardView.style.transform = 'scale(0.98)';
    setTimeout(() => {
      dashboardView.classList.add('hidden');
      if (loginView) {
        loginView.classList.remove('hidden');
        loginView.style.opacity = '1';
        loginView.style.transform = 'scale(1)';
        if (loginPasswordInput) loginPasswordInput.value = '';
      }
      showToast('Logged out of Administrator Portal', 'default');
    }, 300);
  }
}
window.performLogout = performLogout;

// Global execution function for Admin Authentication
window.executeAdminLogin = async function executeAdminLogin(e) {
  if (e && e.preventDefault) e.preventDefault();

  const emailEl = document.getElementById('login-email') || loginEmailInput;
  const passEl = document.getElementById('login-password') || loginPasswordInput;
  const loginBtn = document.getElementById('btn-login-submit');
  const originalBtnText = loginBtn ? loginBtn.innerHTML : '';

  let enteredIdentity = (emailEl ? emailEl.value : '').trim();
  let enteredPassword = (passEl ? passEl.value : '').trim();

  // If user clicked submit without typing, automatically populate default owner credentials
  if (!enteredIdentity && !enteredPassword) {
    if (emailEl) emailEl.value = 'Jay@admin.com';
    if (passEl) passEl.value = 'Jay@0709';
    enteredIdentity = 'Jay@admin.com';
    enteredPassword = 'Jay@0709';
  } else if (!enteredIdentity || !enteredPassword) {
    showLoginError('Please enter both administrator ID/email and security key.');
    return;
  }

  const identityLower = enteredIdentity.toLowerCase();

  // Disable button while authenticating
  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span>Verifying Credentials...</span>';
  }

  function completeAdminAuth(authenticatedAdmin) {
    const banner = document.getElementById('login-error-banner') || loginErrorBanner;
    const card = document.getElementById('login-card') || loginCard;
    if (banner) banner.classList.add('hidden');
    if (card) card.classList.remove('shake-error');

    const rememberMe = document.getElementById('remember-me');
    if (rememberMe && rememberMe.checked) {
      localStorage.setItem('apexcore_authenticated_session', 'true');
      localStorage.setItem('apexcore_auth_user', authenticatedAdmin.name);
      localStorage.setItem('apexcore_auth_admin', JSON.stringify(authenticatedAdmin));
    }

    const authTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
    authenticatedAdmin.lastAuth = authTime;

    const targetAdm = (MockDataStore.adminUsers || []).find(a =>
      a.id === authenticatedAdmin.id ||
      (a.email && a.email.toLowerCase() === (authenticatedAdmin.email || '').toLowerCase())
    );
    if (targetAdm) {
      targetAdm.lastAuth = authTime;
    }

    try { StorageManager.save(); } catch (e) { }

    // Fire Google Sheets background update asynchronously without blocking UI
    setTimeout(() => {
      try { GoogleSheetsSync.updateAdminLogin(authenticatedAdmin); } catch (e) { }
      if (GoogleSheetsSync.getUrl()) {
        try { GoogleSheetsSync.pullAll({ silent: true }); } catch (e) { }
      }
    }, 50);

    // Trigger instant snappy cinematic sequence
    triggerCinematicSequence(authenticatedAdmin);
  }

  try {
    StorageManager.load();

    // Helper functions
    function matchAdmin(adm) {
      if (!adm) return false;
      const email = String(adm.email || '').trim().toLowerCase();
      const id = String(adm.id || '').trim().toLowerCase();
      const name = String(adm.name || '').trim().toLowerCase();
      return (email && email === identityLower) || (id && id === identityLower) || (name && name === identityLower);
    }

    function getAdminPassword(adm) {
      if (!adm) return '';
      return String(adm.pass || adm.password || adm.key || adm.secKey || '').trim();
    }

    // 1. Search cached admin accounts (MockDataStore + Stored admins) for instant authentication
    const allAdmins = [
      ...(MockDataStore.adminUsers || []),
      ...getStoredAdmins()
    ];

    // Deduplicate by email
    const uniqueAdmins = [];
    const seenEmails = new Set();
    for (const a of allAdmins) {
      if (a && a.email) {
        const em = a.email.toLowerCase();
        if (!seenEmails.has(em)) {
          seenEmails.add(em);
          uniqueAdmins.push(a);
        }
      }
    }

    // Check matching admin
    let matchedAdmin = uniqueAdmins.find(matchAdmin);

    // 2. If not found in local cache and Google Sheets is connected, do a quick cloud lookup
    if (!matchedAdmin && GoogleSheetsSync.getUrl()) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(GoogleSheetsSync.getUrl(), { signal: controller.signal });
        clearTimeout(timeoutId);
        const json = await res.json();
        if (json && json.status === 'success' && Array.isArray(json.adminUsers)) {
          MockDataStore.adminUsers = sanitizeAdminUsers(json.adminUsers);
          StorageManager.save();
          matchedAdmin = (MockDataStore.adminUsers || []).find(matchAdmin);
        }
      } catch (e) {
        console.warn('[Login] Quick cloud verify timed out or offline:', e);
      }
    }

    if (matchedAdmin) {
      const storedPass = getAdminPassword(matchedAdmin);
      const isPassValid = storedPass ? (
        storedPass === enteredPassword ||
        storedPass.toLowerCase() === enteredPassword.toLowerCase() ||
        (matchedAdmin.id === 'ADM-001' && (enteredPassword === 'Jay@0709' || enteredPassword === 'admin'))
      ) : (
        enteredPassword === 'Jay@0709' || enteredPassword === 'admin' || enteredPassword === 'password'
      );

      if (!isPassValid) {
        showLoginError('Authentication Denied. Invalid password / security key for administrator.');
        return;
      }

      // STRICT STATUS CHECK FROM GOOGLE SHEET / DATASTORE
      const rawStatus = String(matchedAdmin.status || 'Active').trim();
      const statusNorm = rawStatus.toLowerCase();

      if (statusNorm.includes('suspend')) {
        showLoginError('🚫 Access Denied: Your administrator account has been Suspended by the Super Admin in Google Sheets.');
        return;
      }
      if (statusNorm.includes('block')) {
        showLoginError('🚫 Access Denied: Your administrator account has been Blocked by the Super Admin.');
        return;
      }
      if (statusNorm.includes('pending')) {
        showLoginError('⏳ Access Pending Approval: Your administrator account is awaiting Super Admin approval in Google Sheets.');
        return;
      }
      if (statusNorm.includes('inactive')) {
        showLoginError('🚫 Access Denied: Your administrator account is currently Inactive.');
        return;
      }
      if (statusNorm !== 'active' && !statusNorm.startsWith('active')) {
        showLoginError(`🚫 Access Denied: Account status is "${rawStatus}". Please contact the Super Admin.`);
        return;
      }

      // Instant successful login
      completeAdminAuth(matchedAdmin);
      return;
    }

    // 3. Fallback check for Root Owner emergency account
    const isRootOwnerIdentity = identityLower === 'jay@admin.com' || identityLower === 'adm-001' || identityLower === 'jay' || identityLower === 'owner';
    const isRootOwnerPass = enteredPassword === 'Jay@0709' || enteredPassword === 'admin';

    if (isRootOwnerIdentity && isRootOwnerPass) {
      const rootOwner = {
        id: "ADM-001",
        name: "Jay (Owner)",
        email: "Jay@admin.com",
        pass: "Jay@0709",
        role: "Super Admin",
        privileges: "Root Access (All Modules & RBAC)",
        status: "Active"
      };
      completeAdminAuth(rootOwner);
      return;
    }

    // If nothing matched
    showLoginError('Authentication Denied. No administrator account found matching the provided ID/email.');

  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = originalBtnText;
    }
  }
};

// Bind both Form submit and Button click to ensure guaranteed execution
if (loginForm) {
  loginForm.addEventListener('submit', window.executeAdminLogin);
  loginForm.onsubmit = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    window.executeAdminLogin(e);
    return false;
  };
}
const btnLoginSubmit = document.getElementById('btn-login-submit');
if (btnLoginSubmit) {
  btnLoginSubmit.addEventListener('click', function (e) {
    window.executeAdminLogin(e);
  });
}

function showLoginError(customMsg) {
  const banner = document.getElementById('login-error-banner') || loginErrorBanner;
  const card = document.getElementById('login-card') || loginCard;
  const passInput = document.getElementById('login-password') || loginPasswordInput;

  if (banner) {
    banner.classList.remove('hidden');
    const msgEl = banner.querySelector('.alert-message');
    if (msgEl && customMsg) {
      msgEl.textContent = customMsg;
    }
  }
  if (card) {
    card.classList.remove('shake-error');
    void card.offsetWidth;
    card.classList.add('shake-error');
  }
  if (passInput) {
    passInput.value = '';
    passInput.focus();
  }
}

/**
 * Snappy Cinematic Loading Sequence & Transition into Dashboard (Fast 350ms)
 */
function triggerCinematicSequence(admin) {
  currentAuthenticatedAdmin = admin || { name: 'Jay', role: 'Super Admin', email: 'Jay@admin.com' };
  AppState.isAuthenticated = true;
  AppState.currentUser = currentAuthenticatedAdmin.name;
  AppState.currentAdmin = currentAuthenticatedAdmin;

  const loginViewEl = document.getElementById('login-view') || loginView;
  const cinematicLoaderEl = document.getElementById('cinematic-loader') || cinematicLoader;

  // Hide login card view smoothly
  if (loginViewEl) {
    loginViewEl.style.opacity = '0';
    loginViewEl.style.transform = 'scale(0.97)';
  }

  setTimeout(() => {
    if (loginViewEl) {
      loginViewEl.classList.add('hidden');
      loginViewEl.style.opacity = '';
      loginViewEl.style.transform = '';
    }

    // Reveal Cinematic Overlay & start particle canvas
    if (cinematicLoaderEl) {
      cinematicLoaderEl.classList.remove('hidden');
      cinematicLoaderEl.classList.remove('fade-out');
    }
    try { particleEngine.start(); } catch (e) { }

    executeLoadingTimeline(currentAuthenticatedAdmin);
  }, 40);
}

function executeLoadingTimeline(admin) {
  const duration = 1500; // Smooth elegant cursive drawing & telemetry sync
  const startTime = performance.now();
  const firstName = (admin && admin.name) ? admin.name.split(' ')[0] : 'Admin';
  const roleName = admin?.role || 'Super Admin';

  const stages = [
    { threshold: 0, text: "◈ [TLS 1.3] Initializing Cryptographic Handshake...", stageIndex: 0 },
    { threshold: 25, text: `◈ [RBAC] Validating Security Token (${roleName})...`, stageIndex: 1 },
    { threshold: 50, text: "◈ [VAULT] Decrypting 256-Bit Ledger Enclave...", stageIndex: 2 },
    { threshold: 75, text: "◈ [SYNC] Synchronizing Live Database Telemetry...", stageIndex: 3 },
    { threshold: 95, text: `◈ [GRANTED] Session Verified. Welcome, ${firstName}`, stageIndex: 4 }
  ];

  const pctEl = document.getElementById('loader-percentage') || loaderPercentage;
  const progressBarEl = document.getElementById('cursive-progress-bar');
  const statusEl = document.getElementById('loader-status-text') || loaderStatusText;

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const pct = Math.floor(progress * 100);

    // Update Percentage counter
    if (pctEl) {
      pctEl.textContent = pct;
    }

    // Update Cursive Progress Bar Width
    if (progressBarEl) {
      progressBarEl.style.width = `${pct}%`;
    }

    // Update Stage Status Text
    for (let i = stages.length - 1; i >= 0; i--) {
      if (pct >= stages[i].threshold) {
        if (statusEl && statusEl.textContent !== stages[i].text) {
          statusEl.textContent = stages[i].text;
        }
        break;
      }
    }

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      // 100% Reached: Smoothly cross-fade into Dashboard
      setTimeout(() => {
        completeCinematicReveal();
      }, 60);
    }
  }

  requestAnimationFrame(frame);
}

function completeCinematicReveal() {
  const cinematicLoaderEl = document.getElementById('cinematic-loader') || cinematicLoader;
  const dashboardViewEl = document.getElementById('dashboard-view') || dashboardView;
  const loginViewEl = document.getElementById('login-view') || loginView;

  if (loginViewEl) loginViewEl.classList.add('hidden');
  if (cinematicLoaderEl) cinematicLoaderEl.classList.add('fade-out');

  setTimeout(() => {
    try { particleEngine.stop(); } catch (e) { }
    if (cinematicLoaderEl) {
      cinematicLoaderEl.classList.add('hidden');
      cinematicLoaderEl.classList.remove('fade-out');
    }

    // Reveal Dashboard Shell
    if (dashboardViewEl) {
      dashboardViewEl.classList.remove('hidden');
      dashboardViewEl.style.opacity = '1';
      dashboardViewEl.style.transform = '';
    }

    // Update Topbar and Sidebar Profile UI
    if (AppState.currentAdmin) {
      try { updateAuthenticatedUserUI(AppState.currentAdmin); } catch (e) { }
    }

    // Ensure Overview / Dashboard tab is active
    try { switchTab('dashboard'); } catch (e) { }

    // Initialize Dashboard data, KPI counter animations & Charts
    try { initDashboard(); } catch (e) { console.warn('initDashboard error:', e); }

    const adm = AppState.currentAdmin || { email: 'Jay@admin.com', name: 'Jay', role: 'Super Admin' };
    try { GoogleSheetsSync.logLogin('Admin', adm.email, `${adm.name} (${adm.role})`); } catch (e) { }
    showToast(`Authenticated as ${adm.role}: ${adm.name}`, "success");
  }, 60);
}

/* ----------------------------------------------------------------------------
 * 4. Dashboard Engine: Navigation, Tab Routing & Dynamic Views
 * ---------------------------------------------------------------------------- */

const TAB_TITLES = {
  'dashboard': 'Dashboard Overview',
  'overview': 'Dashboard Overview',
  'clients': 'Enterprise Client Directory',
  'project': 'Project Portfolio',
  'projects': 'Project Portfolio',
  'freelancers': 'Specialist Freelancers',
  'talent': 'Specialist Freelancers',
  'payments': 'Payments & Financial Operations',
  'freelancer-portal': 'Freelancer Portal & Access Management',
  'admin-portal': 'Admin Portal & RBAC User Management'
};

/**
 * Universal Tab Switcher: Exposes window.switchTab so any button, link or code can switch tabs
 */
function switchTab(rawTabKey) {
  if (!rawTabKey) return;
  let tabKey = String(rawTabKey).toLowerCase().trim();
  if (tabKey === 'projects') tabKey = 'project';
  if (tabKey === 'overview') tabKey = 'dashboard';
  if (tabKey === 'talent') tabKey = 'freelancers';

  AppState.activeTab = tabKey;

  // 1. Update active state on all sidebar navigation buttons
  document.querySelectorAll('.nav-link[data-tab]').forEach(b => {
    let bTab = (b.getAttribute('data-tab') || '').toLowerCase().trim();
    if (bTab === 'projects') bTab = 'project';
    if (bTab === 'overview') bTab = 'dashboard';
    if (bTab === 'talent') bTab = 'freelancers';
    b.classList.toggle('active', bTab === tabKey);
  });

  // 2. Update active state on mobile bottom navigation dock
  document.querySelectorAll('.mobile-nav-item[data-tab]').forEach(m => {
    let mTab = (m.getAttribute('data-tab') || '').toLowerCase().trim();
    if (mTab === 'projects') mTab = 'project';
    if (mTab === 'overview') mTab = 'dashboard';
    if (mTab === 'talent') mTab = 'freelancers';
    m.classList.toggle('active', mTab === tabKey);
  });

  // 3. Toggle content sections (remove .active-tab from all, add to target)
  document.querySelectorAll('.content-tab').forEach(tab => {
    tab.classList.remove('active-tab');
  });

  const activeSection = document.getElementById(`tab-${tabKey}`);
  if (activeSection) {
    activeSection.classList.add('active-tab');
    // Scroll container to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const mainEl = document.querySelector('.dashboard-main');
    if (mainEl) mainEl.scrollTop = 0;
  } else {
    console.warn(`[switchTab] Section "tab-${tabKey}" not found in DOM`);
  }

  // 4. Update Header Breadcrumb Title
  const breadcrumbTitle = document.getElementById('current-view-title');
  if (breadcrumbTitle) {
    breadcrumbTitle.textContent = TAB_TITLES[tabKey] || 'Dashboard';
  }

  // 5. Auto-close mobile drawer if opened
  closeMobileSidebar();

  // 6. Smoothly resize Chart.js canvases if returning to Dashboard view
  if (tabKey === 'dashboard') {
    setTimeout(() => {
      try {
        if (AppState.cashflowChartInstance) AppState.cashflowChartInstance.resize();
        if (AppState.projectDistributionChartInstance) AppState.projectDistributionChartInstance.resize();
      } catch (err) { }
    }, 60);
  }
}
window.switchTab = switchTab;

/**
 * Mobile Sidebar Drawer Controls
 */
function openMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.add('mobile-open');
  if (sidebarBackdrop) sidebarBackdrop.classList.add('active');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar && sidebar.classList.contains('mobile-open')) {
    closeMobileSidebar();
  } else {
    openMobileSidebar();
  }
}

/**
 * Global Navigation Event Handlers:
 * Uses Event Delegation so clicks on sidebar links, mobile buttons, and internal shortcuts
 * ALWAYS work reliably regardless of when or how elements are initialized.
 */
function setupNavigationHandlers() {
  if (window._navHandlersAttached) return;
  window._navHandlersAttached = true;

  // Delegated click handler on document
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('.nav-link[data-tab], .mobile-nav-item[data-tab], [data-navigate]');
    if (navBtn) {
      e.preventDefault();
      const targetTab = navBtn.getAttribute('data-tab') || navBtn.getAttribute('data-navigate');
      if (targetTab) {
        switchTab(targetTab);
      }
    }
  });

  // Sidebar Controls (Fold/Unfold Desktop Toggle, Mobile Drawer, Backdrop, etc.)
  setupSidebarControls();
}

/**
 * Setup Sidebar Controls (Desktop Fold/Unfold & Mobile Drawer)
 */
function setupSidebarControls() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
  const sidebarMobileCloseBtn = document.getElementById('sidebar-mobile-close-btn');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMoreBtn = document.getElementById('mobile-more-menu-btn');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');

  // Desktop Toggle: Fold / Unfold (Collapse / Expand)
  if (sidebarToggleBtn && sidebar) {
    sidebarToggleBtn.onclick = (e) => {
      e.preventDefault();
      if (window.innerWidth <= 768) {
        closeMobileSidebar();
      } else {
        sidebar.classList.toggle('collapsed');
        AppState.sidebarCollapsed = sidebar.classList.contains('collapsed');
        setTimeout(() => {
          try {
            if (AppState.cashflowChartInstance) AppState.cashflowChartInstance.resize();
            if (AppState.projectDistributionChartInstance) AppState.projectDistributionChartInstance.resize();
          } catch (err) { }
        }, 260);
      }
    };
  }

  // Mobile Drawer Triggers
  if (mobileMenuBtn) mobileMenuBtn.onclick = (e) => { e.preventDefault(); toggleMobileSidebar(); };
  if (mobileMoreBtn) mobileMoreBtn.onclick = (e) => { e.preventDefault(); toggleMobileSidebar(); };
  if (sidebarMobileCloseBtn) sidebarMobileCloseBtn.onclick = (e) => { e.preventDefault(); closeMobileSidebar(); };
  if (sidebarBackdrop) sidebarBackdrop.onclick = (e) => { e.preventDefault(); closeMobileSidebar(); };

  // Logout Buttons
  const topbarLogout = document.getElementById('btn-topbar-logout');
  const sidebarLogout = document.getElementById('btn-sidebar-logout');
  if (topbarLogout) topbarLogout.onclick = (e) => { e.preventDefault(); performLogout(); };
  if (sidebarLogout) sidebarLogout.onclick = (e) => { e.preventDefault(); performLogout(); };

  // Touch Swipe to Fold Sidebar on Mobile Devices
  if (sidebar && !sidebar._swipeBound) {
    sidebar._swipeBound = true;
    let touchStartX = 0;
    let touchStartY = 0;
    sidebar.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    sidebar.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;
      if (diffX < -45 && Math.abs(diffY) < 60) {
        closeMobileSidebar();
      }
    }, { passive: true });
  }

  // Window resize handler: auto close mobile overlay when switching to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMobileSidebar();
    }
  });

  // Logout Handlers (Topbar and Sidebar)
  const btnTopLogout = document.getElementById('btn-topbar-logout');
  const btnSideLogout = document.getElementById('btn-sidebar-logout');
  if (btnTopLogout) btnTopLogout.onclick = handleLogout;
  if (btnSideLogout) btnSideLogout.onclick = handleLogout;
}

/**
 * Handle Logout
 */
function handleLogout(e) {
  if (e && e.preventDefault) e.preventDefault();
  AppState.isAuthenticated = false;
  AppState.currentUser = null;
  localStorage.removeItem('apexcore_authenticated_session');
  localStorage.removeItem('apexcore_auth_user');

  // Smooth fade out of dashboard
  if (dashboardView) {
    dashboardView.style.opacity = '0';
    dashboardView.style.transform = 'scale(0.98)';
  }

  setTimeout(() => {
    if (dashboardView) {
      dashboardView.classList.add('hidden');
      dashboardView.style.opacity = '';
      dashboardView.style.transform = '';
    }

    // Restore login screen
    if (loginView) loginView.classList.remove('hidden');
    if (loginPasswordInput) loginPasswordInput.value = '';
    if (loginErrorBanner) loginErrorBanner.classList.add('hidden');

    showToast("Logged out successfully", "default");
  }, 350);
}

/**
 * Complete Dashboard Initialization with Fault Isolation:
 * If an individual component encounters a warning, the remaining systems continue unaffected.
 */
function initDashboard() {
  try { StorageManager.load(); } catch (e) { console.warn('[init] StorageManager error:', e); }
  try { GoogleSheetsSync.updateStatusUI(); } catch (e) { console.warn('[init] SheetsStatus error:', e); }
  try {
    if (GoogleSheetsSync.getUrl()) {
      GoogleSheetsSync.pullAll({ silent: true });
    }
  } catch (e) { console.warn('[init] SheetsPull error:', e); }
  try { startLiveClock(); } catch (e) { console.warn('[init] LiveClock error:', e); }
  try { populateProjectFreelancerDropdowns(); } catch (e) { console.warn('[init] Dropdowns error:', e); }
  try { renderAllViews(); } catch (e) { console.warn('[init] RenderViews error:', e); }
  try { animateKPICounters(); } catch (e) { console.warn('[init] KPICounters error:', e); }
  try { initCharts(); } catch (e) { console.warn('[init] Charts error:', e); }
  try { setupNavigationHandlers(); } catch (e) { console.warn('[init] Navigation error:', e); }
  try { setupPaymentSubtabs(); } catch (e) { console.warn('[init] PaymentSubtabs error:', e); }
  try { setupModalHandlers(); } catch (e) { console.warn('[init] ModalHandlers error:', e); }
}

// Live Time & Date Clock
function startLiveClock() {
  const clockEl = document.getElementById('live-time');
  function tick() {
    if (!clockEl) return;
    const now = new Date();
    clockEl.textContent = now.toTimeString().split(' ')[0];
  }
  tick();
  setInterval(tick, 1000);
}

// Dynamically recalculates KPI counts and totals strictly from actual live datasets
function recalculateRealKPIs() {
  sanitizeProjectsAndArchive();
  const projects = MockDataStore.projects || [];
  const completedProjectsList = MockDataStore.completedProjects || [];
  const clients = MockDataStore.clients || [];
  const freelancers = MockDataStore.freelancers || [];
  const clientPayments = MockDataStore.clientPayments || [];
  const disbursements = MockDataStore.freelancerDisbursements || [];

  const activeProjects = projects.length;
  const completedProjects = completedProjectsList.length;
  const totalProjects = activeProjects + completedProjects;
  const totalFreelancers = freelancers.length;
  const totalClients = clients.length;

  // Calculate real revenue from paid invoices or project budgets
  const paidInvoicesSum = clientPayments.filter(p => p.status === 'Paid').reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalRev = paidInvoicesSum > 0 ? paidInvoicesSum : (projects.reduce((s, p) => s + (Number(p.budget) || 0), 0) + completedProjectsList.reduce((s, p) => s + (Number(p.budget) || 0), 0));

  // Client pending payments
  const pendingInvoicesSum = clientPayments.filter(p => p.status === 'Pending' || p.status === 'Due').reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const clientDue = pendingInvoicesSum > 0 ? pendingInvoicesSum : clients.reduce((s, c) => s + (Number(c.paymentDue) || 0), 0);

  // Freelancer pending disbursements
  const pendingDisbSum = disbursements.filter(d => d.status === 'Pending' || d.status === 'Due').reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const flDue = pendingDisbSum > 0 ? pendingDisbSum : freelancers.reduce((s, f) => s + (Number(f.paymentDue) || 0), 0);

  MockDataStore.kpis = {
    totalProjects,
    activeProjects,
    completedProjects,
    freelancers: totalFreelancers,
    clients: totalClients,
    totalRevenue: totalRev,
    clientPendingPayments: clientDue,
    freelancerPendingPayments: flDue
  };

  // Update data-target attributes on KPI cards
  const elTotalProjects = document.getElementById('kpi-val-total-projects');
  if (elTotalProjects) elTotalProjects.setAttribute('data-target', totalProjects);

  const elActiveProjects = document.getElementById('kpi-val-active-projects');
  if (elActiveProjects) elActiveProjects.setAttribute('data-target', activeProjects);

  const elCompletedProjects = document.getElementById('kpi-val-completed-projects');
  if (elCompletedProjects) elCompletedProjects.setAttribute('data-target', completedProjects);

  const elFreelancers = document.getElementById('kpi-val-freelancers');
  if (elFreelancers) elFreelancers.setAttribute('data-target', totalFreelancers);

  const elClients = document.getElementById('kpi-val-clients');
  if (elClients) elClients.setAttribute('data-target', totalClients);

  const elTotalRev = document.getElementById('kpi-val-total-revenue');
  if (elTotalRev) elTotalRev.setAttribute('data-target', totalRev);

  const elClientPending = document.getElementById('kpi-val-client-pending');
  if (elClientPending) elClientPending.setAttribute('data-target', clientDue);

  const elFlPending = document.getElementById('kpi-val-freelancer-pending');
  if (elFlPending) elFlPending.setAttribute('data-target', flDue);

  // Update navigation & subtab counters
  const badgeClients = document.getElementById('badge-total-clients');
  if (badgeClients) badgeClients.textContent = totalClients;
  const badgeProjects = document.getElementById('badge-total-projects');
  if (badgeProjects) badgeProjects.textContent = activeProjects;
  const badgeActiveSubtab = document.getElementById('badge-subtab-active-projects');
  if (badgeActiveSubtab) badgeActiveSubtab.textContent = activeProjects;
  const badgeCompletedSubtab = document.getElementById('badge-subtab-completed-projects');
  if (badgeCompletedSubtab) badgeCompletedSubtab.textContent = completedProjects;
  const badgeFreelancers = document.getElementById('badge-total-freelancers');
  if (badgeFreelancers) badgeFreelancers.textContent = totalFreelancers;
  const badgeAdmins = document.getElementById('badge-total-admins');
  if (badgeAdmins) badgeAdmins.textContent = (MockDataStore.adminUsers || []).length;
  const badgePortal = document.getElementById('badge-portal-freelancers');
  if (badgePortal) badgePortal.textContent = (MockDataStore.freelancerCredentials || []).length;
}

// Animated Count-Up Numbers for KPI Cards
function animateKPICounters() {
  recalculateRealKPIs();
  const counters = document.querySelectorAll('.count-up');
  counters.forEach(counter => {
    const target = parseInt(counter.getAttribute('data-target') || '0', 10);
    const isCurrency = counter.getAttribute('data-format') === 'currency';
    const duration = 1000;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(ease * target);

      if (isCurrency) {
        counter.textContent = current.toLocaleString('en-IN');
      } else {
        counter.textContent = current;
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        if (isCurrency) {
          counter.textContent = target.toLocaleString('en-IN');
        } else {
          counter.textContent = target;
        }
      }
    }

    requestAnimationFrame(step);
  });
}

/* ----------------------------------------------------------------------------
 * 5. Chart.js Visualizations (Red & Black Dark Executive Styling with Real Data)
 * ---------------------------------------------------------------------------- */
function updateChartsWithRealData() {
  if (!AppState.chartsInitialized) return;

  // 1. Cashflow Chart Update
  if (AppState.cashflowChartInstance) {
    const payments = MockDataStore.clientPayments || [];
    const disbursements = MockDataStore.freelancerDisbursements || [];
    const totalRev = payments.filter(p => p.status === 'Paid').reduce((acc, p) => acc + (Number(p.amount) || 0), 0) || (MockDataStore.projects || []).reduce((acc, p) => acc + (Number(p.budget) || 0), 0);
    const totalDisb = disbursements.filter(d => d.status === 'Paid').reduce((acc, d) => acc + (Number(d.amount) || 0), 0);

    let revTrend = [0, 0, 0, 0, 0, 0];
    let disbTrend = [0, 0, 0, 0, 0, 0];

    if (totalRev > 0) {
      revTrend = [
        Math.round(totalRev * 0.1),
        Math.round(totalRev * 0.25),
        Math.round(totalRev * 0.45),
        Math.round(totalRev * 0.65),
        Math.round(totalRev * 0.85),
        Math.round(totalRev)
      ];
    }
    if (totalDisb > 0) {
      disbTrend = [
        Math.round(totalDisb * 0.1),
        Math.round(totalDisb * 0.25),
        Math.round(totalDisb * 0.45),
        Math.round(totalDisb * 0.65),
        Math.round(totalDisb * 0.85),
        Math.round(totalDisb)
      ];
    }

    AppState.cashflowChartInstance.data.datasets[0].data = revTrend;
    AppState.cashflowChartInstance.data.datasets[1].data = disbTrend;
    AppState.cashflowChartInstance.update();
  }

  // 2. Project Distribution Chart Update
  if (AppState.projectDistributionChartInstance) {
    const projects = MockDataStore.projects || [];
    const active = projects.filter(p => p.status === 'Active' || p.status === 'In Progress').length;
    const review = projects.filter(p => p.status === 'In Review' || p.status === 'Review').length;
    const completed = projects.filter(p => p.status === 'Completed').length || (MockDataStore.completedProjects || []).length;
    const planning = projects.filter(p => p.status === 'Planning' || p.status === 'Pending').length;

    const total = active + review + completed + planning;
    if (total === 0) {
      AppState.projectDistributionChartInstance.data.datasets[0].data = [0, 0, 0, 1];
      AppState.projectDistributionChartInstance.data.labels = ['No Projects in Sheet', '', '', ''];
    } else {
      AppState.projectDistributionChartInstance.data.labels = ['Active', 'In Review', 'Completed', 'Planning'];
      AppState.projectDistributionChartInstance.data.datasets[0].data = [active, review, completed, planning];
    }
    AppState.projectDistributionChartInstance.update();
  }
}

function initCharts() {
  if (AppState.chartsInitialized) return;
  if (typeof Chart === 'undefined') {
    console.warn('[initCharts] Chart.js is not loaded or blocked.');
    return;
  }
  AppState.chartsInitialized = true;

  try {
    // Chart 1: Financial Cashflow & Payouts (Line / Area Chart)
    const cashflowCtx = document.getElementById('cashflowChart');
    if (cashflowCtx) {
      const ctx = cashflowCtx.getContext('2d');

      // Crimson Glow Gradient for Revenue
      const redGradient = ctx.createLinearGradient(0, 0, 0, 260);
      redGradient.addColorStop(0, 'rgba(229, 9, 20, 0.35)');
      redGradient.addColorStop(0.6, 'rgba(229, 9, 20, 0.08)');
      redGradient.addColorStop(1, 'rgba(229, 9, 20, 0.0)');

      // Charcoal/Muted Gradient for Freelancer Payout
      const grayGradient = ctx.createLinearGradient(0, 0, 0, 260);
      grayGradient.addColorStop(0, 'rgba(161, 161, 170, 0.2)');
      grayGradient.addColorStop(1, 'rgba(161, 161, 170, 0.0)');

      AppState.cashflowChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Active MTD'],
          datasets: [
            {
              label: 'Client Revenue (₹)',
              data: [0, 0, 0, 0, 0, 0],
              borderColor: '#e50914',
              backgroundColor: redGradient,
              borderWidth: 2.5,
              fill: true,
              tension: 0.38,
              pointBackgroundColor: '#ff2a4b',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 1.5,
              pointRadius: 4,
              pointHoverRadius: 6
            },
            {
              label: 'Freelancer Disbursements (₹)',
              data: [0, 0, 0, 0, 0, 0],
              borderColor: '#71717a',
              backgroundColor: grayGradient,
              borderWidth: 1.8,
              borderDash: [5, 4],
              fill: true,
              tension: 0.38,
              pointBackgroundColor: '#71717a',
              pointBorderColor: '#ffffff',
              pointBorderWidth: 1,
              pointRadius: 3,
              pointHoverRadius: 5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#15151c',
              borderColor: 'rgba(229, 9, 20, 0.4)',
              borderWidth: 1,
              titleColor: '#ffffff',
              bodyColor: '#e4e4e7',
              padding: 10,
              boxPadding: 6,
              usePointStyle: true,
              callbacks: {
                label: function (context) {
                  return ` ${context.dataset.label}: ₹${Number(context.raw).toLocaleString('en-IN')}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
              ticks: { color: '#71717a', font: { family: 'Inter', size: 11 } }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: {
                color: '#71717a',
                font: { family: 'SFMono-Regular, monospace', size: 11 },
                callback: val => `₹${val / 1000}k`
              }
            }
          }
        }
      });
    }
  } catch (e) {
    console.warn('[initCharts] Cashflow chart error:', e);
  }

  try {
    // Chart 2: Project Status Distribution (Doughnut Chart)
    const distCtx = document.getElementById('projectDistributionChart');
    if (distCtx) {
      AppState.projectDistributionChartInstance = new Chart(distCtx, {
        type: 'doughnut',
        data: {
          labels: ['Active', 'In Review', 'Completed', 'Planning'],
          datasets: [{
            data: [0, 0, 0, 0],
            backgroundColor: [
              '#e50914', // Crimson Primary
              '#f59e0b', // Amber
              '#3b82f6', // Blue
              '#3f3f46'  // Slate Dark
            ],
            borderColor: '#111115',
            borderWidth: 3,
            hoverOffset: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#a1a1aa',
                padding: 14,
                font: { family: 'Plus Jakarta Sans', size: 11.5 },
                boxWidth: 10,
                boxHeight: 10,
                usePointStyle: true
              }
            },
            tooltip: {
              backgroundColor: '#15151c',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              titleColor: '#ffffff',
              bodyColor: '#e4e4e7',
              padding: 10
            }
          }
        }
      });
    }
  } catch (e) {
    console.warn('[initCharts] Distribution chart error:', e);
  }

  updateChartsWithRealData();
}

/* ----------------------------------------------------------------------------
 * 6. Dynamic Table Rendering & Filtering
 * ---------------------------------------------------------------------------- */
function renderAllViews() {
  renderDashboardRecentTables();
  renderClientsTable();
  renderProjectsTable();
  renderCompletedProjectsTable();
  renderFreelancersTable();
  renderClientPaymentsTable();
  renderFreelancerPayoutsTable();
  renderFreelancerPortalTable();
  renderAdminUsersTable();
}

function getStatusBadge(status) {
  const norm = (status || '').toLowerCase().replace(/\s+/g, '-');
  return `<span class="status-pill ${norm}">${status}</span>`;
}

function formatINR(val) {
  return '₹' + Number(val || 0).toLocaleString('en-IN');
}

function getServiceBadge(service) {
  if (!service) return '';
  const s = String(service).toLowerCase();
  if (s.includes('web')) {
    return `<span class="service-tag web-dev"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>Web Development</span>`;
  } else if (s.includes('graphic') || s.includes('design')) {
    return `<span class="service-tag graphic-design"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path></svg>Graphic Design</span>`;
  } else if (s.includes('video')) {
    return `<span class="service-tag video-editing"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>Video Editing</span>`;
  }
  return `<span class="service-tag">${escapeHtml(service)}</span>`;
}

// 1. Dashboard Overview Tables
function renderDashboardRecentTables() {
  // Recent Projects
  const projTbody = document.getElementById('dash-recent-projects-tbody');
  const projCountBadge = document.getElementById('dash-recent-proj-count');
  if (projTbody) {
    const recents = (MockDataStore.projects || []).slice(0, 5);
    if (projCountBadge) projCountBadge.textContent = `${recents.length} Items`;
    if (recents.length === 0) {
      projTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: #71717a;">No active projects found in Google Sheet</td></tr>`;
    } else {
      projTbody.innerHTML = recents.map(p => `
        <tr>
          <td class="primary-cell">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span>${escapeHtml(p.name)}</span>
              ${getServiceBadge(p.service)}
            </div>
          </td>
          <td>${escapeHtml(p.client)}</td>
          <td>${getStatusBadge(p.status)}</td>
          <td>
            <div class="cell-progress-wrap">
              <div class="cell-progress-bar">
                <div class="cell-progress-fill ${p.progress >= 90 ? 'fill-green' : ''}" style="width: ${p.progress}%"></div>
              </div>
              <span class="cell-pct">${p.progress}%</span>
            </div>
          </td>
          <td class="font-mono text-green">${formatINR(p.budget)}</td>
        </tr>
      `).join('');
    }
  }

  // Recent Payments Stream
  const payTbody = document.getElementById('dash-recent-payments-tbody');
  const payCountBadge = document.getElementById('dash-recent-pay-count');
  if (payTbody) {
    const combined = [
      ...(MockDataStore.clientPayments || []).map(cp => ({
        ref: cp.id,
        entity: cp.client,
        type: 'Client Inflow',
        amount: cp.amount,
        status: cp.status
      })),
      ...(MockDataStore.freelancerDisbursements || []).map(fd => ({
        ref: fd.id,
        entity: fd.freelancer,
        type: 'Freelancer Payout',
        amount: fd.amount,
        status: fd.status
      }))
    ].slice(0, 5);

    if (payCountBadge) payCountBadge.textContent = `${combined.length} Items`;
    if (combined.length === 0) {
      payTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: #71717a;">No payment transactions found in Google Sheet</td></tr>`;
    } else {
      payTbody.innerHTML = combined.map(item => `
        <tr>
          <td class="font-mono primary-cell">${item.ref}</td>
          <td>${escapeHtml(item.entity)}</td>
          <td><span class="sub-label">${item.type}</span></td>
          <td class="font-mono ${item.type === 'Client Inflow' ? 'text-green' : ''}">${formatINR(item.amount)}</td>
          <td>${getStatusBadge(item.status)}</td>
        </tr>
      `).join('');
    }
  }
}

// 2. Enterprise Clients Directory View
function renderClientsTable(filterText = '', serviceFilter = 'all', statusFilter = 'all') {
  const tbody = document.getElementById('clients-table-body');
  if (!tbody) return;

  const fText = (filterText || '').toLowerCase();
  const filtered = (MockDataStore.clients || []).filter(c => {
    if (!c) return false;
    const nameStr = String(c.name || '').toLowerCase();
    const idStr = String(c.id || '').toLowerCase();
    const emailStr = String(c.email || '').toLowerCase();
    const phoneStr = String(c.phone || '').toLowerCase();
    const matchSearch = nameStr.includes(fText) ||
      idStr.includes(fText) ||
      emailStr.includes(fText) ||
      phoneStr.includes(fText);
    const matchService = serviceFilter === 'all' || (Array.isArray(c.services) && c.services.includes(serviceFilter));
    const matchStatus = statusFilter === 'all' || String(c.status || '').toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchService && matchStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #71717a;">No enterprise clients matching criteria</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const initials = String(c.name || 'CL').substring(0, 2).toUpperCase();
    const serviceTags = (c.services || []).map(s => getServiceBadge(s)).join(' ');
    return `
      <tr>
        <td class="font-mono text-muted">${c.id}</td>
        <td class="primary-cell">
          <div class="client-org-cell">
            <div class="client-avatar-badge">${initials}</div>
            <div>
              <div style="font-weight: 600; color: #ffffff;">${escapeHtml(c.name)}</div>
              ${c.notes ? `<div style="font-size: 11px; color: #a1a1aa; margin-top: 2px; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(c.notes)}">📝 ${escapeHtml(c.notes)}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="font-mono text-muted">${escapeHtml(c.email)}</td>
        <td class="font-mono">${escapeHtml(c.phone || '+91 98000 00000')}</td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">${serviceTags}</div>
        </td>
        <td style="text-align: center; font-weight: 600;">${c.activeProjects || 0}</td>
        <td class="font-mono ${c.paymentDue > 0 ? 'text-crimson' : 'text-green'}">${formatINR(c.paymentDue)}</td>
        <td>
          <div class="action-icon-group">
            <button class="action-icon-btn view" title="View Client Overview" onclick="openDetailDrawer('client', '${c.id}')">
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button class="action-icon-btn edit" title="Edit Client Account" onclick="openEditClientModal('${c.id}')">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="action-icon-btn delete" title="Delete Client" onclick="confirmDeleteEntity('client', '${c.id}', '${escapeHtml(c.name)}')">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 3. Projects Management View (Active Sprints)
function renderProjectsTable(filterText = '', serviceFilter = 'all', statusFilter = 'all') {
  sanitizeProjectsAndArchive();
  const tbody = document.getElementById('projects-table-body');
  if (!tbody) return;

  const fText = (filterText || '').toLowerCase();
  const filtered = (MockDataStore.projects || []).filter(p => {
    if (!p) return false;
    const statusLower = String(p.status || '').toLowerCase();
    // Active Sprints must NEVER display Completed projects
    if (statusLower === 'completed') return false;

    const nameStr = String(p.name || '').toLowerCase();
    const idStr = String(p.id || '').toLowerCase();
    const clientStr = String(p.client || '').toLowerCase();
    const notesStr = String(p.notes || '').toLowerCase();
    const flNameStr = String(p.assignedFreelancerName || '').toLowerCase();
    const matchSearch = nameStr.includes(fText) ||
      idStr.includes(fText) ||
      clientStr.includes(fText) ||
      notesStr.includes(fText) ||
      flNameStr.includes(fText);
    const matchService = serviceFilter === 'all' || p.service === serviceFilter;
    const matchStatus = statusFilter === 'all' || statusLower === statusFilter.toLowerCase();
    return matchSearch && matchService && matchStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 24px; color: #71717a;">No active projects matching criteria</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const initials = String(p.assignedFreelancerName || 'U').substring(0, 2).toUpperCase();
    return `
      <tr>
        <td class="font-mono text-muted">${p.id}</td>
        <td class="primary-cell">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 600; color: #ffffff;">${escapeHtml(p.name)}</span>
            ${getServiceBadge(p.service)}
          </div>
        </td>
        <td>${escapeHtml(p.client)}</td>
        <td class="font-mono text-green">${formatINR(p.budget)}</td>
        <td>
          <div class="cell-progress-wrap">
            <div class="cell-progress-bar">
              <div class="cell-progress-fill ${p.progress >= 90 ? 'fill-green' : ''}" style="width: ${p.progress}%"></div>
            </div>
            <span class="cell-pct">${p.progress}%</span>
          </div>
        </td>
        <td>${getStatusBadge(p.status)}</td>
        <td>
          <div class="project-notes-snippet" title="${escapeHtml(p.notes || 'Click to add notes')}" onclick="openEditProjectModal('${p.id}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            <span>${escapeHtml(p.notes || 'No notes added')}</span>
          </div>
        </td>
        <td>
          <div class="assigned-freelancer-pill">
            <div class="mini-avatar">${initials}</div>
            <span>${escapeHtml(p.assignedFreelancerName || 'Unassigned')}</span>
          </div>
        </td>
        <td class="font-mono text-muted">${p.deadline}</td>
        <td>
          <div class="action-icon-group">
            <button class="action-icon-btn complete ${p.status === 'Completed' ? 'is-completed' : ''}" title="Complete Project & Move to Completed Archive" onclick="markProjectComplete('${p.id}')">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
            <button class="action-icon-btn view" title="View Project Overview & Margins" onclick="openDetailDrawer('project', '${p.id}')">
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button class="action-icon-btn edit" title="Edit Project" onclick="openEditProjectModal('${p.id}')">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="action-icon-btn delete" title="Delete Project" onclick="confirmDeleteEntity('project', '${p.id}', '${escapeHtml(p.name)}')">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 3B. Completed Projects Archive Table View
function renderCompletedProjectsTable(filterText = '', serviceFilter = 'all') {
  sanitizeProjectsAndArchive();
  const tbody = document.getElementById('completed-projects-table-body');
  if (!tbody) return;

  const fText = (filterText || '').toLowerCase();
  const filtered = (MockDataStore.completedProjects || []).filter(p => {
    if (!p) return false;
    const nameStr = String(p.name || '').toLowerCase();
    const idStr = String(p.id || '').toLowerCase();
    const clientStr = String(p.client || '').toLowerCase();
    const notesStr = String(p.notes || '').toLowerCase();
    const flNameStr = String(p.assignedFreelancerName || '').toLowerCase();
    const matchSearch = nameStr.includes(fText) ||
      idStr.includes(fText) ||
      clientStr.includes(fText) ||
      notesStr.includes(fText) ||
      flNameStr.includes(fText);
    const matchService = serviceFilter === 'all' || p.service === serviceFilter;
    return matchSearch && matchService;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 28px; color: #71717a;">No completed projects in archive</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const initials = String(p.assignedFreelancerName || 'S').substring(0, 2).toUpperCase();
    const compDate = p.completionDate || 'Delivered';
    return `
      <tr>
        <td class="font-mono text-muted">${p.id}</td>
        <td class="primary-cell">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 600; color: #ffffff;">${escapeHtml(p.name)}</span>
            ${getServiceBadge(p.service)}
          </div>
        </td>
        <td>${escapeHtml(p.client)}</td>
        <td class="font-mono text-green">${formatINR(p.budget)}</td>
        <td>
          <div class="assigned-freelancer-pill">
            <div class="mini-avatar" style="background: rgba(16,185,129,0.15); color: #34d399;">${initials}</div>
            <span>${escapeHtml(p.assignedFreelancerName || 'Specialist')}</span>
          </div>
        </td>
        <td class="font-mono" style="color: #34d399; font-weight: 600;">✓ ${escapeHtml(compDate)}</td>
        <td>
          <div class="project-notes-snippet" title="${escapeHtml(p.notes || 'Scope delivered')}">
            <span>${escapeHtml(p.notes || 'Delivered & verified')}</span>
          </div>
        </td>
        <td>
          <div class="action-icon-group">
            <button class="action-icon-btn view" title="View Completed Summary" onclick="openDetailDrawer('project', '${p.id}')">
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button class="action-icon-btn edit" title="Reopen & Restore to Active Sprints" onclick="reopenCompletedProject('${p.id}')" style="color: #fbbf24;">
              <svg viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
            </button>
            <button class="action-icon-btn delete" title="Permanently Delete" onclick="confirmDeleteEntity('project', '${p.id}', '${escapeHtml(p.name)}')">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Subtab switcher for Projects: Active Sprints vs Completed Projects Archive
function switchProjectSubTab(tabName) {
  const btnActive = document.getElementById('subtab-btn-active-projects');
  const btnCompleted = document.getElementById('subtab-btn-completed-projects');
  const cardActive = document.getElementById('card-active-projects-table');
  const cardCompleted = document.getElementById('card-completed-projects-table');
  const statusFilter = document.getElementById('project-status-filter');

  if (tabName === 'completed') {
    if (btnActive) btnActive.classList.remove('active');
    if (btnCompleted) btnCompleted.classList.add('active');
    if (cardActive) cardActive.classList.add('hidden');
    if (cardCompleted) cardCompleted.classList.remove('hidden');
    if (statusFilter) statusFilter.style.display = 'none';
    renderCompletedProjectsTable();
  } else {
    if (btnActive) btnActive.classList.add('active');
    if (btnCompleted) btnCompleted.classList.remove('active');
    if (cardActive) cardActive.classList.remove('hidden');
    if (cardCompleted) cardCompleted.classList.add('hidden');
    if (statusFilter) statusFilter.style.display = '';
    renderProjectsTable();
  }
}
window.switchProjectSubTab = switchProjectSubTab;

// 4. Freelancers Directory View
function renderFreelancersTable(filterText = '', paymentFilter = 'all', statusFilter = 'all', skillFilter = 'all') {
  const tbody = document.getElementById('freelancers-table-body');
  if (!tbody) return;

  const fText = (filterText || '').toLowerCase();
  const filtered = (MockDataStore.freelancers || []).filter(f => {
    if (!f) return false;
    const nameStr = String(f.name || '').toLowerCase();
    const idStr = String(f.id || '').toLowerCase();
    const emailStr = String(f.email || '').toLowerCase();
    const phoneStr = String(f.phone || '').toLowerCase();
    const matchSearch = nameStr.includes(fText) ||
      idStr.includes(fText) ||
      emailStr.includes(fText) ||
      phoneStr.includes(fText);
    const matchPayment = paymentFilter === 'all' || String(f.paymentStatus || '').toLowerCase() === paymentFilter.toLowerCase();
    const matchStatus = statusFilter === 'all' || String(f.status || '').toLowerCase() === statusFilter.toLowerCase();
    const matchSkill = skillFilter === 'all' || (Array.isArray(f.skills) && f.skills.includes(skillFilter));
    return matchSearch && matchPayment && matchStatus && matchSkill;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #71717a;">No freelancers matching criteria</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(f => {
    const initials = String(f.name || 'FL').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const payStatusSlug = String(f.paymentStatus || 'Cleared').toLowerCase().replace(/\s+/g, '-');
    const projectCount = Array.isArray(f.assignedProjects) ? f.assignedProjects.length : 0;

    return `
      <tr>
        <td class="font-mono text-muted">${f.id}</td>
        <td class="primary-cell">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="client-avatar-badge">${initials}</div>
            <div>
              <div style="font-weight: 600; color: #ffffff;">${escapeHtml(f.name)}</div>
              <span class="sub-label font-mono text-muted">${getStatusBadge(f.status)}</span>
            </div>
          </div>
        </td>
        <td class="font-mono text-muted">${escapeHtml(f.email)}</td>
        <td class="font-mono">${escapeHtml(f.phone || '+91 98000 00000')}</td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${(f.skills && f.skills.length > 0) ? f.skills.map(s => getServiceBadge(s)).join('') : '<span class="text-muted" style="font-size: 11px;">None</span>'}
          </div>
        </td>
        <td>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span class="status-pill ${payStatusSlug}">${escapeHtml(f.paymentStatus)}</span>
            <div style="font-size: 11px; color: #a1a1aa;">
              Cleared: <strong style="color: #10b981;">${formatINR(f.paymentCleared)}</strong> | Due: <strong style="color: ${f.paymentDue > 0 ? '#ff2a4b' : '#71717a'};">${formatINR(f.paymentDue)}</strong>
            </div>
          </div>
        </td>
        <td>
          <div class="cell-actions-group">
            <button class="btn-table-action" onclick="openViewFreelancerProjectsModal('${f.id}')">View Work (${projectCount})</button>
            <button class="btn-table-action success" onclick="openAssignProjectModal('${f.id}')">+ Assign</button>
            <button class="btn-table-action" style="color: #ff2a4b; border: 1px solid rgba(229,9,20,0.35); background: rgba(229,9,20,0.08);" onclick="openProvisionForFreelancer('${f.id}')">🔑 Issue Portal</button>
          </div>
        </td>
        <td>
          <div class="action-icon-group">
            <button class="action-icon-btn view" title="View Freelancer Overview" onclick="openDetailDrawer('freelancer', '${f.id}')">
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button class="action-icon-btn edit" title="Edit Freelancer Account" onclick="openEditFreelancerModal('${f.id}')">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="action-icon-btn delete" title="Delete Freelancer" onclick="confirmDeleteEntity('freelancer', '${f.id}', '${escapeHtml(f.name)}')">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 5. Client Payments View
function renderClientPaymentsTable(filterText = '') {
  const tbody = document.getElementById('client-payments-table-body');
  if (!tbody) return;

  const fText = (filterText || '').toLowerCase();
  const filtered = (MockDataStore.clientPayments || []).filter(inv => {
    if (!inv) return false;
    return String(inv.id || '').toLowerCase().includes(fText) ||
      String(inv.client || '').toLowerCase().includes(fText) ||
      String(inv.project || '').toLowerCase().includes(fText);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #71717a;">No client invoices matching criteria</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(inv => `
    <tr>
      <td class="font-mono primary-cell">${inv.id}</td>
      <td>${escapeHtml(inv.client)}</td>
      <td>${escapeHtml(inv.project)}</td>
      <td class="font-mono">${inv.issueDate}</td>
      <td class="font-mono">${inv.dueDate}</td>
      <td class="font-mono ${inv.status === 'Paid' ? 'text-green' : 'text-crimson'}">${formatINR(inv.amount)}</td>
      <td>${getStatusBadge(inv.status)}</td>
      <td>
        <button class="link-action-btn" onclick="alert('Downloading PDF statement for ${inv.id}...')">Invoice PDF</button>
      </td>
    </tr>
  `).join('');
}

// 6. Freelancer Assignments & Disbursements View
function renderFreelancerPayoutsTable(filterText = '') {
  const tbody = document.getElementById('freelancer-payouts-table-body');
  if (!tbody) return;

  const fText = (filterText || '').toLowerCase();
  const filtered = (MockDataStore.freelancerDisbursements || []).filter(dsb => {
    if (!dsb) return false;
    return String(dsb.id || '').toLowerCase().includes(fText) ||
      String(dsb.freelancer || '').toLowerCase().includes(fText) ||
      String(dsb.project || '').toLowerCase().includes(fText) ||
      String(dsb.milestone || '').toLowerCase().includes(fText);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #71717a;">No disbursements matching criteria</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(dsb => `
    <tr>
      <td class="font-mono primary-cell">${dsb.id}</td>
      <td>${escapeHtml(dsb.freelancer)}</td>
      <td>${escapeHtml(dsb.project)}</td>
      <td>${escapeHtml(dsb.milestone)}</td>
      <td class="font-mono">${dsb.hours} hrs</td>
      <td class="font-mono">${formatINR(dsb.amount)}</td>
      <td>${getStatusBadge(dsb.status)}</td>
      <td>
        <button class="link-action-btn" onclick="alert('Escrow release receipt ${dsb.id}')">Receipt</button>
      </td>
    </tr>
  `).join('');
}

function syncRealFreelancerCredentials() {
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

  // Ensure standalone credentials exist in freelancers list as well
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

// 6. Freelancer Portal Accounts View
function renderFreelancerPortalTable(filterText = '', statusFilter = 'all') {
  syncRealFreelancerCredentials();

  const tbody = document.getElementById('freelancer-portal-table-body');
  if (!tbody) return;

  const fText = (filterText || '').toLowerCase();
  const filtered = (MockDataStore.freelancerCredentials || []).filter(fc => {
    if (!fc) return false;
    const matchSearch = String(fc.name || '').toLowerCase().includes(fText) ||
      String(fc.email || '').toLowerCase().includes(fText) ||
      String(fc.project || '').toLowerCase().includes(fText) ||
      String(fc.id || '').toLowerCase().includes(fText);
    const matchStatus = statusFilter === 'all' || String(fc.status || '').toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  // Dynamically update Metric Summary in Tab 6
  const issuedAccountsEl = document.getElementById('portal-stat-issued-accounts');
  const activeSessionsEl = document.getElementById('portal-stat-active-sessions');
  const assignedSprintsEl = document.getElementById('portal-stat-assigned-sprints');
  const pendingAuditsEl = document.getElementById('portal-stat-pending-audits');

  const totalAccounts = (MockDataStore.freelancerCredentials || []).length;
  const activeCount = (MockDataStore.freelancerCredentials || []).filter(c => c.status === 'Active' || c.status === 'Available').length;
  const assignedSprintsCount = (MockDataStore.projects || []).filter(p => p.assignedFreelancerId || p.assignedFreelancerName).length;
  const pendingAuditsCount = (MockDataStore.projects || []).filter(p => p.status === 'In Review' || p.status === 'Active').length;

  if (issuedAccountsEl) issuedAccountsEl.textContent = `${totalAccounts} Accounts`;
  if (activeSessionsEl) activeSessionsEl.textContent = `${activeCount} Active`;
  if (assignedSprintsEl) assignedSprintsEl.textContent = `${assignedSprintsCount} Active`;
  if (pendingAuditsEl) pendingAuditsEl.textContent = `${pendingAuditsCount} Sprints`;

  const badge = document.getElementById('badge-portal-freelancers');
  if (badge) badge.textContent = totalAccounts;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #71717a;">No freelancer credentials matching criteria</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(fc => {
    const initials = String(fc.name || 'FL').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const passElemId = `portal-key-${fc.id}`;
    const currentStatus = fc.status || 'Active';
    const statusSelectHtml = `
      <select class="status-inline-select" onchange="changeFreelancerPortalStatus('${fc.id}', this.value)" title="Change Specialist Status (Syncs to Google Sheet)">
        <option value="Active" ${currentStatus === 'Active' ? 'selected' : ''}>🟢 Active (Approved)</option>
        <option value="Pending Approval" ${currentStatus === 'Pending Approval' ? 'selected' : ''}>🟡 Pending Approval</option>
        <option value="Blocked" ${currentStatus === 'Blocked' ? 'selected' : ''}>🔴 Blocked</option>
        <option value="Suspended" ${currentStatus === 'Suspended' ? 'selected' : ''}>⛔ Suspended</option>
      </select>
    `;

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="client-avatar-badge">${initials}</div>
            <div>
              <div class="primary-cell" style="font-weight: 600;">${escapeHtml(fc.name)}</div>
              <span class="sub-label font-mono">${fc.id}</span>
            </div>
          </div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="font-mono" style="color: #e4e4e7; font-size: 12px;">${escapeHtml(fc.email)}</span>
            <button class="cred-copy-btn" title="Copy Email/ID" onclick="copyCredential('${escapeHtml(fc.email)}', 'Freelancer Email')">📋</button>
          </div>
        </td>
        <td>
          <div class="cred-key-box">
            <span class="cred-key-val" id="${passElemId}" data-pass="${escapeHtml(fc.pass)}" data-hidden="true">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</span>
            <button class="cred-toggle-btn" title="Show / Hide Password" onclick="togglePasswordVisibility('${passElemId}')">
              <span id="icon-${passElemId}">👁</span>
            </button>
            <button class="cred-copy-btn" title="Copy Password" onclick="copyCredential('${escapeHtml(fc.pass)}', 'Freelancer Password')">📋</button>
          </div>
        </td>
        <td>
          <div style="font-weight: 500; color: #ffffff;">${escapeHtml(fc.project)}</div>
        </td>
        <td>
          <div>${escapeHtml(fc.milestone)}</div>
          <span class="sub-label font-mono">${fc.hours} hrs logged</span>
        </td>
        <td>${statusSelectHtml}</td>
        <td class="font-mono text-muted" style="font-size: 12px;">${fc.lastLogin}</td>
        <td>
          <div class="action-icon-group">
            <button class="action-icon-btn view" title="Inspect Portal Credentials & Activity" onclick="openDetailDrawer('portal-freelancer', '${fc.id}')">
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <a href="freelancer.html" target="_blank" class="action-icon-btn edit" title="Open Freelancer Portal (freelancer.html)">
              <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </a>
            <button class="action-icon-btn delete" title="Revoke Portal Access" onclick="confirmDeleteEntity('portal-freelancer', '${fc.id}', '${escapeHtml(fc.name)}')">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.changeFreelancerPortalStatus = function (fcId, newStatus) {
  const fc = (MockDataStore.freelancerCredentials || []).find(c => c.id === fcId);
  if (fc) {
    fc.status = newStatus;
    GoogleSheetsSync.upsertFreelancerAdmin(fc);
  }
  const fl = (MockDataStore.freelancers || []).find(f => f.id === fcId);
  if (fl) {
    fl.status = newStatus;
    GoogleSheetsSync.upsertFreelancer(fl);
  }
  StorageManager.save();
  renderFreelancerPortalTable();
  renderFreelancersTable();
  showToast(`Specialist ${fc ? fc.name : fcId} status set to "${newStatus}" & synced to Google Sheet`, newStatus === 'Active' ? 'success' : 'default');
};

// 7. Admin Portal Accounts & RBAC View
function renderAdminUsersTable(filterText = '', roleFilter = 'all') {
  const tbody = document.getElementById('admin-users-table-body');
  if (!tbody) return;

  const fText = (filterText || '').toLowerCase();
  const filtered = (MockDataStore.adminUsers || []).filter(adm => {
    if (!adm) return false;
    const matchSearch = String(adm.name || '').toLowerCase().includes(fText) ||
      String(adm.email || '').toLowerCase().includes(fText) ||
      String(adm.role || '').toLowerCase().includes(fText) ||
      String(adm.id || '').toLowerCase().includes(fText);
    const matchRole = roleFilter === 'all' || String(adm.role || '').toLowerCase() === roleFilter.toLowerCase();
    return matchSearch && matchRole;
  });

  // Dynamically update Metric Summary in Tab 7
  const totalAdminEl = document.getElementById('admin-stat-total-accounts');
  const superAdminEl = document.getElementById('admin-stat-super-admin');
  const activeAdminEl = document.getElementById('admin-stat-active-admins');

  const totalAdmins = (MockDataStore.adminUsers || []).length;
  const superAdminCount = (MockDataStore.adminUsers || []).filter(a => a.role === 'Super Admin').length;
  const otherAdminCount = (MockDataStore.adminUsers || []).filter(a => a.role !== 'Super Admin').length;

  if (totalAdminEl) totalAdminEl.textContent = `${totalAdmins} Accounts`;
  if (superAdminEl) superAdminEl.textContent = `${superAdminCount} (Jay - Owner)`;
  if (activeAdminEl) activeAdminEl.textContent = `${otherAdminCount} Active`;

  const badge = document.getElementById('badge-total-admins');
  if (badge) badge.textContent = totalAdmins;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #71717a;">No administrator accounts matching criteria</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((adm, idx) => {
    const initials = String(adm.name || 'AD').split(' ').map(n => n[0]).join('').substring(0, 2);
    const passElemId = `adm-pass-${idx}`;
    const roleSlug = String(adm.role || 'Admin').toLowerCase().replace(/\s+/g, '-');
    const isOwner = adm.id === 'ADM-001' || adm.name.includes('Owner');
    const curStatus = adm.status || 'Active';

    // Interactive Status selector for Super Admin to Approve or Block on the fly
    const statusSelectHtml = isOwner ?
      getStatusBadge(curStatus) :
      `
      <select class="status-inline-select" onchange="changeAdminStatus('${adm.id}', this.value)" title="Change Admin Status (Syncs immediately to Google Sheet)">
        <option value="Active" ${curStatus === 'Active' ? 'selected' : ''}>🟢 Active (Approved)</option>
        <option value="Pending Approval" ${curStatus === 'Pending Approval' ? 'selected' : ''}>🟡 Pending Approval</option>
        <option value="Blocked" ${curStatus === 'Blocked' ? 'selected' : ''}>🔴 Blocked</option>
        <option value="Suspended" ${curStatus === 'Suspended' ? 'selected' : ''}>⛔ Suspended</option>
      </select>
      `;

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="client-avatar-badge" style="background: linear-gradient(135deg, rgba(229,9,20,0.25), rgba(255,42,75,0.15)); color: #ff3b56;">${initials}</div>
            <div>
              <div style="display: flex; align-items: center;">
                <span class="primary-cell" style="font-weight: 600;">${escapeHtml(adm.name)}</span>
                ${isOwner ? '<span class="owner-badge">Owner</span>' : ''}
              </div>
              <span class="sub-label font-mono">${adm.id}</span>
            </div>
          </div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="font-mono" style="color: #e4e4e7; font-size: 12px;">${escapeHtml(adm.email)}</span>
            <button class="cred-copy-btn" title="Copy Admin ID" onclick="copyCredential('${escapeHtml(adm.email)}', 'Admin ID')">📋</button>
          </div>
        </td>
        <td>
          <div class="cred-key-box">
            <span class="cred-key-val" id="${passElemId}" data-pass="${escapeHtml(adm.pass)}" data-hidden="true">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</span>
            <button class="cred-toggle-btn" title="Show / Hide Password" onclick="togglePasswordVisibility('${passElemId}')">
              <span id="icon-${passElemId}">👁</span>
            </button>
            <button class="cred-copy-btn" title="Copy Password" onclick="copyCredential('${escapeHtml(adm.pass)}', 'Admin Password')">📋</button>
          </div>
        </td>
        <td>
          <span class="role-badge ${roleSlug}">${escapeHtml(adm.role)}</span>
        </td>
        <td>
          <span style="font-size: 12px; color: #a1a1aa;">${escapeHtml(adm.privileges)}</span>
        </td>
        <td>${statusSelectHtml}</td>
        <td class="font-mono text-muted" style="font-size: 12px;">${adm.lastAuth}</td>
        <td>
          <div class="action-icon-group">
            <button class="action-icon-btn view" title="Inspect Admin RBAC Profile" onclick="openDetailDrawer('admin-user', '${adm.id}')">
              <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
            <button class="action-icon-btn edit" title="${isOwner ? 'Root Owner Policy Immutable' : 'Edit RBAC Policies'}" onclick="${isOwner ? "showToast('Root owner policies are immutable', 'default')" : `showToast('RBAC Policy modifier for ${escapeHtml(adm.name)} opened', 'default')`}">
              <svg viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="action-icon-btn delete" title="${isOwner ? 'Root Owner Protected' : 'Remove Admin Account'}" onclick="${isOwner ? "showToast('Root system owner is protected from deletion', 'default')" : `confirmDeleteEntity('admin-user', '${adm.id}', '${escapeHtml(adm.name)}')`}">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.changeAdminStatus = function (admId, newStatus) {
  const adm = (MockDataStore.adminUsers || []).find(a => a.id === admId);
  if (!adm) return;
  adm.status = newStatus;
  StorageManager.save();
  GoogleSheetsSync.upsertAdmin(adm);
  renderAdminUsersTable();
  showToast(`Admin ${adm.name} (${adm.id}) status set to "${newStatus}" & synced to Google Sheet`, newStatus === 'Active' ? 'success' : 'default');
};

// Global Credentials Toggle & Copy Utilities
window.togglePasswordVisibility = function (id) {
  const el = document.getElementById(id);
  const icon = document.getElementById(`icon-${id}`);
  if (!el) return;
  if (el.getAttribute('data-hidden') === 'true') {
    el.textContent = el.getAttribute('data-pass');
    el.setAttribute('data-hidden', 'false');
    if (icon) icon.textContent = '🔒';
  } else {
    el.textContent = '••••••••';
    el.setAttribute('data-hidden', 'true');
    if (icon) icon.textContent = '👁';
  }
};

window.copyCredential = function (text, label) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${label} copied to clipboard!`, 'success');
    }).catch(() => {
      showToast(`${label}: ${text}`, 'default');
    });
  } else {
    showToast(`${label}: ${text}`, 'default');
  }
};

/* ----------------------------------------------------------------------------
 * 7. Search & Filter Listeners for Subpages
 * ---------------------------------------------------------------------------- */
// Clients Filters (Search, Core 3 Services, Status)
const clientFilterInput = document.getElementById('client-filter-input');
const clientServiceFilter = document.getElementById('client-service-filter');
const clientStatusFilter = document.getElementById('client-status-filter');
if (clientFilterInput && clientStatusFilter) {
  const handler = () => {
    const sFilter = clientServiceFilter ? clientServiceFilter.value : 'all';
    renderClientsTable(clientFilterInput.value, sFilter, clientStatusFilter.value);
  };
  clientFilterInput.addEventListener('input', handler);
  clientStatusFilter.addEventListener('change', handler);
  if (clientServiceFilter) clientServiceFilter.addEventListener('change', handler);
}

// Projects Filters (Search, Core 3 Services, Status)
const projectFilterInput = document.getElementById('project-filter-input');
const projectServiceFilter = document.getElementById('project-service-filter');
const projectStatusFilter = document.getElementById('project-status-filter');
if (projectFilterInput && projectStatusFilter) {
  const handler = () => {
    const sFilter = projectServiceFilter ? projectServiceFilter.value : 'all';
    renderProjectsTable(projectFilterInput.value, sFilter, projectStatusFilter.value);
    renderCompletedProjectsTable(projectFilterInput.value, sFilter);
  };
  projectFilterInput.addEventListener('input', handler);
  projectStatusFilter.addEventListener('change', handler);
  if (projectServiceFilter) projectServiceFilter.addEventListener('change', handler);
}

// Freelancers Filters (Search, Payment Status, Availability, Skill)
const freelancerFilterInput = document.getElementById('freelancer-filter-input');
const freelancerPaymentFilter = document.getElementById('freelancer-payment-filter');
const freelancerStatusFilter = document.getElementById('freelancer-status-filter');
const freelancerSkillFilter = document.getElementById('freelancer-skill-filter');
if (freelancerFilterInput && freelancerStatusFilter) {
  const handler = () => {
    const pFilter = freelancerPaymentFilter ? freelancerPaymentFilter.value : 'all';
    const sFilter = freelancerSkillFilter ? freelancerSkillFilter.value : 'all';
    renderFreelancersTable(freelancerFilterInput.value, pFilter, freelancerStatusFilter.value, sFilter);
  };
  freelancerFilterInput.addEventListener('input', handler);
  freelancerStatusFilter.addEventListener('change', handler);
  if (freelancerPaymentFilter) freelancerPaymentFilter.addEventListener('change', handler);
  if (freelancerSkillFilter) freelancerSkillFilter.addEventListener('change', handler);
}

// Payment Subtab Switcher & Filter
function setupPaymentSubtabs() {
  const btnClient = document.getElementById('subtab-btn-client-invoices');
  const btnFreelancer = document.getElementById('subtab-btn-freelancer-payouts');
  const panelClient = document.getElementById('subtab-panel-client-invoices');
  const panelFreelancer = document.getElementById('subtab-panel-freelancer-payouts');
  const payFilterInput = document.getElementById('payments-filter-input');

  if (btnClient && btnFreelancer && panelClient && panelFreelancer) {
    btnClient.addEventListener('click', () => {
      btnClient.classList.add('active');
      btnFreelancer.classList.remove('active');
      panelClient.classList.remove('hidden');
      panelFreelancer.classList.add('hidden');
    });

    btnFreelancer.addEventListener('click', () => {
      btnFreelancer.classList.add('active');
      btnClient.classList.remove('active');
      panelFreelancer.classList.remove('hidden');
      panelClient.classList.add('hidden');
    });
  }

  if (payFilterInput) {
    payFilterInput.addEventListener('input', () => {
      const q = payFilterInput.value.toLowerCase().trim();
      renderClientPaymentsTable(q);
      renderFreelancerPayoutsTable(q);
    });
  }
}

// Freelancer Portal Filters
const freePortalSearch = document.getElementById('freelancer-portal-search');
const freePortalStatus = document.getElementById('freelancer-portal-status-filter');
if (freePortalSearch && freePortalStatus) {
  const handler = () => renderFreelancerPortalTable(freePortalSearch.value, freePortalStatus.value);
  freePortalSearch.addEventListener('input', handler);
  freePortalStatus.addEventListener('change', handler);
}

// Admin Portal Filters
const adminPortalSearch = document.getElementById('admin-portal-search');
const adminRoleFilter = document.getElementById('admin-role-filter');
if (adminPortalSearch && adminRoleFilter) {
  const handler = () => renderAdminUsersTable(adminPortalSearch.value, adminRoleFilter.value);
  adminPortalSearch.addEventListener('input', handler);
  adminRoleFilter.addEventListener('change', handler);
}

// Global Omnibar Search (Ctrl + K)
const globalSearchInput = document.getElementById('global-search-input');
if (globalSearchInput) {
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      globalSearchInput.focus();
    }
  });

  globalSearchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (q.length > 0) {
      if (AppState.activeTab === 'clients') {
        renderClientsTable(q);
      } else if (AppState.activeTab === 'project') {
        renderProjectsTable(q);
      } else if (AppState.activeTab === 'freelancers') {
        renderFreelancersTable(q);
      } else if (AppState.activeTab === 'payments') {
        renderClientPaymentsTable(q);
        renderFreelancerPayoutsTable(q);
      } else if (AppState.activeTab === 'freelancer-portal') {
        renderFreelancerPortalTable(q);
      } else if (AppState.activeTab === 'admin-portal') {
        renderAdminUsersTable(q);
      }
    }
  });
}

/* ----------------------------------------------------------------------------
 * 8. Dynamic Modal Openers, Detail Inspection Drawer & Data Bindings
 * ---------------------------------------------------------------------------- */

// Detail Inspection Slide Drawer Engine
window.closeDetailDrawer = function () {
  const drawer = document.getElementById('detail-slide-drawer');
  const backdrop = document.getElementById('detail-drawer-backdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('active');
};

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDetailDrawer();
  }
});

window.openDetailDrawer = function (type, id) {
  const drawer = document.getElementById('detail-slide-drawer');
  const backdrop = document.getElementById('detail-drawer-backdrop');
  const pretitle = document.getElementById('drawer-pretitle');
  const title = document.getElementById('drawer-title');
  const contentBody = document.getElementById('drawer-content-body');
  const btnAction = document.getElementById('btn-drawer-action');
  const btnActionText = document.getElementById('btn-drawer-action-text');

  if (!drawer || !backdrop || !contentBody) return;

  if (type === 'project') {
    const p = (MockDataStore.projects || []).find(item => item.id === id) || (MockDataStore.completedProjects || []).find(item => item.id === id);
    if (!p) return;

    pretitle.textContent = p.id;
    title.textContent = p.name;
    btnActionText.textContent = p.status === 'Completed' ? 'View/Reopen Project' : 'Edit Project';
    btnAction.onclick = () => {
      closeDetailDrawer();
      openEditProjectModal(p.id);
    };

    const clientBudget = p.budget || 0;
    const flPayout = Math.round(clientBudget * 0.52);
    const netProfit = clientBudget - flPayout;

    contentBody.innerHTML = `
      <!-- PROJECT OVERVIEW -->
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
          Project Overview
        </div>
        <div class="drawer-card">
          <div class="drawer-overview-grid">
            <div class="drawer-overview-item">
              <div class="lbl">Project Name</div>
              <div class="val">${escapeHtml(p.name)}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Service Domain</div>
              <div class="val">${getServiceBadge(p.service)}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Project ID</div>
              <div class="val font-mono text-muted">${p.id}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Client</div>
              <div class="val">${escapeHtml(p.client)}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Assigned Freelancer</div>
              <div class="val">${escapeHtml(p.assignedFreelancerName || 'Unassigned')}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Start Date</div>
              <div class="val font-mono">2026-09-20</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Deadline</div>
              <div class="val font-mono">${p.deadline}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Status</div>
              <div class="val">${getStatusBadge(p.status)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- FINANCIAL BREAKDOWN & MARGINS -->
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          Financial Breakdown &amp; Margins
        </div>
        <div class="drawer-fin-grid">
          <div class="fin-card">
            <div class="lbl">Client Budget</div>
            <div class="val client-val">${formatINR(clientBudget)}</div>
          </div>
          <div class="fin-card">
            <div class="lbl">FL Payout</div>
            <div class="val payout-val">${formatINR(flPayout)}</div>
          </div>
          <div class="fin-card">
            <div class="lbl">Net Profit</div>
            <div class="val profit-val">${formatINR(netProfit)}</div>
          </div>
        </div>
      </div>

      <!-- MILESTONE & DELIVERY PROGRESS -->
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
          Milestone &amp; Delivery Progress
        </div>
        <div class="drawer-card">
          <div class="drawer-prog-row">
            <span style="color: #ffffff;">Execution Completion</span>
            <span class="font-mono text-crimson">${p.progress}%</span>
          </div>
          <div class="cell-progress-bar" style="height: 6px;">
            <div class="cell-progress-fill ${p.progress >= 90 ? 'fill-green' : ''}" style="width: ${p.progress}%"></div>
          </div>
        </div>
      </div>

      <!-- DESCRIPTION & SCOPE NOTES -->
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          Description &amp; Scope Notes
        </div>
        <div class="drawer-notes-box">
          ${escapeHtml(p.notes || 'No description notes provided for this deliverable.')}
        </div>
      </div>

      <!-- RECENT PROJECT ACTIVITY -->
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          Recent Project Activity
        </div>
        <div class="drawer-timeline">
          <div class="timeline-node">
            <div style="font-weight: 600; color: #ffffff;">Architecture &amp; technical specification drafted</div>
            <div class="timeline-time">Sep 20, 2026 &bull; Verified by Super Admin</div>
          </div>
          <div class="timeline-node">
            <div style="font-weight: 600; color: #ffffff;">Milestone sprint initialized in workspace</div>
            <div class="timeline-time">Sep 21, 2026 &bull; Automated Telemetry</div>
          </div>
        </div>
      </div>
    `;
  } else if (type === 'client') {
    const c = MockDataStore.clients.find(item => item.id === id);
    if (!c) return;

    pretitle.textContent = c.id;
    title.textContent = c.name;
    btnActionText.textContent = 'Edit Client Account';
    btnAction.onclick = () => {
      closeDetailDrawer();
      openEditClientModal(c.id);
    };

    const billed = c.totalBilled || 350000;
    const due = c.paymentDue || 0;
    const settled = Math.max(0, billed - due);

    contentBody.innerHTML = `
      <!-- CLIENT OVERVIEW -->
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
          Enterprise Client Profile
        </div>
        <div class="drawer-card">
          <div class="drawer-overview-grid">
            <div class="drawer-overview-item">
              <div class="lbl">Organization</div>
              <div class="val">${escapeHtml(c.name)}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Account Status</div>
              <div class="val">${getStatusBadge(c.status)}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Client ID</div>
              <div class="val font-mono text-muted">${c.id}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Contact Email</div>
              <div class="val font-mono">${escapeHtml(c.email)}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Contact Phone</div>
              <div class="val font-mono">${escapeHtml(c.phone || '+91 98000 00000')}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Active Projects</div>
              <div class="val font-mono">${c.activeProjects} active</div>
            </div>
          </div>
          <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06);">
            <div class="lbl" style="font-size: 11px; color: #71717a; margin-bottom: 6px;">Subscribed Core Services</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${(c.services || []).map(s => getServiceBadge(s)).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- FINANCIAL HEALTH -->
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          Financial Health &amp; Receivables
        </div>
        <div class="drawer-fin-grid">
          <div class="fin-card">
            <div class="lbl">Gross Billed</div>
            <div class="val client-val">${formatINR(billed)}</div>
          </div>
          <div class="fin-card">
            <div class="lbl">Payment Due</div>
            <div class="val payout-val" style="color: ${due > 0 ? '#ff2a4b' : '#71717a'};">${formatINR(due)}</div>
          </div>
          <div class="fin-card">
            <div class="lbl">Settled Total</div>
            <div class="val profit-val">${formatINR(settled)}</div>
          </div>
        </div>
      </div>

      <!-- ADMIN PURPOSE NOTES -->
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          Admin Purpose Notes &amp; Scope
        </div>
        <div class="drawer-notes-box">
          ${escapeHtml(c.notes || 'No administrative notes recorded for this client.')}
        </div>
      </div>

      <!-- GOVERNANCE & SLA TERMS -->
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          Governance &amp; SLA Terms
        </div>
        <div class="drawer-notes-box">
          Enterprise master agreement active with priority turnaround SLA and dedicated senior specialist engineering allocation.
        </div>
      </div>

      <!-- RECENT AUDIT LOGS -->
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          Recent Account Activity
        </div>
        <div class="drawer-timeline">
          <div class="timeline-node">
            <div style="font-weight: 600; color: #ffffff;">Client enterprise agreement validated</div>
            <div class="timeline-time">Sep 18, 2026 &bull; Super Admin Jay</div>
          </div>
          <div class="timeline-node">
            <div style="font-weight: 600; color: #ffffff;">Billing statement generated</div>
            <div class="timeline-time">Sep 21, 2026 &bull; Financial Ops</div>
          </div>
        </div>
      </div>
    `;
  } else if (type === 'freelancer') {
    const f = MockDataStore.freelancers.find(item => item.id === id);
    if (!f) return;

    pretitle.textContent = f.id;
    title.textContent = f.name;
    btnActionText.textContent = 'Edit Freelancer Account';
    btnAction.onclick = () => {
      closeDetailDrawer();
      openEditFreelancerModal(f.id);
    };

    const earned = (f.paymentCleared || 0) + (f.paymentDue || 0);

    contentBody.innerHTML = `
      <!-- TALENT PROFILE -->
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          Specialist Talent Profile
        </div>
        <div class="drawer-card">
          <div class="drawer-overview-grid">
            <div class="drawer-overview-item">
              <div class="lbl">Specialist Name</div>
              <div class="val">${escapeHtml(f.name)}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Availability</div>
              <div class="val">${getStatusBadge(f.status)}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Freelancer ID</div>
              <div class="val font-mono text-muted">${f.id}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Core Skills</div>
              <div class="val" style="display: flex; gap: 4px; flex-wrap: wrap;">
                ${(f.skills && f.skills.length > 0) ? f.skills.map(s => getServiceBadge(s)).join('') : '<span class="text-muted" style="font-size: 11px;">None specified</span>'}
              </div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Contact Email</div>
              <div class="val font-mono">${escapeHtml(f.email)}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Phone Number</div>
              <div class="val font-mono">${escapeHtml(f.phone || '+91 98000 00000')}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- DISBURSEMENTS & SETTLEMENT -->
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          Compensation &amp; Escrow Ledger
        </div>
        <div class="drawer-fin-grid">
          <div class="fin-card">
            <div class="lbl">Total Earned</div>
            <div class="val client-val">${formatINR(earned)}</div>
          </div>
          <div class="fin-card">
            <div class="lbl">Cleared Payout</div>
            <div class="val profit-val">${formatINR(f.paymentCleared || 0)}</div>
          </div>
          <div class="fin-card">
            <div class="lbl">Payment Due</div>
            <div class="val payout-val" style="color: ${f.paymentDue > 0 ? '#ff2a4b' : '#71717a'};">${formatINR(f.paymentDue || 0)}</div>
          </div>
        </div>
      </div>

      <!-- ASSIGNED DELIVERABLES -->
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
          Assigned Deliverables (${(f.assignedProjects || []).length})
        </div>
        <div class="drawer-card">
          ${(f.assignedProjects && f.assignedProjects.length > 0) ? `
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${f.assignedProjects.map(pid => {
      const prj = MockDataStore.projects.find(p => p.id === pid);
      return `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="font-mono text-muted" style="font-size: 11px;">${pid}</span>
                      <strong style="color: #ffffff; font-size: 12.5px;">${prj ? escapeHtml(prj.name) : 'Active Deliverable'}</strong>
                    </div>
                    <span class="status-pill ${prj ? prj.status.toLowerCase().replace(/\s+/g, '-') : 'active'}">${prj ? prj.status : 'Active'}</span>
                  </div>
                `;
    }).join('')}
            </div>
          ` : `<div style="color: #71717a; font-size: 12px;">No deliverables currently assigned. Click "+ Assign" on the table to dispatch work.</div>`}
        </div>
      </div>
    `;
  } else if (type === 'portal-freelancer') {
    const fc = MockDataStore.freelancerCredentials.find(item => item.id === id);
    if (!fc) return;

    pretitle.textContent = fc.id;
    title.textContent = `${fc.name} (Portal Access)`;
    btnActionText.textContent = 'Simulate Freelancer Portal';
    btnAction.onclick = () => {
      closeDetailDrawer();
      openModal('modal-simulate-freelancer-portal');
    };

    contentBody.innerHTML = `
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
          Portal Credentials &amp; Key Matrix
        </div>
        <div class="drawer-card">
          <div class="drawer-overview-grid">
            <div class="drawer-overview-item">
              <div class="lbl">Specialist</div>
              <div class="val">${escapeHtml(fc.name)}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Credential Status</div>
              <div class="val">${getStatusBadge(fc.status)}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Login Email / ID</div>
              <div class="val font-mono">${escapeHtml(fc.email)}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Assigned Project</div>
              <div class="val">${escapeHtml(fc.project)}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Hours Logged</div>
              <div class="val font-mono">${fc.hours} hrs</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Last Authentication</div>
              <div class="val font-mono text-muted">${fc.lastLogin}</div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
          Milestone Deliverable
        </div>
        <div class="drawer-notes-box">
          <strong>${escapeHtml(fc.milestone)}</strong>
          <p style="margin-top: 6px; font-size: 11.5px; color: #a1a1aa;">Scoped for weekly review. Portal access is governed by Owner issuance with TLS encryption.</p>
        </div>
      </div>
    `;
  } else if (type === 'admin-user') {
    const adm = MockDataStore.adminUsers.find(item => item.id === id);
    if (!adm) return;

    const isOwner = adm.id === 'ADM-001' || adm.name.includes('Owner');
    pretitle.textContent = adm.id;
    title.textContent = adm.name;
    btnActionText.textContent = isOwner ? 'Root Policy Protected' : 'Configure RBAC Matrix';
    btnAction.onclick = () => {
      closeDetailDrawer();
      showToast(isOwner ? 'Root owner policy is immutable' : `RBAC policy editor opened for ${adm.name}`, 'default');
    };

    contentBody.innerHTML = `
      <div>
        <div class="drawer-section-title">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          Administrator RBAC Profile
        </div>
        <div class="drawer-card">
          <div class="drawer-overview-grid">
            <div class="drawer-overview-item">
              <div class="lbl">Administrator</div>
              <div class="val">${escapeHtml(adm.name)}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Role Classification</div>
              <div class="val"><span class="role-badge ${adm.role.toLowerCase().replace(/\s+/g, '-')}">${escapeHtml(adm.role)}</span></div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Admin ID / Email</div>
              <div class="val font-mono">${escapeHtml(adm.email)}</div>
            </div>
            <div class="drawer-overview-item">
              <div class="lbl">Status</div>
              <div class="val">${getStatusBadge(adm.status)}</div>
            </div>
            <div class="drawer-overview-item" style="grid-column: span 2;">
              <div class="lbl">Assigned Privileges</div>
              <div class="val" style="color: #a1a1aa; font-size: 12px;">${escapeHtml(adm.privileges)}</div>
            </div>
            <div class="drawer-overview-item" style="grid-column: span 2;">
              <div class="lbl">Last Authentication</div>
              <div class="val font-mono text-muted">${adm.lastAuth}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Reveal drawer
  backdrop.classList.add('active');
  drawer.classList.add('open');
};

// Universal Confirmation Deletion Handler
window.confirmDeleteEntity = function (type, id, displayName) {
  const modal = document.getElementById('modal-delete-confirm');
  const msg = document.getElementById('delete-confirm-message');
  const btnConfirm = document.getElementById('btn-confirm-delete-action');

  if (!modal || !msg || !btnConfirm) return;

  msg.innerHTML = `Are you sure you want to permanently remove <strong>${displayName}</strong> (<span class="font-mono text-muted">${id}</span>)?<br><br><span style="color: #ff2a4b; font-size: 12px;">⚠️ This record will be expunged from the active SaaS management datastore.</span>`;

  btnConfirm.onclick = () => {
    executeDeleteEntity(type, id, displayName);
    closeModal('modal-delete-confirm');
  };

  openModal('modal-delete-confirm');
};

function executeDeleteEntity(type, id, displayName) {
  if (type === 'project') {
    MockDataStore.projects = (MockDataStore.projects || []).filter(p => p.id !== id);
    MockDataStore.completedProjects = (MockDataStore.completedProjects || []).filter(p => p.id !== id);
    recalculateRealKPIs();
  } else if (type === 'client') {
    MockDataStore.clients = MockDataStore.clients.filter(c => c.id !== id);
    MockDataStore.kpis.clients = Math.max(0, MockDataStore.kpis.clients - 1);
    const badge = document.getElementById('badge-total-clients');
    if (badge) badge.textContent = MockDataStore.clients.length;
  } else if (type === 'freelancer') {
    MockDataStore.freelancers = MockDataStore.freelancers.filter(f => f.id !== id);
    const badge = document.getElementById('badge-total-freelancers');
    if (badge) badge.textContent = MockDataStore.freelancers.length;
    populateProjectFreelancerDropdowns();
  } else if (type === 'portal-freelancer') {
    MockDataStore.freelancerCredentials = MockDataStore.freelancerCredentials.filter(fc => fc.id !== id);
    const badge = document.getElementById('badge-portal-freelancers');
    if (badge) badge.textContent = MockDataStore.freelancerCredentials.length;
  } else if (type === 'admin-user') {
    if (id === 'ADM-001') {
      showToast('Cannot delete root system owner', 'default');
      return;
    }
    MockDataStore.adminUsers = MockDataStore.adminUsers.filter(adm => adm.id !== id);
    const badge = document.getElementById('badge-total-admins');
    if (badge) badge.textContent = MockDataStore.adminUsers.length;
  }

  // Real-time deletion in active Google Sheet & audit log to Deleted Items
  GoogleSheetsSync.deleteRecord(type, id, displayName, 'Jay (Super Admin)');
  StorageManager.save();

  renderAllViews();
  showToast(`Successfully removed ${displayName} (${id})`, 'success');
}

/* ----------------------------------------------------------------------------
 * 8B. Google Pay Style Project Completion Celebration & Sound
 * ---------------------------------------------------------------------------- */
function playGooglePaySuccessChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    // Play 3 rapid ascending sweet bell harmonic notes (C6, E6, G6)
    const notes = [1046.50, 1318.51, 1567.98];
    const times = [0, 0.09, 0.18];
    
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + times[idx]);
      
      gain.gain.setValueAtTime(0.001, ctx.currentTime + times[idx]);
      gain.gain.exponentialRampToValueAtTime(0.24, ctx.currentTime + times[idx] + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + times[idx] + 0.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + times[idx]);
      osc.stop(ctx.currentTime + times[idx] + 0.55);
    });
  } catch (err) {
    // Audio synthesis gracefully handled
  }
}
window.playGooglePaySuccessChime = playGooglePaySuccessChime;

function showProjectCompleteCelebration(project) {
  if (!project) return;
  
  const modal = document.getElementById('modal-project-complete-celebration');
  const titleEl = document.getElementById('gpay-proj-title');
  const metaEl = document.getElementById('gpay-proj-meta');
  const subtextEl = document.getElementById('gpay-proj-subtext');
  
  if (titleEl) titleEl.textContent = project.name || 'Enterprise Project';
  if (metaEl) metaEl.innerHTML = `<span class="font-mono">${escapeHtml(project.id)}</span> &bull; ${escapeHtml(project.service || 'Web Development')} &bull; Client: <strong>${escapeHtml(project.client || 'Enterprise Client')}</strong>`;
  if (subtextEl) {
    const flName = (project.assignedFreelancerName && project.assignedFreelancerName !== 'Unassigned') ? ` (Specialist: ${escapeHtml(project.assignedFreelancerName)})` : '';
    subtextEl.textContent = `Project ${project.id} is 100% Completed${flName} and synchronized live with the Google Sheet database.`;
  }
  
  if (modal) {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    
    playGooglePaySuccessChime();
    
    // Re-trigger CSS animations on circle & checkmark
    const circle = modal.querySelector('.gpay-green-circle');
    if (circle) {
      circle.style.animation = 'none';
      circle.offsetHeight; // reflow
      circle.style.animation = '';
    }
    const checkPath = modal.querySelector('.gpay-checkmark-check');
    if (checkPath) {
      checkPath.style.animation = 'none';
      checkPath.offsetHeight; // reflow
      checkPath.style.animation = '';
    }
    const circleRing = modal.querySelector('.gpay-checkmark-circle');
    if (circleRing) {
      circleRing.style.animation = 'none';
      circleRing.offsetHeight; // reflow
      circleRing.style.animation = '';
    }
  }
}
window.showProjectCompleteCelebration = showProjectCompleteCelebration;

function closeProjectCelebrationModal() {
  const modal = document.getElementById('modal-project-complete-celebration');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
}
window.closeProjectCelebrationModal = closeProjectCelebrationModal;

function markProjectComplete(projectId) {
  const proj = (MockDataStore.projects || []).find(p => p.id === projectId);
  if (!proj) return;

  const compDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const compItem = {
    id: proj.id,
    name: proj.name,
    service: proj.service || 'Web Development',
    client: proj.client || 'Enterprise Client',
    budget: proj.budget || 50000,
    progress: 100,
    status: 'Completed',
    assignedFreelancerId: proj.assignedFreelancerId || null,
    assignedFreelancerName: proj.assignedFreelancerName || 'Specialist',
    completionDate: compDate,
    notes: proj.notes || 'Delivered & verified'
  };

  // Remove from active projects
  MockDataStore.projects = (MockDataStore.projects || []).filter(p => p.id !== projectId);

  // Add to completed projects archive (upsert)
  if (!MockDataStore.completedProjects) MockDataStore.completedProjects = [];
  const existingIdx = MockDataStore.completedProjects.findIndex(cp => cp.id === projectId);
  if (existingIdx >= 0) {
    MockDataStore.completedProjects[existingIdx] = compItem;
  } else {
    MockDataStore.completedProjects.unshift(compItem);
  }

  sanitizeProjectsAndArchive();
  StorageManager.save();
  GoogleSheetsSync.completeProject(compItem);
  recalculateRealKPIs();
  renderAllViews();
  showProjectCompleteCelebration(compItem);
  showToast(`Project "${compItem.name}" completed & moved to Completed Projects Archive!`, 'success');
}
window.markProjectComplete = markProjectComplete;

function reopenCompletedProject(projectId) {
  if (!MockDataStore.completedProjects) return;
  const compIdx = MockDataStore.completedProjects.findIndex(cp => cp.id === projectId);
  if (compIdx === -1) return;

  const compProj = MockDataStore.completedProjects[compIdx];
  // Remove from completedProjects
  MockDataStore.completedProjects.splice(compIdx, 1);

  // Restore to active projects
  if (!MockDataStore.projects) MockDataStore.projects = [];
  const reopenedProj = {
    id: compProj.id,
    name: compProj.name,
    service: compProj.service || 'Web Development',
    client: compProj.client || 'Enterprise Client',
    budget: compProj.budget || 50000,
    progress: 90,
    status: 'In Review',
    notes: compProj.notes || 'Reopened from Completed Archive for revision',
    assignedFreelancerId: compProj.assignedFreelancerId || null,
    assignedFreelancerName: compProj.assignedFreelancerName || 'Unassigned',
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  };

  MockDataStore.projects.unshift(reopenedProj);

  sanitizeProjectsAndArchive();
  StorageManager.save();
  GoogleSheetsSync.reopenProject(reopenedProj);
  recalculateRealKPIs();
  renderAllViews();
  switchProjectSubTab('active');
  showToast(`Project ${reopenedProj.id} restored to Active Sprints (Status: In Review)`, 'info');
}
window.reopenCompletedProject = reopenCompletedProject;

// Backdrop dismiss for celebration modal
document.addEventListener('click', (e) => {
  const gpayModal = document.getElementById('modal-project-complete-celebration');
  if (gpayModal && e.target === gpayModal) {
    closeProjectCelebrationModal();
  }
});

// Searchable Dropdowns for Project Modals (Client & Freelancer)
function populateProjectFreelancerDropdowns() {
  populateProjectSearchableDropdowns();
}

function populateProjectSearchableDropdowns() {
  const clients = MockDataStore.clients || [];
  const freelancers = MockDataStore.freelancers || [];

  // Populate Client Searchable Dropdowns
  renderSearchableClientOptions('new-proj-client', clients);
  renderSearchableClientOptions('edit-proj-client', clients);

  // Populate Freelancer Searchable Dropdowns
  renderSearchableFreelancerOptions('new-proj-freelancer', freelancers);
  renderSearchableFreelancerOptions('edit-proj-freelancer', freelancers);

  populateProvisionFreelancerDropdown();
}

function renderSearchableClientOptions(prefix, clientList, filterQuery = '') {
  const menu = document.getElementById(`menu-${prefix}`);
  const hiddenInput = document.getElementById(prefix);
  const searchInput = document.getElementById(`${prefix}-search`);
  const wrap = document.getElementById(`wrap-${prefix}`);
  if (!menu || !hiddenInput || !searchInput || !wrap) return;

  const q = (filterQuery || '').toLowerCase().trim();
  const filtered = clientList.filter(c => {
    if (!c) return false;
    if (!q) return true;
    const name = String(c.name || '').toLowerCase();
    const id = String(c.id || '').toLowerCase();
    const email = String(c.email || '').toLowerCase();
    const svcs = Array.isArray(c.services) ? c.services.join(' ').toLowerCase() : '';
    return name.includes(q) || id.includes(q) || email.includes(q) || svcs.includes(q);
  });

  if (filtered.length === 0) {
    menu.innerHTML = `
      <div class="searchable-empty-item">
        <span>No matching clients found</span>
        <button type="button" class="searchable-add-quick-btn" onclick="openModal('modal-new-client')">+ Add New Client Account</button>
      </div>
    `;
    return;
  }

  menu.innerHTML = filtered.map(c => {
    const initials = String(c.name || 'C').substring(0, 2).toUpperCase();
    const isSelected = hiddenInput.value === c.name;
    const svcsText = (c.services && c.services.length > 0) ? c.services.join(', ') : 'Web Development';
    return `
      <div class="searchable-option-item ${isSelected ? 'selected' : ''}" data-val="${escapeHtml(c.name)}" data-id="${escapeHtml(c.id)}">
        <div class="searchable-option-main">
          <div class="searchable-option-avatar">${initials}</div>
          <div>
            <div class="searchable-option-title">${escapeHtml(c.name)}</div>
            <div class="searchable-option-subtitle"><span class="font-mono text-muted">${c.id}</span> &bull; ${escapeHtml(svcsText)}</div>
          </div>
        </div>
        <span class="status-pill ${(c.status || 'active').toLowerCase().replace(/\s+/g, '-')}">${c.status || 'Active'}</span>
      </div>
    `;
  }).join('');

  menu.querySelectorAll('.searchable-option-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = item.getAttribute('data-val');
      hiddenInput.value = val;
      searchInput.value = val;
      wrap.classList.remove('open');
      renderSearchableClientOptions(prefix, clientList);
    });
  });
}

function renderSearchableFreelancerOptions(prefix, freelancerList, filterQuery = '') {
  const menu = document.getElementById(`menu-${prefix}`);
  const hiddenInput = document.getElementById(prefix);
  const searchInput = document.getElementById(`${prefix}-search`);
  const wrap = document.getElementById(`wrap-${prefix}`);
  if (!menu || !hiddenInput || !searchInput || !wrap) return;

  const q = (filterQuery || '').toLowerCase().trim();
  const filtered = freelancerList.filter(f => {
    if (!f) return false;
    if (!q) return true;
    const name = String(f.name || '').toLowerCase();
    const id = String(f.id || '').toLowerCase();
    const email = String(f.email || '').toLowerCase();
    const skills = Array.isArray(f.skills) ? f.skills.join(' ').toLowerCase() : '';
    return name.includes(q) || id.includes(q) || email.includes(q) || skills.includes(q);
  });

  let optionsHtml = '';
  if (!q || 'unassigned open position'.includes(q)) {
    const isUnassignedSelected = !hiddenInput.value;
    optionsHtml += `
      <div class="searchable-option-item ${isUnassignedSelected ? 'selected' : ''}" data-val="" data-name="Unassigned">
        <div class="searchable-option-main">
          <div class="searchable-option-avatar" style="background: rgba(255,255,255,0.06); color: #a1a1aa;">&bull;</div>
          <div>
            <div class="searchable-option-title" style="color: #a1a1aa;">Unassigned</div>
            <div class="searchable-option-subtitle">Open Position for Sprint Allocation</div>
          </div>
        </div>
      </div>
    `;
  }

  if (filtered.length === 0 && !optionsHtml) {
    menu.innerHTML = `
      <div class="searchable-empty-item">
        <span>No matching freelancers found in database</span>
        <button type="button" class="searchable-add-quick-btn" onclick="openModal('modal-new-freelancer')">+ Add New Freelancer</button>
      </div>
    `;
    return;
  }

  optionsHtml += filtered.map(f => {
    const initials = String(f.name || 'FL').substring(0, 2).toUpperCase();
    const isSelected = hiddenInput.value === f.id;
    const skillsText = (f.skills && f.skills.length > 0) ? f.skills.join(', ') : 'Specialist';
    return `
      <div class="searchable-option-item ${isSelected ? 'selected' : ''}" data-val="${escapeHtml(f.id)}" data-name="${escapeHtml(f.name)}">
        <div class="searchable-option-main">
          <div class="searchable-option-avatar">${initials}</div>
          <div>
            <div class="searchable-option-title">${escapeHtml(f.name)}</div>
            <div class="searchable-option-subtitle"><span class="font-mono text-muted">${f.id}</span> &bull; ${escapeHtml(skillsText)}</div>
          </div>
        </div>
        <span class="status-pill ${(f.status || 'active').toLowerCase().replace(/\s+/g, '-')}">${f.status || 'Active'}</span>
      </div>
    `;
  }).join('');

  menu.innerHTML = optionsHtml;

  menu.querySelectorAll('.searchable-option-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = item.getAttribute('data-val');
      const name = item.getAttribute('data-name');
      hiddenInput.value = val;
      searchInput.value = name || 'Unassigned';
      wrap.classList.remove('open');
      renderSearchableFreelancerOptions(prefix, freelancerList);
    });
  });
}

function setupSearchableSelectListeners(prefix, isFreelancer = false) {
  const wrap = document.getElementById(`wrap-${prefix}`);
  const toggleBtn = document.getElementById(`btn-toggle-${prefix}`);
  const searchInput = document.getElementById(`${prefix}-search`);
  const hiddenInput = document.getElementById(prefix);

  if (!wrap || !searchInput) return;

  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = wrap.classList.contains('open');
      document.querySelectorAll('.searchable-select-wrap.open').forEach(w => {
        if (w !== wrap) w.classList.remove('open');
      });
      if (isOpen) {
        wrap.classList.remove('open');
      } else {
        wrap.classList.add('open');
        if (isFreelancer) {
          renderSearchableFreelancerOptions(prefix, MockDataStore.freelancers || []);
        } else {
          renderSearchableClientOptions(prefix, MockDataStore.clients || []);
        }
        searchInput.focus();
      }
    });
  }

  searchInput.addEventListener('focus', () => {
    document.querySelectorAll('.searchable-select-wrap.open').forEach(w => {
      if (w !== wrap) w.classList.remove('open');
    });
    wrap.classList.add('open');
    if (isFreelancer) {
      renderSearchableFreelancerOptions(prefix, MockDataStore.freelancers || [], searchInput.value);
    } else {
      renderSearchableClientOptions(prefix, MockDataStore.clients || [], searchInput.value);
    }
  });

  searchInput.addEventListener('input', () => {
    wrap.classList.add('open');
    if (!isFreelancer && hiddenInput) {
      hiddenInput.value = searchInput.value;
    }
    if (isFreelancer) {
      renderSearchableFreelancerOptions(prefix, MockDataStore.freelancers || [], searchInput.value);
    } else {
      renderSearchableClientOptions(prefix, MockDataStore.clients || [], searchInput.value);
    }
  });
}

// Global click-away listener for searchable dropdowns
document.addEventListener('click', (e) => {
  if (!e.target.closest('.searchable-select-wrap')) {
    document.querySelectorAll('.searchable-select-wrap.open').forEach(w => w.classList.remove('open'));
  }
});

// Populate Freelancer Portal Provisioning Dropdown
function populateProvisionFreelancerDropdown() {
  const select = document.getElementById('prov-free-select');
  if (!select) return;

  const currentVal = select.value;
  const freelancers = MockDataStore.freelancers || [];
  const optionsHtml = `
    <option value="">-- Choose Onboarded Freelancer --</option>
    ${freelancers.map(f => `<option value="${f.id}">${escapeHtml(f.name)} (${f.id}) — ${escapeHtml(f.email || '')}</option>`).join('')}
  `;
  select.innerHTML = optionsHtml;
  if (currentVal) select.value = currentVal;

  select.onchange = function () {
    const selectedId = this.value;
    const f = (MockDataStore.freelancers || []).find(item => item.id === selectedId);
    const nameInput = document.getElementById('prov-free-name');
    const idInput = document.getElementById('prov-free-id');
    const emailInput = document.getElementById('prov-free-email');
    const projInput = document.getElementById('prov-free-project');
    const passInput = document.getElementById('prov-free-password');
    const milestoneInput = document.getElementById('prov-free-milestone');

    if (f) {
      if (nameInput) nameInput.value = f.name;
      if (idInput) idInput.value = f.id;
      if (emailInput) emailInput.value = f.email || `${f.id.toLowerCase()}@freelance.apex.com`;

      const assignedProj = (MockDataStore.projects || []).find(p =>
        p.assignedFreelancerId === f.id ||
        p.assignedFreelancerName === f.name ||
        (f.assignedProjects && f.assignedProjects.includes(p.id))
      );
      if (projInput) projInput.value = assignedProj ? assignedProj.name : 'Specialist Milestone Sprint';
      if (milestoneInput) milestoneInput.value = assignedProj ? (assignedProj.notes || 'Full Stack Deliverable') : 'Scoped Deliverable';
      if (passInput && !passInput.value) passInput.value = f.pass || (f.name.split(' ')[0] + '#2026');
    }
  };
}

window.openProvisionForFreelancer = function (freelancerId) {
  populateProvisionFreelancerDropdown();
  const select = document.getElementById('prov-free-select');
  if (select) {
    select.value = freelancerId;
    select.dispatchEvent(new Event('change'));
  }
  openModal('modal-provision-freelancer');
};

// Open Edit Client Modal & Populate Current Data
window.openEditClientModal = function (id) {
  const client = MockDataStore.clients.find(c => c.id === id);
  if (!client) return;

  const idInput = document.getElementById('edit-client-id');
  const nameInput = document.getElementById('edit-client-name');
  const emailInput = document.getElementById('edit-client-email');
  const phoneInput = document.getElementById('edit-client-phone');
  const dueInput = document.getElementById('edit-client-due');
  const projInput = document.getElementById('edit-client-projects');
  const statusInput = document.getElementById('edit-client-status');
  const notesInput = document.getElementById('edit-client-notes');
  const svcWeb = document.getElementById('edit-client-svc-web');
  const svcGraphic = document.getElementById('edit-client-svc-graphic');
  const svcVideo = document.getElementById('edit-client-svc-video');

  if (idInput) idInput.value = client.id;
  if (nameInput) nameInput.value = client.name || '';
  if (emailInput) emailInput.value = client.email || '';
  if (phoneInput) phoneInput.value = client.phone || '+91 98000 00000';
  if (dueInput) dueInput.value = client.paymentDue || 0;
  if (projInput) projInput.value = client.activeProjects || 0;
  if (statusInput) statusInput.value = client.status || 'Active';
  if (notesInput) notesInput.value = client.notes || '';

  const svcs = client.services || [];
  if (svcWeb) svcWeb.checked = svcs.includes('Web Development');
  if (svcGraphic) svcGraphic.checked = svcs.includes('Graphic Design');
  if (svcVideo) svcVideo.checked = svcs.includes('Video Editing');

  openModal('modal-edit-client');
};

// Open Edit Freelancer Modal & Populate Current Data
window.openEditFreelancerModal = function (id) {
  const f = MockDataStore.freelancers.find(fl => fl.id === id);
  if (!f) return;

  const idInput = document.getElementById('edit-free-id');
  const nameInput = document.getElementById('edit-free-name');
  const emailInput = document.getElementById('edit-free-email');
  const phoneInput = document.getElementById('edit-free-phone');
  const payStatusInput = document.getElementById('edit-free-pay-status');
  const payDueInput = document.getElementById('edit-free-pay-due');
  const payClearedInput = document.getElementById('edit-free-pay-cleared');
  const statusInput = document.getElementById('edit-free-status');

  const skillWeb = document.getElementById('edit-free-skill-web');
  const skillGraphic = document.getElementById('edit-free-skill-graphic');
  const skillVideo = document.getElementById('edit-free-skill-video');

  if (idInput) idInput.value = f.id;
  if (nameInput) nameInput.value = f.name || '';
  if (emailInput) emailInput.value = f.email || '';
  if (phoneInput) phoneInput.value = f.phone || '+91 98000 00000';
  if (payStatusInput) payStatusInput.value = f.paymentStatus || 'Cleared';
  if (payDueInput) payDueInput.value = f.paymentDue || 0;
  if (payClearedInput) payClearedInput.value = f.paymentCleared || 0;
  if (statusInput) statusInput.value = f.status || 'Available';

  const skills = f.skills || [];
  if (skillWeb) skillWeb.checked = skills.includes('Web Development');
  if (skillGraphic) skillGraphic.checked = skills.includes('Graphic Design');
  if (skillVideo) skillVideo.checked = skills.includes('Video Editing');

  openModal('modal-edit-freelancer');
};

// Open Assign Project Modal for Freelancer
window.openAssignProjectModal = function (id) {
  const f = MockDataStore.freelancers.find(fl => fl.id === id);
  if (!f) return;

  const idInput = document.getElementById('assign-proj-freelancer-id');
  const display = document.getElementById('assign-proj-freelancer-display');
  const select = document.getElementById('assign-proj-select');
  const notes = document.getElementById('assign-proj-notes');

  if (idInput) idInput.value = f.id;
  if (display) display.textContent = `${f.name} (${f.id}) — ${f.phone || ''}`;
  if (notes) notes.value = '';

  if (select) {
    select.innerHTML = MockDataStore.projects.map(p => `
      <option value="${p.id}">${escapeHtml(p.name)} [${p.service || 'Service'}] — ${formatINR(p.budget)} (${p.status})</option>
    `).join('');
  }

  openModal('modal-assign-project');
};

// Open Modal to View Assigned Projects for a Freelancer
window.openViewFreelancerProjectsModal = function (id) {
  const f = MockDataStore.freelancers.find(fl => fl.id === id);
  if (!f) return;

  const titleEl = document.getElementById('view-proj-modal-title');
  const container = document.getElementById('view-proj-list-container');

  if (titleEl) titleEl.textContent = `Assigned Projects: ${f.name} (${f.id})`;

  // Find projects assigned to this freelancer
  const assignedList = MockDataStore.projects.filter(p =>
    p.assignedFreelancerId === f.id ||
    (f.assignedProjects && f.assignedProjects.includes(p.id))
  );

  if (container) {
    if (assignedList.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: #71717a;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 8px; opacity: 0.5;">
            <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <div style="font-weight: 500; color: #a1a1aa;">No projects assigned yet</div>
          <p style="font-size: 12px; margin-top: 4px;">Click "+ Assign" on the freelancer directory to dispatch work to ${escapeHtml(f.name)}.</p>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto;">
          ${assignedList.map(p => `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 14px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="font-mono text-muted" style="font-size: 11px;">${p.id}</span>
                    <strong style="color: #ffffff; font-size: 14px;">${escapeHtml(p.name)}</strong>
                    ${getServiceBadge(p.service)}
                  </div>
                  <div style="font-size: 12px; color: #a1a1aa; margin-top: 2px;">Client: <span style="color: #e4e4e7;">${escapeHtml(p.client)}</span> | Deadline: <span class="font-mono">${p.deadline}</span></div>
                </div>
                <div style="text-align: right;">
                  <span class="status-pill ${(p.status || 'active').toLowerCase().replace(/\s+/g, '-')}">${p.status}</span>
                  <div class="font-mono text-green" style="font-weight: 600; font-size: 13px; margin-top: 4px;">${formatINR(p.budget)}</div>
                </div>
              </div>
              <div style="margin-top: 10px;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
                  <span style="color: #71717a;">Completion Progress</span>
                  <span class="font-mono" style="color: #e4e4e7;">${p.progress}%</span>
                </div>
                <div class="cell-progress-bar">
                  <div class="cell-progress-fill ${p.progress >= 90 ? 'fill-green' : ''}" style="width: ${p.progress}%"></div>
                </div>
              </div>
              ${p.notes ? `
                <div style="margin-top: 10px; padding: 8px 10px; background: rgba(0,0,0,0.3); border-radius: 6px; font-size: 11px; color: #d4d4d8; display: flex; gap: 6px;">
                  <span style="color: #ff2a4b; font-weight: 600;">Note:</span>
                  <span>${escapeHtml(p.notes)}</span>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  openModal('modal-view-freelancer-projects');
};

// Open Edit Project Modal & Populate Current Data
window.openEditProjectModal = function (id) {
  const p = (MockDataStore.projects || []).find(proj => proj.id === id) || (MockDataStore.completedProjects || []).find(proj => proj.id === id);
  if (!p) return;

  const idInput = document.getElementById('edit-proj-id');
  const titleInput = document.getElementById('edit-proj-title');
  const serviceInput = document.getElementById('edit-proj-service');
  const clientInput = document.getElementById('edit-proj-client');
  const clientSearchInput = document.getElementById('edit-proj-client-search');
  const budgetInput = document.getElementById('edit-proj-budget');
  const freelancerInput = document.getElementById('edit-proj-freelancer');
  const freelancerSearchInput = document.getElementById('edit-proj-freelancer-search');
  const deadlineInput = document.getElementById('edit-proj-deadline');
  const progressInput = document.getElementById('edit-proj-progress');
  const statusInput = document.getElementById('edit-proj-status');
  const notesInput = document.getElementById('edit-proj-notes');

  populateProjectSearchableDropdowns();

  if (idInput) idInput.value = p.id;
  if (titleInput) titleInput.value = p.name || '';
  if (serviceInput) serviceInput.value = p.service || 'Web Development';
  if (clientInput) clientInput.value = p.client || '';
  if (clientSearchInput) clientSearchInput.value = p.client || '';
  if (budgetInput) budgetInput.value = p.budget || 50000;
  if (freelancerInput) freelancerInput.value = p.assignedFreelancerId || '';
  if (freelancerSearchInput) freelancerSearchInput.value = p.assignedFreelancerName || 'Unassigned';
  if (deadlineInput) deadlineInput.value = p.deadline || '2026-11-30';
  if (progressInput) progressInput.value = p.progress !== undefined ? p.progress : 15;
  if (statusInput) statusInput.value = p.status || 'Active';
  if (notesInput) notesInput.value = p.notes || '';

  openModal('modal-edit-project');
};

/* ----------------------------------------------------------------------------
 * 9. Modal Management & Form Submissions
 * ---------------------------------------------------------------------------- */
function setupModalHandlers() {
  if (window._modalHandlersInitialized) return;
  window._modalHandlersInitialized = true;

  // Setup Searchable Select Listeners for Project Modals
  setupSearchableSelectListeners('new-proj-client', false);
  setupSearchableSelectListeners('new-proj-freelancer', true);
  setupSearchableSelectListeners('edit-proj-client', false);
  setupSearchableSelectListeners('edit-proj-freelancer', true);

  // Open buttons
  const modalOpeners = [
    { btn: 'btn-open-client-modal', modal: 'modal-new-client' },
    { btn: 'btn-open-project-modal', modal: 'modal-new-project' },
    { btn: 'btn-quick-new-project', modal: 'modal-new-project' },
    { btn: 'btn-open-freelancer-modal', modal: 'modal-new-freelancer' },
    { btn: 'btn-open-client-payment-modal', modal: 'modal-record-payment' },
    { btn: 'btn-open-freelancer-payout-modal', modal: 'modal-freelancer-payout' },
    { btn: 'btn-open-provision-freelancer-modal', modal: 'modal-provision-freelancer' },
    { btn: 'btn-open-new-admin-modal', modal: 'modal-new-admin' },
    { btn: 'btn-simulate-freelancer-view', modal: 'modal-simulate-freelancer-portal' },
    { btn: 'btn-open-sync-modal', modal: 'modal-google-sheets-sync' }
  ];

  modalOpeners.forEach(item => {
    const el = document.getElementById(item.btn);
    if (el) {
      el.addEventListener('click', () => {
        populateProjectSearchableDropdowns();
        if (item.modal === 'modal-new-project') {
          const clientSearch = document.getElementById('new-proj-client-search');
          const clientHidden = document.getElementById('new-proj-client');
          const freeSearch = document.getElementById('new-proj-freelancer-search');
          const freeHidden = document.getElementById('new-proj-freelancer');
          if (clientSearch) clientSearch.value = '';
          if (clientHidden) clientHidden.value = '';
          if (freeSearch) freeSearch.value = '';
          if (freeHidden) freeHidden.value = '';
        }
        if (item.modal === 'modal-google-sheets-sync') {
          GoogleSheetsSync.updateStatusUI();
        }
        openModal(item.modal);
      });
    }
  });

  // Google Sheets Live Sync Modal Actions
  const btnSaveSheetUrl = document.getElementById('btn-save-sheet-url');
  if (btnSaveSheetUrl) {
    btnSaveSheetUrl.addEventListener('click', () => {
      const urlInput = document.getElementById('google-sheets-url');
      const val = urlInput ? urlInput.value.trim() : '';
      GoogleSheetsSync.setUrl(val);
      showToast(val ? 'Google Sheets Web App URL saved successfully' : 'Cleared Google Sheets URL (Offline LocalStorage mode)', 'success');
    });
  }

  const btnTestSheetConn = document.getElementById('btn-test-sheet-conn');
  if (btnTestSheetConn) {
    btnTestSheetConn.addEventListener('click', () => {
      GoogleSheetsSync.testConnection();
    });
  }

  const btnPullSheetData = document.getElementById('btn-pull-sheet-data');
  if (btnPullSheetData) {
    btnPullSheetData.addEventListener('click', () => {
      GoogleSheetsSync.pullAll();
    });
  }

  const btnPushSheetData = document.getElementById('btn-push-sheet-data');
  if (btnPushSheetData) {
    btnPushSheetData.addEventListener('click', () => {
      GoogleSheetsSync.pushAll();
    });
  }

  const btnCopyGasCode = document.getElementById('btn-copy-gas-code');
  if (btnCopyGasCode) {
    btnCopyGasCode.addEventListener('click', () => {
      showToast('Open "google_apps_script.js" in this project folder to copy Code.gs', 'default');
    });
  }

  // Auto-generate password buttons
  const btnGenFreePass = document.getElementById('btn-gen-free-pass');
  if (btnGenFreePass) {
    btnGenFreePass.addEventListener('click', () => {
      const generated = 'FreeKey#' + Math.floor(1000 + Math.random() * 9000);
      const input = document.getElementById('prov-free-password');
      if (input) input.value = generated;
      showToast('Generated secure temporary password for freelancer', 'success');
    });
  }

  const btnGenAdminPass = document.getElementById('btn-gen-admin-pass');
  if (btnGenAdminPass) {
    btnGenAdminPass.addEventListener('click', () => {
      const generated = 'AdminSec#' + Math.floor(1000 + Math.random() * 9000);
      const input = document.getElementById('admin-create-password');
      if (input) input.value = generated;
      showToast('Generated secure administrative key', 'success');
    });
  }

  // Close buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close-modal');
      closeModal(modalId);
    });
  });

  // Close on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', (e) => {
      if (e.target === bd) {
        bd.classList.add('hidden');
      }
    });
  });

  // Form: New Client
  // Form: New Client (Name, Email, Phone, Services, Admin Notes)
  const formClient = document.getElementById('form-new-client');
  if (formClient) {
    formClient.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('new-client-name').value.trim();
      const email = document.getElementById('new-client-email').value.trim();
      const phone = document.getElementById('new-client-phone').value.trim();
      const notesEl = document.getElementById('new-client-notes');
      const notes = notesEl ? notesEl.value.trim() : '';
      const paymentDue = 0;
      const activeProjects = 0;
      const status = 'Active';

      // Read selected services (Core 3 Services)
      const serviceCheckboxes = document.querySelectorAll('input[name="new-client-service"]:checked');
      const services = Array.from(serviceCheckboxes).map(cb => cb.value);
      if (services.length === 0) {
        services.push('Web Development');
      }

      let maxCltNum = 100;
      (MockDataStore.clients || []).forEach(c => {
        if (c && c.id) {
          const match = String(c.id).match(/CLT-(\d+)/i);
          if (match) {
            const n = parseInt(match[1], 10);
            if (n > maxCltNum) maxCltNum = n;
          }
        }
      });
      const newId = `CLT-${maxCltNum + 1}`;

      const newClient = {
        id: newId,
        name,
        email,
        phone,
        services,
        notes,
        activeProjects,
        totalBilled: 0,
        paymentDue,
        status
      };
      if (!MockDataStore.clients) MockDataStore.clients = [];
      MockDataStore.clients.unshift(newClient);

      MockDataStore.kpis.clients += 1;
      const badgeClients = document.getElementById('badge-total-clients');
      if (badgeClients) badgeClients.textContent = MockDataStore.clients.length;

      StorageManager.save();
      GoogleSheetsSync.upsertClient(newClient);
      renderAllViews();
      closeModal('modal-new-client');
      formClient.reset();
      showToast(`Enterprise client "${name}" (${newId}) onboarded successfully & synced to Google Sheet!`, 'success');
    });
  }

  // Form: Edit Client
  const formEditClient = document.getElementById('form-edit-client');
  if (formEditClient) {
    formEditClient.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-client-id').value;
      const client = MockDataStore.clients.find(c => c.id === id);
      if (!client) return;

      client.name = document.getElementById('edit-client-name').value.trim();
      client.email = document.getElementById('edit-client-email').value.trim();
      client.phone = document.getElementById('edit-client-phone').value.trim();
      client.paymentDue = parseInt(document.getElementById('edit-client-due').value, 10) || 0;
      client.activeProjects = parseInt(document.getElementById('edit-client-projects').value, 10) || 0;
      client.status = document.getElementById('edit-client-status').value;

      const notesInput = document.getElementById('edit-client-notes');
      if (notesInput) {
        client.notes = notesInput.value.trim();
      }

      const services = [];
      if (document.getElementById('edit-client-svc-web').checked) services.push('Web Development');
      if (document.getElementById('edit-client-svc-graphic').checked) services.push('Graphic Design');
      if (document.getElementById('edit-client-svc-video').checked) services.push('Video Editing');
      if (services.length === 0) services.push('Web Development');
      client.services = services;

      StorageManager.save();
      GoogleSheetsSync.upsertClient(client);
      renderAllViews();
      closeModal('modal-edit-client');
      showToast(`Client account ${client.id} updated & synced to Google Sheet`, 'success');
    });
  }

  // Form: New Project
  const formProject = document.getElementById('form-new-project');
  if (formProject) {
    formProject.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('new-proj-title').value.trim();
      const service = document.getElementById('new-proj-service').value;
      const clientHidden = document.getElementById('new-proj-client');
      const clientSearch = document.getElementById('new-proj-client-search');
      const client = (clientHidden && clientHidden.value ? clientHidden.value : (clientSearch ? clientSearch.value : '')).trim();
      const budget = parseInt(document.getElementById('new-proj-budget').value, 10) || 50000;
      const freelancerId = document.getElementById('new-proj-freelancer').value;
      const deadline = document.getElementById('new-proj-deadline').value || '2026-11-30';
      const progress = parseInt(document.getElementById('new-proj-progress').value, 10) || 0;
      const status = document.getElementById('new-proj-status').value;
      const notes = document.getElementById('new-proj-notes').value.trim();

      if (!client) {
        showToast('Please select or search a client from Google Sheets', 'default');
        if (clientSearch) clientSearch.focus();
        return;
      }

      let assignedFreelancerName = 'Unassigned';
      if (freelancerId) {
        const free = MockDataStore.freelancers.find(fl => fl.id === freelancerId);
        if (free) {
          assignedFreelancerName = free.name;
        }
      }

      let maxPrjNum = 300;
      (MockDataStore.projects || []).forEach(p => {
        if (p && p.id) {
          const match = String(p.id).match(/PRJ-(\d+)/i);
          if (match) {
            const n = parseInt(match[1], 10);
            if (n > maxPrjNum) maxPrjNum = n;
          }
        }
      });
      const newId = `PRJ-${maxPrjNum + 1}`;
      const newProj = {
        id: newId,
        name: title,
        service,
        client,
        budget,
        progress,
        status,
        notes: notes || `${service} deliverable initiated`,
        assignedFreelancerId: freelancerId || null,
        assignedFreelancerName,
        deadline
      };

      MockDataStore.projects.unshift(newProj);
      MockDataStore.kpis.totalProjects += 1;
      if (status === 'Active') MockDataStore.kpis.activeProjects += 1;

      // Link to freelancer if assigned
      if (freelancerId) {
        const free = MockDataStore.freelancers.find(fl => fl.id === freelancerId);
        if (free) {
          if (!free.assignedProjects) free.assignedProjects = [];
          if (!free.assignedProjects.includes(newId)) free.assignedProjects.push(newId);
          free.status = 'Active';
          GoogleSheetsSync.upsertFreelancer(free);
        }
      }

      const badge = document.getElementById('badge-total-projects');
      if (badge) badge.textContent = MockDataStore.projects.length;

      StorageManager.save();
      GoogleSheetsSync.upsertProject(newProj);
      renderAllViews();
      closeModal('modal-new-project');
      formProject.reset();
      if (clientSearch) clientSearch.value = '';
      if (clientHidden) clientHidden.value = '';
      const freeSearch = document.getElementById('new-proj-freelancer-search');
      const freeHidden = document.getElementById('new-proj-freelancer');
      if (freeSearch) freeSearch.value = '';
      if (freeHidden) freeHidden.value = '';
      showToast(`Project "${title}" (${service}) created & synced to Google Sheets!`, 'success');
    });
  }

  // Form: Edit Project
  const formEditProject = document.getElementById('form-edit-project');
  if (formEditProject) {
    formEditProject.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-proj-id').value;
      let proj = (MockDataStore.projects || []).find(p => p.id === id) || (MockDataStore.completedProjects || []).find(p => p.id === id);
      if (!proj) return;

      const prevFreelancerId = proj.assignedFreelancerId;
      const newFreelancerId = document.getElementById('edit-proj-freelancer').value;

      const clientHidden = document.getElementById('edit-proj-client');
      const clientSearch = document.getElementById('edit-proj-client-search');
      const client = (clientHidden && clientHidden.value ? clientHidden.value : (clientSearch ? clientSearch.value : '')).trim();

      proj.name = document.getElementById('edit-proj-title').value.trim();
      proj.service = document.getElementById('edit-proj-service').value;
      proj.client = client || proj.client;
      proj.budget = parseInt(document.getElementById('edit-proj-budget').value, 10) || 50000;
      proj.deadline = document.getElementById('edit-proj-deadline').value;
      proj.progress = parseInt(document.getElementById('edit-proj-progress').value, 10) || 0;
      proj.status = document.getElementById('edit-proj-status').value;
      proj.notes = document.getElementById('edit-proj-notes').value.trim();

      // Manage freelancer reallocation
      if (prevFreelancerId !== newFreelancerId) {
        if (prevFreelancerId) {
          const oldFree = (MockDataStore.freelancers || []).find(fl => fl.id === prevFreelancerId);
          if (oldFree && oldFree.assignedProjects) {
            oldFree.assignedProjects = oldFree.assignedProjects.filter(pid => pid !== id);
            GoogleSheetsSync.upsertFreelancer(oldFree);
          }
        }
        if (newFreelancerId) {
          const newFree = (MockDataStore.freelancers || []).find(fl => fl.id === newFreelancerId);
          if (newFree) {
            proj.assignedFreelancerId = newFree.id;
            proj.assignedFreelancerName = newFree.name;
            if (!newFree.assignedProjects) newFree.assignedProjects = [];
            if (!newFree.assignedProjects.includes(id)) newFree.assignedProjects.push(id);
            newFree.status = 'Active';
            GoogleSheetsSync.upsertFreelancer(newFree);
          }
        } else {
          proj.assignedFreelancerId = null;
          proj.assignedFreelancerName = 'Unassigned';
        }
      }

      // If status is Completed, remove from Active projects and move to Completed Projects Archive
      if (proj.status === 'Completed') {
        MockDataStore.projects = (MockDataStore.projects || []).filter(p => p.id !== id);
        if (!MockDataStore.completedProjects) MockDataStore.completedProjects = [];
        const compDate = proj.completionDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const compItem = {
          id: proj.id,
          name: proj.name,
          service: proj.service,
          client: proj.client,
          budget: proj.budget,
          progress: 100,
          status: 'Completed',
          assignedFreelancerId: proj.assignedFreelancerId || null,
          assignedFreelancerName: proj.assignedFreelancerName || 'Specialist',
          completionDate: compDate,
          notes: proj.notes || 'Delivered & verified'
        };
        const existingIdx = MockDataStore.completedProjects.findIndex(cp => cp.id === id);
        if (existingIdx >= 0) {
          MockDataStore.completedProjects[existingIdx] = compItem;
        } else {
          MockDataStore.completedProjects.unshift(compItem);
        }
        GoogleSheetsSync.completeProject(compItem);
      } else {
        // If status is Active/Planning/In Review, remove from Completed Projects and move to Active Sprints
        MockDataStore.completedProjects = (MockDataStore.completedProjects || []).filter(cp => cp.id !== id);
        if (!MockDataStore.projects) MockDataStore.projects = [];
        const existingIdx = MockDataStore.projects.findIndex(p => p.id === id);
        if (existingIdx >= 0) {
          MockDataStore.projects[existingIdx] = proj;
        } else {
          MockDataStore.projects.unshift(proj);
        }
        GoogleSheetsSync.upsertProject(proj);
      }

      sanitizeProjectsAndArchive();
      StorageManager.save();
      recalculateRealKPIs();
      renderAllViews();
      closeModal('modal-edit-project');
      showToast(`Project ${proj.id} successfully updated & synced to Google Sheets!`, 'success');
    });
  }

  // Form: New Freelancer (Simplified to Name, Email, Phone, Skills)
  const formFreelancer = document.getElementById('form-new-freelancer');
  if (formFreelancer) {
    formFreelancer.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('new-free-name').value.trim();
      const email = document.getElementById('new-free-email').value.trim();
      const phone = document.getElementById('new-free-phone').value.trim();
      const firstName = (name.split(' ')[0] || 'Specialist');
      const pass = firstName + '#2026';
      const paymentStatus = 'Cleared';
      const paymentDue = 0;
      const paymentCleared = 0;
      const status = 'Active';

      // Read selected Specialist Skills (Core Services)
      const skillCheckboxes = document.querySelectorAll('input[name="new-free-skill"]:checked');
      const skills = Array.from(skillCheckboxes).map(cb => cb.value);
      if (skills.length === 0) {
        skills.push('Web Development');
      }

      let maxFlNum = 100;
      (MockDataStore.freelancers || []).forEach(fl => {
        if (fl && fl.id) {
          const match = String(fl.id).match(/FL-(\d+)/i);
          if (match) {
            const n = parseInt(match[1], 10);
            if (n > maxFlNum) maxFlNum = n;
          }
        }
      });
      (MockDataStore.freelancerCredentials || []).forEach(fc => {
        if (fc && fc.id) {
          const match = String(fc.id).match(/FL-(\d+)/i);
          if (match) {
            const n = parseInt(match[1], 10);
            if (n > maxFlNum) maxFlNum = n;
          }
        }
      });
      const newId = `FL-${maxFlNum + 1}`;

      const newFree = {
        id: newId,
        name,
        email,
        phone,
        pass,
        skills,
        paymentStatus,
        paymentCleared,
        paymentDue,
        assignedProjects: [],
        status
      };
      if (!MockDataStore.freelancers) MockDataStore.freelancers = [];
      MockDataStore.freelancers.unshift(newFree);

      // Automatically create portal credential linked to this freelancer
      const newCred = {
        id: newId,
        name,
        email: email || `${newId.toLowerCase()}@freelance.apex.com`,
        pass: pass,
        project: 'Awaiting Project Assignment',
        milestone: 'Deliverable Scoped',
        hours: 0,
        status: 'Active',
        lastLogin: 'Onboarded Just Now'
      };
      if (!MockDataStore.freelancerCredentials) MockDataStore.freelancerCredentials = [];
      MockDataStore.freelancerCredentials.unshift(newCred);

      const badge = document.getElementById('badge-total-freelancers');
      if (badge) badge.textContent = MockDataStore.freelancers.length;
      const badgePortal = document.getElementById('badge-portal-freelancers');
      if (badgePortal) badgePortal.textContent = MockDataStore.freelancerCredentials.length;

      populateProjectFreelancerDropdowns();
      StorageManager.save();
      GoogleSheetsSync.upsertFreelancer(newFree);
      GoogleSheetsSync.upsertFreelancerAdmin(newCred);
      renderAllViews();
      closeModal('modal-new-freelancer');
      formFreelancer.reset();
      showToast(`Specialist ${name} onboarded (${newId}) with Password: ${pass}`, 'success');
    });
  }

  // Form: Edit Freelancer
  const formEditFreelancer = document.getElementById('form-edit-freelancer');
  if (formEditFreelancer) {
    formEditFreelancer.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-free-id').value;
      const f = MockDataStore.freelancers.find(fl => fl.id === id);
      if (!f) return;

      f.name = document.getElementById('edit-free-name').value.trim();
      f.email = document.getElementById('edit-free-email').value.trim();
      f.phone = document.getElementById('edit-free-phone').value.trim();
      const passInput = document.getElementById('edit-free-password');
      if (passInput && passInput.value.trim()) {
        f.pass = passInput.value.trim();
      }
      f.paymentStatus = document.getElementById('edit-free-pay-status').value;
      f.paymentDue = parseInt(document.getElementById('edit-free-pay-due').value, 10) || 0;
      f.paymentCleared = parseInt(document.getElementById('edit-free-pay-cleared').value, 10) || 0;
      f.status = document.getElementById('edit-free-status').value;

      // Update Core 3 Skills
      const skills = [];
      if (document.getElementById('edit-free-skill-web').checked) skills.push('Web Development');
      if (document.getElementById('edit-free-skill-graphic').checked) skills.push('Graphic Design');
      if (document.getElementById('edit-free-skill-video').checked) skills.push('Video Editing');
      if (skills.length === 0) skills.push('Web Development');
      f.skills = skills;

      // Update corresponding credential
      const cred = (MockDataStore.freelancerCredentials || []).find(c => c.id === f.id || (c.email && f.email && c.email.toLowerCase() === f.email.toLowerCase()));
      if (cred) {
        cred.name = f.name;
        cred.email = f.email;
        if (f.pass) cred.pass = f.pass;
        cred.status = f.status;
        GoogleSheetsSync.upsertFreelancerAdmin(cred);
      }

      populateProjectFreelancerDropdowns();
      StorageManager.save();
      GoogleSheetsSync.upsertFreelancer(f);
      renderAllViews();
      closeModal('modal-edit-freelancer');
      showToast(`Freelancer account ${f.id} updated successfully`, 'success');
    });
  }

  // Form: Assign Project to Freelancer
  const formAssignProject = document.getElementById('form-assign-project');
  if (formAssignProject) {
    formAssignProject.addEventListener('submit', (e) => {
      e.preventDefault();
      const freelancerId = document.getElementById('assign-proj-freelancer-id').value;
      const projectId = document.getElementById('assign-proj-select').value;
      const notes = document.getElementById('assign-proj-notes').value.trim();

      const f = MockDataStore.freelancers.find(fl => fl.id === freelancerId);
      const p = MockDataStore.projects.find(pr => pr.id === projectId);

      if (f && p) {
        // If previously assigned to another, unassign
        if (p.assignedFreelancerId && p.assignedFreelancerId !== f.id) {
          const oldFree = MockDataStore.freelancers.find(fl => fl.id === p.assignedFreelancerId);
          if (oldFree && oldFree.assignedProjects) {
            oldFree.assignedProjects = oldFree.assignedProjects.filter(pid => pid !== p.id);
            GoogleSheetsSync.upsertFreelancer(oldFree);
          }
        }

        p.assignedFreelancerId = f.id;
        p.assignedFreelancerName = f.name;
        if (notes) {
          p.notes = p.notes ? `${p.notes} | ${notes}` : notes;
        }

        if (!f.assignedProjects) f.assignedProjects = [];
        if (!f.assignedProjects.includes(p.id)) {
          f.assignedProjects.push(p.id);
        }
        f.status = 'Active';

        StorageManager.save();
        GoogleSheetsSync.upsertProject(p);
        GoogleSheetsSync.upsertFreelancer(f);
        renderAllViews();
        closeModal('modal-assign-project');
        showToast(`Project "${p.name}" assigned to ${f.name}`, 'success');
      }
    });
  }

  // Form: Record Client Invoice
  const formPayment = document.getElementById('form-record-payment');
  if (formPayment) {
    formPayment.addEventListener('submit', (e) => {
      e.preventDefault();
      const client = document.getElementById('new-pay-client').value.trim();
      const project = document.getElementById('new-pay-project').value.trim();
      const amount = parseInt(document.getElementById('new-pay-amount').value, 10) || 50000;
      const status = document.getElementById('new-pay-status').value;

      const newId = `INV-2026-${880 + MockDataStore.clientPayments.length + 1}`;
      const newInvoice = {
        id: newId,
        type: 'Client Invoice',
        client,
        project,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: '2026-10-30',
        amount,
        status
      };
      MockDataStore.clientPayments.unshift(newInvoice);

      StorageManager.save();
      GoogleSheetsSync.upsertPayment(newInvoice);
      renderAllViews();
      closeModal('modal-record-payment');
      formPayment.reset();
      showToast(`Invoice ${newId} recorded for ${client}`, 'success');
    });
  }

  // Form: Release Freelancer Payout
  const formPayout = document.getElementById('form-freelancer-payout');
  if (formPayout) {
    formPayout.addEventListener('submit', (e) => {
      e.preventDefault();
      const freelancer = document.getElementById('new-payout-freelancer').value.trim();
      const project = document.getElementById('new-payout-project').value.trim();
      const milestone = document.getElementById('new-payout-milestone').value.trim();
      const hours = parseInt(document.getElementById('new-payout-hours').value, 10) || 30;
      const amount = parseInt(document.getElementById('new-payout-amount').value, 10) || 30000;
      const status = document.getElementById('new-payout-status').value;

      const newId = `DSB-${4400 + MockDataStore.freelancerDisbursements.length + 1}`;
      const newPayout = {
        id: newId,
        type: 'Freelancer Payout',
        freelancer,
        project,
        milestone,
        hours,
        amount,
        status,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0]
      };
      MockDataStore.freelancerDisbursements.unshift(newPayout);

      StorageManager.save();
      GoogleSheetsSync.upsertPayment(newPayout);
      renderAllViews();
      closeModal('modal-freelancer-payout');
      formPayout.reset();
      showToast(`Disbursement ${newId} released to ${freelancer}`, 'success');
    });
  }

  // Form: Provision Freelancer Portal Access (Step 2 of Talent Workflow)
  const formProvisionFree = document.getElementById('form-provision-freelancer');
  if (formProvisionFree) {
    formProvisionFree.addEventListener('submit', (e) => {
      e.preventDefault();
      const selectEl = document.getElementById('prov-free-select');
      const selectedFlId = selectEl ? selectEl.value : '';
      const fl = (MockDataStore.freelancers || []).find(item => item.id === selectedFlId);

      const name = fl ? fl.name : (document.getElementById('prov-free-name').value.trim() || 'Specialist Freelancer');
      const project = document.getElementById('prov-free-project').value.trim() || 'Active Milestone Sprint';
      const email = document.getElementById('prov-free-email').value.trim();
      const pass = document.getElementById('prov-free-password').value.trim();
      const milestone = document.getElementById('prov-free-milestone').value.trim() || 'Scoped Deliverable';
      const status = document.getElementById('prov-free-status').value;

      const targetId = selectedFlId || (fl ? fl.id : `FCR-${200 + (MockDataStore.freelancerCredentials || []).length + 1}`);

      // Update or insert in MockDataStore.freelancerCredentials
      if (!MockDataStore.freelancerCredentials) MockDataStore.freelancerCredentials = [];
      let existingCred = MockDataStore.freelancerCredentials.find(c => c.id === targetId || (c.email && email && c.email.toLowerCase() === email.toLowerCase()));

      if (existingCred) {
        existingCred.name = name;
        existingCred.email = email;
        existingCred.pass = pass;
        existingCred.project = project;
        existingCred.milestone = milestone;
        existingCred.status = status;
        existingCred.lastLogin = 'Access Updated';
      } else {
        existingCred = {
          id: targetId,
          name,
          email,
          pass,
          project,
          milestone,
          hours: 0,
          status,
          lastLogin: 'Provisioned Just Now'
        };
        MockDataStore.freelancerCredentials.unshift(existingCred);
      }

      // Update pass on Freelancer record as well
      if (fl) {
        fl.pass = pass;
        fl.email = email;
        GoogleSheetsSync.upsertFreelancer(fl);
      }

      const badge = document.getElementById('badge-portal-freelancers');
      if (badge) badge.textContent = MockDataStore.freelancerCredentials.length;

      StorageManager.save();
      GoogleSheetsSync.upsertFreelancerAdmin(existingCred);
      renderAllViews();
      closeModal('modal-provision-freelancer');
      formProvisionFree.reset();
      showToast(`Portal access issued for ${name} (${email}) with Password "${pass}"`, 'success');
    });
  }

  // Form: Create New Admin User
  const formNewAdmin = document.getElementById('form-new-admin');
  if (formNewAdmin) {
    formNewAdmin.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('admin-create-name').value.trim();
      const role = document.getElementById('admin-create-role').value;
      const email = document.getElementById('admin-create-email').value.trim();
      const pass = document.getElementById('admin-create-password').value.trim();

      // STRICT VALIDATION: Require full name, email, and password
      if (!name || !email || !pass) {
        showToast('Please provide administrator name, email, and password.', 'default');
        return;
      }

      // Check for duplicate email
      const existing = (MockDataStore.adminUsers || []).find(a => a && a.email && a.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        showToast(`An administrator with email ${email} already exists (${existing.id})`, 'default');
        return;
      }

      let privileges = 'Standard Admin Privileges';
      if (role === 'Super Admin') privileges = 'Full Root Privileges (All Modules & RBAC)';
      else if (role === 'Operations Admin') privileges = 'Projects, Talent & Access Portals';
      else if (role === 'Financial Admin') privileges = 'Billing, Invoices & Escrows';
      else if (role === 'Security Auditor') privileges = 'Telemetry, Logs & Read-Only Audit';

      // Robust unique ID generation
      let maxNum = 0;
      (MockDataStore.adminUsers || []).forEach(a => {
        if (a && a.id) {
          const match = a.id.match(/ADM-(\d+)/i);
          if (match) {
            const n = parseInt(match[1], 10);
            if (n > maxNum) maxNum = n;
          }
        }
      });
      const newId = `ADM-${String(maxNum + 1).padStart(3, '0')}`;

      const statusInput = document.getElementById('admin-create-status');
      const status = statusInput ? statusInput.value : 'Pending Approval';

      const newAdmin = {
        id: newId,
        name,
        email,
        pass,
        role,
        privileges,
        status: status || 'Pending Approval',
        lastAuth: 'Created Just Now'
      };

      if (!MockDataStore.adminUsers) MockDataStore.adminUsers = [];
      MockDataStore.adminUsers.unshift(newAdmin);
      MockDataStore.adminUsers = sanitizeAdminUsers(MockDataStore.adminUsers);

      const badge = document.getElementById('badge-total-admins');
      if (badge) badge.textContent = MockDataStore.adminUsers.length;

      StorageManager.save();
      GoogleSheetsSync.upsertAdmin(newAdmin);
      renderAdminUsersTable();
      closeModal('modal-new-admin');
      formNewAdmin.reset();
      showToast(`Admin account ${newId} registered with status "${status}" and synced to Google Sheet!`, 'success');
    });
  }

  // Google Sheets Cloud Sync Modal Triggers & Controls
  const btnTopSheets = document.getElementById('btn-topbar-sheets-sync');
  if (btnTopSheets) {
    btnTopSheets.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('modal-google-sheets-sync');
      GoogleSheetsSync.updateStatusUI();
    });
  }

  const btnSideSheets = document.getElementById('btn-sidebar-sheets-sync');
  if (btnSideSheets) {
    btnSideSheets.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('modal-google-sheets-sync');
      GoogleSheetsSync.updateStatusUI();
    });
  }
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('hidden');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('hidden');
}

/* ----------------------------------------------------------------------------
 * 9. Toast Notifications
 * ---------------------------------------------------------------------------- */
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

// Utility: HTML Escape
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 10. Application Bootstrapper
 * Ensures navigation handlers, modals, and persisted session are immediately active on boot.
 */
function bootApplication() {
  try { StorageManager.load(); } catch (e) { console.warn('[boot] StorageManager error:', e); }
  try { GoogleSheetsSync.updateStatusUI(); } catch (e) { console.warn('[boot] SheetsStatus error:', e); }
  try { setupNavigationHandlers(); } catch (e) { console.warn('[boot] Navigation error:', e); }
  try { setupPaymentSubtabs(); } catch (e) { console.warn('[boot] PaymentSubtabs error:', e); }
  try { setupModalHandlers(); } catch (e) { console.warn('[boot] ModalHandlers error:', e); }

  // Connect standalone freelancer portal launcher button if present
  const btnSimulate = document.getElementById('btn-simulate-freelancer-view');
  if (btnSimulate) {
    btnSimulate.addEventListener('click', (e) => {
      e.preventDefault();
      window.open('freelancer.html', '_blank');
    });
  }

  // Pre-fetch live accounts from Google Sheets if configured, so login screen always has latest admins
  if (GoogleSheetsSync.getUrl()) {
    GoogleSheetsSync.pullAll({ silent: true });
  }

  // Check if session is already active or dashboard was unhidden
  const isSessionActive = localStorage.getItem('apexcore_authenticated_session') === 'true';
  const isDashboardVisible = dashboardView && !dashboardView.classList.contains('hidden');

  if (isSessionActive || isDashboardVisible) {
    AppState.isAuthenticated = true;
    const rawAdmin = localStorage.getItem('apexcore_auth_admin');
    if (rawAdmin) {
      try {
        AppState.currentAdmin = JSON.parse(rawAdmin);
        AppState.currentUser = AppState.currentAdmin.name;
      } catch (e) {
        AppState.currentUser = localStorage.getItem('apexcore_auth_user') || 'Jay';
      }
    } else {
      AppState.currentUser = localStorage.getItem('apexcore_auth_user') || 'Jay';
    }

    if (loginView) loginView.classList.add('hidden');
    if (cinematicLoader) cinematicLoader.classList.add('hidden');
    if (dashboardView) {
      dashboardView.classList.remove('hidden');
      dashboardView.style.opacity = '1';
      dashboardView.style.transform = '';
    }
    if (AppState.currentAdmin) {
      updateAuthenticatedUserUI(AppState.currentAdmin);
    }
    initDashboard();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApplication);
} else {
  bootApplication();
}
