const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const USERS_FILE = path.join(__dirname, 'users.json');
const BOOKINGS_FILE = path.join(__dirname, 'bookings.json');
const DISTRICTS_FILE = path.join(__dirname, 'districts.json');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'exploreup-super-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true in production if HTTPS is active
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    }
  })
);

// Helper functions for user storage
function getUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading users.json:', err);
    return [];
  }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing users.json:', err);
    return false;
  }
}

// Helper functions for bookings
function getBookings() {
  try {
    if (!fs.existsSync(BOOKINGS_FILE)) {
      const initialBookings = [
        {
          id: 'UP-BK-8801',
          userName: 'PriyaSharma',
          email: 'traveler_1789485129842@example.com',
          destination: 'Agra',
          title: 'Taj Mahal Sunrise Monument Entry & Guided Heritage Walk',
          date: '2026-10-12',
          time: '06:00 AM',
          hotel: 'The Oberoi Amarvilas (Premier Luxury Room with Taj View)',
          transport: 'Gatimaan Express (Train #12050, Executive Chair Car)',
          status: 'Confirmed',
          pax: 2
        },
        {
          id: 'UP-BK-8802',
          userName: 'Aarav_4122',
          email: 'aarav_1789486564122@example.com',
          destination: 'Varanasi',
          title: 'Ganga Aarti Private Sunrise Boat & Kashi Vishwanath VIP Darshan',
          date: '2026-10-15',
          time: '05:30 AM',
          hotel: 'BrijRama Palace Heritage Hotel, Darbhanga Ghat',
          transport: 'Vande Bharat Express (Train #22436, Seat C3-24)',
          status: 'Confirmed',
          pax: 1
        }
      ];
      fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(initialBookings, null, 2), 'utf-8');
      return initialBookings;
    }
    const data = fs.readFileSync(BOOKINGS_FILE, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading bookings.json:', err);
    return [];
  }
}

function getUserBookings(userName, userObj) {
  const allBookings = getBookings();
  const uname = (userName || (userObj && userObj.username) || '').toLowerCase();
  const uemail = ((userObj && userObj.email) || '').toLowerCase();
  const uid = ((userObj && userObj.id) || '').toLowerCase();

  return allBookings.filter((b) => {
    const bName = (b.userName || b.username || '').toLowerCase();
    const bEmail = (b.email || '').toLowerCase();
    const bId = (b.userId || '').toLowerCase();
    return (
      (uname && bName === uname) ||
      (uemail && bEmail === uemail) ||
      (uid && bId === uid)
    );
  });
}

// Helper function to read districts.json (supports object dictionary or array)
function getDistrictsData() {
  try {
    if (fs.existsSync(DISTRICTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(DISTRICTS_FILE, 'utf-8'));
      if (Array.isArray(data)) return data;
      if (typeof data === 'object' && data !== null) {
        return Object.values(data);
      }
    }
  } catch (err) {
    console.error('Error reading districts.json:', err);
  }
  return [];
}

// Authentication Middleware
function isAuthenticated(req, res, next) {
  if (req.session && (req.session.userName || req.session.user)) {
    if (!req.session.userName && req.session.user) {
      req.session.userName = req.session.user.username;
    }
    return next();
  }
  return res.status(401).json({
    error: 'Unauthorized. Please log in to chat with Arya AI.',
    authenticated: false
  });
}

// Initialize Google Gen AI client if API key is provided
let genAIClient = null;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (GEMINI_API_KEY) {
  try {
    const { GoogleGenAI } = require('@google/genai');
    genAIClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    console.log('GoogleGenAI initialized successfully with API key.');
  } catch (err) {
    console.warn('GoogleGenAI SDK not loaded or key missing:', err.message);
  }
}

// =========================================================
// AUTHENTICATION ROUTES
// =========================================================

