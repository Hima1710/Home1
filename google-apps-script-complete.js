// Google Apps Script for نظام حسابات خالي عادل
// This script handles all CRUD operations for the accounting system

function doGet(e) {
  try {
    // Set CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400'
    };
    
    const action = e.parameter.action;
    
    if (action === 'login') {
      const phone = e.parameter.phone;
      const password = e.parameter.password;
      
      if (!phone || !password) {
        return sendJSON(e, { status: 'error', message: 'Phone and password are required' });
      }
      
      const isValid = validateLogin(phone, password);
      if (isValid) {
        return sendJSON(e, { status: 'ok', message: 'Login successful' });
      } else {
        return sendJSON(e, { status: 'error', message: 'Invalid credentials' });
      }
    }
    
    if (action === 'all') {
      const data = {};
      sheets.forEach(sheetName => {
        if (sheetName !== 'المستخدمين') { // لا نرسل بيانات المستخدمين
          data[sheetName] = getSheetData(sheetName);
        }
      });
      return sendJSON(e, { status: 'ok', data: data });
    }
    
    if (action === 'add') {
      const sheetName = e.parameter.sheet;
      const dataStr = e.parameter.data;
      
      if (!sheetName || !dataStr) {
        return sendJSON(e, { status: 'error', message: 'Sheet name and data are required' });
      }
      
      try {
        const data = JSON.parse(dataStr);
        const result = addRow(sheetName, data);
        if (result) {
          return sendJSON(e, { status: 'ok', message: 'Data added successfully' });
        } else {
          return sendJSON(e, { status: 'error', message: 'Failed to add data' });
        }
      } catch (error) {
        return sendJSON(e, { status: 'error', message: 'Invalid data format' });
      }
    }
    
    if (action === 'delete') {
      const sheetName = e.parameter.sheet;
      const rowIndex = parseInt(e.parameter.row);
      
      if (!sheetName || isNaN(rowIndex)) {
        return sendJSON(e, { status: 'error', message: 'Sheet name and row index are required' });
      }
      
      const result = deleteRow(sheetName, rowIndex);
      if (result) {
        return sendJSON(e, { status: 'ok', message: 'Row deleted successfully' });
      } else {
        return sendJSON(e, { status: 'error', message: 'Failed to delete row' });
      }
    }
    
    // Default response
    return sendJSON(e, { status: 'error', message: 'Invalid action' });
    
  } catch (error) {
    console.error('Error in doGet:', error);
    return sendJSON(e, { status: 'error', message: 'Internal server error' });
  }
}

function doPost(e) {
  try {
    const sheetName = e.parameter.sheet;
    if (!sheetName) throw new Error("Missing 'sheet' parameter");

    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheetName) throw new Error("Sheet not found: " + sheetName);

    // Validate required fields based on sheet type
    if (!validateData(sheetName, data)) {
      throw new Error("Missing required fields for " + sheetName);
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(h => data[h] || "");
    sheet.appendRow(newRow);

    // Update summary sheet if needed
    if (sheetName !== "الملخص" && sheetName !== "المستخدمين") {
      updateSummarySheet();
    }

    return sendJSON(e, { status: "ok", message: "Row added successfully", data: newRow });
  } catch (err) {
    return sendJSON(e, { status: "error", message: err.message });
  }
}

function doOptions(e) {
  const output = ContentService.createTextOutput('');
  output.addHeader('Access-Control-Allow-Origin', '*');
  output.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.addHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  output.addHeader('Access-Control-Max-Age', '86400');
  return output;
}

function addRow(sheetName, data) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return false;

    if (!validateData(sheetName, data)) {
      return false;
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(h => data[h] || "");
    sheet.appendRow(newRow);

    if (sheetName !== "الملخص" && sheetName !== "المستخدمين") {
      updateSummarySheet();
    }

    return true;
  } catch (error) {
    console.error("Error adding row:", error);
    return false;
  }
}

