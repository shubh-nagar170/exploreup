require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const https = require('https');
const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 8080;
const USERS_FILE = path.join(__dirname, 'users.json');
const BOOKINGS_FILE = path.join(__dirname, 'bookings.json');
const DISTRICTS_FILE = path.join(__dirname, 'districts.json');

// Enable trust proxy for secure cookies and IP forwarding behind Vercel/proxies
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware for Vercel cross-origin/serverless routing
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.header(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

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

// Authentication Middleware for routes that strictly require authentication
function isAuthenticated(req, res, next) {
  if (req.session && (req.session.userName || req.session.user)) {
    if (!req.session.userName && req.session.user) {
      req.session.userName = req.session.user.username;
    }
    return next();
  }
  return res.status(401).json({
    error: 'Unauthorized. Please log in.',
    authenticated: false
  });
}

// =========================================================
// ARYA AI TOOL ARCHITECTURE (Calculator, Planner, Tourism Search)
// =========================================================

function safeCalculate(expression) {
  if (!expression || typeof expression !== 'string') {
    return { error: 'Invalid expression provided.' };
  }
  let sanitized = expression
    .replace(/₹|rs\.?|inr/gi, '')
    .replace(/,/g, '')
    .replace(/\b(?:divide|split)\s*(\d+(?:\.\d+)?)\s*(?:between|among|amongst|by|\/)\s*(?:the\s*)?(\d+(?:\.\d+)?)(?:\s*(?:people|persons|travelers|pax|ways|friends))?/gi, '$1 / $2')
    .replace(/(\d+(?:\.\d+)?)\s*(?:divided by|\/)\s*(\d+(?:\.\d+)?)/gi, '$1 / $2')
    .replace(/(\d+(\.\d+)?)%\s*(?:of\s*)?(\d+(\.\d+)?)/gi, '($1/100)*$3')
    .replace(/(\d+(\.\d+)?)%/g, '($1/100)')
    .replace(/\b(?:plus|add)\b/gi, '+')
    .replace(/\b(?:minus|subtract)\b/gi, '-')
    .replace(/\b(?:multiplied by|times)\b/gi, '*')
    .replace(/\bx\b/gi, '*')
    .replace(/\^/g, '**')
    .replace(/calculate|compute|solve|what is|find|result of|evaluate|can you/gi, '')
    .replace(/[^\d\s+\-*/().]/g, '')
    .trim();

  if (!sanitized || !/^[\d\s+\-*/().]+$/.test(sanitized)) {
    return { error: 'Unsupported characters or empty math expression. Only numbers and basic operations (+, -, *, /, %, parentheses) are allowed.' };
  }
  try {
    const result = Function('"use strict"; return (' + sanitized + ')')();
    if (typeof result !== 'number' || !isFinite(result)) {
      return { error: 'Calculation resulted in an invalid number.' };
    }
    const formatted = Number.isInteger(result) ? result : Math.round(result * 100) / 100;
    return {
      expression: expression.trim(),
      sanitized: sanitized.trim(),
      result: formatted
    };
  } catch (err) {
    return { error: `Calculation error: ${err.message}` };
  }
}

function parseBudgetNumber(budgetStr) {
  if (typeof budgetStr === 'number') return budgetStr;
  if (!budgetStr) return null;
  const match = budgetStr.toString().replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function planTrip({ destination = 'Uttar Pradesh', days = 3, travelers = 1, budget = null, interests = '', style = '' }) {
  const numDays = Math.max(1, Math.min(14, parseInt(days, 10) || 3));
  const numTravelers = Math.max(1, parseInt(travelers, 10) || 1);
  const totalBudget = parseBudgetNumber(budget);

  const districts = getDistrictsData();
  const destLower = destination.toLowerCase();
  let cityInfo = districts.find(
    (d) => (d.name && d.name.toLowerCase() === destLower) || (d.id && d.id.toLowerCase() === destLower)
  );
  if (!cityInfo) {
    cityInfo = districts.find(
      (d) => (d.name && destLower.includes(d.name.toLowerCase())) || (d.id && destLower.includes(d.id.toLowerCase()))
    );
  }
  const cityName = cityInfo ? cityInfo.name : destination;

  let budgetBreakdown = null;
  if (totalBudget) {
    const perPerson = Math.round(totalBudget / numTravelers);
    const perDay = Math.round(totalBudget / numDays);
    const perPersonPerDay = Math.round(perPerson / numDays);

    let categoryTier = 'Comfort / Mid-Range';
    if (perPersonPerDay < 1500) categoryTier = 'Budget / Backpacker';
    else if (perPersonPerDay > 3500) categoryTier = 'Luxury / Premium';

    budgetBreakdown = {
      totalBudget: `₹${totalBudget.toLocaleString('en-IN')}`,
      travelers: numTravelers,
      days: numDays,
      perPerson: `₹${perPerson.toLocaleString('en-IN')}`,
      perDayTotal: `₹${perDay.toLocaleString('en-IN')}/day`,
      perPersonPerDay: `₹${perPersonPerDay.toLocaleString('en-IN')}/day per person`,
      tier: categoryTier,
      allocation: {
        accommodation: `₹${Math.round(totalBudget * 0.35).toLocaleString('en-IN')} (approx. 35%)`,
        foodAndDining: `₹${Math.round(totalBudget * 0.30).toLocaleString('en-IN')} (approx. 30%)`,
        localTransit: `₹${Math.round(totalBudget * 0.15).toLocaleString('en-IN')} (approx. 15%)`,
        sightseeingAndEntries: `₹${Math.round(totalBudget * 0.12).toLocaleString('en-IN')} (approx. 12%)`,
        contingencyBuffer: `₹${Math.round(totalBudget * 0.08).toLocaleString('en-IN')} (approx. 8%)`
      }
    };
  }

  const itinerary = [];
  for (let d = 1; d <= numDays; d++) {
    let dayTheme = '';
    let morning = '';
    let afternoon = '';
    let evening = '';

    const cLower = cityName.toLowerCase();
    if (/\b(varanasi|kashi|banaras)\b/i.test(cLower)) {
      if (d === 1) {
        dayTheme = 'Arrival, Ghat Orientation & Grand Ganga Aarti';
        morning = 'Arrive in Varanasi, check-in near Assi or Dashashwamedh Ghat. Breakfast: Hot kachori-sabzi and jalebi at Ram Bhandar in Chowk.';
        afternoon = 'Stroll through the heritage alleyways of the Old City; explore Vishwanath Gali markets and try authentic Banarasi lassi at Pehlwan Lassi.';
        evening = 'Witness the sunset Ganga Aarti at Dashashwamedh Ghat from a riverboat or ghat steps. Dinner: Legendary Tamatar Chaat and Dahi Golgappa at Kashi Chaat Bhandar.';
      } else if (d === 2) {
        dayTheme = 'Sacred Darshan, Subah-e-Banaras & Historic Corridors';
        morning = 'Early sunrise Subah-e-Banaras boat ride along Assi Ghat. Morning VIP/general darshan at the Kashi Vishwanath Golden Temple Corridor.';
        afternoon = 'Visit Annapurna Mandir and Kaal Bhairav temple. Enjoy winter Malaiyo froth dessert or refreshing saffron Thandai.';
        evening = 'Explore Assi Ghat evening cultural concerts; relax at an open-air riverfront terrace cafe.';
      } else if (d === 3) {
        dayTheme = 'Sarnath Buddhist Heritage & Banarasi Silk Weaving';
        morning = 'Excursion to Sarnath (10 km): Dhamek Stupa, Ashoka Pillar, and the Archaeological Museum.';
        afternoon = 'Visit a traditional Banarasi silk handloom weaving cluster; witness master artisans weaving zari sarees.';
        evening = 'Sunset boat ride past historic Manikarnika and Harishchandra Ghats; sample famous Banarasi Maghai Paan at Chowk.';
      } else if (d === 4) {
        dayTheme = 'Ramnagar Fort, BHU & Souvenir Shopping';
        morning = 'Visit the 18th-century Ramnagar Fort and vintage museum across the Ganga; tour Banaras Hindu University (BHU) and the New Vishwanath Temple.';
        afternoon = 'Shop for authentic Banarasi silk stoles, brass handicrafts, and Lal Peda sweets in Godowlia market.';
        evening = 'Final quiet walk along the riverfront steps, sunset blessings, and departure transfer.';
      } else {
        dayTheme = `Extended Exploration Day ${d} — Excursion & Culture`;
        morning = 'Day excursion to historic Chunar Fort or Vindhyachal pilgrimage.';
        afternoon = 'Discover quieter northern ghats (Panchganga, Scindia, Rajghat) and local ashrams.';
        evening = 'Leisurely riverside dining soaking in Kashi spiritual ambience.';
      }
    } else if (/\b(prayagraj|allahabad)\b/i.test(cLower)) {
      if (d === 1) {
        dayTheme = 'Triveni Sangam Confluence & Sacred Darshan';
        morning = 'Early sunrise authorized boat ride to the holy Triveni Sangam (confluence of Ganga, Yamuna & subterranean Saraswati); take a sacred dip. Breakfast: Netram Ki Kachori-Sabzi in Civil Lines.';
        afternoon = 'Visit the underground Bade Hanuman Ji Temple (reclining posture), view the historic Allahabad Fort ramparts, and see the sacred Akshayavat tree.';
        evening = 'Sunset stroll along the riverbanks with steaming hot earthen kulhad chai; sample famous melt-in-mouth Dehati Rasgulla.';
      } else if (d === 2) {
        dayTheme = 'Freedom Struggle Heritage, Anand Bhavan & Khusro Bagh';
        morning = 'Visit Anand Bhavan (the ancestral home of the Nehru family and epicenter of India\'s independence struggle) and the adjacent Swaraj Bhavan.';
        afternoon = 'Admire the Gothic Victorian architecture of All Saints Cathedral (Church of Stone), then explore the sprawling Mughal tombs and mango orchards at Khusro Bagh.';
        evening = 'High street shopping and dining in Civil Lines; sample seasonal Allahabadi Surkha (red) guavas and Rabri-Jalebi before departure.';
      } else {
        dayTheme = `Day ${d}: Spiritual Circuits & Excursions`;
        morning = 'Excursion to Shringverpur (ancient hermitage of Sage Shringi along the Ganga) or Shankar Viman Mandapam.';
        afternoon = 'Explore local literary archives and Hindi Sahitya Sammelan heritage libraries.';
        evening = 'Peaceful evening contemplation along the Sangam ghats.';
      }
    } else if (/\b(ayodhya)\b/i.test(cLower)) {
      if (d === 1) {
        dayTheme = 'Ram Janmabhoomi & Sacred Darshan';
        morning = 'Darshan at the grand Shri Ram Janmabhoomi Mandir; visit Hanumangarhi for blessings.';
        afternoon = 'Explore Kanak Bhawan (Golden Palace) and Dashrath Mahal; enjoy a traditional satvik lunch.';
        evening = 'Experience the evening Maha Aarti at Ram Ki Paidi along the holy Saryu River; visit Surya Kund laser show.';
      } else if (d === 2) {
        dayTheme = 'Saryu Ghats & Cultural Pilgrimage';
        morning = 'Sunrise holy dip and peaceful boat ride along Naya Ghat and Guptar Ghat (where Lord Rama took Jal Samadhi).';
        afternoon = 'Visit Mani Parbat and Sita Ki Rasoi; sample local Ayodhya pedas and rabdi.';
        evening = 'Stroll the illuminated Ram Path; peaceful departure transfer from Ayodhya Dham Junction or Maharishi Valmiki Airport.';
      } else {
        dayTheme = `Day ${d}: Holy Circuit & Excursions`;
        morning = 'Excursion to Bharat Kund (Nandigram) where Bharata ruled Ayodhya with Rama\'s padukas.';
        afternoon = 'Visit ancient ashrams and spiritual libraries along the Saryu belt.';
        evening = 'Evening river contemplation and peaceful departure.';
      }
    } else if (/\b(lucknow)\b/i.test(cLower)) {
      if (d === 1) {
        dayTheme = 'Nawabi Grandeur & Awadhi Culinary Trail';
        morning = 'Visit the colossal Bara Imambara, navigate the labyrinthine Bhool Bhulaiya, and see Rumi Darwaza.';
        afternoon = 'Head to Chowk for lunch at the legendary Tunday Kababi (melt-in-mouth Galawati Kebabs with Sheermal).';
        evening = 'Stroll Hazratganj high street; indulge in Basket Chaat at Royal Cafe, followed by Prakash Ki Kulfi in Aminabad.';
      } else if (d === 2) {
        dayTheme = 'British Residency, Chhota Imambara & Chikankari Shopping';
        morning = 'Walk through the poignant ruins of the British Residency (1857 First War of Independence epicentre).';
        afternoon = 'Visit the Chhota Imambara (Palace of Lights) and the historic Husainabad Clock Tower.';
        evening = 'Shop for authentic hand-embroidered Chikankari kurtas in Janpath and Aminabad; dinner at Dastarkhwan (Awadhi Dum Biryani).';
      } else {
        dayTheme = `Day ${d}: Arts, Parks & Excursions`;
        morning = 'Visit the State Museum and relax at Janeshwar Mishra Park or Gomti Riverfront.';
        afternoon = 'Explore artisan attar (natural perfume) distilleries in the old quarter.';
        evening = 'Fine dining and traditional Kathak performance or Awadhi musical evening.';
      }
    } else if (/\b(mathura|vrindavan)\b/i.test(cLower)) {
      if (d === 1) {
        dayTheme = 'Mathura: Shri Krishna Janmabhoomi & Yamuna Aarti';
        morning = 'Visit the sacred Shri Krishna Janmasthan Temple complex and Keshavdev Ji Mandir. Breakfast: Crispy kachoris with aloo jhol and famous Mathura Peda.';
        afternoon = 'Explore Dwarkadhish Temple and the historic museum at Dampier Park; walk along the ancient ghats of the Yamuna.';
        evening = 'Attend the majestic sunset Yamuna Aarti at Vishram Ghat from a decorated wooden boat; dinner tasting traditional Brij satvik thali.';
      } else if (d === 2) {
        dayTheme = 'Vrindavan: Banke Bihari & Prem Mandir Spectacle';
        morning = 'Early morning darshan at Banke Bihari Temple; immerse in kirtan and devotional atmosphere. Try creamy Makhan Mishri and thick kulhad lassi.';
        afternoon = 'Visit the Radha Raman Temple, historic Nidhivan, and the sprawling white-marble ISKCON Krishna Balaram Mandir.';
        evening = 'Witness the breathtaking musical fountain and evening laser illumination at Prem Mandir (Temple of Divine Love). Departure transfer.';
      } else {
        dayTheme = `Day ${d}: Govardhan & Barsana Parikrama`;
        morning = 'Excursion to Govardhan Hill for holy parikrama and Radha Kund holy bath.';
        afternoon = 'Visit Barsana (Radha Rani Temple) and Nandgaon for scenic Brij countryside views.';
        evening = 'Peaceful evening Aarti and departure.';
      }
    } else if (/\b(agra)\b/i.test(cLower)) {
      if (d === 1) {
        dayTheme = 'Taj Mahal Sunrise & Mughal Grandeur';
        morning = 'Early sunrise entry at Taj Mahal (East Gate) for the best light. Breakfast: Bedai & Dubki Wale Aloo with crisp Jalebis at Deviram Sweets.';
        afternoon = 'Explore the grand red-sandstone Agra Fort (UNESCO World Heritage Site), Jahangiri Mahal, and Diwan-i-Khas.';
        evening = 'Sunset views across the Yamuna River from Mehtab Bagh garden with reflection photos of the Taj. Dinner tasting Mughlai kebabs along Fatehabad Road.';
      } else if (d === 2) {
        dayTheme = 'Fatehpur Sikri Day Excursion & Baby Taj';
        morning = 'Trip to Fatehpur Sikri (37 km): Buland Darwaza, Jama Masjid, Tomb of Sheikh Salim Chishti, and Panch Mahal.';
        afternoon = 'Return to Agra; visit the exquisite marble inlay Tomb of I\'timad-ud-Daulah (Baby Taj).';
        evening = 'Shop for genuine Panchhi Petha (Kesar, Angoori, Paan) and marble inlay handicrafts in Sadar Bazaar.';
      } else if (d === 3) {
        dayTheme = 'Akbar\'s Tomb & Old City Heritage';
        morning = 'Visit Akbar\'s red-sandstone Tomb at Sikandra; explore the expansive gardens with roaming blackbucks.';
        afternoon = 'Walk through the vibrant Kinari Bazaar and visit the historic Jama Masjid of Agra.';
        evening = 'Rooftop dinner overlooking illuminated monuments and transfer for onward transit.';
      } else {
        dayTheme = `Regional Discovery Day ${d}`;
        morning = 'Side trip to Mathura-Vrindavan (55 km) or Keoladeo Bird Sanctuary (Bharatpur, 55 km).';
        afternoon = 'Visit Brij temples or sanctuary wetlands; return to Agra for evening departure.';
        evening = 'Relaxed evening and local market dinner.';
      }
    } else {
      dayTheme = `Day ${d}: Discovering ${cityName}`;
      morning = `Explore premier heritage landmarks, ancient monuments, and cultural sites in ${cityName}.`;
      afternoon = `Experience local culinary specialties, street food stalls, and traditional artisan bazaars.`;
      evening = `Scenic sunset stroll at local promenade, riverfront, or cultural evening hub.`;
    }

    itinerary.push({
      day: d,
      theme: dayTheme,
      morning,
      afternoon,
      evening
    });
  }

  return {
    destination: cityName,
    days: numDays,
    travelers: numTravelers,
    budgetSummary: budgetBreakdown,
    topAttractions: cityInfo ? cityInfo.places : 'Top city landmarks and heritage sites',
    recommendedFood: cityInfo ? cityInfo.food : 'Famous local street food and culinary specialties',
    bestTime: cityInfo ? (cityInfo.best_time || 'October to March') : 'October to March',
    localTip: cityInfo ? cityInfo.tip : 'Start sightseeing early in the morning to beat crowds and weather.',
    itinerary
  };
}

function searchUpTourism({ destination, topic = 'all' }) {
  const districts = getDistrictsData();
  const destLower = (destination || '').toLowerCase().trim();
  let match = districts.find(
    (d) => (d.name && d.name.toLowerCase() === destLower) || (d.id && d.id.toLowerCase() === destLower)
  );
  if (!match) {
    match = districts.find(
      (d) => (d.name && destLower.includes(d.name.toLowerCase())) || (d.id && destLower.includes(d.id.toLowerCase()))
    );
  }
  if (!match) {
    return {
      found: false,
      message: `No specific entry found for "${destination}" in ExploreUP official district records. You can still provide helpful general knowledge.`
    };
  }

  const result = {
    found: true,
    name: match.name,
    about: match.about,
    attractions: match.places,
    cuisine: match.food,
    bestTimeToVisit: match.best_time,
    insiderTip: match.tip
  };

  if (match.hotels) result.hotels = match.hotels;
  if (match.transport) result.transport = match.transport;
  if (match.food_items) result.foodItems = match.food_items;

  return result;
}

const toolRegistry = {
  calculate: {
    definition: {
      type: 'function',
      function: {
        name: 'calculate',
        description: 'Perform a safe mathematical calculation (arithmetic, percentages, division, totals, budget splits). Use this tool whenever a calculation or math expression is requested.',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'The mathematical expression to evaluate, e.g. "12500 / 5", "15% of 12000", "5000 + 2500", "10000 / 3"'
            }
          },
          required: ['expression']
        }
      }
    },
    execute: async (args) => safeCalculate(args.expression)
  },

  plan_trip: {
    definition: {
      type: 'function',
      function: {
        name: 'plan_trip',
        description: 'Generate a practical, structured travel itinerary and budget breakdown for a destination in Uttar Pradesh or nearby.',
        parameters: {
          type: 'object',
          properties: {
            destination: {
              type: 'string',
              description: 'The city or destination, e.g. "Varanasi", "Agra", "Lucknow", "Ayodhya", "Mathura", "Prayagraj"'
            },
            days: {
              type: 'integer',
              description: 'Number of days for the trip (e.g. 1 to 14)'
            },
            travelers: {
              type: 'integer',
              description: 'Number of travelers/people (default: 1)'
            },
            budget: {
              type: 'string',
              description: 'Total budget amount or tier, e.g. "₹10,000", "10000", "budget", "luxury"'
            },
            interests: {
              type: 'string',
              description: 'Traveler interests, e.g. "food, temples, heritage, photography"'
            },
            style: {
              type: 'string',
              description: 'Travel style, e.g. "budget", "comfort", "fast-paced", "relaxed"'
            }
          },
          required: ['destination', 'days']
        }
      }
    },
    execute: async (args) => planTrip(args)
  },

  search_up_tourism: {
    definition: {
      type: 'function',
      function: {
        name: 'search_up_tourism',
        description: 'Look up verified information about Uttar Pradesh districts, cities, monuments, street food, best visit timings, and travel tips from the official ExploreUP database.',
        parameters: {
          type: 'object',
          properties: {
            destination: {
              type: 'string',
              description: 'The district or city name (e.g. "Agra", "Varanasi", "Lucknow", "Ayodhya", "Prayagraj", "Jhansi")'
            },
            topic: {
              type: 'string',
              description: 'Specific topic to retrieve: "attractions", "food", "best_time", "tips", "all"'
            }
          },
          required: ['destination']
        }
      }
    },
    execute: async (args) => searchUpTourism(args)
  },

  search_web: {
    definition: {
      type: 'function',
      function: {
        name: 'search_web',
        description: 'Search the live web for current real-time information, events happening this week, opening hours today, hotel rates, transport status, or latest tourism news. Use this when the user asks for current/live information.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to look up on the internet (e.g. "Taj Mahal opening hours today", "events in Varanasi this week", "hotels in Agra current prices")'
            }
          },
          required: ['query']
        }
      }
    },
    execute: async (args) => {
      const results = await liveWebSearch(args.query);
      return { results };
    }
  },

  google_maps_places: {
    definition: {
      type: 'function',
      function: {
        name: 'google_maps_places',
        description: 'Look up places, routes, directions, and geographic landmarks across Uttar Pradesh.',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'Place, city, or landmark name' }
          },
          required: ['location']
        }
      }
    },
    execute: async (args) => ({ status: 'success', location: args.location, note: 'Location referenced for navigation guidance.' })
  },

  get_weather: {
    definition: {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather and seasonal forecast for any Uttar Pradesh city.',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'City name (e.g. "Varanasi", "Lucknow", "Agra")' }
          },
          required: ['city']
        }
      }
    },
    execute: async (args) => {
      const webInfo = await liveWebSearch(`${args.city} current weather forecast`);
      return { city: args.city, forecast: webInfo[0]?.snippet || 'Pleasant travel weather typical for the season.' };
    }
  },

  search_hotels: {
    definition: {
      type: 'function',
      function: {
        name: 'search_hotels',
        description: 'Search for hotels, heritage homestays, and accommodation options with rates.',
        parameters: {
          type: 'object',
          properties: {
            destination: { type: 'string', description: 'City or district name' },
            budget_tier: { type: 'string', description: 'budget, comfort, or luxury' }
          },
          required: ['destination']
        }
      }
    },
    execute: async (args) => {
      const webHotels = await liveWebSearch(`best hotels stays in ${args.destination} ${args.budget_tier || ''}`);
      return { destination: args.destination, recommendations: webHotels };
    }
  },

  search_transportation: {
    definition: {
      type: 'function',
      function: {
        name: 'search_transportation',
        description: 'Search for trains, buses, expressways, and flights connecting Uttar Pradesh cities.',
        parameters: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Departure city' },
            to: { type: 'string', description: 'Arrival destination city' }
          },
          required: ['from', 'to']
        }
      }
    },
    execute: async (args) => {
      const transportResults = await liveWebSearch(`how to travel from ${args.from} to ${args.to} train bus expressway`);
      return { route: `${args.from} to ${args.to}`, options: transportResults };
    }
  }
};