// POST /api/register
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required.' });
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedUsername.length < 2) {
      return res.status(400).json({ error: 'Username must be at least 2 characters long.' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
    }

    const users = getUsers();

    // Check if user already exists
    const existingUser = users.find(
      (u) =>
        u.email.toLowerCase() === trimmedEmail ||
        u.username.toLowerCase() === trimmedUsername.toLowerCase()
    );

    if (existingUser) {
      return res.status(409).json({
        error:
          existingUser.email.toLowerCase() === trimmedEmail
            ? 'An account with this email already exists.'
            : 'This username is already taken.'
      });
    }

    // Hash password with bcryptjs
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = {
      id: 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      username: trimmedUsername,
      email: trimmedEmail,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    // User Identity: Attach user's name (req.session.userName) to session
    req.session.userName = newUser.username;
    req.session.user = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email
    };

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      userName: req.session.userName,
      user: req.session.user
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { usernameOrEmail, email, username, password } = req.body;
    const identifier = (usernameOrEmail || email || username || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/Email and password are required.' });
    }

    const users = getUsers();
    const user = users.find(
      (u) =>
        u.email.toLowerCase() === identifier ||
        u.username.toLowerCase() === identifier
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid email/username or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email/username or password.' });
    }

    // User Identity: Attach user's name (req.session.userName) to session on login
    req.session.userName = user.username;
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email
    };

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      userName: req.session.userName,
      user: req.session.user
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// POST /api/logout
app.post('/api/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Could not log out. Please try again.' });
      }
      res.clearCookie('connect.sid');
      return res.status(200).json({ success: true, message: 'Logged out successfully.' });
    });
  } else {
    return res.status(200).json({ success: true, message: 'Already logged out.' });
  }
});

// GET /api/me
app.get('/api/me', (req, res) => {
  if (req.session && (req.session.userName || req.session.user)) {
    const userName = req.session.userName || (req.session.user ? req.session.user.username : 'Traveler');
    return res.status(200).json({
      userName,
      user: req.session.user || { username: userName },
      authenticated: true
    });
  }
  return res.status(200).json({ user: null, userName: null, authenticated: false });
});

