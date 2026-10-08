/**
 * ============================================================================
 * APEXCORE ENTERPRISE SAAS — GOOGLE APPS SCRIPT ENGINE (v4.0 PRODUCTION BACKEND)
 * Real-Time Bidirectional Database & Webhook API for Google Sheets
 * Supports: Admin RBAC, Freelancer Admin, Freelancers, Clients, Projects, Payments,
 * Completed Projects, Deleted Items Audit Trail, and Real-Time Login Activity Logs.
 * ============================================================================
 * 
 * SETUP & DEPLOYMENT INSTRUCTIONS:
 * 1. Open your Google Sheet -> Click "Extensions" -> "Apps Script".
 * 2. Delete all existing code in Code.gs (Ctrl+A -> Backspace) and paste this entire file.
 * 3. Click the Save icon (Ctrl+S).
 * 4. In the top function dropdown toolbar, select "setupGoogleSheets" and click "Run".
 *    (Authorize the script when prompted by Google).
 * 5. Click "Deploy" (top right) -> "New deployment" -> Click the gear icon -> "Web app":
 *    - Description: ApexCore SaaS Backend v4.0
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone" (Critical for web app connectivity)
 * 6. Click "Deploy" -> Copy the "Web app URL" (ends in /exec).
 * 7. Open the SaaS platform -> Settings (or Cloud Sync) -> Paste your URL & click Save!
 * ============================================================================
 */

// Core Validation Constants (For Live Google Sheets Dropdown Menus)
var CORE_SERVICES = ["Web Development", "Graphic Design", "Video Editing"];
var PROJECT_STATUSES = ["Planning", "Active", "In Review", "Completed"];
var PAYMENT_STATUSES = ["Cleared", "Due", "Partially Paid", "Paid", "Pending"];
var ADMIN_ROLES = ["Super Admin", "Operations Admin", "Financial Admin", "Security Auditor"];
var ADMIN_STATUSES = ["Active", "Pending Approval", "Blocked", "Suspended"];
var CREDENTIAL_STATUSES = ["Active", "Pending Approval", "Blocked", "Suspended"];
var FREELANCER_STATUSES = ["Active", "Pending Approval", "Blocked", "Suspended"];
var CLIENT_STATUSES = ["Active", "Pending", "On Hold", "Inactive"];

/**
 * 1. ONE-CLICK INITIALIZATION FUNCTION
 * Automatically creates, formats, styles, and validates all business worksheets.
 */
function setupGoogleSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Master Validation Lists Sheet
  var listsSheet = getOrCreateSheet(ss, "Lists");
  setupListsSheet(listsSheet);

  // 2. Setup All Operational Business Sheets
  setupAdminSheet(getOrCreateSheet(ss, "Admin"));
  setupFreelancerAdminSheet(getOrCreateSheet(ss, "Freelancer Admin"), listsSheet);
  setupFreelancersSheet(getOrCreateSheet(ss, "Freelancers"), listsSheet);
  setupClientsSheet(getOrCreateSheet(ss, "Clients"), listsSheet);
  setupProjectsSheet(getOrCreateSheet(ss, "Projects"), listsSheet);
  setupPaymentsSheet(getOrCreateSheet(ss, "Payments"), listsSheet);
  setupCompletedProjectsSheet(getOrCreateSheet(ss, "Completed Projects"), listsSheet);
  setupDeletedItemsSheet(getOrCreateSheet(ss, "Deleted Items"));
  setupLoginActivitySheet(getOrCreateSheet(ss, "Login Activity"));

  // Focus on Admin or Projects sheet
  var defaultSheet = ss.getSheetByName("Admin") || ss.getSheets()[0];
  ss.setActiveSheet(defaultSheet);

  Logger.log("ApexCore SaaS Google Sheet v4.0 setup completed successfully!");
}

/**
 * Helper: Find or create sheet
 */
function getOrCreateSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

/**
 * Header Row Formatting Utility
 */
function formatHeaderRow(sheet, row, colCount, bgColor, textColor) {
  var range = sheet.getRange(row, 1, 1, colCount);
  range.setBackground(bgColor);
  range.setFontColor(textColor);
  range.setFontWeight("bold");
  range.setFontFamily("Inter");
  range.setFontSize(10.5);
  range.setHorizontalAlignment("center");
  range.setVerticalAlignment("middle");
  sheet.setRowHeight(row, 36);
}

/**
 * Master Lists Sheet (Validation Rules for Dropdowns)
 */
