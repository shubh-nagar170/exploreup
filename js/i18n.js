/**
 * ExploreUP Professional Multilingual / Internationalization (i18n) Engine
 * Supports 22 major Indian & international languages with RTL handling,
 * dynamic key translation, persistent local storage, bulletproof English fallbacks,
 * and smart raw-key suppression.
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
    ayodhya: ['ayodhya', 'अयोध्या', 'राम जन्मभूमि', 'అయోధ్య', 'அயோத்தி', 'ಅಯோధ్యె', 'അയോധ്യ', 'অযোধ্যা', 'અયોધ્યા', 'ਅਯੁੱਧਿਆ', 'ଅଯୋଧ୍ୟା', 'ایودھیا', 'アヨーディヤー', '阿约提亚', '아야디야', '아요디아', 'أيوديا', 'Айодхья'],
    mathura: ['mathura', 'मथुरा', 'కృష్ణ జన్మభూమి', 'మథుర', 'மதுரா', 'ಮಥುರಾ', 'മഥുര', 'মথুরা', 'મથુરા', 'ਮਥੁਰਾ', 'ମଥୁରା', 'متھرا', 'ماثورا', 'マトゥラー', '马图拉', '마투라', 'Матхура'],
    prayagraj: ['prayagraj', 'allahabad', 'प्रयागराज', 'इलाहाबाद', 'त्रिवेणी संगम', 'ప్రయాగ్‌రాజ్', 'பிரயாக்ராஜ்', 'ಪ್ರಯಾಗ್‌రాజ్', 'പ്രయాഗ്‌రాജ്', 'প্রয়াগরাজ', 'પ્રયાગરાજ', 'ਪ੍ਰਯਾਗਰਾਜ', 'ପ୍ରୟାଗରାଜ', 'پریاگ راج', 'プラヤグラージ', '普拉亚格拉吉', '프라야그라지', 'براياغراج', 'Праяградж'],
    kanpur: ['kanpur', 'कानपुर', 'కాన్పూర్', 'கான்பூர்', 'ಕಾನ್ಪುರ', 'കാൺപൂർ', 'কানপুর', 'કાનપુર', 'ਕਾਨਪੁਰ', 'କାନପୁର', 'کانپور', 'カーンプル', '坎普尔', '칸푸르', 'كانبور', 'Канпур'],
    jhansi: ['jhansi', 'झांसी', 'झाँसी', 'ఝాన్సీ', 'ஜான்சி', 'ಝಾನ್சி', 'ഝാൻസി', 'ঝাঁসি', 'ઝાંસી', 'ਝਾਂਸੀ', 'ଝାଁସୀ', 'جھانسی', 'ジャーンシー', '占西', '잔시', 'جهانسي', 'Джханси'],
    chitrakoot: ['chitrakoot', 'चित्रकूट', 'చిత్రకూట్', 'சித்ரகூட்', 'ಚಿತ್ರಕೂಟ', 'ചിത്രകൂട്', 'চিত্রকূট', 'ચિત્રકૂટ', 'ਚਿੱਤਰਕੂਟ', 'ଚିତ୍ରକୂଟ', 'چترکوٹ', 'チトラクート', '奇特拉库特', '치트라쿠트', 'تشيتراكوت', 'Читракут'],
    vrindavan: ['vrindavan', 'वृन्दावन', 'वृंदावन', 'బృందావనం', 'பிருந்தாவனம்', 'ಬೃಂದಾವನ', 'വൃന്ദാവനം', 'বৃন্দাবন', 'વૃંદાવન', 'ਵ੍ਰਿੰਦਾਵਨ', 'ବୃନ୍ଦାବନ', 'ورنداون', 'ヴリンダーヴァン', '温达文', '브린다반', 'فريندافان', 'Вриндаван']
  };

  // Synchronous English Master Dictionary (Instant guarantee, zero network delay/failure)
  const DEFAULT_EN = {
    langCode: "en",
    langName: "English",
    nativeName: "English",
    dir: "ltr",
    nav: {
      home: "Home",
      exploreCities: "Explore All Cities",
      tripPlanner: "Trip Planner",
      foodTrails: "Food Trails",
      festivals: "Festivals",
      about: "About",
      tagline: "HAR SHEHAR KI KAHANI"
    },
    drawer: {
      welcomeExplorer: "Welcome, Explorer!",
      welcomeSub: "Sign in to plan & save your UP journeys",
      account: "Account",
      preferences: "Preferences",
      exploreSupport: "Explore & Support",
      navigation: "Explore & Support",
      language: "Language / भाषा",
      languageSub: "Choose your preferred language",
      darkMode: "Dark Mode",
      lightThemeActive: "Light Theme Active",
      darkThemeActive: "Dark Theme Active",
      admin: "Admin Panel",
      adminPanel: "Admin Panel",
      adminSub: "Destination controls & portal admin",
      helpline: "Helplines & Emergency",
      helplineSub: "Police 112 • Ambulance 108 • Tourist 1363",
      about: "About ExploreUP",
      aboutExploreUp: "About ExploreUP",
      aboutSub: "Why ExploreUP, mission & city directory",
      login: "Login",
      loginSub: "Sign in to your ExploreUP account",
      createAccount: "Create Account",
      createAccountSub: "Register a new customer account",
      hiddenGems: "Hidden Gems",
      logout: "Logout",
      logoutSub: "Safely sign out of your account"
    },
    buttons: {
      explore: "Explore",
      learnMore: "Learn More",
      planTrip: "Plan Your Trip",
      search: "Search",
      login: "Login",
      createAccount: "Create Account",
      logout: "Logout",
      askArya: "Ask Arya",
      submit: "Submit",
      cancel: "Cancel",
      close: "Close",
      save: "Save",
      share: "Share",
      viewAllCities: "View All Cities ↓",
      hideCities: "Hide Cities ↑",
      viewAllGems: "View All Hidden Gems ↓",
      hideGems: "Hide Hidden Gems ↑",
      clear: "Clear",
      backToHome: "← Home",
      resetFilters: "Reset Filters & Show All",
      exploreGuide: "Explore Guide →"
    },
    hero: {
      greeting: "Namaste 🙏",
      title: "Explore",
      titleEm: "Uttar Pradesh",
      subtitle: "Discover timeless heritage, legendary street food, spiritual sacred rivers, hotels, transport guides and hidden gems — city by city.",
      searchPlaceholder: "Search any city, monument, food or ask Arya AI (e.g. Agra, Taj Mahal, Plan a 3 day Agra trip)...",
      destinationsBadge: "36 Destinations",
      transportBadge: "🚆 Live Transport Guides",
      staysBadge: "🏨 Verified Stays & Healthcare",
      plannerBadge: "🧳 Smart Trip Planner",
      exploreCitiesBtn: "📍 Explore All Cities",
      planTripBtn: "🧳 Plan Your Trip",
      hiddenGemsBtn: "💎 Hidden Gems"
    },
    home: {
      breadcrumbHome: "Home",
      breadcrumbCurrent: "Explore Uttar Pradesh",
      citiesTitle: "Explore All Cities",
      exploreAllCities: "Explore All Cities",
      citiesSub: "Explore Uttar Pradesh city by city, with comprehensive travel guides, transport, hotels and food.",
      exploreAllCitiesSub: "Explore Uttar Pradesh city by city, with comprehensive travel guides, transport, hotels and food.",
      searchCitiesPlaceholder: "Search cities...",
      noCitiesFound: "No cities found matching your search.",
      featuredDestination: "FEATURED DESTINATION",
      exploreGuide: "Explore Guide →",
      whyExploreUp: "Why ExploreUP?",
      whyDirectory: "Complete City Directory",
      whyDirectorySub: "Places, food, stays and medical facilities",
      whyTransport: "Live Transport Routes",
      whyTransportSub: "Airports, railway junctions & expressways",
      whyFood: "Local Food Trails",
      whyFoodSub: "Must-try authentic dishes & sweet shops",
      whyPlanning: "Smart Trip Planning",
      whyPlanningSub: "Custom 1, 2, or 3-day realistic itineraries",
      hiddenGemsTitle: "Hidden Gems of Uttar Pradesh",
      hiddenGemsSubtitle: "Discover the lesser-known waterfalls, forests, forts, wildlife sanctuaries and historic places beyond the famous destinations.",
      gemsBadge: "16 hidden gems to explore",
      gemsSearchPlaceholder: "Search by destination, district, or category...",
      gemsAll: "All (16)",
      gemsNature: "🌊 Nature & Waterfalls",
      gemsHistory: "🏰 History & Heritage",
      gemsWildlife: "🐅 Wildlife",
      gemsSpiritual: "🕉️ Spiritual",
      noGemsFound: "No Hidden Gems Found",
      districtsTitle: "District-wise Exploration",
      districtsSub: "Choose a district to explore its places, food, services and travel information.",
      festivalsTitle: "Festivals & Cultural Calendar",
      festivalsSub: "Experience grand celebrations, devotion, crafts and fairs across the state.",
      trailsTitle: "Thematic Travel Trails",
      trailsSub: "Curated journeys through spirituality, nature, handicrafts and freedom struggles.",
      sustainTitle: "Responsible & Sustainable Tourism",
      sustainSub: "Preserve the beauty and culture of Uttar Pradesh for future generations."
    },
    search: {
      placeholder: "Search any city, monument, food or ask Arya AI (e.g. Agra, Taj Mahal, Plan a 3 day Agra trip)...",
      citiesPlaceholder: "Search cities...",
      popular: "Popular Searches",
      cities: "Cities",
      places: "Monuments & Places",
      gems: "Hidden Gems",
      food: "Food Specialties",
      noResults: "No results found for",
      btn: "Search"
    },
    trip: {
      title: "Smart Trip Planner",
      subtitle: "Craft your personalized day-by-day Uttar Pradesh itinerary in seconds",
      destination: "Select Destination",
      duration: "Trip Duration",
      travelers: "Who is Traveling?",
      budget: "Budget Preference",
      transport: "Preferred Transport",
      stay: "Accommodation Style",
      travelStyle: "Pacing & Style",
      interests: "Interests & Themes",
      makePlan: "Make My Plan",
      calculateBudget: "Calculate Budget",
      saveItinerary: "Save Itinerary",
      day: "Day",
      morning: "Morning",
      afternoon: "Afternoon",
      evening: "Evening",
      lunch: "Lunch & Local Flavors",
      estimatedBudget: "Estimated Trip Budget",
      perPerson: "per person"
    },
    auth: {
      login: "Login",
      loginTitle: "Welcome Back",
      loginSubtitle: "Sign in with your registered email and password",
      noAccount: "Don't have an account?",
      createAccount: "Create Account",
      registerTitle: "Create Your Account",
      registerSubtitle: "Join ExploreUP to start your Uttar Pradesh journey",
      fullName: "Full Name",
      namePlaceholder: "Enter your full name",
      email: "Email Address",
      emailPlaceholder: "Enter your email address",
      password: "Password",
      passwordPlaceholder: "Enter your password",
      createPasswordPlaceholder: "Create a password (min 6 characters)",
      confirmPassword: "Confirm Password",
      confirmPasswordPlaceholder: "Re-enter your password",
      terms: "I agree to the Terms & Conditions",
      hasAccount: "Already have an account?",
      alreadyHaveAccount: "Already have an account?",
      dontHaveAccount: "Don't have an account?",
      loginInstead: "Sign in here",
      createInstead: "Create one free",
      loggingIn: "Signing in...",
      creatingAccount: "Creating account...",
      loginSuccess: "Welcome back!",
      registerSuccess: "Account created successfully!",
      logoutSuccess: "Signed out successfully",
      invalidCredentials: "Invalid email or password. Please try again.",
      emailExists: "An account with this email already exists.",
      passwordMismatch: "Passwords do not match.",
      passwordTooShort: "Password must be at least 6 characters.",
      allFieldsRequired: "Please fill in all required fields."
    },
    arya: {
      title: "Arya AI Travel Concierge",
      subtitle: "Your 24x7 intelligent guide to Uttar Pradesh",
      placeholder: "Ask Arya about places, food, routes, or trip plans...",
      send: "Send",
      listening: "Listening...",
      voicePrompt: "Speak now...",
      clearHistory: "Clear History",
      greeting: "Namaste! I'm Arya, your AI guide to Uttar Pradesh. How can I help you explore today?"
    },
    footer: {
      rights: "All Rights Reserved",
      tagline: "Explore Uttar Pradesh with comprehensive travel guides, transport, hotels and food.",
      helplineNote: "Emergency numbers: Police 112 • Ambulance 108 • Tourist Helpline 1363",
      disclaimer: "ExploreUP is a digital travel discovery portal for Uttar Pradesh."
    },
    languageModal: {
      title: "Language / भाषा",
      subtitle: "Choose your preferred language",
      current: "Active Language",
      select: "Select"
    }
  };

  // Cross-key aliases for seamless backward & forward compatibility
  const KEY_ALIASES = {
    "home.citiesTitle": "home.exploreAllCities",
    "home.exploreAllCities": "home.citiesTitle",
    "home.citiesSub": "home.exploreAllCitiesSub",
    "home.exploreAllCitiesSub": "home.citiesSub",
    "search.citiesPlaceholder": "home.searchCitiesPlaceholder",
    "home.searchCitiesPlaceholder": "search.citiesPlaceholder",
    "search.placeholder": "hero.searchPlaceholder",
    "hero.searchPlaceholder": "search.placeholder",
    "drawer.navigation": "drawer.exploreSupport",
    "drawer.exploreSupport": "drawer.navigation",
    "drawer.login": "buttons.login",
    "drawer.createAccount": "buttons.createAccount",
    "drawer.about": "drawer.aboutExploreUp",
    "drawer.aboutExploreUp": "drawer.about",
    "drawer.admin": "drawer.adminPanel",
    "drawer.adminPanel": "drawer.admin"
  };

  // Cache for loaded translations, seeded with English immediately
  const translations = {
    en: JSON.parse(JSON.stringify(DEFAULT_EN))
  };
  let currentLang = 'en';

  // Strict check to ensure raw keys like 'home.citiesTitle' are NEVER rendered
  function isRawKey(str) {
    if (!str || typeof str !== 'string') return false;
    const s = str.trim();
    return /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(s);
  }

  // Get saved language or fallback
  function getSavedLanguage() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const saved = localStorage.getItem(STORAGE_KEY) || (window.exploreStorage ? window.exploreStorage.get('exploreup_lang') : null);
        if (saved && SUPPORTED_LANGUAGES.some(l => l.code === saved)) {
          return saved;
        }
      }
    } catch (e) {
      console.warn('[i18n] Storage access error:', e);
    }
    return 'en';
  }

  // Save selected language
  function saveLanguage(code) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(STORAGE_KEY, code);
      }
      if (window.exploreStorage) {
        window.exploreStorage.set('exploreup_lang', code);
      }
    } catch (e) {
      console.warn('[i18n] Storage write error:', e);
    }
  }

  // Load language dictionary JSON with resilient fallback paths
  async function loadLocale(code) {
    if (translations[code] && Object.keys(translations[code]).length > 1) {
      return translations[code];
    }
    const paths = [`/locales/${code}.json`, `/public/locales/${code}.json`];
    for (const p of paths) {
      try {
        const res = await fetch(p);
        if (res.ok) {
          const data = await res.json();
          translations[code] = Object.assign(translations[code] || {}, data);
          return translations[code];
        }
      } catch (e) {
        // try next path
      }
    }
    // Return English if available, or empty object
    return translations['en'] || DEFAULT_EN;
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

  // Bulletproof translation function: NEVER RETURNS RAW KEYS
  function t(key, fallback) {
    if (!key) return '';

    // 1. Try current language
    let val = getNestedValue(translations[currentLang], key);
    if (typeof val === 'string' && val.trim() !== '' && !isRawKey(val)) {
      return val;
    }

    // 2. Try alias in current language
    const alias = KEY_ALIASES[key];
    if (alias) {
      val = getNestedValue(translations[currentLang], alias);
      if (typeof val === 'string' && val.trim() !== '' && !isRawKey(val)) {
        return val;
      }
    }

    // 3. Try English loaded dictionary
    val = getNestedValue(translations['en'], key);
    if (typeof val === 'string' && val.trim() !== '' && !isRawKey(val)) {
      return val;
    }

    // 4. Try English alias
    if (alias) {
      val = getNestedValue(translations['en'], alias);
      if (typeof val === 'string' && val.trim() !== '' && !isRawKey(val)) {
        return val;
      }
    }

    // 5. Try synchronous DEFAULT_EN
    val = getNestedValue(DEFAULT_EN, key) || (alias ? getNestedValue(DEFAULT_EN, alias) : null);
    if (typeof val === 'string' && val.trim() !== '' && !isRawKey(val)) {
      return val;
    }

    // 6. Use provided fallback if it's clean human-readable text
    if (fallback !== undefined && fallback !== null) {
      const fbStr = String(fallback).trim();
      if (fbStr !== '' && !isRawKey(fbStr)) {
        return fbStr;
      }
    }

    // 7. Return null: NEVER leak the raw key string to visitors
    return null;
  }

  // Apply translations to the DOM safely
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
      if (!key) return;

      // Remember original human-readable default text from HTML on initial load
      if (!el.hasAttribute('data-i18n-default')) {
        const initialText = el.hasAttribute('data-i18n-html') ? el.innerHTML.trim() : el.textContent.trim();
        if (initialText && !isRawKey(initialText)) {
          el.setAttribute('data-i18n-default', initialText);
        }
      }
      const defaultText = el.getAttribute('data-i18n-default') || '';

      const translated = t(key, defaultText);
      if (translated && !isRawKey(translated)) {
        if (el.hasAttribute('data-i18n-html')) {
          el.innerHTML = translated;
        } else {
          el.textContent = translated;
        }
      } else if (defaultText && !isRawKey(defaultText)) {
        if (el.hasAttribute('data-i18n-html')) {
          el.innerHTML = defaultText;
        } else {
          el.textContent = defaultText;
        }
      }
    });

    // 3. Placeholders [data-i18n-placeholder]
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;

      if (!el.hasAttribute('data-i18n-default-ph')) {
        const origPh = (el.getAttribute('placeholder') || '').trim();
        if (origPh && !isRawKey(origPh)) {
          el.setAttribute('data-i18n-default-ph', origPh);
        }
      }
      const defaultPh = el.getAttribute('data-i18n-default-ph') || '';

      const translated = t(key, defaultPh);
      if (translated && !isRawKey(translated)) {
        el.setAttribute('placeholder', translated);
      } else if (defaultPh && !isRawKey(defaultPh)) {
        el.setAttribute('placeholder', defaultPh);
      }
    });

    // 4. Titles [data-i18n-title]
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (!key) return;

      if (!el.hasAttribute('data-i18n-default-title')) {
        const orig = (el.getAttribute('title') || '').trim();
        if (orig && !isRawKey(orig)) {
          el.setAttribute('data-i18n-default-title', orig);
        }
      }
      const defaultTitle = el.getAttribute('data-i18n-default-title') || '';

      const translated = t(key, defaultTitle);
      if (translated && !isRawKey(translated)) {
        el.setAttribute('title', translated);
      } else if (defaultTitle && !isRawKey(defaultTitle)) {
        el.setAttribute('title', defaultTitle);
      }
    });

    // 5. Aria Labels [data-i18n-aria]
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      if (!key) return;

      if (!el.hasAttribute('data-i18n-default-aria')) {
        const orig = (el.getAttribute('aria-label') || '').trim();
        if (orig && !isRawKey(orig)) {
          el.setAttribute('data-i18n-default-aria', orig);
        }
      }
      const defaultAria = el.getAttribute('data-i18n-default-aria') || '';

      const translated = t(key, defaultAria);
      if (translated && !isRawKey(translated)) {
        el.setAttribute('aria-label', translated);
      } else if (defaultAria && !isRawKey(defaultAria)) {
        el.setAttribute('aria-label', defaultAria);
      }
    });

    // 6. Dynamic Drawer Language Sync
    syncDrawerLangUI();

    // 7. Top Navigation Language Badge Sync
    const navLabel = document.getElementById('navLangLabel');
    if (navLabel) {
      navLabel.textContent = langMeta.nativeName || langMeta.name;
    }

    // 8. Dispatch language change event for other components (Arya, Trip Planner, etc.)
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

    // Load target language if not already present
    if (code !== 'en') {
      await loadLocale(code);
    }

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
    if (!document || typeof document.getElementById !== 'function' || typeof document.createElement !== 'function') return;
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

    // 1. Immediately apply synchronous English master translations
    applyTranslations();

    // 2. If non-English selected, load that locale asynchronously
    if (currentLang !== 'en') {
      await loadLocale(currentLang);
      applyTranslations();
    }

    // 3. Render modal container when DOM is ready
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
    DEFAULT_EN,
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