function deleteRow(sheetName, rowIndex) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return false;

    sheet.deleteRow(rowIndex + 1);
    
    if (sheetName !== "الملخص" && sheetName !== "المستخدمين") {
      updateSummarySheet();
    }

    return true;
  } catch (error) {
    console.error("Error deleting row:", error);
    return false;
  }
}

function doDelete(e) {
  try {
    const sheetName = e.parameter.sheet;
    const rowIndex = parseInt(e.parameter.row);
    
    if (!sheetName) throw new Error("Missing 'sheet' parameter");
    if (isNaN(rowIndex)) throw new Error("Invalid row index");

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found: " + sheetName);

    // Delete the row (add 1 because sheet rows are 1-indexed and we need to account for header)
    sheet.deleteRow(rowIndex + 1);
    
    // Update summary sheet
    if (sheetName !== "الملخص" && sheetName !== "المستخدمين") {
      updateSummarySheet();
    }

    return sendJSON(e, { status: "ok", message: "Row deleted successfully" });
  } catch (err) {
    return sendJSON(e, { status: "error", message: err.message });
  }
}

function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return []; // Only header row

  const headers = rows.shift();
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function validateData(sheetName, data) {
  const requiredFields = {
    "الدخل": ["التاريخ", "المصدر (منين جالي)", "المبلغ", "العملة", "طريقة الدفع", "المستخدم"],
    "المصروفات": ["التاريخ", "المصدر (اتصرف فين)", "المبلغ", "العملة", "طريقة الدفع", "المستخدم"],
    "العمال": ["التاريخ", "اسم العامل", "المبلغ", "العملة", "طريقة الدفع", "المستخدم"],
    "الاسترجاع": ["التاريخ", "المصدر (مين رجع)", "المبلغ", "العملة", "طريقة الدفع", "المستخدم"]
  };

  const fields = requiredFields[sheetName];
  if (!fields) return true; // No validation for unknown sheets

  return fields.every(field => data[field] && data[field].toString().trim() !== "");
}

// Validate login credentials
function validateLogin(phone, password) {
  try {
    const usersSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("المستخدمين");
    if (!usersSheet) return false;

    const data = usersSheet.getDataRange().getValues();
    if (data.length <= 1) return false; // Only header row

    // Normalize helper: cast to string, trim, remove internal spaces, and convert Arabic/Persian digits to Latin
    const convertArabicDigits = function(str) {
      return str
        .replace(/[\u0660-\u0669]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x0660 + 48))
        .replace(/[\u06F0-\u06F9]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x06F0 + 48));
    };

    const normalize = function(value) {
      if (value === null || value === undefined) return "";
      let s = String(value).trim();
      s = convertArabicDigits(s);
      s = s.replace(/\s+/g, "");
      return s; // لا نحذف الأصفار الأولية
    };

    const inputPhone = normalize(phone);
    const inputPassword = normalize(password);

    // Check if credentials match - البيانات: password في العمود الأول (A)، phone في العمود الثاني (B)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowPassword = normalize(row[0]); // العمود A - password
      const rowPhone = normalize(row[1]);    // العمود B - phone

      if (rowPhone === inputPhone && rowPassword === inputPassword) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error validating login:", error);
    return false;
  }
}

function updateSummarySheet() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const summarySheet = spreadsheet.getSheetByName("الملخص");
    if (!summarySheet) return;

    // Calculate totals for each currency
    const incomeEGP = calculateTotalByCurrency("الدخل", "EGP");
    const incomeUSD = calculateTotalByCurrency("الدخل", "USD");
    const expensesEGP = calculateTotalByCurrency("المصروفات", "EGP");
    const expensesUSD = calculateTotalByCurrency("المصروفات", "USD");

    // Update summary sheet
    const summaryData = [
      ["إجمالي الدخل", incomeEGP, incomeUSD],
      ["إجمالي المصروفات", expensesEGP, expensesUSD],
      ["صافي الربح", incomeEGP - expensesEGP, incomeUSD - expensesUSD]
    ];

    // Clear existing data (except headers)
    const lastRow = summarySheet.getLastRow();
    if (lastRow > 1) {
      summarySheet.getRange(2, 1, lastRow - 1, 3).clear();
    }

    // Add new data
    if (summaryData.length > 0) {
      summarySheet.getRange(2, 1, summaryData.length, 3).setValues(summaryData);
    }

  } catch (error) {
    console.error("Error updating summary sheet:", error);
  }
}