// Live Web Search Retriever
function liveWebSearch(query) {
  return new Promise((resolve) => {
    if (!query || typeof query !== 'string') return resolve([]);
    const cleanQuery = query.replace(/["']/g, '').trim();
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      },
      (res) => {
        let html = '';
        res.on('data', (c) => (html += c));
        res.on('end', () => {
          const results = [];
          const regex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>)?/gi;
          let m;
          while ((m = regex.exec(html)) !== null && results.length < 5) {
            let href = m[1];
            if (href.includes('uddg=')) {
              try {
                const p = new URL(href.startsWith('//') ? 'https:' + href : href);
                const a = p.searchParams.get('uddg');
                if (a) href = a;
              } catch (e) {}
            }
            const title = m[2].replace(/<[^>]+>/g, '').trim();
            const snippet = m[3] ? m[3].replace(/<[^>]+>/g, '').trim() : '';
            if (title && href.startsWith('http')) {
              results.push({ title, url: href, snippet });
            }
          }
          resolve(results);
        });
      }
    );
    req.on('error', (e) => {
      console.warn('Web search request error:', e.message);
      resolve([]);
    });
    req.setTimeout(5000, () => {
      req.destroy();
      resolve([]);
    });
  });
}

// Gemini Function Declarations for @google/genai SDK
const geminiTools = [
  {
    functionDeclarations: [
      {
        name: 'search_web',
        description: 'Search the live web for current real-time information, events happening this week, opening hours today, hotel rates, transport status, or latest tourism news. Use this when the user asks for current/live information.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: {
              type: 'STRING',
              description: 'The search query to look up on the internet (e.g. "Taj Mahal opening hours today", "events in Varanasi this week", "hotels in Agra current prices")'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'calculate',
        description: 'Perform a safe mathematical calculation (arithmetic, percentages, division, totals, budget splits). Use this tool whenever a calculation or math expression is requested.',
        parameters: {
          type: 'OBJECT',
          properties: {
            expression: {
              type: 'STRING',
              description: 'The mathematical expression to evaluate, e.g. "12500 / 5", "15% of 12000", "5000 + 2500", "10000 / 3"'
            }
          },
          required: ['expression']
        }
      },
      {
        name: 'plan_trip',
        description: 'Generate a practical, structured travel itinerary and budget breakdown for a destination in Uttar Pradesh or nearby.',
        parameters: {
          type: 'OBJECT',
          properties: {
            destination: {
              type: 'STRING',
              description: 'The city or destination, e.g. "Varanasi", "Agra", "Lucknow", "Ayodhya", "Prayagraj", "Mathura"'
            },
            days: {
              type: 'INTEGER',
              description: 'Number of days for the trip'
            },
            travelers: {
              type: 'INTEGER',
              description: 'Number of travelers/people (default: 1)'
            },
            budget: {
              type: 'STRING',
              description: 'Total budget amount or tier, e.g. "₹10,000", "10000", "budget", "luxury"'
            },
            interests: {
              type: 'STRING',
              description: 'Traveler interests, e.g. "temples, food, heritage"'
            },
            style: {
              type: 'STRING',
              description: 'Travel style, e.g. "budget", "comfort", "relaxed"'
            }
          },
          required: ['destination', 'days']
        }
      },
      {
        name: 'search_up_tourism',
        description: 'Look up verified information about Uttar Pradesh districts, cities, monuments, street food, best visit timings, and travel tips from the official ExploreUP database.',
        parameters: {
          type: 'OBJECT',
          properties: {
            destination: {
              type: 'STRING',
              description: 'The district or city name (e.g. "Agra", "Varanasi", "Lucknow", "Ayodhya", "Prayagraj")'
            },
            topic: {
              type: 'STRING',
              description: 'Specific topic to retrieve: "attractions", "food", "best_time", "tips", "all"'
            }
          },
          required: ['destination']
        }
      },
      {
        name: 'google_maps_places',
        description: 'Look up directions, routes, or location coordinates for landmarks and tourist spots.',
        parameters: {
          type: 'OBJECT',
          properties: {
            location: { type: 'STRING', description: 'Place, city, or landmark name' }
          },
          required: ['location']
        }
      },
      {
        name: 'get_weather',
        description: 'Get current weather and seasonal forecast for any Uttar Pradesh city.',
        parameters: {
          type: 'OBJECT',
          properties: {
            city: { type: 'STRING', description: 'City name' }
          },
          required: ['city']
        }
      },
      {
        name: 'search_hotels',
        description: 'Search for hotels and stays with pricing and ratings.',
        parameters: {
          type: 'OBJECT',
          properties: {
            destination: { type: 'STRING', description: 'City or district name' },
            budget_tier: { type: 'STRING', description: 'budget, comfort, or luxury' }
          },
          required: ['destination']
        }
      },
      {
        name: 'search_transportation',
        description: 'Search for trains, buses, expressways, and flight options connecting Uttar Pradesh cities.',
        parameters: {
          type: 'OBJECT',
          properties: {
            from: { type: 'STRING', description: 'Departure city' },
            to: { type: 'STRING', description: 'Arrival destination city' }
          },
          required: ['from', 'to']
        }
      }
    ]
  }
];

