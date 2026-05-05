// ===========================================================================
// PanganScraper — Keyword Configuration
// Manages preset categories and custom user keywords for commodity detection
// ===========================================================================

/**
 * @typedef {Object} KeywordConfig
 * @property {Object} presets - Preset keyword categories (toggleable)
 * @property {string[]} custom - User-added custom keywords
 * @property {string[]} negative - Words that disqualify a post
 * @property {string[]} contextHints - Must match ≥1 alongside commodity keyword
 * @property {Object} priceRanges - Min/max sane price per commodity (Rp)
 */

/** Default keyword configuration */
const DEFAULT_KEYWORDS = {
  presets: {
    BUMBU: {
      enabled: true,
      keywords: [
        'cabai', 'cabe', 'rawit', 'cabai rawit', 'cabai merah',
        'bawang merah', 'bawang putih', 'bamer', 'baput',
        'jahe', 'kunyit', 'lengkuas', 'sereh', 'kemiri',
        'ketumbar', 'merica', 'lada'
      ]
    },
    POKOK: {
      enabled: true,
      keywords: [
        'beras', 'beras medium', 'beras premium',
        'gula', 'gula pasir',
        'minyak goreng', 'minyakita', 'migor',
        'tepung terigu', 'tepung',
        'garam', 'garam halus'
      ]
    },
    PROTEIN: {
      enabled: true,
      keywords: [
        'daging sapi', 'daging ayam', 'ayam ras',
        'telur', 'telor', 'telur ayam',
        'ikan', 'ikan kembung', 'ikan tongkol', 'ikan bandeng',
        'udang', 'cumi', 'lele', 'nila', 'gurame'
      ]
    },
    SAYUR: {
      enabled: false,
      keywords: [
        'tomat', 'kentang', 'wortel', 'kangkung', 'bayam',
        'brokoli', 'kol', 'kubis', 'sawi', 'terong',
        'timun', 'mentimun', 'labu', 'pare'
      ]
    },
    BUAH: {
      enabled: false,
      keywords: [
        'jeruk', 'apel', 'pisang', 'mangga', 'semangka',
        'pepaya', 'melon', 'alpukat', 'anggur', 'nanas',
        'durian', 'rambutan', 'salak', 'kelapa'
      ]
    }
  },

  custom: [],

  negative: [
    'resep', 'masak', 'cara masak', 'tutorial',
    'diet', 'review', 'promo', 'diskon', 'cashback',
    'gratis ongkir', 'flash sale', 'giveaway',
    'meme', 'lucu', 'viral'
  ],

  contextHints: [
    'harga', 'jual', 'ready', 'stok', 'stock',
    '/kg', 'per kg', 'per kilo',
    '/ikat', 'per ikat',
    '/pack', 'per pack',
    'grosir', 'ecer', 'partai',
    'rb', 'ribu', 'rp',
    'murah', 'mahal', 'naik', 'turun',
    'hari ini', 'update harga'
  ],

  priceRanges: {
    'beras':        { min: 8000,   max: 25000  },
    'gula':         { min: 12000,  max: 25000  },
    'minyak goreng':{ min: 12000,  max: 25000  },
    'tepung terigu':{ min: 8000,   max: 18000  },
    'cabai':        { min: 15000,  max: 120000 },
    'bawang merah': { min: 20000,  max: 80000  },
    'bawang putih': { min: 25000,  max: 80000  },
    'daging sapi':  { min: 100000, max: 200000 },
    'daging ayam':  { min: 25000,  max: 50000  },
    'telur':        { min: 22000,  max: 35000  },
    'ikan':         { min: 20000,  max: 60000  },
    'garam':        { min: 3000,   max: 15000  },
    '_default':     { min: 1000,   max: 500000 }
  }
};

/**
 * Get the full keyword config from chrome.storage.local
 * Falls back to DEFAULT_KEYWORDS on first run
 * @returns {Promise<KeywordConfig>}
 */
async function getKeywordConfig() {
  const result = await chrome.storage.local.get('keywordConfig');
  if (result.keywordConfig) {
    return result.keywordConfig;
  }
  // First run — save defaults
  await chrome.storage.local.set({ keywordConfig: DEFAULT_KEYWORDS });
  return DEFAULT_KEYWORDS;
}

/**
 * Save keyword config to chrome.storage.local
 * @param {KeywordConfig} config
 */
async function saveKeywordConfig(config) {
  await chrome.storage.local.set({ keywordConfig: config });
}

/**
 * Get all active keywords (enabled presets + custom)
 * @returns {Promise<string[]>}
 */
async function getActiveKeywords() {
  const config = await getKeywordConfig();
  const keywords = [];

  // Collect enabled preset keywords
  for (const [, category] of Object.entries(config.presets)) {
    if (category.enabled) {
      keywords.push(...category.keywords);
    }
  }

  // Add custom keywords
  keywords.push(...config.custom);

  return keywords;
}

/**
 * Check if a post text matches our keyword rules
 * Rule: ≥1 commodity keyword + ≥1 context hint + 0 negative keywords
 * @param {string} text - Post text to check
 * @param {KeywordConfig} config - Keyword configuration
 * @returns {{ matched: boolean, matchedKeywords: string[], matchedHints: string[] }}
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
  allKeywords.push(...config.custom);

  // Find matching commodity keywords
  const matchedKeywords = allKeywords.filter(kw =>
    lowerText.includes(kw.toLowerCase())
  );

  if (matchedKeywords.length === 0) {
    return { matched: false, matchedKeywords: [], matchedHints: [] };
  }

  // Find matching context hints
  const matchedHints = config.contextHints.filter(hint =>
    lowerText.includes(hint.toLowerCase())
  );

  if (matchedHints.length === 0) {
    return { matched: false, matchedKeywords, matchedHints: [] };
  }

  return { matched: true, matchedKeywords, matchedHints };
}

// Export for use in other modules
if (typeof module !== 'undefined') {
  module.exports = { DEFAULT_KEYWORDS, getKeywordConfig, saveKeywordConfig, getActiveKeywords, matchPost };
}
