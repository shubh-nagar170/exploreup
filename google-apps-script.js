/**
 * ExploreUP Sheets Connection - Google Apps Script Backend (Dynamic Header Mapping)
 * 
 * Instructions:
 * 1. Open your Google Spreadsheet: "ExploreUP Database" (or your existing sheet)
 * 2. Go to Extensions -> Apps Script
 * 3. Replace all contents of Code.gs with this script.
 * 4. In Project Settings (gear icon) -> Script Properties:
 *    Add property: EXPLOREUP_API_SECRET = (your secret password/token)
 * 5. Click "Deploy" -> "New deployment"
 *    - Select type: "Web app"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (crucial for Vercel backend to connect)
 * 6. Copy the Web App URL and add it to your Vercel Project Environment Variables as GOOGLE_APPS_SCRIPT_URL
 *    and EXPLOREUP_API_SECRET
 */

function getScriptSecret() {
  var props = PropertiesService.getScriptProperties();
  return (props.getProperty('EXPLOREUP_API_SECRET') || '').trim();
}

function getFlexibleSheet(ss, standardName, defaultHeaders) {
  var cleanTarget = standardName.replace(/\s+/g, '').toLowerCase();
  var sheets = ss.getSheets();
  var sheet = null;
  
  for (var i = 0; i < sheets.length; i++) {
    var curClean = sheets[i].getName().replace(/\s+/g, '').toLowerCase();
    if (curClean === cleanTarget) {
      sheet = sheets[i];
      break;
    }
  }
  
  if (!sheet) {
    sheet = ss.insertSheet(standardName);
    if (defaultHeaders && defaultHeaders.length > 0) {
      sheet.appendRow(defaultHeaders);
      sheet.getRange(1, 1, 1, defaultHeaders.length).setFontWeight('bold');
    }
  } else if (sheet.getLastRow() === 0 && defaultHeaders && defaultHeaders.length > 0) {
    sheet.appendRow(defaultHeaders);
    sheet.getRange(1, 1, 1, defaultHeaders.length).setFontWeight('bold');
  }
  
  return sheet;
}

function getTargetSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var props = PropertiesService.getScriptProperties();
    var sheetId = (props.getProperty('SPREADSHEET_ID') || '').trim();
    if (sheetId) {
      try {
        ss = SpreadsheetApp.openById(sheetId);
      } catch (err) {
        return null;
      }
    }
  }
  return ss;
}

// =========================================================
// DYNAMIC HEADER MAPPING & COLUMN RESOLUTION
// Preserves existing spreadsheet columns, headers, and order.
// =========================================================

function normalizeHeaderName(name) {
  return String(name || '').trim().toLowerCase().replace(/[\s_\-\.]+/g, '');
}

var USER_COL_ALIASES = {
  id: ['id', 'userid', 'user_id'],
  name: ['name', 'username', 'user_name', 'fullname', 'full_name'],
  email: ['email', 'useremail', 'user_email', 'emailaddress', 'email_address'],
  passwordHash: ['passwordhash', 'password_hash'],
  createdAt: ['createdat', 'created_at', 'timestamp', 'date_created']
};

var TRIP_COL_ALIASES = {
  id: ['id', 'planid', 'plan_id', 'tripid', 'trip_id'],
  userEmail: ['useremail', 'user_email', 'email', 'owneremail', 'owner_email'],
  userName: ['username', 'user_name', 'name', 'travelername'],
  destination: ['destination', 'city', 'cityname', 'place'],
  days: ['days', 'duration', 'numdays', 'numberofdays'],
  budget: ['budget', 'budttier', 'budgettier', 'budget_tier'],
  planData: ['plandata', 'plan_data', 'details', 'tripjson'],
  createdAt: ['createdat', 'created_at', 'timestamp', 'date_created', 'updatedat']
};

var SAVED_PLACE_COL_ALIASES = {
  id: ['id', 'favoriteid', 'fav_id', 'placeid'],
  userEmail: ['useremail', 'user_email', 'email'],
  cityName: ['cityname', 'city_name', 'city', 'destination', 'place'],
  createdAt: ['createdat', 'created_at', 'timestamp', 'date_created']
};

