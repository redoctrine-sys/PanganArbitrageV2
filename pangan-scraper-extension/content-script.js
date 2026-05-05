// ===========================================================================
// PanganScraper — Content Script
// Runs on Facebook pages. Watches feed for posts matching commodity keywords.
// Stage 1: Keyword trigger (local, $0) → sends matched posts to background.js
// ===========================================================================

(function () {
  'use strict';

  const SCRAPER_ATTR = 'data-pangan-scraped';
  const MIN_POST_LENGTH = 20;
  const MAX_POST_LENGTH = 3000;
  const DEBOUNCE_MS = 1000;

  let isEnabled = true;
  let keywordConfig = null;
  let debounceTimer = null;

  // ─── Init ──────────────────────────────────────────────────────────
  async function init() {
    // Load extension state
    const state = await chrome.storage.local.get(['extensionEnabled', 'keywordConfig']);
    isEnabled = state.extensionEnabled !== false; // default ON
    keywordConfig = state.keywordConfig || null;

    if (!isEnabled) {
      console.log('[PanganScraper] Extension disabled, not scanning.');
      return;
    }

    if (!keywordConfig) {
      // Request defaults from background
      chrome.runtime.sendMessage({ type: 'GET_KEYWORD_CONFIG' }, (response) => {
        if (response && response.config) {
          keywordConfig = response.config;
          startObserving();
        }
      });
    } else {
      startObserving();
    }

    // Listen for config changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.extensionEnabled) {
        isEnabled = changes.extensionEnabled.newValue;
        if (!isEnabled) {
          console.log('[PanganScraper] Disabled via popup.');
        }
      }
      if (changes.keywordConfig) {
        keywordConfig = changes.keywordConfig.newValue;
        console.log('[PanganScraper] Keywords updated.');
      }
    });
  }

  // ─── Feed Observer ─────────────────────────────────────────────────
  function startObserving() {
    console.log('[PanganScraper] Watching Facebook feed for commodity prices...');

    // Scan existing posts
    scanVisiblePosts();

    // Watch for new posts (infinite scroll)
    const observer = new MutationObserver(() => {
      if (!isEnabled || !keywordConfig) return;

      // Debounce to avoid scanning too frequently
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => scanVisiblePosts(), DEBOUNCE_MS);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ─── Post Scanner ──────────────────────────────────────────────────
  function scanVisiblePosts() {
    if (!isEnabled || !keywordConfig) return;

    // Facebook post selectors (may need updating as FB changes DOM)
    const postSelectors = [
      '[data-ad-comet-preview="message"]',   // Post text container
      '[data-ad-preview="message"]',          // Alternative
      'div[dir="auto"]',                       // Generic text blocks
    ];

    for (const selector of postSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        processElement(el);
      }
    }
  }

  /**
   * Process a single DOM element as potential price post
   * @param {HTMLElement} el
   */
  function processElement(el) {
    // Skip already-processed elements
    if (el.hasAttribute(SCRAPER_ATTR)) return;

    const text = el.textContent?.trim();
    if (!text || text.length < MIN_POST_LENGTH || text.length > MAX_POST_LENGTH) return;

    // Mark as processed (even if no match)
    el.setAttribute(SCRAPER_ATTR, 'true');

    // Stage 1: Keyword matching
    const matchResult = matchPost(text, keywordConfig);

    if (!matchResult.matched) return;

    console.log(
      `[PanganScraper] ✅ Match found! Keywords: [${matchResult.matchedKeywords.join(', ')}], ` +
      `Hints: [${matchResult.matchedHints.join(', ')}]`
    );

    // Try to get the post URL
    const postUrl = findPostUrl(el);

    // Send to background for Gemini extraction (Stage 2)
    chrome.runtime.sendMessage({
      type: 'PROCESS_POST',
      data: {
        text: text.slice(0, MAX_POST_LENGTH),
        url: postUrl,
        matchedKeywords: matchResult.matchedKeywords,
        matchedHints: matchResult.matchedHints,
        timestamp: new Date().toISOString()
      }
    });
  }

  // ─── Keyword Matching (Stage 1) ────────────────────────────────────
  /**
   * Check if post text matches keyword rules
   * Rule: ≥1 commodity keyword + ≥1 context hint + 0 negative keywords
   */
  function matchPost(text, config) {
    const lowerText = text.toLowerCase();

    // Check negative keywords first (early exit)
    for (const neg of config.negative) {
      if (lowerText.includes(neg.toLowerCase())) {
        return { matched: false, matchedKeywords: [], matchedHints: [] };
      }
    }

    // Collect all active commodity keywords
    const allKeywords = [];
    for (const [, category] of Object.entries(config.presets)) {
      if (category.enabled) {
        allKeywords.push(...category.keywords);
      }
    }
    allKeywords.push(...(config.custom || []));

    // Find matching commodity keywords
    const matchedKeywords = allKeywords.filter(kw =>
      lowerText.includes(kw.toLowerCase())
    );

    if (matchedKeywords.length === 0) {
      return { matched: false, matchedKeywords: [], matchedHints: [] };
    }

    // Find matching context hints
    const matchedHints = (config.contextHints || []).filter(hint =>
      lowerText.includes(hint.toLowerCase())
    );

    if (matchedHints.length === 0) {
      return { matched: false, matchedKeywords, matchedHints: [] };
    }

    return { matched: true, matchedKeywords, matchedHints };
  }

  // ─── Utility ───────────────────────────────────────────────────────
  /**
   * Try to find the permalink for a Facebook post
   * @param {HTMLElement} el
   * @returns {string|null}
   */
  function findPostUrl(el) {
    // Walk up to find a post container with a permalink
    let container = el;
    for (let i = 0; i < 15; i++) {
      if (!container.parentElement) break;
      container = container.parentElement;

      // Look for timestamp links (usually the permalink)
      const links = container.querySelectorAll('a[href*="/posts/"], a[href*="/permalink/"], a[href*="story_fbid"]');
      if (links.length > 0) {
        return links[0].href;
      }
    }
    return null;
  }

  // ─── Start ─────────────────────────────────────────────────────────
  init();
})();
