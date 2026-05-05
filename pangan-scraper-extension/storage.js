// ===========================================================================
// PanganScraper — Local Storage Manager
// Manages CapturedPrice items in chrome.storage.local (staging area)
// Nothing goes to Supabase until user explicitly accepts
// ===========================================================================

/**
 * @typedef {Object} CapturedPrice
 * @property {string} id - UUID
 * @property {string} commodity - AI-extracted commodity name
 * @property {number} price - Rp (normalized, actual value)
 * @property {string} unit - "kg" | "ikat" | "pack" | "butir" | "liter"
 * @property {string} city - AI-extracted location
 * @property {number} confidence - 0-1 from Gemini
 * @property {"pending"|"accepted"|"rejected"} status
 * @property {string} sourceSnippet - first 200 chars of FB post
 * @property {string} [sourceUrl] - FB post permalink
 * @property {string} capturedAt - ISO timestamp
 * @property {string[]} matchedKeywords - which keywords triggered this capture
 */

/** Generate a simple UUID v4 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Get all captured prices from local storage
 * @returns {Promise<CapturedPrice[]>}
 */
async function getAllCaptures() {
  const result = await chrome.storage.local.get('captures');
  return result.captures || [];
}

/**
 * Get only pending captures (awaiting user review)
 * @returns {Promise<CapturedPrice[]>}
 */
async function getPendingCaptures() {
  const all = await getAllCaptures();
  return all.filter(c => c.status === 'pending');
}

/**
 * Get today's capture stats
 * @returns {Promise<{total: number, pending: number, accepted: number, rejected: number}>}
 */
async function getTodayStats() {
  const all = await getAllCaptures();
  const today = new Date().toISOString().slice(0, 10);
  const todayCaptures = all.filter(c => c.capturedAt.startsWith(today));

  return {
    total: todayCaptures.length,
    pending: todayCaptures.filter(c => c.status === 'pending').length,
    accepted: todayCaptures.filter(c => c.status === 'accepted').length,
    rejected: todayCaptures.filter(c => c.status === 'rejected').length
  };
}

/**
 * Add a new captured price to local storage
 * Deduplicates by (commodity + city + date)
 * @param {Omit<CapturedPrice, 'id'|'status'|'capturedAt'>} priceData
 * @returns {Promise<CapturedPrice|null>} null if duplicate
 */
async function addCapture(priceData) {
  const all = await getAllCaptures();
  const today = new Date().toISOString().slice(0, 10);

  // Dedup check: same commodity + city + date
  const isDuplicate = all.some(c =>
    c.commodity.toLowerCase() === priceData.commodity.toLowerCase() &&
    c.city.toLowerCase() === priceData.city.toLowerCase() &&
    c.capturedAt.startsWith(today) &&
    c.status !== 'rejected'
  );

  if (isDuplicate) {
    console.log(`[PanganScraper] Duplicate skipped: ${priceData.commodity} in ${priceData.city}`);
    return null;
  }

  const capture = {
    id: generateId(),
    ...priceData,
    status: 'pending',
    capturedAt: new Date().toISOString()
  };

  all.push(capture);
  await chrome.storage.local.set({ captures: all });

  // Update badge
  await updateBadge();

  console.log(`[PanganScraper] Captured: ${capture.commodity} Rp ${capture.price}/${capture.unit} (${capture.city})`);
  return capture;
}

/**
 * Update a capture's status
 * @param {string} id
 * @param {"accepted"|"rejected"} status
 * @param {Partial<CapturedPrice>} [edits] - optional field edits before accepting
 * @returns {Promise<CapturedPrice|null>}
 */
async function updateCaptureStatus(id, status, edits = {}) {
  const all = await getAllCaptures();
  const index = all.findIndex(c => c.id === id);
  if (index === -1) return null;

  // Apply edits (user may fix price, city, commodity)
  if (edits.commodity) all[index].commodity = edits.commodity;
  if (edits.price) all[index].price = edits.price;
  if (edits.unit) all[index].unit = edits.unit;
  if (edits.city) all[index].city = edits.city;

  all[index].status = status;
  await chrome.storage.local.set({ captures: all });
  await updateBadge();

  return all[index];
}

/**
 * Accept all pending captures at once
 * @returns {Promise<CapturedPrice[]>} accepted items
 */
async function acceptAllPending() {
  const all = await getAllCaptures();
  const accepted = [];

  for (const capture of all) {
    if (capture.status === 'pending') {
      capture.status = 'accepted';
      accepted.push(capture);
    }
  }

  await chrome.storage.local.set({ captures: all });
  await updateBadge();
  return accepted;
}

/**
 * Reject all pending captures at once
 * @returns {Promise<number>} count of rejected items
 */
async function rejectAllPending() {
  const all = await getAllCaptures();
  let count = 0;

  for (const capture of all) {
    if (capture.status === 'pending') {
      capture.status = 'rejected';
      count++;
    }
  }

  await chrome.storage.local.set({ captures: all });
  await updateBadge();
  return count;
}

/**
 * Clean up old captures (older than 7 days)
 * Keeps accepted for history, removes rejected
 */
async function cleanupOldCaptures() {
  const all = await getAllCaptures();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString();

  const filtered = all.filter(c => {
    if (c.capturedAt > cutoffStr) return true;
    // Keep accepted history, remove rejected and old pending
    return c.status === 'accepted';
  });

  await chrome.storage.local.set({ captures: filtered });
}

/**
 * Update extension badge with pending count
 */
async function updateBadge() {
  const pending = await getPendingCaptures();
  const count = pending.length;

  if (count > 0) {
    await chrome.action.setBadgeText({ text: String(count) });
    await chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' }); // amber
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined') {
  module.exports = {
    generateId, getAllCaptures, getPendingCaptures, getTodayStats,
    addCapture, updateCaptureStatus, acceptAllPending, rejectAllPending,
    cleanupOldCaptures, updateBadge
  };
}