function setupListsSheet(sheet) {
  sheet.clear();
  var headers = ["Core Services", "Project Statuses", "Payment Statuses", "Admin Roles", "Credential Statuses", "Admin Statuses"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, 1, headers.length, "#181820", "#ffffff");

  for (var i = 0; i < CORE_SERVICES.length; i++) {
    sheet.getRange(i + 2, 1).setValue(CORE_SERVICES[i]);
  }
  for (var j = 0; j < PROJECT_STATUSES.length; j++) {
    sheet.getRange(j + 2, 2).setValue(PROJECT_STATUSES[j]);
  }
  for (var k = 0; k < PAYMENT_STATUSES.length; k++) {
    sheet.getRange(k + 2, 3).setValue(PAYMENT_STATUSES[k]);
  }
  for (var l = 0; l < ADMIN_ROLES.length; l++) {
    sheet.getRange(l + 2, 4).setValue(ADMIN_ROLES[l]);
  }
  for (var m = 0; m < CREDENTIAL_STATUSES.length; m++) {
    sheet.getRange(m + 2, 5).setValue(CREDENTIAL_STATUSES[m]);
  }
  for (var n = 0; n < ADMIN_STATUSES.length; n++) {
    sheet.getRange(n + 2, 6).setValue(ADMIN_STATUSES[n]);
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Sheet 1: Admin
 * Super Admin & Privileged RBAC Accounts with Approval & Block Dropdown
 */
function setupAdminSheet(sheet) {
  sheet.clear();
  var headers = [
    "Admin ID", "Full Name", "Email / Login ID", "Password / Key",
    "Assigned Role", "System Privileges", "Status", "Last Authentication / Login Time"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, 1, headers.length, "#7f1d1d", "#ffffff");

  // Default Root Owner Super Admin
  sheet.getRange(2, 1, 1, headers.length).setValues([
    [
      "ADM-001", "Jay (Owner)", "Jay@admin.com", "Jay@0709",
      "Super Admin", "Root Access (All Modules & RBAC)", "Active", "System Initialized"
    ]
  ]);

  var roleRule = SpreadsheetApp.newDataValidation().requireValueInList(ADMIN_ROLES, true).build();
  sheet.getRange("E2:E500").setDataValidation(roleRule);

  var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(ADMIN_STATUSES, true).build();
  sheet.getRange("G2:G500").setDataValidation(statusRule);

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Sheet 2: Freelancer Admin
 * Dedicated manager for Freelancer Portal access, security keys, assigned projects, and live login times
 */
function setupFreelancerAdminSheet(sheet, listsSheet) {
  sheet.clear();
  var headers = [
    "Freelancer ID", "Specialist Full Name", "Portal Login Email / ID", "Security Key / Pass",
    "Assigned Work & Project", "Assigned Milestone Scoped", "Hours Logged", "Portal Status",
    "Last Login Time", "Created / Updated Date"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, 1, headers.length, "#1e1b4b", "#ffffff");

  var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(CREDENTIAL_STATUSES, true).build();
  sheet.getRange("H2:H500").setDataValidation(statusRule);

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Sheet 3: Freelancers
 * Directory of Specialists & Payment Records
 */
function setupFreelancersSheet(sheet, listsSheet) {
  sheet.clear();
  var headers = [
    "Freelancer ID", "Full Name", "Email", "Phone", "Core Services",
    "Payment Status", "Payment Cleared (\u20B9)", "Payment Due (\u20B9)",
    "Assigned Projects", "Status"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, 1, headers.length, "#1e293b", "#ffffff");

  var payRule = SpreadsheetApp.newDataValidation().requireValueInList(PAYMENT_STATUSES, true).build();
  sheet.getRange("F2:F500").setDataValidation(payRule);

  var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(FREELANCER_STATUSES, true).build();
  sheet.getRange("J2:J500").setDataValidation(statusRule);

  sheet.getRange("G2:H500").setNumberFormat("\u20B9#,##0");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Sheet 4: Clients
 * Client directory with live billing & active project counts
 */
function setupClientsSheet(sheet, listsSheet) {
  sheet.clear();
  var headers = [
    "Client ID", "Client Name / Company", "Contact Email", "Phone", "Services Engaged",
    "Active Projects Count", "Total Billed (\u20B9)", "Pending Payment (\u20B9)", "Relationship Status", "Admin Notes"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, 1, headers.length, "#78350f", "#ffffff");

  var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(CLIENT_STATUSES, true).build();
  sheet.getRange("I2:I500").setDataValidation(statusRule);

  sheet.getRange("G2:H500").setNumberFormat("\u20B9#,##0");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Sheet 5: Projects
 * Active Projects, Budget, Scope, Assigned Specialists, and Progress
 */
function setupProjectsSheet(sheet, listsSheet) {
  sheet.clear();
  var headers = [
    "Project ID", "Project Name", "Core Service", "Client",
    "Budget (\u20B9)", "Progress (%)", "Project Status",
    "Scope Notes", "Assigned Freelancer ID", "Assigned Freelancer Name", "Target Deadline"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, 1, headers.length, "#991b1b", "#ffffff");

  var serviceRule = SpreadsheetApp.newDataValidation().requireValueInList(CORE_SERVICES, true).build();
  sheet.getRange("C2:C500").setDataValidation(serviceRule);

  var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(PROJECT_STATUSES, true).build();
  sheet.getRange("G2:G500").setDataValidation(statusRule);

  sheet.getRange("E2:E500").setNumberFormat("\u20B9#,##0");
  sheet.getRange("F2:F500").setNumberFormat("0'%'");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Sheet 6: Payments
 * Invoices & Freelancer Disbursements Ledger
 */
function setupPaymentsSheet(sheet, listsSheet) {
  sheet.clear();
  var headers = [
    "Transaction / Invoice ID", "Payment Type", "Entity Name (Client / Freelancer)",
    "Associated Project", "Amount (\u20B9)", "Payment Status", "Issue Date", "Due Date"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, 1, headers.length, "#065f46", "#ffffff");

  var typeRule = SpreadsheetApp.newDataValidation().requireValueInList(["Client Invoice", "Freelancer Payout"], true).build();
  sheet.getRange("B2:B500").setDataValidation(typeRule);

  var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(PAYMENT_STATUSES, true).build();
  sheet.getRange("F2:F500").setDataValidation(statusRule);

  sheet.getRange("E2:E500").setNumberFormat("\u20B9#,##0");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Sheet 7: Completed Projects
 * Delivered Project Archive
 */
function setupCompletedProjectsSheet(sheet, listsSheet) {
  sheet.clear();
  var headers = [
    "Project ID", "Project Name", "Core Service", "Client",
    "Budget (\u20B9)", "Assigned Specialist", "Completion Date", "Delivery Notes"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, 1, headers.length, "#14532d", "#ffffff");

  var serviceRule = SpreadsheetApp.newDataValidation().requireValueInList(CORE_SERVICES, true).build();
  sheet.getRange("C2:C500").setDataValidation(serviceRule);

  sheet.getRange("E2:E500").setNumberFormat("\u20B9#,##0");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Sheet 8: Deleted Items
 * Audit Log for Deletions
 */
function setupDeletedItemsSheet(sheet) {
  sheet.clear();
  var headers = [
    "Audit Log ID", "Entity Type", "Original ID", "Display Name",
    "Deleted By", "Deletion Timestamp", "System Snapshot / Reason"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, 1, headers.length, "#4c0519", "#ffffff");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Sheet 9: Login Activity
 * Real-time Authentication & Session Audit Trail
 */
function setupLoginActivitySheet(sheet) {
  sheet.clear();
  var headers = [
    "Session ID", "User Type", "User Login ID", "User Full Name",
    "Authentication Timestamp", "Session Status", "Portal / Client Info"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatHeaderRow(sheet, 1, headers.length, "#312e81", "#ffffff");

  sheet.getRange(2, 1, 1, headers.length).setValues([[
    "SES-9001", "Admin", "Jay@admin.com", "Jay (Owner)",
    new Date().toISOString().replace('T', ' ').substring(0, 19), "Success", "Admin Portal (Secure Web)"
  ]]);

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}

/* ============================================================================
 * 2. DATABASE HELPER UTILITIES (Row Finding, Upserting, Deleting)
 * ============================================================================ */

function findRowById(sheet, idColIndex, idValue) {
  if (!sheet) return -1;
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  var vals = sheet.getRange(2, idColIndex, lastRow - 1, 1).getValues();
  var target = String(idValue).trim().toLowerCase();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toLowerCase() === target) {
      return i + 2; // 1-based row index
    }
  }
  return -1;
}

function upsertRow(sheet, idColIndex, idValue, rowValues) {
  var rowIndex = findRowById(sheet, idColIndex, idValue);
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
    return rowIndex;
  } else {
    sheet.appendRow(rowValues);
    return sheet.getLastRow();
  }
}

function deleteRowById(sheet, idColIndex, idValue) {
  var rowIndex = findRowById(sheet, idColIndex, idValue);
  if (rowIndex > 0) {
    sheet.deleteRow(rowIndex);
    return true;
  }
  return false;
}

/* ============================================================================
 * 3. REST API CONTROLLER (doGet: READ REAL DATA)
 * ============================================================================ */

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Check optional action query parameter
    var action = e && e.parameter ? e.parameter.action : null;

    if (action === "ping" || action === "test_connection") {
      return createJsonResponse({
        status: "success",
        message: "ApexCore SaaS Google Apps Script v4.0 is active and responding"
      });
    }

    var data = {
      status: "success",
      timestamp: new Date().toISOString(),
      clients: readClientsSheet(ss.getSheetByName("Clients")),
      projects: readProjectsSheet(ss.getSheetByName("Projects")),
      freelancers: readFreelancersSheet(ss.getSheetByName("Freelancers")),
      freelancerAdmin: readFreelancerAdminSheet(ss.getSheetByName("Freelancer Admin")),
      freelancerCredentials: readFreelancerAdminSheet(ss.getSheetByName("Freelancer Admin")),
      adminUsers: readAdminSheet(ss.getSheetByName("Admin")),
      paymentsData: readPaymentsSheet(ss.getSheetByName("Payments")),
      completedProjects: readCompletedProjectsSheet(ss.getSheetByName("Completed Projects"), ss.getSheetByName("Projects")),
      deletedItems: readDeletedItemsSheet(ss.getSheetByName("Deleted Items")),
      loginActivity: readLoginActivitySheet(ss.getSheetByName("Login Activity"))
    };

    // Flatten payments
    data.clientPayments = data.paymentsData.clientPayments;
    data.freelancerDisbursements = data.paymentsData.freelancerDisbursements;
    delete data.paymentsData;

    return createJsonResponse(data);
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function readClientsSheet(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (!row[0]) continue;
    var svcs = String(row[4] || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    if (svcs.length === 0) svcs = ["Web Development"];
    list.push({
      id: String(row[0]),
      name: String(row[1] || ""),
      email: String(row[2] || ""),
      phone: String(row[3] || ""),
      services: svcs,
      activeProjects: Number(row[5]) || 0,
      totalBilled: Number(row[6]) || 0,
      paymentDue: Number(row[7]) || 0,
      status: String(row[8] || "Active"),
      notes: String(row[9] || "")
    });
  }
  return list;
}

function readProjectsSheet(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (!row[0]) continue;
    var statusStr = String(row[6] || "Active").trim();
    // Exclude completed projects from active Projects sheet query
    if (statusStr.toLowerCase() === "completed") continue;
    list.push({
      id: String(row[0]),
      name: String(row[1] || ""),
      service: String(row[2] || "Web Development"),
      client: String(row[3] || ""),
      budget: Number(row[4]) || 0,
      progress: Number(row[5]) || 0,
      status: statusStr,
      notes: String(row[7] || ""),
      assignedFreelancerId: String(row[8] || ""),
      assignedFreelancerName: String(row[9] || "Unassigned"),
      deadline: String(row[10] || "")
    });
  }
  return list;
}

function readFreelancersSheet(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (!row[0]) continue;
    var sk = String(row[4] || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    if (sk.length === 0) sk = ["Web Development"];
    var projs = String(row[8] || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    list.push({
      id: String(row[0]),
      name: String(row[1] || ""),
      email: String(row[2] || ""),
      phone: String(row[3] || ""),
      skills: sk,
      paymentStatus: String(row[5] || "Cleared"),
      paymentCleared: Number(row[6]) || 0,
      paymentDue: Number(row[7]) || 0,
      assignedProjects: projs,
      status: String(row[9] || "Active")
    });
  }
  return list;
}

function readFreelancerAdminSheet(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var id = String(row[0] || "").trim();
    var name = String(row[1] || "").trim();
    var email = String(row[2] || "").trim();
    if (!id || !name || !email) continue;
    list.push({
      id: id,
      name: name,
      email: email,
      pass: String(row[3] || "").trim(),
      project: String(row[4] || ""),
      milestone: String(row[5] || ""),
      hours: Number(String(row[6] || "35").replace(/[^\d]/g, '')) || 35,
      status: String(row[7] || "Active"),
      lastLogin: String(row[8] || "Active Now"),
      createdAt: String(row[9] || new Date().toISOString().split('T')[0])
    });
  }
  return list;
}

function readPaymentsSheet(sheet) {
  var clientPayments = [];
  var freelancerDisbursements = [];
  if (!sheet) return { clientPayments: clientPayments, freelancerDisbursements: freelancerDisbursements };
  var data = sheet.getDataRange().getValues();
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (!row[0]) continue;
    var type = String(row[1] || "Client Invoice");
    if (type.toLowerCase().indexOf("client") !== -1 || type.toLowerCase().indexOf("invoice") !== -1) {
      clientPayments.push({
        id: String(row[0]),
        type: "Client Invoice",
        client: String(row[2] || ""),
        project: String(row[3] || ""),
        amount: Number(row[4]) || 0,
        status: String(row[5] || "Pending"),
        issueDate: String(row[6] || ""),
        dueDate: String(row[7] || "")
      });
    } else {
      freelancerDisbursements.push({
        id: String(row[0]),
        type: "Freelancer Payout",
        freelancer: String(row[2] || ""),
        project: String(row[3] || ""),
        milestone: "Delivery Milestone",
        hours: 35,
        amount: Number(row[4]) || 0,
        status: String(row[5] || "Pending"),
        issueDate: String(row[6] || ""),
        dueDate: String(row[7] || "")
      });
    }
  }
  return { clientPayments: clientPayments, freelancerDisbursements: freelancerDisbursements };
}

function readAdminSheet(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var id = String(row[0] || "").trim();
    var name = String(row[1] || "").trim();
    var email = String(row[2] || "").trim();
    // Strictly filter out ghost / blank admin rows where ID, Name, or Email is missing
    if (!id || !name || !email) continue;
    list.push({
      id: id,
      name: name,
      email: email,
      pass: String(row[3] || "").trim(),
      role: String(row[4] || "Super Admin").trim(),
      privileges: String(row[5] || "Root Access (All Modules & RBAC)").trim(),
      status: String(row[6] || "Active").trim(),
      lastAuth: String(row[7] || "Active Now").trim()
    });
  }
  return list;
}

function readCompletedProjectsSheet(sheet, projSheet) {
  var list = [];
  var seenIds = {};

  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (!row[0]) continue;
      var id = String(row[0]).trim();
      seenIds[id.toUpperCase()] = true;
      list.push({
        id: id,
        name: String(row[1] || ""),
        service: String(row[2] || "Web Development"),
        client: String(row[3] || ""),
        budget: Number(row[4]) || 0,
        assignedFreelancerName: String(row[5] || "Lead Specialist"),
        completionDate: String(row[6] || ""),
        notes: String(row[7] || "")
      });
    }
  }

  // Also catch any completed rows remaining in Projects sheet and merge
  if (projSheet) {
    var pData = projSheet.getDataRange().getValues();
    for (var pr = 1; pr < pData.length; pr++) {
      var pRow = pData[pr];
      if (!pRow[0]) continue;
      var pId = String(pRow[0]).trim();
      var pStatus = String(pRow[6] || "").trim().toLowerCase();
      if (pStatus === "completed" && !seenIds[pId.toUpperCase()]) {
        seenIds[pId.toUpperCase()] = true;
        list.push({
          id: pId,
          name: String(pRow[1] || ""),
          service: String(pRow[2] || "Web Development"),
          client: String(pRow[3] || ""),
          budget: Number(pRow[4]) || 0,
          assignedFreelancerName: String(pRow[9] || "Lead Specialist"),
          completionDate: String(pRow[10] || new Date().toISOString().split('T')[0]),
          notes: String(pRow[7] || "Completed deliverable")
        });
      }
    }
  }

  return list;
}

function readDeletedItemsSheet(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (!row[0]) continue;
    list.push({
      id: String(row[0]),
      itemType: String(row[1] || ""),
      recordId: String(row[2] || ""),
      recordName: String(row[3] || ""),
      deletedBy: String(row[4] || "Jay (Super Admin)"),
      deletedAt: String(row[5] || ""),
      snapshot: String(row[6] || "")
    });
  }
  return list;
}

function readLoginActivitySheet(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (!row[0]) continue;
    list.push({
      sessionId: String(row[0]),
      userType: String(row[1] || "Admin"),
      userId: String(row[2] || ""),
      userName: String(row[3] || ""),
      timestamp: String(row[4] || ""),
      authStatus: String(row[5] || "Success"),
      clientInfo: String(row[6] || "")
    });
  }
  return list;
}

/* ============================================================================
 * 4. REST API CONTROLLER (doPost: WRITE REAL DATA IN REAL-TIME)
 * ============================================================================ */

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var payload = JSON.parse(raw);
    var action = payload.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var result = { status: "success", action: action };

    // TEST CONNECTION
    if (action === "test_connection") {
      result.message = "Successfully connected to ApexCore Google Sheets Live Backend";
    }

    // 1. UPSERT CLIENT
    else if (action === "upsert_client") {
      var c = payload.client || payload;
      var clientSheet = getOrCreateSheet(ss, "Clients");
      var servicesStr = Array.isArray(c.services) ? c.services.join(", ") : (c.services || c.service || "Web Development");
      var rowData = [
        c.id, c.name, c.email, c.phone || "", servicesStr,
        Number(c.activeProjects) || 0, Number(c.totalBilled) || 0, Number(c.paymentDue) || 0, c.status || "Active",
        c.notes || ""
      ];
      upsertRow(clientSheet, 1, c.id, rowData);
      result.id = c.id;
      result.message = "Client " + c.id + " updated in Google Sheets";
    }

    // 2. UPSERT PROJECT & COMPLETE PROJECT (Separates active Projects and Completed Projects)
    else if (action === "upsert_project" || action === "complete_project") {
      var p = payload.project || payload;
      var projSheet = getOrCreateSheet(ss, "Projects");
      var compSheet = getOrCreateSheet(ss, "Completed Projects");
      var isCompleted = (String(p.status || "").toLowerCase() === "completed") || (action === "complete_project");

      if (isCompleted) {
        // 1. Remove from active Projects sheet
        deleteRowById(projSheet, 1, p.id);

        // 2. Upsert into Completed Projects sheet
        var compDate = p.completionDate || new Date().toISOString().split('T')[0];
        var compRow = [
          p.id, p.name, p.service || "Web Development", p.client || "",
          Number(p.budget) || 0, p.assignedFreelancerName || "Unassigned",
          compDate, p.notes || "Completed deliverable verified"
        ];
        upsertRow(compSheet, 1, p.id, compRow);

        result.id = p.id;
        result.message = "Project " + p.id + " moved from Projects to Completed Projects in Google Sheets";
      } else {
        // Active / Planning / In Review project -> remove from Completed Projects if previously there
        deleteRowById(compSheet, 1, p.id);

        var rowData = [
          p.id, p.name, p.service || "Web Development", p.client || "",
          Number(p.budget) || 0, Number(p.progress) || 0, p.status || "Active",
          p.notes || "", p.assignedFreelancerId || "", p.assignedFreelancerName || "Unassigned", p.deadline || ""
        ];
        upsertRow(projSheet, 1, p.id, rowData);
        result.id = p.id;
        result.message = "Project " + p.id + " updated in active Projects Google Sheet";
      }
    }

    // 2B. REOPEN / RESTORE PROJECT
    else if (action === "reopen_project") {
      var p = payload.project || payload;
      var projSheet = getOrCreateSheet(ss, "Projects");
      var compSheet = getOrCreateSheet(ss, "Completed Projects");

      // Remove from Completed Projects
      deleteRowById(compSheet, 1, p.id);

      // Insert back into active Projects sheet
      var rowData = [
        p.id, p.name, p.service || "Web Development", p.client || "",
        Number(p.budget) || 0, Number(p.progress) || 85, p.status || "In Review",
        p.notes || "Project reopened from Completed archive", p.assignedFreelancerId || "", p.assignedFreelancerName || "Unassigned", p.deadline || ""
      ];
      upsertRow(projSheet, 1, p.id, rowData);
      result.id = p.id;
      result.message = "Project " + p.id + " reopened and restored to active Projects sheet";
    }

    // 3. UPSERT FREELANCER (Directory)
    else if (action === "upsert_freelancer") {
      var f = payload.freelancer || payload;
      var freeSheet = getOrCreateSheet(ss, "Freelancers");
      var skillsStr = Array.isArray(f.skills) ? f.skills.join(", ") : (f.skills || f.skill || "Web Development");
      var projsStr = Array.isArray(f.assignedProjects) ? f.assignedProjects.join(", ") : (f.assignedProjects || "");
      var rowData = [
        f.id, f.name, f.email, f.phone || "", skillsStr,
        f.paymentStatus || "Cleared", Number(f.paymentCleared) || 0, Number(f.paymentDue) || 0,
        projsStr, f.status || "Active"
      ];
      upsertRow(freeSheet, 1, f.id, rowData);

      // Mirror to Freelancer Admin sheet
      var flAdminSheet = getOrCreateSheet(ss, "Freelancer Admin");
      var pass = f.pass || (f.name.split(' ')[0] + '#2026');
      var flAdminRow = [
        f.id, f.name, f.email, pass,
        projsStr || "Sprint Scoped", "Deliverables Scoped", "35 hrs",
        f.status || "Active", "Active Now", new Date().toISOString().split('T')[0]
      ];
      upsertRow(flAdminSheet, 1, f.id, flAdminRow);

      result.id = f.id;
      result.message = "Freelancer " + f.id + " updated across Freelancers & Freelancer Admin sheets";
    }

    // 4. UPSERT FREELANCER ADMIN (Dedicated Credentials Sheet)
    else if (action === "upsert_freelancer_admin" || action === "upsert_freelancer_credential") {
      var fc = payload.credential || payload.freelancer || payload;
      var faSheet = getOrCreateSheet(ss, "Freelancer Admin");
      var faRow = [
        fc.id, fc.name, fc.email, fc.pass || (fc.name.split(' ')[0] + '#2026'),
        fc.project || "Sprint Scoped", fc.milestone || "Deliverables Scoped",
        (fc.hours ? (fc.hours + " hrs") : "35 hrs"),
        fc.status || "Active", fc.lastLogin || "Active Now",
        fc.createdAt || new Date().toISOString().split('T')[0]
      ];
      upsertRow(faSheet, 1, fc.id, faRow);
      result.id = fc.id;
      result.message = "Freelancer Admin credential " + fc.id + " saved to Google Sheets";
    }

    // 5. UPDATE FREELANCER LOGIN TIME
    else if (action === "update_freelancer_login_time") {
      var targetId = payload.id || "";
      var targetEmail = payload.email || "";
      var timeStr = payload.timestamp || (new Date().toISOString().replace('T', ' ').substring(0, 19) + " IST");

      var faSheet = getOrCreateSheet(ss, "Freelancer Admin");
      var rowIdx = findRowById(faSheet, 1, targetId);
      if (rowIdx <= 0 && targetEmail) {
        rowIdx = findRowById(faSheet, 3, targetEmail);
      }
      if (rowIdx > 0) {
        faSheet.getRange(rowIdx, 9).setValue(timeStr); // Column 9: Last Login Time
      }

      // Also log to Login Activity sheet
      var logSheet = getOrCreateSheet(ss, "Login Activity");
      var logId = "SES-" + Math.floor(1000 + Math.random() * 9000);
      logSheet.appendRow([
        logId, "Freelancer Specialist", targetEmail || targetId, payload.name || "Freelancer",
        timeStr, "Success", payload.clientInfo || "Freelancer Portal (freelancer.html)"
      ]);
      result.message = "Updated login time for freelancer " + (targetId || targetEmail) + " to " + timeStr;
    }

    // 6. UPDATE ADMIN LOGIN TIME
    else if (action === "update_admin_login_time") {
      var admId = payload.id || "";
      var admEmail = payload.email || "";
      var timeStr = payload.timestamp || (new Date().toISOString().replace('T', ' ').substring(0, 19) + " IST");

      var admSheet = getOrCreateSheet(ss, "Admin");
      var rowIdx = findRowById(admSheet, 1, admId);
      if (rowIdx <= 0 && admEmail) {
        rowIdx = findRowById(admSheet, 3, admEmail);
      }
      if (rowIdx > 0) {
        admSheet.getRange(rowIdx, 8).setValue(timeStr); // Column 8: Last Authentication
      }

      // Log to Login Activity
      var logSheet = getOrCreateSheet(ss, "Login Activity");
      var logId = "SES-" + Math.floor(1000 + Math.random() * 9000);
      logSheet.appendRow([
        logId, "Admin", admEmail || admId, payload.name || "Administrator",
        timeStr, "Success", payload.clientInfo || "Admin Portal (index.html)"
      ]);
      result.message = "Updated authentication time for admin " + (admId || admEmail) + " to " + timeStr;
    }

    // 7. UPSERT PAYMENT
    else if (action === "upsert_payment") {
      var pay = payload.payment || payload;
      var paySheet = getOrCreateSheet(ss, "Payments");
      var rowData = [
        pay.id, pay.type || "Client Invoice", pay.client || pay.freelancer || pay.entityName || "",
        pay.project || "", Number(pay.amount) || 0, pay.status || "Pending",
        pay.issueDate || new Date().toISOString().split('T')[0], pay.dueDate || ""
      ];
      upsertRow(paySheet, 1, pay.id, rowData);
      result.id = pay.id;
    }

    // 8. UPSERT ADMIN
    else if (action === "upsert_admin") {
      var adm = payload.admin || payload;
      var admId = String(adm.id || "").trim();
      var admName = String(adm.name || "").trim();
      var admEmail = String(adm.email || "").trim();

      // Reject empty or ghost admin records
      if (!admId || !admName || !admEmail) {
        result.status = "ignored";
        result.message = "Skipped empty admin payload: ID, Name, and Email are required";
      } else {
        var admSheet = getOrCreateSheet(ss, "Admin");
        var rowData = [
          admId, admName, admEmail, String(adm.pass || "").trim(),
          String(adm.role || "Super Admin").trim(),
          String(adm.privileges || "Root Access (All Modules & RBAC)").trim(),
          String(adm.status || "Active").trim(),
          String(adm.lastAuth || new Date().toISOString().replace('T', ' ').substring(0, 19)).trim()
        ];
        upsertRow(admSheet, 1, admId, rowData);
        result.id = admId;
      }
    }

    // 9. DELETE RECORD (Deletes row from active sheet AND logs to Deleted Items)
    else if (action === "delete_record") {
      var targetSheetName = "";
      var type = (payload.itemType || "").toLowerCase();
      if (type.indexOf("client") !== -1) targetSheetName = "Clients";
      else if (type.indexOf("proj") !== -1) {
        targetSheetName = "Projects";
        var compSheet = ss.getSheetByName("Completed Projects");
        if (compSheet) deleteRowById(compSheet, 1, payload.id);
      }
      else if (type.indexOf("free") !== -1) {
        targetSheetName = "Freelancers";
        var faSheet = ss.getSheetByName("Freelancer Admin");
        if (faSheet) deleteRowById(faSheet, 1, payload.id);
      }
      else if (type.indexOf("admin") !== -1) targetSheetName = "Admin";
      else if (type.indexOf("pay") !== -1) targetSheetName = "Payments";

      if (targetSheetName) {
        var targetSheet = ss.getSheetByName(targetSheetName);
        if (targetSheet) {
          deleteRowById(targetSheet, 1, payload.id);
        }
      }

      // Log into Deleted Items audit sheet
      var delSheet = getOrCreateSheet(ss, "Deleted Items");
      var delId = "DEL-" + Math.floor(1000 + Math.random() * 9000);
      var delTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
      delSheet.appendRow([
        delId, payload.itemType, payload.id, payload.displayName || payload.name || payload.id,
        payload.deletedBy || "Jay (Super Admin)", delTime,
        payload.snapshot || ("Deleted from " + targetSheetName)
      ]);
      result.deletedId = delId;
      result.message = payload.id + " permanently deleted from " + targetSheetName;
    }

    // 10. COMPLETE PROJECT
    else if (action === "complete_project") {
      var cp = payload.project || payload;
      var projSheet = getOrCreateSheet(ss, "Projects");
      var rIdx = findRowById(projSheet, 1, cp.id);
      if (rIdx > 0) {
        projSheet.getRange(rIdx, 6).setValue(100);
        projSheet.getRange(rIdx, 7).setValue("Completed");
      }
      var compSheet = getOrCreateSheet(ss, "Completed Projects");
      compSheet.appendRow([
        cp.id, cp.name, cp.service || "Web Development", cp.client || "",
        Number(cp.budget) || 0, cp.assignedFreelancerName || "Lead Specialist",
        cp.completionDate || new Date().toISOString().split('T')[0],
        cp.notes || "Milestone completed"
      ]);
      result.message = "Project " + cp.id + " archived into Completed Projects";
    }

    // 11. LOG LOGIN (General)
    else if (action === "log_login") {
      var logSheet = getOrCreateSheet(ss, "Login Activity");
      var logId = "SES-" + Math.floor(1000 + Math.random() * 9000);
      var timeStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
      logSheet.appendRow([
        logId, payload.userType || "Admin", payload.userId || payload.email || "Jay@admin.com",
        payload.userName || "Jay (Super Admin)", timeStr,
        payload.authStatus || "Success", payload.clientInfo || "Enterprise TLS Web"
      ]);
      result.sessionId = logId;
    }

    // 12. FULL BATCH SYNC ALL
    else if (action === "sync_all") {
      if (payload.clients) syncClientsSheet(ss, payload.clients);
      if (payload.projects) syncProjectsSheet(ss, payload.projects);
      if (payload.freelancers) syncFreelancersSheet(ss, payload.freelancers);
      if (payload.freelancerAdmin || payload.freelancerCredentials) {
        syncFreelancerAdminSheet(ss, payload.freelancerAdmin || payload.freelancerCredentials);
      }
      if (payload.adminUsers) syncAdminSheet(ss, payload.adminUsers);
      result.message = "All operational sheets fully synchronized";
    }

    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

/* ============================================================================
 * 5. BATCH SYNC HELPERS (For Push to Sheets)
 * ============================================================================ */

function syncClientsSheet(ss, clients) {
  var sheet = ss.getSheetByName("Clients");
  if (!sheet || !clients || clients.length === 0) return;
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 9).clearContent();
  var rows = clients.map(function (c) {
    var svcs = Array.isArray(c.services) ? c.services.join(", ") : (c.services || c.service || "Web Development");
    return [
      c.id, c.name, c.email, c.phone || "", svcs,
      Number(c.activeProjects) || 0, Number(c.totalBilled) || 0, Number(c.paymentDue) || 0, c.status || "Active"
    ];
  });
  sheet.getRange(2, 1, rows.length, 9).setValues(rows);
}

