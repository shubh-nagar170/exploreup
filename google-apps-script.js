/**
 * ExploreUP Sheets Connection - Google Apps Script Backend
 * 
 * Instructions:
 * 1. Open your Google Spreadsheet: "ExploreUP Database"
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
  return props.getProperty('EXPLOREUP_API_SECRET') || '';
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

function doPost(e) {
  try {
    var raw = e && e.postData ? e.postData.contents : '';
    if (!raw) {
      return jsonResponse({ success: false, error: 'Empty request body' });
    }
    
    var data = JSON.parse(raw);
    var configuredSecret = getScriptSecret();
    
    // Verify API secret if configured
    if (configuredSecret && data.secret !== configuredSecret) {
      return jsonResponse({ success: false, error: 'Unauthorized: Invalid EXPLOREUP_API_SECRET' });
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return jsonResponse({ success: false, error: 'Could not access active spreadsheet' });
    }
    
    var action = data.action;
    
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
        var sheet = getFlexibleSheet(ss, 'Users', ['id', 'name', 'email', 'passwordHash', 'createdAt']);
        var values = sheet.getDataRange().getValues();
        
        var foundUser = null;
        for (var i = 1; i < values.length; i++) {
          var row = values[i];
          if (String(row[2]).trim().toLowerCase() === userEmail) {
            foundUser = {
              id: String(row[0]),
              name: String(row[1]),
              email: String(row[2]),
              passwordHash: String(row[3]),
              createdAt: String(row[4])
            };
            break;
          }
        }
        return jsonResponse({ success: true, user: foundUser });
      }
      
      case 'registerUser': {
        var user = data.user;
        if (!user || !user.email) {
          return jsonResponse({ success: false, error: 'Invalid user payload' });
        }
        var sheet = getFlexibleSheet(ss, 'Users', ['id', 'name', 'email', 'passwordHash', 'createdAt']);
        var values = sheet.getDataRange().getValues();
        var emailLower = String(user.email).trim().toLowerCase();
        
        for (var i = 1; i < values.length; i++) {
          if (String(values[i][2]).trim().toLowerCase() === emailLower) {
            return jsonResponse({ success: false, error: 'This email is already registered.' });
          }
        }
        
        sheet.appendRow([
          user.id || ('usr_' + new Date().getTime()),
          user.name || '',
          emailLower,
          user.passwordHash || '',
          user.createdAt || new Date().toISOString()
        ]);
        
        return jsonResponse({ success: true, message: 'User registered successfully' });
      }
      
      // ==========================================
      // TRIP PLANS TAB
      // ==========================================
      case 'saveTripPlan': {
        var trip = data.trip;
        if (!trip || !trip.destination) {
          return jsonResponse({ success: false, error: 'Invalid trip payload' });
        }
        var sheet = getFlexibleSheet(ss, 'TripPlans', ['id', 'userEmail', 'userName', 'destination', 'days', 'budget', 'planData', 'createdAt']);
        var tripId = trip.id || ('trip_' + new Date().getTime());
        var userEmail = String(trip.userEmail || data.userEmail || '').trim().toLowerCase();
        var planDataStr = typeof trip.planData === 'string' ? trip.planData : JSON.stringify(trip);
        
        var values = sheet.getDataRange().getValues();
        var updated = false;
        
        for (var i = 1; i < values.length; i++) {
          if (String(values[i][0]) === String(tripId)) {
            sheet.getRange(i + 1, 1, 1, 8).setValues([[
              tripId,
              userEmail,
              trip.userName || '',
              trip.destination || '',
              trip.days || 3,
              trip.budgetTier || trip.budget || '',
              planDataStr,
              new Date().toISOString()
            ]]);
            updated = true;
            break;
          }
        }
        
        if (!updated) {
          sheet.appendRow([
            tripId,
            userEmail,
            trip.userName || '',
            trip.destination || '',
            trip.days || 3,
            trip.budgetTier || trip.budget || '',
            planDataStr,
            new Date().toISOString()
          ]);
        }
        
        return jsonResponse({ success: true, message: 'Trip plan saved', id: tripId });
      }
      
      case 'getTripPlans': {
        var userEmail = String(data.userEmail || '').trim().toLowerCase();
        var sheet = getFlexibleSheet(ss, 'TripPlans', ['id', 'userEmail', 'userName', 'destination', 'days', 'budget', 'planData', 'createdAt']);
        var values = sheet.getDataRange().getValues();
        var trips = [];
        
        for (var i = 1; i < values.length; i++) {
          var row = values[i];
          if (!userEmail || String(row[1]).trim().toLowerCase() === userEmail) {
            var rawPlan = String(row[6] || '');
            var parsedPlan = null;
            try { parsedPlan = JSON.parse(rawPlan); } catch (e) { parsedPlan = { destination: row[3], days: row[4] }; }
            trips.push(parsedPlan);
          }
        }
        return jsonResponse({ success: true, trips: trips });
      }
      
      case 'deleteTripPlan': {
        var tripId = String(data.id || '');
        var userEmail = String(data.userEmail || '').trim().toLowerCase();
        var sheet = getFlexibleSheet(ss, 'TripPlans', ['id', 'userEmail', 'userName', 'destination', 'days', 'budget', 'planData', 'createdAt']);
        var values = sheet.getDataRange().getValues();
        
        for (var i = 1; i < values.length; i++) {
          if (String(values[i][0]) === tripId) {
            if (!userEmail || String(values[i][1]).trim().toLowerCase() === userEmail) {
              sheet.deleteRow(i + 1);
              return jsonResponse({ success: true, message: 'Trip plan deleted' });
            }
          }
        }
        return jsonResponse({ success: true, message: 'Trip plan not found' });
      }
      
      // ==========================================
      // SAVED PLACES TAB
      // ==========================================
      case 'savePlace': {
        var userEmail = String(data.userEmail || (data.place && data.place.userEmail) || '').trim().toLowerCase();
        var cityName = String(data.cityName || (data.place && data.place.cityName) || '').trim();
        if (!userEmail || !cityName) {
          return jsonResponse({ success: false, error: 'userEmail and cityName are required' });
        }
        var sheet = getFlexibleSheet(ss, 'Saved Places', ['id', 'userEmail', 'cityName', 'createdAt']);
        var values = sheet.getDataRange().getValues();
        var exists = false;
        
        for (var i = 1; i < values.length; i++) {
          if (String(values[i][1]).trim().toLowerCase() === userEmail && String(values[i][2]).toLowerCase() === cityName.toLowerCase()) {
            exists = true;
            break;
          }
        }
        
        if (!exists) {
          sheet.appendRow([
            'fav_' + new Date().getTime(),
            userEmail,
            cityName,
            new Date().toISOString()
          ]);
        }
        return jsonResponse({ success: true, message: 'Place saved' });
      }
      
      case 'removePlace': {
        var userEmail = String(data.userEmail || '').trim().toLowerCase();
        var cityName = String(data.cityName || '').trim();
        var sheet = getFlexibleSheet(ss, 'Saved Places', ['id', 'userEmail', 'cityName', 'createdAt']);
        var values = sheet.getDataRange().getValues();
        
        for (var i = 1; i < values.length; i++) {
          if (String(values[i][1]).trim().toLowerCase() === userEmail && String(values[i][2]).toLowerCase() === cityName.toLowerCase()) {
            sheet.deleteRow(i + 1);
            return jsonResponse({ success: true, message: 'Place removed' });
          }
        }
        return jsonResponse({ success: true, message: 'Place not found' });
      }
      
      case 'getSavedPlaces': {
        var userEmail = String(data.userEmail || '').trim().toLowerCase();
        var sheet = getFlexibleSheet(ss, 'Saved Places', ['id', 'userEmail', 'cityName', 'createdAt']);
        var values = sheet.getDataRange().getValues();
        var places = [];
        
        for (var i = 1; i < values.length; i++) {
          if (String(values[i][1]).trim().toLowerCase() === userEmail) {
            places.push(String(values[i][2]));
          }
        }
        return jsonResponse({ success: true, places: places });
      }
      
      // ==========================================
      // FEEDBACK TAB
      // ==========================================
      case 'saveFeedback': {
        var fb = data.feedback || data;
        var sheet = getFlexibleSheet(ss, 'Feedback', ['id', 'cityName', 'category', 'text', 'authorName', 'userEmail', 'createdAt']);
        sheet.appendRow([
          fb.id || ('fb_' + new Date().getTime()),
          fb.cityName || 'general',
          fb.category || 'General',
          fb.text || '',
          fb.authorName || 'Visitor',
          fb.userEmail || '',
          new Date().toISOString()
        ]);
        return jsonResponse({ success: true, message: 'Feedback saved' });
      }
      
      case 'getFeedback': {
        var cityName = String(data.cityName || '').trim().toLowerCase();
        var sheet = getFlexibleSheet(ss, 'Feedback', ['id', 'cityName', 'category', 'text', 'authorName', 'userEmail', 'createdAt']);
        var values = sheet.getDataRange().getValues();
        var feedbackList = [];
        
        for (var i = 1; i < values.length; i++) {
          var row = values[i];
          if (!cityName || String(row[1]).trim().toLowerCase() === cityName || String(row[1]).trim().toLowerCase() === 'general') {
            feedbackList.push({
              id: row[0],
              cityName: row[1],
              category: row[2],
              text: row[3],
              authorName: row[4],
              createdAt: row[6]
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
        var sheet = getFlexibleSheet(ss, 'ContactForms', ['id', 'name', 'email', 'phone', 'subject', 'message', 'createdAt']);
        sheet.appendRow([
          contact.id || ('cnt_' + new Date().getTime()),
          contact.name || '',
          contact.email || '',
          contact.phone || '',
          contact.subject || 'General Inquiry',
          contact.message || '',
          new Date().toISOString()
        ]);
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
    message: 'Google Apps Script endpoint is running. Send POST requests with action and payload.'
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
