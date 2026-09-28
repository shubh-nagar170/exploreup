/**
 * ExploreUP Professional Multilingual / Internationalization (i18n) Engine
 * Supports 22 major Indian & international languages with RTL handling,
 * dynamic key translation, persistent local storage, and AI context injection.
 */
(function(window, document) {
  'use strict';

  const STORAGE_KEY = 'exploreup_language';

  // 22 Supported Languages Metadata
  const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', dir: 'ltr' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', dir: 'ltr' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', dir: 'ltr' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', dir: 'ltr' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी', dir: 'ltr' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', dir: 'ltr' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', dir: 'ltr' },
    { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', dir: 'ltr' },
    { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', dir: 'ltr' },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', dir: 'rtl' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', dir: 'ltr' },
    { code: 'zh', name: 'Chinese', nativeName: '中文', dir: 'ltr' },
    { code: 'ko', name: 'Korean', nativeName: '한국어', dir: 'ltr' },
    { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', dir: 'ltr' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', dir: 'ltr' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl' }
  ];

  // Multilingual City Aliases for Smart Search
  const CITY_ALIASES = {
    agra: ['agra', 'आगरा', 'ताजनगरी', 'ఆగ్రా', 'ஆக்ரா', 'ಆಗ್ರಾ', 'ആഗ്ര', 'आग्रा', 'আগ্রা', 'આગ્રા', 'ਆਗਰਾ', 'ଆଗ୍ରା', 'آگرہ', 'アグラ', 'アーグラ', '阿格拉', '아그라', 'أغرة', 'أجرا', 'Агра'],
    varanasi: ['varanasi', 'banaras', 'kashi', 'वाराणसी', 'बनारस', 'काशी', 'వారణాసి', 'కాశీ', 'బనారస్', 'வாரணாசி', 'காசி', 'ವಾರಣಾಸಿ', 'വാരാണസി', 'বারাণসী', 'વારાણસી', 'ਵਾਰਾਣਸੀ', 'ବାରାଣସୀ', 'وارانسی', 'بنارس', 'کاشی', 'バラナシ', 'ヴァーラーナシー', '瓦拉纳西', '바라나시', 'فاراناسي', 'بنارس', 'Варанаси'],
    lucknow: ['lucknow', 'लखनऊ', 'ਨਵਾਬਾਂ ਦਾ ਸ਼ਹਿਰ', 'లక్నో', 'லக்னோ', 'ಲಖನೌ', 'ലഖ്‌നൗ', 'लखनौ', 'লখনউ', 'લખનૌ', 'ਲਖਨਊ', 'ଲକ୍ଷ୍ନୌ', 'لکھنؤ', 'ラクナウ', '勒克瑙', '러크나우', 'لكناو', 'Лакхнау'],
    ayodhya: ['ayodhya', 'अयोध्या', 'राम जन्मभूमि', 'అయోధ్య', 'அயோத்தி', 'ಅಯೋಧ್ಯೆ', 'അയോധ്യ', 'অযোধ্যা', 'અયોધ્યા', 'ਅਯੁੱਧਿਆ', 'ଅଯୋଧ୍ୟା', 'ایودھیا', 'アヨーディヤー', '阿约提亚', '아야디야', '아요디아', 'أيوديا', 'Айодхья'],
    mathura: ['mathura', 'मथुरा', 'కృష్ణ జన్మభూమి', 'మథుర', 'மதுரா', 'ಮಥುರಾ', 'മഥുര', 'মথুরা', 'મથુરા', 'ਮਥੁਰਾ', 'ମଥୁରା', 'متھرا', 'マトゥラー', '马图拉', '마투라', 'ماثورا', 'Матхура'],
    prayagraj: ['prayagraj', 'allahabad', 'प्रयागराज', 'इलाहाबाद', 'त्रिवेणी संगम', 'ప్రయాగ్‌రాజ్', 'பிரயாக்ராஜ்', 'ಪ್ರಯಾಗ್‌ರಾಜ್', 'പ്രയാഗ്‌രാജ്', 'প্রয়াগরাজ', 'પ્રયાગરાજ', 'ਪ੍ਰਯਾਗਰਾਜ', 'ପ୍ରୟାଗରାଜ', 'پریاگ راج', 'プラヤグラージ', '普拉亚格拉吉', '프라야그라지', 'براياغراج', 'Праяградж'],
    kanpur: ['kanpur', 'कानपुर', 'కాన్పూర్', 'கான்பூர்', 'ಕಾನ್ಪುರ', 'കാൺപൂർ', 'কানপুর', 'કાનપુર', 'ਕਾਨਪੁਰ', 'କାନପୁର', 'کانپور', 'カーンプル', '坎普尔', '칸푸르', 'كانبور', 'Канпур'],
    jhansi: ['jhansi', 'झांसी', 'झाँसी', 'ఝాన్సీ', 'ஜான்சி', 'ಝಾನ್ಸಿ', 'ഝാൻസി', 'ঝাঁসি', 'ઝાંસી', 'ਝਾਂਸੀ', 'ଝାଁସୀ', 'جھانسی', 'ジャーンシー', '占西', '잔시', 'جهانسي', 'Джханси'],
    chitrakoot: ['chitrakoot', 'चित्रकूट', 'చిత్రకూట్', 'சித்ரகூட்', 'ಚಿತ್ರಕೂಟ', 'ചിത്രകൂട്', 'চিত্রকূট', 'ચિત્રકૂટ', 'ਚਿੱਤਰਕੂਟ', 'ଚିତ୍ରକୂଟ', 'چترکوٹ', 'チトラクート', '奇特拉库特', '치트라쿠트', 'تشيتراكوت', 'Читракут'],
    vrindavan: ['vrindavan', 'वृन्दावन', 'वृंदावन', 'బృందావనం', 'பிருந்தாவனம்', 'ಬೃಂದಾವನ', 'വൃന്ദാവനം', 'বৃন্দাবন', 'વૃંદાવન', 'ਵ੍ਰਿੰਦਾਵਨ', 'ବୃନ୍ଦାବନ', 'ورنداون', 'ヴリンダーヴァン', '温达文', '브린다반', 'فريندافان', 'Вриндаван']
  };

  // Cache for loaded translations
  const translations = {};
  let currentLang = 'en';

  // Get saved language or fallback
  function getSavedLanguage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || (window.exploreStorage ? window.exploreStorage.get('exploreup_lang') : null);
      if (saved && SUPPORTED_LANGUAGES.some(l => l.code === saved)) {
        return saved;
      }
    } catch (e) {
      console.warn('[i18n] Storage access error:', e);
    }
    return 'en';
  }

  // Save selected language
  function saveLanguage(code) {
    try {
      localStorage.setItem(STORAGE_KEY, code);
      if (window.exploreStorage) {
        window.exploreStorage.set('exploreup_lang', code);
      }
    } catch (e) {
      console.warn('[i18n] Storage write error:', e);
    }
  }

  // Load language dictionary JSON
  async function loadLocale(code) {
    if (translations[code]) {
      return translations[code];
    }
    try {
      const res = await fetch(`/locales/${code}.json`);
      if (res.ok) {
        const data = await res.json();
        translations[code] = data;
        return data;
      }
    } catch (e) {
      console.warn(`[i18n] Failed to fetch /locales/${code}.json:`, e);
    }
    // Return English if available, or empty object
    return translations['en'] || {};
  }

  // Resolve nested dot-notation key
  function getNestedValue(obj, keyPath) {
    if (!obj || !keyPath) return null;
    const parts = keyPath.split('.');
    let curr = obj;
    for (const part of parts) {
      if (curr === undefined || curr === null) return null;
      curr = curr[part];
    }
    return curr;
  }

  // Translation function with English fallback
  function t(key, fallback) {
    if (!key) return '';
    // 1. Try current language
    let val = getNestedValue(translations[currentLang], key);
    if (typeof val === 'string' && val.trim() !== '') {
      return val;
    }
    // 2. Try English fallback
    val = getNestedValue(translations['en'], key);
    if (typeof val === 'string' && val.trim() !== '') {
      return val;
    }
    // 3. Use provided fallback or key
    if (fallback !== undefined && fallback !== null) {
      return String(fallback);
    }
    return key;
  }

  // Apply translations to the DOM
  function applyTranslations() {
    const langMeta = SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

    // 1. Document attributes and direction
    document.documentElement.lang = currentLang;
    document.documentElement.dir = langMeta.dir || 'ltr';
    if (langMeta.dir === 'rtl') {
      document.body.classList.add('rtl');
    } else {
      document.body.classList.remove('rtl');
    }

    // 2. Translate text nodes [data-i18n]
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        const translated = t(key);
        if (translated) {
          if (el.hasAttribute('data-i18n-html')) {
            el.innerHTML = translated;
          } else {
            el.textContent = translated;
          }
        }
      }
    });

    // 3. Placeholders [data-i18n-placeholder]
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.setAttribute('placeholder', t(key));
      }
    });

    // 4. Titles [data-i18n-title]
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.setAttribute('title', t(key));
      }
    });

    // 5. Aria Labels [data-i18n-aria]
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) {
        el.setAttribute('aria-label', t(key));
      }
    });

    // 6. Dynamic Drawer Language Sync
    syncDrawerLangUI();

    // 7. Dispatch language change event for other components (Arya, Trip Planner, etc.)
    window.dispatchEvent(new CustomEvent('exploreup:languagechange', {
      detail: { lang: currentLang, meta: langMeta }
    }));
  }

  // Synchronize the drawer language item
  function syncDrawerLangUI() {
    const badge = document.getElementById('drawerLangBadge');
    const sub = document.getElementById('drawerLangSubtitle');
    const langMeta = SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

    if (badge) {
      badge.textContent = `${langMeta.nativeName} (Active)`;
    }
    if (sub) {
      sub.textContent = `${langMeta.name} • Tap to change`;
    }
  }

  // Set new language
  async function setLanguage(code) {
    if (!SUPPORTED_LANGUAGES.some(l => l.code === code)) {
      console.warn(`[i18n] Language "${code}" is not supported.`);
      return;
    }

    currentLang = code;
    saveLanguage(code);

    // Ensure English is loaded for fallbacks
    if (!translations['en']) {
      await loadLocale('en');
    }

    // Load target language
    await loadLocale(code);

    // Apply translations
    applyTranslations();

    // Close language modal if open
    closeLanguageModal();
  }

  // Smart search matcher for multilingual inputs
  function matchCityMultilingual(query) {
    if (!query) return null;
    const cleanQ = query.trim().toLowerCase();
    for (const [cityKey, aliases] of Object.entries(CITY_ALIASES)) {
      for (const alias of aliases) {
        if (cleanQ === alias.toLowerCase() || cleanQ.includes(alias.toLowerCase()) || alias.toLowerCase().includes(cleanQ)) {
          return cityKey;
        }
      }
    }
    return null;
  }

  // Format numbers in locale
  function formatNumber(num) {
    try {
      return new Intl.NumberFormat(currentLang).format(num);
    } catch (e) {
      return String(num);
    }
  }

  // Format dates in locale
  function formatDate(date, options) {
    try {
      return new Intl.DateTimeFormat(currentLang, options || { dateStyle: 'medium' }).format(new Date(date));
    } catch (e) {
      return String(date);
    }
  }

  // =========================================================
  // LANGUAGE SELECTOR MODAL
  // =========================================================
  function renderLanguageModal() {
    if (document.getElementById('languageModal')) return;

    const modalHtml = `
      <div class="lang-modal-backdrop" id="languageModalBackdrop" onclick="I18N.closeModal()" aria-hidden="true"></div>
      <div class="lang-modal-panel" id="languageModal" role="dialog" aria-modal="true" aria-labelledby="langModalTitle">
        <div class="lang-modal-header">
          <div class="lang-modal-title-wrap">
            <span class="lang-modal-icon">🌐</span>
            <div>
              <h2 id="langModalTitle" class="lang-modal-title">Language / भाषा</h2>
              <p class="lang-modal-sub" id="langModalSub">Choose your preferred language</p>
            </div>
          </div>
          <button type="button" class="lang-modal-close" onclick="I18N.closeModal()" aria-label="Close language selector">✕</button>
        </div>
        <div class="lang-modal-body">
          <div class="lang-grid" id="langGridContainer">
            ${SUPPORTED_LANGUAGES.map(l => `
              <button type="button" class="lang-option-card ${l.code === currentLang ? 'active' : ''}" data-lang-code="${l.code}" onclick="I18N.setLanguage('${l.code}')">
                <div class="lang-card-main">
                  <span class="lang-card-native">${l.nativeName}</span>
                  <span class="lang-card-name">${l.name}</span>
                </div>
                ${l.code === currentLang ? '<span class="lang-card-badge">✓ Active</span>' : ''}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const wrap = document.createElement('div');
    wrap.innerHTML = modalHtml;
    while (wrap.firstChild) {
      document.body.appendChild(wrap.firstChild);
    }
  }

  function openLanguageModal() {
    renderLanguageModal();
    const modal = document.getElementById('languageModal');
    const backdrop = document.getElementById('languageModalBackdrop');
    if (!modal || !backdrop) return;

    // Update active states
    document.querySelectorAll('.lang-option-card').forEach(card => {
      const code = card.getAttribute('data-lang-code');
      if (code === currentLang) {
        card.classList.add('active');
        if (!card.querySelector('.lang-card-badge')) {
          const badge = document.createElement('span');
          badge.className = 'lang-card-badge';
          badge.textContent = '✓ Active';
          card.appendChild(badge);
        }
      } else {
        card.classList.remove('active');
        const b = card.querySelector('.lang-card-badge');
        if (b) b.remove();
      }
    });

    backdrop.classList.add('active');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Trap focus / close on escape
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeLanguageModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  function closeLanguageModal() {
    const modal = document.getElementById('languageModal');
    const backdrop = document.getElementById('languageModalBackdrop');
    if (backdrop) backdrop.classList.remove('active');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Initialize engine
  async function init() {
    currentLang = getSavedLanguage();

    // 1. Preload English
    await loadLocale('en');

    // 2. If non-English selected, load that locale
    if (currentLang !== 'en') {
      await loadLocale(currentLang);
    }

    // 3. Render modal container
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        applyTranslations();
        renderLanguageModal();
      });
    } else {
      applyTranslations();
      renderLanguageModal();
    }
  }

  // Public API
  const I18N = {
    SUPPORTED_LANGUAGES,
    init,
    t,
    getLanguage: () => currentLang,
    getLanguageName: () => {
      const m = SUPPORTED_LANGUAGES.find(l => l.code === currentLang);
      return m ? m.name : 'English';
    },
    getNativeLanguageName: () => {
      const m = SUPPORTED_LANGUAGES.find(l => l.code === currentLang);
      return m ? m.nativeName : 'English';
    },
    getLanguageMeta: () => SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[0],
    isRTL: () => {
      const m = SUPPORTED_LANGUAGES.find(l => l.code === currentLang);
      return m ? m.dir === 'rtl' : false;
    },
    setLanguage,
    applyTranslations,
    matchCityMultilingual,
    formatNumber,
    formatDate,
    openModal: openLanguageModal,
    closeModal: closeLanguageModal
  };

  window.I18N = I18N;
  window.openLanguageModal = openLanguageModal;
  window.closeLanguageModal = closeLanguageModal;
  window.toggleLanguage = openLanguageModal; // Hook existing hamburger drawer language action!

  // Auto-run initialization
  init();

})(window, document);