function syncProjectsSheet(ss, projects) {
  var sheet = ss.getSheetByName("Projects");
  if (!sheet || !projects || projects.length === 0) return;
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 11).clearContent();
  var rows = projects.map(function (p) {
    return [
      p.id, p.name, p.service || "Web Development", p.client || "",
      Number(p.budget) || 0, Number(p.progress) || 0, p.status || "Active",
      p.notes || "", p.assignedFreelancerId || "", p.assignedFreelancerName || "Unassigned", p.deadline || ""
    ];
  });
  sheet.getRange(2, 1, rows.length, 11).setValues(rows);
}

function syncFreelancersSheet(ss, freelancers) {
  var sheet = ss.getSheetByName("Freelancers");
  if (!sheet || !freelancers || freelancers.length === 0) return;
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 10).clearContent();
  var rows = freelancers.map(function (f) {
    var sk = Array.isArray(f.skills) ? f.skills.join(", ") : (f.skills || f.skill || "Web Development");
    var projs = Array.isArray(f.assignedProjects) ? f.assignedProjects.join(", ") : (f.assignedProjects || "");
    return [
      f.id, f.name, f.email, f.phone || "", sk,
      f.paymentStatus || "Cleared", Number(f.paymentCleared) || 0, Number(f.paymentDue) || 0,
      projs, f.status || "Active"
    ];
  });
  sheet.getRange(2, 1, rows.length, 10).setValues(rows);
}