var FEEDBACK_COL_ALIASES = {
  id: ['id', 'feedbackid', 'feedback_id'],
  cityName: ['cityname', 'city_name', 'city'],
  category: ['category', 'feedbackcategory', 'topic'],
  text: ['text', 'feedback', 'message', 'comment', 'comments', 'review'],
  authorName: ['authorname', 'author_name', 'author'],
  userEmail: ['useremail', 'user_email', 'email'],
  createdAt: ['createdat', 'created_at', 'timestamp', 'date_created']
};

var CONTACT_COL_ALIASES = {
  id: ['id', 'contactid', 'inquiryid'],
  name: ['name', 'fullname', 'contactname'],
  email: ['email', 'contactemail', 'useremail'],
  phone: ['phone', 'phonenumber', 'phone_number', 'mobile'],
  subject: ['subject', 'topic', 'inquiry_subject'],
  message: ['message', 'msg', 'body', 'text'],
  createdAt: ['createdat', 'created_at', 'timestamp', 'date_created']
};

var DEFAULT_USER_HEADERS = ['id', 'name', 'email', 'passwordHash', 'createdAt'];
var DEFAULT_TRIP_HEADERS = ['id', 'userEmail', 'userName', 'destination', 'days', 'budget', 'planData', 'createdAt'];
var DEFAULT_SAVED_PLACE_HEADERS = ['id', 'userEmail', 'cityName', 'createdAt'];
var DEFAULT_FEEDBACK_HEADERS = ['id', 'cityName', 'category', 'text', 'authorName', 'userEmail', 'createdAt'];
var DEFAULT_CONTACT_HEADERS = ['id', 'name', 'email', 'phone', 'subject', 'message', 'createdAt'];

function getSheetHeaderInfo(sheet, aliasDefs) {
  var headers = [];
  if (typeof sheet.getLastColumn === 'function' && typeof sheet.getRange === 'function') {
    var lastCol = sheet.getLastColumn();
    if (lastCol > 0) {
      var rawRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      for (var i = 0; i < rawRow.length; i++) {
        headers.push(String(rawRow[i] || '').trim());
      }
    }
  } else if (typeof sheet.getDataRange === 'function') {
    var dataValues = sheet.getDataRange().getValues();
    if (dataValues && dataValues.length > 0) {
      var rawRow = dataValues[0];
      for (var i = 0; i < rawRow.length; i++) {
        headers.push(String(rawRow[i] || '').trim());
      }
    }
  }

  function findCol(canonicalKey) {
    var candidates = (aliasDefs && aliasDefs[canonicalKey]) || [canonicalKey];
    for (var c = 0; c < candidates.length; c++) {
      var normCandidate = normalizeHeaderName(candidates[c]);
      for (var h = 0; h < headers.length; h++) {
        if (normalizeHeaderName(headers[h]) === normCandidate) {
          return h;
        }
      }
    }
    return -1;
  }

  function ensureCol(canonicalKey) {
    var existingIdx = findCol(canonicalKey);
    if (existingIdx >= 0) {
      return existingIdx;
    }
    var nextCol = headers.length + 1;
    if (typeof sheet.getRange === 'function') {
      var cell = sheet.getRange(1, nextCol);
      if (cell && typeof cell.setValue === 'function') {
        cell.setValue(canonicalKey);
        if (typeof cell.setFontWeight === 'function') {
          cell.setFontWeight('bold');
        }
      }
    }
    headers.push(canonicalKey);
    return headers.length - 1;
  }

  function buildRow(canonicalValues) {
    var row = new Array(headers.length);
    for (var i = 0; i < row.length; i++) {
      row[i] = '';
    }
    for (var key in canonicalValues) {
      if (Object.prototype.hasOwnProperty.call(canonicalValues, key)) {
        var colIdx = findCol(key);
        if (colIdx >= 0) {
          row[colIdx] = canonicalValues[key];
        }
      }
    }
    return row;
  }

  function updateRowValues(rowIndex, canonicalUpdates) {
    if (typeof sheet.getRange !== 'function') return;
    var range = sheet.getRange(rowIndex, 1, 1, headers.length);
    var existingRow = range.getValues()[0];
    for (var key in canonicalUpdates) {
      if (Object.prototype.hasOwnProperty.call(canonicalUpdates, key)) {
        var colIdx = findCol(key);
        if (colIdx >= 0) {
          existingRow[colIdx] = canonicalUpdates[key];
        }
      }
    }
    range.setValues([existingRow]);
  }

  return {
    headers: headers,
    findCol: findCol,
    ensureCol: ensureCol,
    buildRow: buildRow,
    updateRowValues: updateRowValues
  };
}