// =========================================================
// PROTECTED RAG ROUTE (Personalized & Conversational Arya AI)
// =========================================================
app.post('/api/chat', isAuthenticated, async (req, res) => {
  try {
    const query = (req.body.query || req.body.message || req.body.prompt || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Query prompt is required.' });
    }

    const userName = req.session.userName || (req.session.user && req.session.user.username) || 'Traveler';
    const userBookings = getUserBookings(userName, req.session.user);
    const districts = getDistrictsData();

    // 1. Try Gemini API if available
    if (genAIClient) {
      try {
        const systemPrompt = `You are Arya AI, an expert, warm, and highly personalized conversational travel assistant for Uttar Pradesh (UP), India.

USER IDENTITY & PROFILE:
- User's Name: ${userName}
- User's Personal Bookings (from bookings.json):
${JSON.stringify(userBookings, null, 2)}

OFFICIAL DISTRICTS KNOWLEDGE BASE (from districts.json):
${JSON.stringify(districts.slice(0, 15), null, 2)}

CORE INSTRUCTIONS:
1. Greet the user by their name (${userName}) at the start of your reply in a warm, welcoming tone.
2. Reply fluently in ANY language used in the query (Hindi in Devanagari script, English, or conversational Hinglish). Mirror the user's language accurately.
3. Provide detailed, rich, multi-paragraph answers for local travel queries (such as famous street food, places to visit, history, monuments, hidden gems, and timings) combining both districts.json and broad general knowledge. Format with clear headings, bullet points, and practical insider tips.
4. Accurately pull personal booking info from the provided bookings.json when requested:
   - If the user asks about their bookings, tickets, or hotel stays, present their specific details (Booking ID, Destination, Hotel, Transport, Dates, Time, and Status).
   - If no bookings exist for ${userName}, kindly inform them by name that they have no current bookings and suggest popular UP trips.`;

        const geminiResponse = await genAIClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: query,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7
          }
        });

        if (geminiResponse && geminiResponse.text) {
          return res.status(200).json({
            reply: geminiResponse.text,
            user: userName,
            source: 'gemini',
            timestamp: new Date().toISOString()
          });
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, falling back to local engine:', geminiErr.message);
      }
    }

    // 2. Intelligent, Conversational Local Engine (Multi-Lingual, Personal & Bookings-Aware)
    const qLower = query.toLowerCase();

    // Detect language: Hindi, Hinglish, or English
    const isDevanagari = /[\u0900-\u097F]/.test(query);
    const isHinglish =
      !isDevanagari &&
      /\b(kya|kaha|kaise|batao|chahiye|khana|ghumne|mera|meri|hai|hain|karo|bataiye|aap|kijiye|ticket|mandir|jagah|kab)\b/i.test(
        query
      );

    // Personal Greeting
    let greeting = '';
    if (isDevanagari) {
      greeting = `नमस्ते ${userName} जी! 🙏\n\n`;
    } else if (isHinglish) {
      greeting = `Namaste ${userName}! Kaise hain aap? 🙏\n\n`;
    } else {
      greeting = `Namaste ${userName}! Welcome back to ExploreUP. 👋\n\n`;
    }

    // Check for Personal Booking Queries
    const isBookingQuery = /\b(booking|bookings|reservation|reservations|ticket|tickets|itinerary|mera booking|meri booking|book kiya|hotel booking)\b/i.test(
      query
    );

    if (isBookingQuery) {
      let bookingReply = '';
      if (userBookings.length > 0) {
        if (isDevanagari) {
          bookingReply = `${greeting}आपकी पुष्टि की गई बुकिंग विवरण (Bookings.json से):\n\n`;
          userBookings.forEach((b, idx) => {
            bookingReply += `📌 **बुकिंग #${idx + 1} (${b.id})**\n`;
            bookingReply += `• **स्थान:** ${b.destination}\n`;
            bookingReply += `• **गतिविधि:** ${b.title || b.item || 'यात्रा'}\n`;
            bookingReply += `• **तारीख व समय:** ${b.date} | ${b.time}\n`;
            if (b.hotel) bookingReply += `• **होटल:** ${b.hotel}\n`;
            if (b.transport) bookingReply += `• **परिवहन:** ${b.transport}\n`;
            bookingReply += `• **स्थिति:** ✅ ${b.status}\n\n`;
          });
          bookingReply += `क्या आप इसमें कोई बदलाव करना चाहते हैं या यात्रा के लिए विशेष सुझाव चाहिए?`;
        } else if (isHinglish) {
          bookingReply = `${greeting}Aapki verified booking details ye rahi (Bookings.json se):\n\n`;
          userBookings.forEach((b, idx) => {
            bookingReply += `📌 **Booking #${idx + 1} (${b.id})**\n`;
            bookingReply += `• **Destination:** ${b.destination}\n`;
            bookingReply += `• **Experience:** ${b.title || b.item || 'Trip'}\n`;
            bookingReply += `• **Date & Time:** ${b.date} at ${b.time}\n`;
            if (b.hotel) bookingReply += `• **Hotel Stay:** ${b.hotel}\n`;
            if (b.transport) bookingReply += `• **Transport:** ${b.transport}\n`;
            bookingReply += `• **Status:** ✅ ${b.status}\n\n`;
          });
          bookingReply += `Agar aapko hotel check-in timings ya local food recommendations chahiye toh zaroor batayein!`;
        } else {
          bookingReply = `${greeting}Here are your verified personal bookings retrieved from bookings.json:\n\n`;
          userBookings.forEach((b, idx) => {
            bookingReply += `📌 **Booking #${idx + 1} — Reference: ${b.id}**\n`;
            bookingReply += `• **Destination:** ${b.destination}, Uttar Pradesh\n`;
            bookingReply += `• **Tour / Activity:** ${b.title || b.item || 'Sightseeing'}\n`;
            bookingReply += `• **Schedule:** ${b.date} at ${b.time}\n`;
            if (b.hotel) bookingReply += `• **Accommodation:** ${b.hotel}\n`;
            if (b.transport) bookingReply += `• **Transit Route:** ${b.transport}\n`;
            bookingReply += `• **Status:** ✅ ${b.status}\n\n`;
          });
          bookingReply += `Let me know if you would like packing tips, navigation assistance, or customized restaurant recommendations for your stay!`;
        }
      } else {
        if (isDevanagari) {
          bookingReply = `${greeting}वर्तमान में आपके नाम (${userName}) पर कोई सक्रिय बुकिंग दर्ज नहीं है।\n\nआप आगरा, वाराणसी, लखनऊ या अयोध्या के लिए नए टूर और होटल बुक कर सकते हैं। क्या आप एक नया यात्रा प्लान बनाना चाहेंगे?`;
        } else if (isHinglish) {
          bookingReply = `${greeting}Filhal aapke account (${userName}) par koi active bookings recorded nahi hain.\n\nAap Agra, Varanasi, Lucknow ya Ayodhya ke liye customized trip plan kar sakte hain. Bataiye kis city ke baare me plan banayein?`;
        } else {
          bookingReply = `${greeting}I checked our records, but you currently have no active travel reservations registered under "${userName}".\n\nI can help you build an itinerary and explore top accommodations in Agra, Varanasi, Lucknow, or Ayodhya anytime. Where would you love to travel next?`;
        }
      }
      return res.status(200).json({
        reply: bookingReply,
        user: userName,
        source: 'local-rag',
        timestamp: new Date().toISOString()
      });
    }

    // Match City / Travel Query from districts.json & UP Knowledge Base
    let cityMatch = districts.find((d) => d.name && qLower.includes(d.name.toLowerCase()));
    if (!cityMatch) {
      if (qLower.includes('taj') || qLower.includes('petha') || qLower.includes('agra')) {
        cityMatch = districts.find((d) => d.name === 'Agra');
      } else if (qLower.includes('kashi') || qLower.includes('banaras') || qLower.includes('varanasi') || qLower.includes('ghat')) {
        cityMatch = districts.find((d) => d.name === 'Varanasi');
      } else if (qLower.includes('awadh') || qLower.includes('kebab') || qLower.includes('lucknow')) {
        cityMatch = districts.find((d) => d.name === 'Lucknow');
      } else if (qLower.includes('ram mandir') || qLower.includes('saryu') || qLower.includes('ayodhya')) {
        cityMatch = districts.find((d) => d.name === 'Ayodhya');
      } else if (qLower.includes('krishna') || qLower.includes('vrindavan') || qLower.includes('mathura')) {
        cityMatch = districts.find((d) => d.name === 'Mathura');
      }
    }

    let detailedReply = '';

    if (cityMatch) {
      const cityName = cityMatch.name;
      const places = cityMatch.places || '';
      const food = cityMatch.food || '';
      const about = cityMatch.about || '';
      const bestTime = cityMatch.best_time || cityMatch.time || 'October to March';
      const tip = cityMatch.tip || '';

      if (isDevanagari) {
        detailedReply = `${greeting}**${cityName} — संपूर्ण यात्रा और स्थानीय जानकारी:**\n\n`;
        detailedReply += `🏛️ **इतिहास और प्रसिद्ध दर्शनीय स्थल:**\n${about}\n\nमुख्य स्थल: ${places}।\n\n`;
        detailedReply += `🍲 **प्रसिद्ध स्ट्रीट फूड और लज़ीज़ व्यंजन:**\n${food}।\n\n`;
        detailedReply += `🗓️ **घूमने का सर्वोत्तम समय और स्थानीय सलाह:**\nसर्वश्रेष्ठ मौसम: ${bestTime}।\n💡 *विशेष टिप:* ${tip}\n\n`;
        detailedReply += `यदि आप ${cityName} के लिए दिन-वार विस्तृत इटिनरेरी या होटल विकल्प चाहते हैं, तो कृपया बताएं!`;
      } else if (isHinglish) {
        detailedReply = `${greeting}**${cityName} ka complete travel guide aapke liye:**\n\n`;
        detailedReply += `🏛️ **History aur Famous Places to Visit:**\n${about}\n\nTop spots to cover: ${places}.\n\n`;
        detailedReply += `🍛 **Must-Try Local Street Food:**\n${cityName} aakar yeh zaroor try karein: ${food}.\n\n`;
        detailedReply += `🕒 **Best Timing & Pro Traveler Tip:**\nBest time to visit: ${bestTime}.\n💡 *Insider Tip:* ${tip}\n\n`;
        detailedReply += `Kya aap ${cityName} ke hotel stays ya railway transit routes ke baare me aur jaanna chahte hain?`;
      } else {
        detailedReply = `${greeting}Here is your comprehensive travel and cultural guide for **${cityName}**:\n\n`;
        detailedReply += `🏛️ **Heritage & Top Attractions:**\n${about}\n\nKey landmarks to explore include: **${places}**.\n\n`;
        detailedReply += `🍛 **Legendary Street Food & Culinary Trails:**\nIndulge in authentic local flavors: **${food}**.\n\n`;
        detailedReply += `🧭 **Best Season & Insider Advice:**\n• **Ideal Travel Period:** ${bestTime}\n• **Local Tip:** ${tip}\n\n`;
        detailedReply += `Would you like me to map out a customized day-by-day itinerary or check hotel accommodations for your visit?`;
      }
    } else {
      // General UP tourism response
      if (isDevanagari) {
        detailedReply = `${greeting}उत्तर प्रदेश के 75 जिलों की अनूठी संस्कृति, शाही स्थापत्य और प्रसिद्ध व्यंजनों के बारे में आप मुझसे कुछ भी पूछ सकते हैं।\n\n• **ताज महल व मुग़लिया विरासत:** आगरा, फतेहपुर सीकरी\n• **आध्यात्मिक व पावन घाट:** वाराणसी, अयोध्या, मथुरा-वृंदावन, प्रयागराज\n• **नवाबी तहज़ीब व जायका:** लखनऊ के कबाब, बिरयानी और चिकनकारी\n• **प्राकृतिक अभयारण्य:** दुधवा नेशनल पार्क, पीलीभीत टाइगर रिज़र्व\n\nआप अपनी व्यक्तिगत बुकिंग्स भी कभी भी चेक कर सकते हैं। बताइए आपकी यात्रा में मैं कैसे मदद करूँ?`;
      } else if (isHinglish) {
        detailedReply = `${greeting}Uttar Pradesh ke 75 districts me se aap kisi bhi destination ke baare me pooch sakte hain!\n\n• **Heritage & Monuments:** Agra (Taj Mahal & Agra Fort), Fatehpur Sikri\n• **Spiritual Hubs:** Varanasi Ghats, Ayodhya Ram Mandir, Mathura-Vrindavan\n• **Food Trails:** Lucknow ke world-famous Tunday Kebabs aur Awadhi Biryani\n• **Wildlife & Nature:** Dudhwa Tiger Reserve aur Katarniaghat\n\nAap kisi bhi waqt apni personal bookings bhi check kar sakte hain. Bataiye, kis jagah ke baare me plan karein?`;
      } else {
        detailedReply = `${greeting}I am your dedicated Uttar Pradesh travel companion. With in-depth knowledge across all 75 districts, I can assist you with:\n\n• **Heritage & History:** Taj Mahal, Agra Fort, Bara Imambara, and Jhansi Fort.\n• **Spiritual Pilgrimages:** Kashi Vishwanath Ganga Aarti, Ayodhya Ram Mandir, and Mathura-Vrindavan.\n• **Iconic Food Trails:** Tunday Kebabs in Lucknow, Panchhi Petha in Agra, Tamatar Chaat in Varanasi.\n• **Personal Bookings:** Inquire about your confirmed hotel, train, and monument reservations at any time.\n\nWhich destination or experience would you like to explore today?`;
      }
    }

    return res.status(200).json({
      reply: detailedReply,
      user: userName,
      source: 'local-rag',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: 'Failed to process chat query.' });
  }
});

// =========================================================
// STATIC ASSETS & FALLBACK
// =========================================================
app.use(express.static(__dirname));

// Fallback for SPA navigation
app.use((req, res) => {
  const filePath = path.join(__dirname, req.path === '/' ? 'index.html' : req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  return res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ExploreUP Express server running at http://localhost:${PORT}/`);
});
