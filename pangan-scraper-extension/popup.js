// ===========================================================================
// PanganScraper — Popup Logic
// Manages review queue, keyword settings, and push-to-Supabase flow
// ===========================================================================

document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadStats();
  await loadReviewQueue();
  await loadKeywords();
  await loadSettings();
  bindEvents();
}

// ─── Stats ───────────────────────────────────────────────────────────
async function loadStats() {
  const result = await chrome.storage.local.get('captures');
  const all = result.captures || [];
  const today = new Date().toISOString().slice(0, 10);
  const todayCaptures = all.filter(c => c.capturedAt.startsWith(today));

  document.getElementById('statTotal').textContent = todayCaptures.length;
  document.getElementById('statAccepted').textContent = todayCaptures.filter(c => c.status === 'accepted').length;
  document.getElementById('statRejected').textContent = todayCaptures.filter(c => c.status === 'rejected').length;
  document.getElementById('statPending').textContent = todayCaptures.filter(c => c.status === 'pending').length;
}

// ─── Review Queue ────────────────────────────────────────────────────
async function loadReviewQueue() {
  const result = await chrome.storage.local.get('captures');
  const all = result.captures || [];
  const pending = all.filter(c => c.status === 'pending');

  const container = document.getElementById('reviewQueue');
  const countEl = document.getElementById('pendingCount');
  const bulkEl = document.getElementById('bulkActions');

  countEl.textContent = `(${pending.length} pending)`;

  if (pending.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">✅</div>
        No pending captures. Browse Facebook groups to start collecting prices.
      </div>`;
    bulkEl.style.display = 'none';
    return;
  }

  bulkEl.style.display = 'flex';
  container.innerHTML = pending.map(capture => `
    <div class="capture-item" data-id="${capture.id}">
      <div class="capture-header">
        <span class="capture-commodity">${escapeHtml(capture.commodity)}</span>
        <span class="capture-confidence ${getConfClass(capture.confidence)}">
          ${(capture.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <div class="capture-details">
        <span class="capture-price">Rp ${formatPrice(capture.price)}</span>
        / ${escapeHtml(capture.unit)} · 📍 ${escapeHtml(capture.city)}
      </div>
      <div class="capture-snippet">"${escapeHtml(capture.sourceSnippet)}"</div>
      <div class="capture-actions">
        <button class="btn btn-accept" onclick="acceptCapture('${capture.id}')">✅ Accept</button>
        <button class="btn btn-edit" onclick="editCapture('${capture.id}')">✏️ Edit</button>
        <button class="btn btn-reject" onclick="rejectCapture('${capture.id}')">❌ Reject</button>
      </div>
    </div>
  `).join('');
}

// ─── Accept / Reject / Edit ──────────────────────────────────────────
async function acceptCapture(id) {
  const result = await chrome.storage.local.get('captures');
  const all = result.captures || [];
  const index = all.findIndex(c => c.id === id);
  if (index === -1) return;

  all[index].status = 'accepted';
  await chrome.storage.local.set({ captures: all });

  // Push this single capture to Supabase
  await pushCapturesToSupabase([all[index]]);

  await refresh();
}

async function rejectCapture(id) {
  const result = await chrome.storage.local.get('captures');
  const all = result.captures || [];
  const index = all.findIndex(c => c.id === id);
  if (index === -1) return;

  all[index].status = 'rejected';
  await chrome.storage.local.set({ captures: all });
  await refresh();
}

// Make functions available to inline onclick handlers
window.acceptCapture = acceptCapture;
window.rejectCapture = rejectCapture;

function editCapture(id) {
  const result = chrome.storage.local.get('captures').then(res => {
    const all = res.captures || [];
    const capture = all.find(c => c.id === id);
    if (!capture) return;

    document.getElementById('editId').value = capture.id;
    document.getElementById('editCommodity').value = capture.commodity;
    document.getElementById('editPrice').value = capture.price;
    document.getElementById('editUnit').value = capture.unit;
    document.getElementById('editCity').value = capture.city;
    document.getElementById('editModal').classList.add('show');
  });
}
window.editCapture = editCapture;

// ─── Push to Supabase ────────────────────────────────────────────────
async function pushCapturesToSupabase(captures) {
  const settings = await chrome.storage.local.get('apiUrl');
  const apiUrl = settings.apiUrl;

  if (!apiUrl) {
    console.warn('[PanganScraper] No API URL configured. Set it in Settings.');
    return;
  }

  chrome.runtime.sendMessage({
    type: 'PUSH_TO_SUPABASE',
    data: { captures, apiUrl }
  });
}

// ─── Bulk Actions ────────────────────────────────────────────────────
async function acceptAll() {
  const result = await chrome.storage.local.get('captures');
  const all = result.captures || [];
  const accepted = [];

  for (const c of all) {
    if (c.status === 'pending') {
      c.status = 'accepted';
      accepted.push(c);
    }
  }

  await chrome.storage.local.set({ captures: all });
  if (accepted.length > 0) {
    await pushCapturesToSupabase(accepted);
  }
  await refresh();
}

async function rejectAll() {
  const result = await chrome.storage.local.get('captures');
  const all = result.captures || [];
  for (const c of all) {
    if (c.status === 'pending') c.status = 'rejected';
  }
  await chrome.storage.local.set({ captures: all });
  await refresh();
}

// ─── Keywords ────────────────────────────────────────────────────────
async function loadKeywords() {
  const result = await chrome.storage.local.get('keywordConfig');
  const config = result.keywordConfig;
  if (!config) return;

  // Preset pills
  const pillContainer = document.getElementById('presetPills');
  pillContainer.innerHTML = Object.entries(config.presets).map(([name, cat]) => `
    <div class="pill ${cat.enabled ? 'active' : ''}" data-preset="${name}">
      ${cat.enabled ? '✅' : '☐'} ${name}
    </div>
  `).join('');

  // Custom keywords
  const kwContainer = document.getElementById('customKeywords');
  kwContainer.innerHTML = (config.custom || []).map(kw => `
    <span class="kw-tag">
      ${escapeHtml(kw)}
      <span class="remove" data-keyword="${escapeHtml(kw)}">×</span>
    </span>
  `).join('');
}

async function togglePreset(presetName) {
  const result = await chrome.storage.local.get('keywordConfig');
  const config = result.keywordConfig;
  if (!config || !config.presets[presetName]) return;

  config.presets[presetName].enabled = !config.presets[presetName].enabled;
  await chrome.storage.local.set({ keywordConfig: config });
  await loadKeywords();
}

async function addCustomKeyword() {
  const input = document.getElementById('newKeyword');
  const keyword = input.value.trim().toLowerCase();
  if (!keyword) return;

  const result = await chrome.storage.local.get('keywordConfig');
  const config = result.keywordConfig;
  if (!config) return;

  if (!config.custom.includes(keyword)) {
    config.custom.push(keyword);
    await chrome.storage.local.set({ keywordConfig: config });
  }

  input.value = '';
  await loadKeywords();
}

async function removeCustomKeyword(keyword) {
  const result = await chrome.storage.local.get('keywordConfig');
  const config = result.keywordConfig;
  if (!config) return;

  config.custom = config.custom.filter(k => k !== keyword);
  await chrome.storage.local.set({ keywordConfig: config });
  await loadKeywords();
}

// ─── Settings ────────────────────────────────────────────────────────
async function loadSettings() {
  const result = await chrome.storage.local.get(['geminiApiKey', 'apiUrl', 'extensionEnabled']);

  if (result.geminiApiKey) {
    document.getElementById('geminiKey').value = '••••••••••';
  }
  if (result.apiUrl) {
    document.getElementById('apiUrl').value = result.apiUrl;
  }

  const enabled = result.extensionEnabled !== false;
  updateToggleButton(enabled);
}

function updateToggleButton(enabled) {
  const btn = document.getElementById('toggleBtn');
  btn.textContent = enabled ? 'ON' : 'OFF';
  btn.classList.toggle('off', !enabled);
}

// ─── Event Bindings ──────────────────────────────────────────────────
function bindEvents() {
  // Toggle
  document.getElementById('toggleBtn').addEventListener('click', async () => {
    const result = await chrome.storage.local.get('extensionEnabled');
    const newState = result.extensionEnabled === false ? true : false;
    await chrome.storage.local.set({ extensionEnabled: newState });
    updateToggleButton(newState);
  });

  // Bulk actions
  document.getElementById('acceptAllBtn').addEventListener('click', acceptAll);
  document.getElementById('rejectAllBtn').addEventListener('click', rejectAll);

  // Preset pills
  document.getElementById('presetPills').addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (pill) togglePreset(pill.dataset.preset);
  });

  // Custom keyword remove
  document.getElementById('customKeywords').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove')) {
      removeCustomKeyword(e.target.dataset.keyword);
    }
  });

  // Add keyword
  document.getElementById('addKeywordBtn').addEventListener('click', addCustomKeyword);
  document.getElementById('newKeyword').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCustomKeyword();
  });

  // Save Gemini key
  document.getElementById('saveGeminiKey').addEventListener('click', async () => {
    const key = document.getElementById('geminiKey').value;
    if (key && !key.startsWith('••')) {
      await chrome.storage.local.set({ geminiApiKey: key });
      document.getElementById('geminiKey').value = '••••••••••';
    }
  });

  // Save API URL
  document.getElementById('saveApiUrl').addEventListener('click', async () => {
    const url = document.getElementById('apiUrl').value.trim().replace(/\/$/, '');
    await chrome.storage.local.set({ apiUrl: url });
  });

  // Edit modal
  document.getElementById('editCancel').addEventListener('click', () => {
    document.getElementById('editModal').classList.remove('show');
  });

  document.getElementById('editSave').addEventListener('click', async () => {
    const id = document.getElementById('editId').value;
    const edits = {
      commodity: document.getElementById('editCommodity').value,
      price: Number(document.getElementById('editPrice').value),
      unit: document.getElementById('editUnit').value,
      city: document.getElementById('editCity').value
    };

    const result = await chrome.storage.local.get('captures');
    const all = result.captures || [];
    const index = all.findIndex(c => c.id === id);
    if (index !== -1) {
      Object.assign(all[index], edits);
      all[index].status = 'accepted';
      await chrome.storage.local.set({ captures: all });
      await pushCapturesToSupabase([all[index]]);
    }

    document.getElementById('editModal').classList.remove('show');
    await refresh();
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────
async function refresh() {
  await loadStats();
  await loadReviewQueue();
  // Update badge
  const result = await chrome.storage.local.get('captures');
  const pending = (result.captures || []).filter(c => c.status === 'pending');
  if (pending.length > 0) {
    await chrome.action.setBadgeText({ text: String(pending.length) });
    await chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

function formatPrice(price) {
  return new Intl.NumberFormat('id-ID').format(price);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getConfClass(confidence) {
  if (confidence >= 0.85) return 'conf-high';
  if (confidence >= 0.7) return 'conf-med';
  return 'conf-low';
}