var ALLOWED_ACTIONS = [
  'ping',
  'findUserByEmail',
  'registerUser',
  'saveTripPlan',
  'getTripPlans',
  'deleteTripPlan',
  'savePlace',
  'removePlace',
  'getSavedPlaces',
  'saveFeedback',
  'getFeedback',
  'saveContactForm'
];

function doPost(e) {
  try {
    var raw = e && e.postData ? e.postData.contents : '';
    if (!raw) {
      return jsonResponse({ success: false, error: 'Empty request body' });
    }
    
    var data = null;
    try {
      data = JSON.parse(raw);
    } catch (parseErr) {
      return jsonResponse({ success: false, error: 'Malformed JSON payload' });
    }

    // ==========================================
    // FAIL-CLOSED SECURITY CHECK
    // Reject every request if EXPLOREUP_API_SECRET is missing, empty, or mismatched
    // ==========================================
    var configuredSecret = getScriptSecret();
    if (!configuredSecret) {
      return jsonResponse({
        success: false,
        error: 'Server configuration error: EXPLOREUP_API_SECRET is not configured in Script Properties.'
      });
    }

    var providedSecret = String((data && data.secret) || '').trim();
    if (!providedSecret || providedSecret !== configuredSecret) {
      return jsonResponse({
        success: false,
        error: 'Unauthorized: Invalid or missing API secret.'
      });
    }

    // Action validation
    var action = String((data && data.action) || '').trim();
    if (!action || ALLOWED_ACTIONS.indexOf(action) === -1) {
      return jsonResponse({ success: false, error: 'Invalid or unsupported action: ' + action });
    }
    
    var ss = getTargetSpreadsheet();
    if (!ss) {
      return jsonResponse({
        success: false,
        error: 'Could not access active spreadsheet. Ensure script is bound to ExploreUP Database or SPREADSHEET_ID is set.'
      });
    }
    
    switch (action) {
      case 'ping':
        return jsonResponse({
          success: true,
          status: 'ok',
          spreadsheetName: ss.getName(),
          timestamp: new Date().toISOString()
        });
        
      // ==========================================
      // USERS TAB
      // ==========================================
      case 'findUserByEmail': {
        var userEmail = String(data.email || '').trim().toLowerCase();
        if (!userEmail) {
          return jsonResponse({ success: false, error: 'Email parameter is required.' });
        }
        var sheet = getFlexibleSheet(ss, 'Users', DEFAULT_USER_HEADERS);
        var hInfo = getSheetHeaderInfo(sheet, USER_COL_ALIASES);
        var emailCol = hInfo.findCol('email');
        if (emailCol < 0) {
          return jsonResponse({ success: true, user: null });
        }

        var values = sheet.getDataRange().getValues();
        var idCol = hInfo.findCol('id');
        var nameCol = hInfo.findCol('name');
        var pwCol = hInfo.findCol('passwordHash');
        var createdCol = hInfo.findCol('createdAt');
        var foundUser = null;

        for (var i = 1; i < values.length; i++) {
          var row = values[i];
          if (String(row[emailCol] || '').trim().toLowerCase() === userEmail) {
            foundUser = {
              id: idCol >= 0 ? String(row[idCol] || '') : '',
              name: nameCol >= 0 ? String(row[nameCol] || '') : '',
              email: String(row[emailCol] || ''),
              passwordHash: pwCol >= 0 ? String(row[pwCol] || '') : '',
              createdAt: createdCol >= 0 ? String(row[createdCol] || '') : ''
            };
            break;
          }
        }
        return jsonResponse({ success: true, user: foundUser });
      }
      
      case 'registerUser': {
        var user = data.user;
        if (!user || !user.email || !user.passwordHash || !user.name) {
          return jsonResponse({ success: false, error: 'Invalid user payload: name, email, and passwordHash are required.' });
        }
        var sheet = getFlexibleSheet(ss, 'Users', DEFAULT_USER_HEADERS);
        var hInfo = getSheetHeaderInfo(sheet, USER_COL_ALIASES);
        
        // Ensure required columns exist without shifting existing columns
        hInfo.ensureCol('id');
        hInfo.ensureCol('name');
        hInfo.ensureCol('email');
        hInfo.ensureCol('passwordHash');
        hInfo.ensureCol('createdAt');

        var emailCol = hInfo.findCol('email');
        var emailLower = String(user.email).trim().toLowerCase();
        var values = sheet.getDataRange().getValues();
        
        for (var i = 1; i < values.length; i++) {
          if (emailCol >= 0 && String(values[i][emailCol] || '').trim().toLowerCase() === emailLower) {
            return jsonResponse({ success: false, error: 'This email is already registered.' });
          }
        }
        
        var newRow = hInfo.buildRow({
          id: user.id || ('usr_' + new Date().getTime()),
          name: String(user.name).trim().slice(0, 100),
          email: emailLower.slice(0, 254),
          passwordHash: String(user.passwordHash).trim(),
          createdAt: user.createdAt || new Date().toISOString()
        });
        sheet.appendRow(newRow);
        
        return jsonResponse({ success: true, message: 'User registered successfully' });
      }
      
      // ==========================================
      // TRIP PLANS TAB
      // ==========================================
      case 'saveTripPlan': {
        var trip = data.trip;
        var userEmail = String(data.userEmail || (trip && trip.userEmail) || '').trim().toLowerCase();
        if (!userEmail) {
          return jsonResponse({ success: false, error: 'Owner userEmail is required to save a trip plan.' });
        }
        if (!trip || !trip.destination) {
          return jsonResponse({ success: false, error: 'Invalid trip payload: destination is required.' });
        }
        var sheet = getFlexibleSheet(ss, 'TripPlans', DEFAULT_TRIP_HEADERS);
        var hInfo = getSheetHeaderInfo(sheet, TRIP_COL_ALIASES);
        
        hInfo.ensureCol('id');
        hInfo.ensureCol('userEmail');
        hInfo.ensureCol('userName');
        hInfo.ensureCol('destination');
        hInfo.ensureCol('days');
        hInfo.ensureCol('budget');
        hInfo.ensureCol('planData');
        hInfo.ensureCol('createdAt');

        var tripId = String(trip.id || ('trip_' + new Date().getTime())).trim();
        var planDataStr = typeof trip.planData === 'string' ? trip.planData : JSON.stringify(trip);
        
        var idCol = hInfo.findCol('id');
        var emailCol = hInfo.findCol('userEmail');
        var values = sheet.getDataRange().getValues();
        var updated = false;
        
        for (var i = 1; i < values.length; i++) {
          var rowTripId = idCol >= 0 ? String(values[i][idCol] || '').trim() : '';
          if (rowTripId === tripId) {
            var existingOwner = emailCol >= 0 ? String(values[i][emailCol] || '').trim().toLowerCase() : '';
            // Ownership check: disallow modifying another user's trip plan
            if (existingOwner && existingOwner !== userEmail) {
              return jsonResponse({ success: false, error: 'Unauthorized: cannot overwrite another user\'s trip plan.' });
            }
            hInfo.updateRowValues(i + 1, {
              id: tripId,
              userEmail: userEmail,
              userName: String(trip.userName || '').slice(0, 100),
              destination: String(trip.destination || '').slice(0, 100),
              days: Number(trip.days) || 3,
              budget: String(trip.budgetTier || trip.budget || '').slice(0, 50),
              planData: planDataStr,
              createdAt: new Date().toISOString()
            });
            updated = true;
            break;
          }
        }
        
        if (!updated) {
          var newRow = hInfo.buildRow({
            id: tripId,
            userEmail: userEmail,
            userName: String(trip.userName || '').slice(0, 100),
            destination: String(trip.destination || '').slice(0, 100),
            days: Number(trip.days) || 3,
            budget: String(trip.budgetTier || trip.budget || '').slice(0, 50),
            planData: planDataStr,
            createdAt: new Date().toISOString()
          });
          sheet.appendRow(newRow);
        }
        
        return jsonResponse({ success: true, message: 'Trip plan saved', id: tripId });
      }
      
      case 'getTripPlans': {
        var userEmail = String(data.userEmail || '').trim().toLowerCase();
        if (!userEmail) {
          return jsonResponse({ success: false, error: 'Owner userEmail is required to retrieve trip plans.' });
        }
        var sheet = getFlexibleSheet(ss, 'TripPlans', DEFAULT_TRIP_HEADERS);
        var hInfo = getSheetHeaderInfo(sheet, TRIP_COL_ALIASES);
        var emailCol = hInfo.findCol('userEmail');
        var idCol = hInfo.findCol('id');
        var nameCol = hInfo.findCol('userName');
        var destCol = hInfo.findCol('destination');
        var daysCol = hInfo.findCol('days');
        var budgetCol = hInfo.findCol('budget');
        var planCol = hInfo.findCol('planData');
        var createdCol = hInfo.findCol('createdAt');

        var values = sheet.getDataRange().getValues();
        var trips = [];
        
        for (var i = 1; i < values.length; i++) {
          var row = values[i];
          var rowOwner = emailCol >= 0 ? String(row[emailCol] || '').trim().toLowerCase() : '';
          if (rowOwner === userEmail) {
            var rawPlan = planCol >= 0 ? String(row[planCol] || '') : '';
            var parsedPlan = null;
            if (rawPlan) {
              try { parsedPlan = JSON.parse(rawPlan); } catch (e) {}
            }
            if (!parsedPlan) {
              parsedPlan = {
                id: idCol >= 0 ? String(row[idCol] || '') : '',
                destination: destCol >= 0 ? String(row[destCol] || '') : '',
                days: daysCol >= 0 ? (Number(row[daysCol]) || 3) : 3,
                budgetTier: budgetCol >= 0 ? String(row[budgetCol] || '') : '',
                userName: nameCol >= 0 ? String(row[nameCol] || '') : '',
                userEmail: rowOwner,
                createdAt: createdCol >= 0 ? String(row[createdCol] || '') : ''
              };
            }
            trips.push(parsedPlan);
          }
        }
        return jsonResponse({ success: true, trips: trips });
      }
      
      case 'deleteTripPlan': {
        var tripId = String(data.id || '').trim();
        var userEmail = String(data.userEmail || '').trim().toLowerCase();
        
        if (!tripId) {
          return jsonResponse({ success: false, error: 'Plan id is required for deletion.' });
        }
        if (!userEmail) {
          return jsonResponse({ success: false, error: 'Owner userEmail is required for deletion.' });
        }

        var sheet = getFlexibleSheet(ss, 'TripPlans', DEFAULT_TRIP_HEADERS);
        var hInfo = getSheetHeaderInfo(sheet, TRIP_COL_ALIASES);
        var idCol = hInfo.findCol('id');
        var emailCol = hInfo.findCol('userEmail');

        var values = sheet.getDataRange().getValues();
        var deleted = false;
        
        for (var i = values.length - 1; i >= 1; i--) {
          var rowTripId = idCol >= 0 ? String(values[i][idCol] || '').trim() : '';
          var rowOwner = emailCol >= 0 ? String(values[i][emailCol] || '').trim().toLowerCase() : '';
          // STRICT OWNERSHIP CHECK: Both trip ID and owner email must match
          if (rowTripId === tripId && rowOwner === userEmail) {
            sheet.deleteRow(i + 1);
            deleted = true;
            break;
          }
        }
        
        if (deleted) {
          return jsonResponse({ success: true, message: 'Trip plan deleted successfully.' });
        }
        return jsonResponse({ success: false, error: 'Trip plan not found or not owned by user.' });
      }
      
      // ==========================================
      // SAVED PLACES TAB
      // ==========================================
      case 'savePlace': {
        var userEmail = String(data.userEmail || '').trim().toLowerCase();
        var cityName = String(data.cityName || '').trim();
        if (!userEmail || !cityName) {
          return jsonResponse({ success: false, error: 'userEmail and cityName are required.' });
        }
        var sheet = getFlexibleSheet(ss, 'Saved Places', DEFAULT_SAVED_PLACE_HEADERS);
        var hInfo = getSheetHeaderInfo(sheet, SAVED_PLACE_COL_ALIASES);
        
        hInfo.ensureCol('id');
        hInfo.ensureCol('userEmail');
        hInfo.ensureCol('cityName');
        hInfo.ensureCol('createdAt');

        var emailCol = hInfo.findCol('userEmail');
        var cityCol = hInfo.findCol('cityName');
        var values = sheet.getDataRange().getValues();
        var exists = false;
        
        for (var i = 1; i < values.length; i++) {
          var rowEmail = emailCol >= 0 ? String(values[i][emailCol] || '').trim().toLowerCase() : '';
          var rowCity = cityCol >= 0 ? String(values[i][cityCol] || '').trim().toLowerCase() : '';
          if (rowEmail === userEmail && rowCity === cityName.toLowerCase()) {
            exists = true;
            break;
          }
        }
        
        if (!exists) {
          var newRow = hInfo.buildRow({
            id: 'fav_' + new Date().getTime(),
            userEmail: userEmail,
            cityName: cityName.slice(0, 100),
            createdAt: new Date().toISOString()
          });
          sheet.appendRow(newRow);
        }
        return jsonResponse({ success: true, message: 'Place saved' });
      }
      
      case 'removePlace': {
        var userEmail = String(data.userEmail || '').trim().toLowerCase();
        var cityName = String(data.cityName || '').trim();
        if (!userEmail || !cityName) {
          return jsonResponse({ success: false, error: 'userEmail and cityName are required.' });
        }
        var sheet = getFlexibleSheet(ss, 'Saved Places', DEFAULT_SAVED_PLACE_HEADERS);
        var hInfo = getSheetHeaderInfo(sheet, SAVED_PLACE_COL_ALIASES);
        var emailCol = hInfo.findCol('userEmail');
        var cityCol = hInfo.findCol('cityName');

        var values = sheet.getDataRange().getValues();
        var removed = false;
        
        for (var i = values.length - 1; i >= 1; i--) {
          var rowEmail = emailCol >= 0 ? String(values[i][emailCol] || '').trim().toLowerCase() : '';
          var rowCity = cityCol >= 0 ? String(values[i][cityCol] || '').trim().toLowerCase() : '';
          if (rowEmail === userEmail && rowCity === cityName.toLowerCase()) {
            sheet.deleteRow(i + 1);
            removed = true;
            break;
          }
        }
        return jsonResponse({ success: true, message: removed ? 'Place removed' : 'Place was not in favorites' });
      }
      
      case 'getSavedPlaces': {
        var userEmail = String(data.userEmail || '').trim().toLowerCase();
        if (!userEmail) {
          return jsonResponse({ success: false, error: 'userEmail is required to get saved places.' });
        }
        var sheet = getFlexibleSheet(ss, 'Saved Places', DEFAULT_SAVED_PLACE_HEADERS);
        var hInfo = getSheetHeaderInfo(sheet, SAVED_PLACE_COL_ALIASES);
        var emailCol = hInfo.findCol('userEmail');
        var cityCol = hInfo.findCol('cityName');

        var values = sheet.getDataRange().getValues();
        var places = [];
        
        for (var i = 1; i < values.length; i++) {
          var rowEmail = emailCol >= 0 ? String(values[i][emailCol] || '').trim().toLowerCase() : '';
          if (rowEmail === userEmail && cityCol >= 0) {
            var val = String(values[i][cityCol] || '').trim();
            if (val) {
              places.push(val);
            }
          }
        }
        return jsonResponse({ success: true, places: places });
      }
      
      // ==========================================
      // FEEDBACK TAB
      // ==========================================
      case 'saveFeedback': {
        var fb = data.feedback || data;
        var text = String((fb && fb.text) || '').trim();
        if (!text || text.length < 3) {
          return jsonResponse({ success: false, error: 'Feedback text must be at least 3 characters.' });
        }
        var sheet = getFlexibleSheet(ss, 'Feedback', DEFAULT_FEEDBACK_HEADERS);
        var hInfo = getSheetHeaderInfo(sheet, FEEDBACK_COL_ALIASES);

        hInfo.ensureCol('id');
        hInfo.ensureCol('cityName');
        hInfo.ensureCol('category');
        hInfo.ensureCol('text');
        hInfo.ensureCol('authorName');
        hInfo.ensureCol('userEmail');
        hInfo.ensureCol('createdAt');

        var newRow = hInfo.buildRow({
          id: fb.id || ('fb_' + new Date().getTime()),
          cityName: String(fb.cityName || 'general').trim().slice(0, 100),
          category: String(fb.category || 'General').trim().slice(0, 50),
          text: text.slice(0, 2000),
          authorName: String(fb.authorName || 'Visitor').trim().slice(0, 100),
          userEmail: String(fb.userEmail || '').trim().toLowerCase().slice(0, 254),
          createdAt: new Date().toISOString()
        });
        sheet.appendRow(newRow);
        return jsonResponse({ success: true, message: 'Feedback saved' });
      }
      
      case 'getFeedback': {
        var cityName = String(data.cityName || '').trim().toLowerCase();
        var sheet = getFlexibleSheet(ss, 'Feedback', DEFAULT_FEEDBACK_HEADERS);
        var hInfo = getSheetHeaderInfo(sheet, FEEDBACK_COL_ALIASES);

        var idCol = hInfo.findCol('id');
        var cityCol = hInfo.findCol('cityName');
        var catCol = hInfo.findCol('category');
        var textCol = hInfo.findCol('text');
        var authorCol = hInfo.findCol('authorName');
        var createdCol = hInfo.findCol('createdAt');

        var values = sheet.getDataRange().getValues();
        var feedbackList = [];
        
        for (var i = 1; i < values.length; i++) {
          var row = values[i];
          var rowCity = cityCol >= 0 ? String(row[cityCol] || '').trim().toLowerCase() : '';
          if (!cityName || rowCity === cityName || rowCity === 'general') {
            feedbackList.push({
              id: idCol >= 0 ? row[idCol] : '',
              cityName: cityCol >= 0 ? row[cityCol] : '',
              category: catCol >= 0 ? row[catCol] : '',
              text: textCol >= 0 ? row[textCol] : '',
              authorName: authorCol >= 0 ? row[authorCol] : '',
              createdAt: createdCol >= 0 ? row[createdCol] : ''
            });
          }
        }
        return jsonResponse({ success: true, feedback: feedbackList });
      }
      
      // ==========================================
      // CONTACT FORMS TAB
      // ==========================================
      case 'saveContactForm': {
        var contact = data.contact || data;
        var name = String((contact && contact.name) || '').trim();
        var email = String((contact && contact.email) || '').trim().toLowerCase();
        var message = String((contact && contact.message) || '').trim();

        if (!name || !email || !message) {
          return jsonResponse({ success: false, error: 'Name, email, and message are required.' });
        }

        var sheet = getFlexibleSheet(ss, 'ContactForms', DEFAULT_CONTACT_HEADERS);
        var hInfo = getSheetHeaderInfo(sheet, CONTACT_COL_ALIASES);

        hInfo.ensureCol('id');
        hInfo.ensureCol('name');
        hInfo.ensureCol('email');
        hInfo.ensureCol('phone');
        hInfo.ensureCol('subject');
        hInfo.ensureCol('message');
        hInfo.ensureCol('createdAt');

        var newRow = hInfo.buildRow({
          id: contact.id || ('cnt_' + new Date().getTime()),
          name: name.slice(0, 100),
          email: email.slice(0, 254),
          phone: String(contact.phone || '').trim().slice(0, 30),
          subject: String(contact.subject || 'General Inquiry').trim().slice(0, 150),
          message: message.slice(0, 3000),
          createdAt: new Date().toISOString()
        });
        sheet.appendRow(newRow);
        return jsonResponse({ success: true, message: 'Contact inquiry recorded' });
      }
      
      default:
        return jsonResponse({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doGet(e) {
  return jsonResponse({
    status: 'ok',
    service: 'ExploreUP Sheets Connection',
    message: 'Google Apps Script endpoint is running. All data operations require POST with a valid EXPLOREUP_API_SECRET.'
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
