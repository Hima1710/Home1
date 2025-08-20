// Google Apps Script for نظام حسابات خالي عادل
// This script handles all CRUD operations for the accounting system

function doGet(e) {
  try {
    const action = e.parameter.action;
    const sheetName = e.parameter.sheet;
    
    if (!action) throw new Error("Missing 'action' parameter");

    if (action === "get") {
      if (!sheetName) throw new Error("Missing 'sheet' parameter");
      const data = getSheetData(sheetName);
      return sendJSON({ status: "ok", data });
    }

    if (action === "all") {
      const sheets = ["الدخل", "المصروفات", "العمال", "الاسترجاع", "الملخص"];
      const allData = {};
      sheets.forEach(name => {
        allData[name] = getSheetData(name);
      });
      return sendJSON({ status: "ok", data: allData });
    }

    if (action === "login") {
      const phone = e.parameter.phone;
      const password = e.parameter.password;
      
      if (!phone || !password) {
        throw new Error("Missing phone or password");
      }
      
      const isValid = validateLogin(phone, password);
      if (isValid) {
        return sendJSON({ status: "ok", message: "Login successful" });
      } else {
        return sendJSON({ status: "error", message: "Invalid credentials" });
      }
    }

    throw new Error("Invalid action");
  } catch (err) {
    return sendJSON({ status: "error", message: err.message });
  }
}

function doPost(e) {
  try {
    const sheetName = e.parameter.sheet;
    if (!sheetName) throw new Error("Missing 'sheet' parameter");

    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found: " + sheetName);

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

    return sendJSON({ status: "ok", message: "Row added successfully", data: newRow });
  } catch (err) {
    return sendJSON({ status: "error", message: err.message });
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

    return sendJSON({ status: "ok", message: "Row deleted successfully" });
  } catch (err) {
    return sendJSON({ status: "error", message: err.message });
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
    
    const headers = data[0];
    const phoneIndex = headers.indexOf("phone");
    const passwordIndex = headers.indexOf("password");
    
    if (phoneIndex === -1 || passwordIndex === -1) return false;
    
    // Check if credentials match
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[phoneIndex] === phone && row[passwordIndex] === password) {
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

function sendJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Setup function to create initial sheets and structure
function setupSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // Create sheets if they don't exist
  const sheetNames = ["الدخل", "المصروفات", "العمال", "الاسترجاع", "الملخص"];
  
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
  return ContentService
    .createTextOutput("")
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type')
    .setHeader('Access-Control-Max-Age', '86400');
}