function syncFreelancerAdminSheet(ss, freelancerAdmins) {
  var sheet = ss.getSheetByName("Freelancer Admin");
  if (!sheet || !freelancerAdmins || freelancerAdmins.length === 0) return;
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 10).clearContent();
  var rows = freelancerAdmins.map(function (fa) {
    return [
      fa.id, fa.name, fa.email, fa.pass || (fa.name.split(' ')[0] + '#2026'),
      fa.project || "Sprint Scoped", fa.milestone || "Deliverables Scoped",
      (fa.hours ? (fa.hours + " hrs") : "35 hrs"),
      fa.status || "Active", fa.lastLogin || "Active Now",
      fa.createdAt || new Date().toISOString().split('T')[0]
    ];
  });
  sheet.getRange(2, 1, rows.length, 10).setValues(rows);
}

function syncAdminSheet(ss, admins) {
  var sheet = ss.getSheetByName("Admin");
  if (!sheet || !admins || admins.length === 0) return;
  var validAdmins = admins.filter(function (a) {
    return a && String(a.id || "").trim() && String(a.name || "").trim() && String(a.email || "").trim();
  });
  if (validAdmins.length === 0) return;
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 8).clearContent();
  var rows = validAdmins.map(function (a) {
    return [
      String(a.id).trim(), String(a.name).trim(), String(a.email).trim(), String(a.pass || "").trim(),
      String(a.role || "Super Admin").trim(), String(a.privileges || "Root Access (All Modules & RBAC)").trim(),
      String(a.status || "Active").trim(),
      String(a.lastAuth || "System Synced").trim()
    ];
  });
  sheet.getRange(2, 1, rows.length, 8).setValues(rows);
}