// Initialize Primary Gemini Client
let geminiClient = null;
function getGeminiClient() {
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (key && key !== 'your_gemini_api_key_here') {
    if (!geminiClient) {
      try {
        geminiClient = new GoogleGenAI({ apiKey: key });
        console.log(`GoogleGenAI client ready (Primary AI Backend with model: ${process.env.GEMINI_MODEL || 'gemini-3.5-flash'})`);
      } catch (err) {
        console.warn('GoogleGenAI initialization error:', err.message);
        return null;
      }
    }
    return geminiClient;
  }
  return null;
}
getGeminiClient();

// Initialize Secondary OpenAI client (Fallback)
let openaiClient = null;
function getOpenAIClient() {
  const key = (process.env.OPENAI_API_KEY || '').trim();
  if (key && key !== 'your_openai_api_key_here') {
    if (!openaiClient || openaiClient.apiKey !== key) {
      try {
        openaiClient = new OpenAI({ apiKey: key });
        console.log(`OpenAI client ready (Fallback with model: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'})`);
      } catch (err) {
        console.warn('OpenAI SDK initialization error:', err.message);
        return null;
      }
    }
    return openaiClient;
  }
  return null;
}
getOpenAIClient();

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
// CHAT ROUTE (General-Purpose Conversational AI & UP Travel Specialist)
// =========================================================
app.post('/api/chat', async (req, res) => {
  try {
    const query = (req.body.query || req.body.message || req.body.prompt || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Query prompt is required.' });
    }

    const isGuest = !(req.session && (req.session.userName || req.session.user));
    const userName = isGuest
      ? null
      : (req.session.userName || (req.session.user && req.session.user.username) || 'Traveler');
    const userBookings = isGuest ? [] : getUserBookings(userName, req.session.user);
    const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

    // Maintain conversation history in session (preserved during current chat session)
    if (!Array.isArray(req.session.chatHistory)) {
      req.session.chatHistory = [];
    }

    // User status and bookings context
    const userStatusDesc = isGuest
      ? "User Status: GUEST (not logged in). If they ask to view or check their personal bookings/tickets on ExploreUP, politely guide them to log in or create an account via the top navigation bar. For general travel planning, answering questions, or general conversations, assist them fully."
      : `User Status: LOGGED IN as "${userName}".${userBookings.length > 0 ? `\nVerified Bookings on ExploreUP:\n${JSON.stringify(userBookings, null, 2)}` : '\nNo active travel bookings on file.'}`;

    // System instruction: General-purpose AI with Uttar Pradesh tourism expertise and Grounding rules
    const systemPrompt = `You are Arya, the AI travel assistant for ExploreUP.

You are a general-purpose conversational AI assistant with specialized expertise in Uttar Pradesh tourism.

Understand the user's actual request before responding.

You can have normal conversations, answer general questions, perform calculations using tools, create travel plans, help with budgets, recommend destinations, and answer Uttar Pradesh tourism questions.

Do not force unrelated questions into tourism answers.

For travel planning, ask only for information that is genuinely necessary. If enough information is available, make a useful plan immediately.

Remember the current conversation and understand follow-up questions.

Be natural, helpful, concise when appropriate, and detailed when the user asks for detail.

GROUNDING & CURRENT INFORMATION RULES:
1. When the user asks for current, live, or real-time information (e.g. "What's happening in Varanasi this week?", "Are these places open today?", "Find current information about hotels in Agra", "What are the latest travel options from Lucknow to Varanasi?", "Find current information about a tourist attraction", "Search the web for current tourism information"), call the 'search_web' tool ONCE with a focused query.
2. Once you receive search results, synthesize a helpful, comprehensive response directly for the traveler.
3. Rely on official tourism, government, or verified business information.
4. Do NOT invent or hallucinate current hotel prices, opening hours, train schedules, weather, events, or live availability.
5. Clearly distinguish current web information from general historical knowledge.
6. For normal conversation (e.g. "Hi", "Hello Arya", "Tell me a joke") or general knowledge (e.g. "What is artificial intelligence?"), do NOT search the web unnecessarily.
7. For trip planning, synthesize: (a) user's requirements, (b) ExploreUP knowledge, and (c) current web information when needed.

TOOL USAGE GUIDELINES:
- 'search_web': Use whenever current live internet data, weekly events, opening hours, or recent travel options are requested.
- 'calculate': Use for math calculations, budget division, percentages, and bill splitting (e.g. "Calculate 12500 / 5", "15% of ₹12000", "Divide ₹10000 between 3 people").
- 'plan_trip': Use to generate practical day-by-day itineraries and budget breakdowns for UP destinations.
- 'search_up_tourism': Use to query official ExploreUP verified facts, monuments, food, and insider tips.

${userStatusDesc}
`;

    // 1. PRIMARY AI BACKEND: Gemini with Web-Search Grounding & Tool Support
    const gemini = getGeminiClient();
    if (gemini) {
      try {
        const candidateModels = [
          GEMINI_MODEL,
          'gemini-3.5-flash',
          'gemini-3.6-flash',
          'gemini-3.7-flash',
          'gemini-3.5-flash-lite',
          'gemini-flash-latest'
        ].filter(Boolean);
        const uniqueModels = [...new Set(candidateModels)];

        // Map session chat history to Gemini alternating format
        const geminiHistory = [];
        const recentHistory = req.session.chatHistory.slice(-10);
        let expectedRole = 'user';
        for (const msg of recentHistory) {
          const gRole = msg.role === 'user' ? 'user' : 'model';
          if (gRole === expectedRole && msg.content) {
            geminiHistory.push({
              role: gRole,
              parts: [{ text: msg.content }]
            });
            expectedRole = expectedRole === 'user' ? 'model' : 'user';
          }
        }
        if (geminiHistory.length > 0 && geminiHistory[geminiHistory.length - 1].role === 'user') {
          geminiHistory.pop();
        }

        let chat = null;
        let chatResponse = null;
        let usedModel = uniqueModels[0];
        let finalReply = '';
        const citations = [];

        for (const m of uniqueModels) {
          try {
            usedModel = m;
            citations.length = 0; // reset citations for clean attempt
            chat = gemini.chats.create({
              model: m,
              history: geminiHistory,
              config: {
                systemInstruction: systemPrompt,
                tools: geminiTools
              }
            });
            chatResponse = await chat.sendMessage({ message: query });

            let loopCount = 0;
            while (chatResponse && chatResponse.functionCalls && chatResponse.functionCalls.length > 0 && loopCount < 3) {
              loopCount++;
              const call = chatResponse.functionCalls[0];
              const toolName = call.name;
              const toolArgs = call.args || {};
              let toolResult;

              if (toolName === 'search_web') {
                const cleanQuery = (toolArgs.query || query).replace(/["']/g, '');
                const searchResults = await liveWebSearch(cleanQuery);
                searchResults.forEach((r) => citations.push({ title: r.title, url: r.url }));
                toolResult = {
                  status: 'success',
                  query: cleanQuery,
                  count: searchResults.length,
                  results: searchResults
                };
              } else if (toolName === 'calculate') {
                toolResult = safeCalculate(toolArgs.expression);
              } else if (toolName === 'plan_trip') {
                toolResult = planTrip(toolArgs);
              } else if (toolName === 'search_up_tourism') {
                toolResult = searchUpTourism(toolArgs);
              } else if (toolRegistry[toolName]) {
                toolResult = await toolRegistry[toolName].execute(toolArgs);
              } else {
                toolResult = { message: `Tool ${toolName} acknowledged.` };
              }

              chatResponse = await chat.sendMessage({
                message: [
                  {
                    functionResponse: {
                      name: toolName,
                      response: toolResult
                    }
                  }
                ]
              });
            }

            finalReply = (chatResponse && chatResponse.text) ? chatResponse.text.trim() : '';

            // Native Google Search grounding metadata if present
            const gMeta = chatResponse?.candidates?.[0]?.groundingMetadata;
            if (gMeta && Array.isArray(gMeta.groundingChunks)) {
              for (const chunk of gMeta.groundingChunks) {
                if (chunk.web && chunk.web.uri) {
                  citations.push({
                    title: chunk.web.title || chunk.web.uri,
                    url: chunk.web.uri
                  });
                }
              }
            }

            // Format citations if web search was used
            if (citations.length > 0 && !finalReply.includes('http')) {
              const uniqueUrls = new Set();
              const uniqueCitations = [];
              for (const c of citations) {
                if (c.url && !uniqueUrls.has(c.url)) {
                  uniqueUrls.add(c.url);
                  uniqueCitations.push(c);
                }
              }
              if (uniqueCitations.length > 0) {
                finalReply += '\n\n🌐 **Sources & Current Information:**\n' +
                  uniqueCitations.slice(0, 4).map((c) => `• [${c.title}](${c.url})`).join('\n');
              }
            }

            if (finalReply) {
              break; // Successfully got response from model m
            }
          } catch (mErr) {
            console.warn(`Gemini model ${m} attempt failed:`, mErr.message);
            if (m === uniqueModels[uniqueModels.length - 1]) {
              throw mErr;
            }
          }
        }

        if (finalReply) {
          req.session.chatHistory.push({ role: 'user', content: query });
          req.session.chatHistory.push({ role: 'assistant', content: finalReply });
          if (req.session.chatHistory.length > 20) {
            req.session.chatHistory = req.session.chatHistory.slice(-20);
          }

          return res.status(200).json({
            reply: finalReply,
            user: isGuest ? 'Guest' : userName,
            authenticated: !isGuest,
            source: 'gemini',
            model: usedModel,
            timestamp: new Date().toISOString()
          });
        }
      } catch (geminiErr) {
        console.warn('Gemini execution encountered error, checking fallback:', geminiErr.message);
      }
    }

    // 2. SECONDARY BACKEND (OpenAI Fallback)
    const openAiClient = getOpenAIClient();
    if (openAiClient) {
      try {
        const historyMessages = req.session.chatHistory.slice(-10).map((msg) => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

        const messages = [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: query }
        ];

        let finalReply = '';
        let loopCount = 0;
        const maxLoops = 3;

        while (loopCount < maxLoops) {
          loopCount++;
          const completion = await openAiClient.chat.completions.create({
            model: OPENAI_MODEL,
            messages,
            tools: Object.values(toolRegistry).map((t) => t.definition),
            tool_choice: 'auto',
            temperature: 0.7,
            max_tokens: 1500
          });

          const responseMessage = completion.choices?.[0]?.message;
          if (!responseMessage) break;

          if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            messages.push(responseMessage);

            for (const toolCall of responseMessage.tool_calls) {
              const toolName = toolCall.function.name;
              let toolArgs = {};
              try {
                toolArgs = JSON.parse(toolCall.function.arguments || '{}');
              } catch (parseErr) {
                console.warn(`Failed to parse arguments for ${toolName}:`, parseErr.message);
              }

              let toolResult = { error: `Tool ${toolName} not found.` };
              if (toolRegistry[toolName]) {
                try {
                  toolResult = await toolRegistry[toolName].execute(toolArgs);
                } catch (execErr) {
                  toolResult = { error: `Tool execution error: ${execErr.message}` };
                }
              }

              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult)
              });
            }
            continue;
          }

          if (responseMessage.content) {
            finalReply = responseMessage.content.trim();
          }
          break;
        }

        if (finalReply) {
          req.session.chatHistory.push({ role: 'user', content: query });
          req.session.chatHistory.push({ role: 'assistant', content: finalReply });
          if (req.session.chatHistory.length > 20) {
            req.session.chatHistory = req.session.chatHistory.slice(-20);
          }

          return res.status(200).json({
            reply: finalReply,
            user: isGuest ? 'Guest' : userName,
            authenticated: !isGuest,
            source: 'openai',
            model: OPENAI_MODEL,
            timestamp: new Date().toISOString()
          });
        }
      } catch (openAiErr) {
        console.warn('OpenAI fallback call error:', openAiErr.message);
      }
    }

    // 3. EMERGENCY OFFLINE FALLBACK (Safe Calculator, Plan Trip & Helpful Assistance)
    let handledReply = '';

    // Safe Calculator direct fallback if query requested calculation
    if (/\b(calculate|compute|divide|split|\d+\s*[\+\-\*\/]\s*\d+|\d+%\s*of)\b/i.test(query)) {
      let calcQuery = query;
      if (/\b(that budget|the budget|that amount|that total)\b/i.test(calcQuery) && Array.isArray(req.session.chatHistory)) {
        for (let i = req.session.chatHistory.length - 1; i >= 0; i--) {
          const prevContent = req.session.chatHistory[i].content || '';
          const foundAmount = prevContent.match(/₹\s*([0-9]+(?:,[0-9]+)*)/);
          if (foundAmount) {
            calcQuery = calcQuery.replace(/\b(that budget|the budget|that amount|that total)\b/gi, foundAmount[1]);
            break;
          }
        }
      }
      const calcResult = safeCalculate(calcQuery);
      if (!calcResult.error && typeof calcResult.result === 'number') {
        const isPerPerson = /\b(people|person|persons|travelers|pax|friends)\b/i.test(query);
        handledReply = `**Calculation Result:** ${calcResult.sanitized} = **${calcResult.result.toLocaleString('en-IN')}${isPerPerson ? ' per person' : ''}**`;
      }
    }

    // Trip Planner direct fallback if query requested trip plan
    if (!handledReply && /\b(plan|itinerary|trip to|tour to|days? trip|days? tour)\b/i.test(query)) {
      const daysMatch = query.match(/(\d+)\s*days?/i);
      const numDays = daysMatch ? parseInt(daysMatch[1], 10) : 3;
      const peopleMatch = query.match(/(\d+)\s*(?:people|persons|travelers|pax)/i);
      const numPeople = peopleMatch ? parseInt(peopleMatch[1], 10) : 1;
      const budgetMatch = query.match(/(?:budget of\s*|budget\s*[:=]?\s*|₹\s*)([₹\d,]+)/i);
      const budgetStr = budgetMatch ? budgetMatch[1] : null;

      const districts = getDistrictsData();
      const sortedDistricts = [...districts].sort((a, b) => (b.name ? b.name.length : 0) - (a.name ? a.name.length : 0));
      const cityMatch = sortedDistricts.find((d) => d.name && new RegExp(`\\b${d.name}\\b`, 'i').test(query));
      const destCity = cityMatch ? cityMatch.name : (query.match(/to\s+([A-Za-z]+)/i) ? query.match(/to\s+([A-Za-z]+)/i)[1] : 'Uttar Pradesh');

      const plan = planTrip({ destination: destCity, days: numDays, travelers: numPeople, budget: budgetStr });
      let planText = `Here is your practical ${plan.days}-day trip plan for **${plan.destination}**`;
      if (plan.travelers > 1) planText += ` for ${plan.travelers} travelers`;
      if (plan.budgetSummary) planText += ` (Budget: ${plan.budgetSummary.totalBudget}, ~${plan.budgetSummary.perPersonPerDay})`;
      planText += `:\n\n`;

      if (plan.budgetSummary) {
        planText += `💰 **Estimated Budget Breakdown (${plan.budgetSummary.tier}):**\n`;
        planText += `• Accommodation: ${plan.budgetSummary.allocation.accommodation}\n`;
        planText += `• Food & Dining: ${plan.budgetSummary.allocation.foodAndDining}\n`;
        planText += `• Local Transit: ${plan.budgetSummary.allocation.localTransit}\n`;
        planText += `• Sightseeing & Entry Fees: ${plan.budgetSummary.allocation.sightseeingAndEntries}\n`;
        planText += `• Contingency Buffer: ${plan.budgetSummary.allocation.contingencyBuffer}\n\n`;
      }

      planText += `🗓️ **Day-by-Day Itinerary:**\n`;
      plan.itinerary.forEach((d) => {
        planText += `\n**Day ${d.day}: ${d.theme}**\n`;
        planText += `• Morning: ${d.morning}\n`;
        planText += `• Afternoon: ${d.afternoon}\n`;
        planText += `• Evening: ${d.evening}\n`;
      });

      planText += `\n🍲 **Must-Try Local Food:** ${plan.recommendedFood}\n`;
      planText += `💡 **Insider Tip:** ${plan.localTip}`;
      handledReply = planText;
    }

    // General fallback message if AI backends are unavailable
    if (!handledReply) {
      handledReply = "Namaste! I am currently operating in high-efficiency offline mode while connecting to live services. You can ask me to calculate budgets, split expenses, or generate detailed day-by-day travel itineraries across Uttar Pradesh!";
    }

    req.session.chatHistory.push({ role: 'user', content: query });
    req.session.chatHistory.push({ role: 'assistant', content: handledReply });
    if (req.session.chatHistory.length > 20) {
      req.session.chatHistory = req.session.chatHistory.slice(-20);
    }

    return res.status(200).json({
      reply: handledReply,
      user: isGuest ? 'Guest' : userName,
      authenticated: !isGuest,
      source: 'offline-engine',
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
  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath, err => {
        if (err && !res.headersSent) res.status(404).end();
      });
    }
  } catch (e) {}
  return res.sendFile(path.join(__dirname, 'index.html'), err => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (res.headersSent) return;
  console.error('Server error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Process-level guards
process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err.message);
});
process.on('unhandledRejection', reason => {
  console.error('Unhandled Rejection:', reason);
});

// Start Server only when executed directly (allows Vercel Serverless Function importing)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ExploreUP Express server running at http://localhost:${PORT}/`);
  });
}

module.exports = app;