function calculateTotalByCurrency(sheetName, currency) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return 0;

    const data = getSheetData(sheetName);
    return data.reduce((total, row) => {
      if (row['العملة'] === currency) {
        const amount = parseFloat(row['المبلغ']) || 0;
        return total + amount;
      }
      return total;
    }, 0);
  } catch (error) {
    console.error("Error calculating total for", sheetName, currency, error);
    return 0;
  }
}

function sendJSON(e, obj) {
  const callback = e && e.parameter && e.parameter.callback;
  const json = JSON.stringify(obj);
  
  let output;
  if (callback) {
    output = ContentService
      .createTextOutput(`${callback}(${json})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    output = ContentService
      .createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Add CORS headers
  output.addHeader('Access-Control-Allow-Origin', '*');
  output.addHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.addHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  output.addHeader('Access-Control-Max-Age', '86400');
  
  return output;
}

// Setup function to create initial sheets and structure
function setupSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create sheets if they don't exist
  const sheetNames = ["الدخل", "المصروفات", "العمال", "الاسترجاع", "الملخص", "المستخدمين"];
  
  sheetNames.forEach(sheetName => {
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }
    
    // Set headers based on sheet type
    switch(sheetName) {
      case "الدخل":
        sheet.getRange(1, 1, 1, 7).setValues([["التاريخ", "المصدر (منين جالي)", "المبلغ", "العملة", "طريقة الدفع", "ملاحظات", "المستخدم"]]);
        break;
      case "المصروفات":
        sheet.getRange(1, 1, 1, 7).setValues([["التاريخ", "المصدر (اتصرف فين)", "المبلغ", "العملة", "طريقة الدفع", "ملاحظات", "المستخدم"]]);
        break;
      case "العمال":
        sheet.getRange(1, 1, 1, 7).setValues([["التاريخ", "اسم العامل", "المبلغ", "العملة", "طريقة الدفع", "ملاحظات", "المستخدم"]]);
        break;
      case "الاسترجاع":
        sheet.getRange(1, 1, 1, 7).setValues([["التاريخ", "المصدر (مين رجع)", "المبلغ", "العملة", "طريقة الدفع", "ملاحظات", "المستخدم"]]);
        break;
      case "الملخص":
        sheet.getRange(1, 1, 1, 3).setValues([["البند", "EGP (جنيه)", "USD (دولار)"]]);
        break;
      case "المستخدمين":
        sheet.getRange(1, 1, 1, 2).setValues([["password", "phone"]]);
        break;
    }
    
    // Format headers
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight("bold");
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setBackground("#4285f4");
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontColor("white");
  });
  
  // Auto-resize columns
  spreadsheet.getSheets().forEach(sheet => {
    sheet.autoResizeColumns(1, sheet.getLastColumn());
  });
}

// Function to handle OPTIONS request for CORS
function doOptions(e) {
  return ContentService.createTextOutput("");
}

// Function to add a test user (run this once to create a test user)
function createTestUser() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let usersSheet = spreadsheet.getSheetByName("المستخدمين");
    
    if (!usersSheet) {
      usersSheet = spreadsheet.insertSheet("المستخدمين");
      usersSheet.getRange(1, 1, 1, 2).setValues([["password", "phone"]]);
      usersSheet.getRange(1, 1, 1, 2).setFontWeight("bold");
      usersSheet.getRange(1, 1, 1, 2).setBackground("#4285f4");
      usersSheet.getRange(1, 1, 1, 2).setFontColor("white");
    }
    
    // Add test user - البيانات: password في العمود A، phone في العمود B
    usersSheet.appendRow(["123456789", "123456789"]);
    
    console.log("Test user created successfully!");
    console.log("Phone: 123456789");
    console.log("Password: 123456789");
    
  } catch (error) {
    console.error("Error creating test user:", error);
  }
}
