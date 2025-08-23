// finance-system.js - النظام المالي لحسابات خالي عادل
// ==================================================

// عنوان Google Apps Script
const GAS_URL = "https://script.google.com/macros/s/AKfycbxqLYgx980bef7NZxPZdTuku1Z4NIT2ERv91HiXAlhePRNJjqsHg8FVioKI8ydnQAa-4w/exec";

// ترجمة أنواع الأقسام الإنجليزية إلى العربية التي يتوقعها الخادم
const sheetMapping = {
  "income": "الدخل",
  "expenses": "المصروفات",
  "workers": "العمال",
  "returns": "الاسترجاع"
};

// إضافة دوال لتعطيل وإعادة تفعيل الأزرار مع مؤشر تحميل
function disableButton(button, loadingText = "جاري الإرسال...") {
  if (!button) return;
  
  const originalText = button.innerHTML;
  button.disabled = true;
  button.classList.add("btn-loading");
  button.setAttribute("data-original-text", originalText);
  button.innerHTML = `
    <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
    <span>${loadingText}</span>
  `;
  return originalText;
}

function enableButton(button) {
  if (!button) return;
  
  const originalText = button.getAttribute("data-original-text") || "إرسال";
  button.disabled = false;
  button.classList.remove("btn-loading");
  button.innerHTML = originalText;
}

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", function () {
  setupNavigation();
  setupEventListeners();
  createLoadingSpinner();
  createNotificationElement();
  // إزالة إضافة زر اختبار الاتصال
});

// إعداد التنقل بين الصفحات
function setupNavigation() {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", function () {
      // إزالة الفئة النشطة من جميع الروابط والأقسام
      document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));
      document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
      
      // إضافة الفئة النشطة للرابط الحالي والقسم المستهدف
      link.classList.add("active");
      const target = this.getAttribute("href")?.substring(1);
      if (target) document.getElementById(target).classList.add("active");
    });
  });

  // إعداد زر التبديل للهاتف المحمول
  const navToggle = document.getElementById("navToggle");
  if (navToggle) {
    navToggle.addEventListener("click", function () {
      this.classList.toggle("active");
      document.getElementById("navMenu").classList.toggle("active");
    });
  }
}

// إعداد مستمعي الأحداث
function setupEventListeners() {
  // نموذج تسجيل الدخول
  document.getElementById("loginForm").addEventListener("submit", handleLogin);
  
  // نموذج إضافة بيانات جديدة
  document.getElementById("addForm").addEventListener("submit", handleAddData);
}

// عرض وإخفاء مؤشر التحميل
let loadingTimer = null;
function showLoading() {
  const spinner = document.getElementById("loadingSpinner");
  if (spinner) {
    spinner.classList.add("active");
    const loadingText = document.getElementById("loadingText");
    if (loadingText) loadingText.textContent = "جاري التحميل...";
  }
  // إخفاء تلقائي بعد 3 ثوانٍ كحد أقصى
  if (loadingTimer) clearTimeout(loadingTimer);
  loadingTimer = setTimeout(() => {
    hideLoading();
  }, 3000);
}

function hideLoading() {
  const spinner = document.getElementById("loadingSpinner");
  if (spinner) {
    spinner.classList.remove("active");
    const loadingText = document.getElementById("loadingText");
    if (loadingText) loadingText.textContent = "";
  }
  if (loadingTimer) {
    clearTimeout(loadingTimer);
    loadingTimer = null;
  }
}

function showLoadingMessage(message) {
  const loadingText = document.getElementById("loadingText");
  if (loadingText) loadingText.textContent = message;
}

// متغير لتخزين token المستخدم
let currentUserToken = null;

// معالجة تسجيل الدخول مع منع النقر المتكرر
function handleLogin(e) {
  e.preventDefault();
  const loginButton = document.querySelector("#loginForm [type='submit']");
  disableButton(loginButton, "جاري التحقق...");
  showLoading();
  showLoadingMessage("جاري التحقق من بيانات تسجيل الدخول...");
  const phone = document.getElementById("phone").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!phone || !password) {
    hideLoading();
    enableButton(loginButton);
    const errorElement = document.getElementById("loginError");
    errorElement.textContent = "يرجى إدخال رقم الهاتف وكلمة المرور";
    errorElement.classList.add("show");
    return;
  }
  console.log("محاولة تسجيل دخول:", { phone, password });
  smartRequestWithRetry(
    `${GAS_URL}?action=login&phone=${encodeURIComponent(phone)}&password=${encodeURIComponent(password)}`,
    function (resp) {
      hideLoading();
      enableButton(loginButton);
      if (resp.status === "ok") {
        currentUserToken = resp.token;
        document.getElementById("loginOverlay").style.display = "none";
        document.getElementById("mainContent").style.display = "block";
        showLoadingMessage("جاري تحميل البيانات...");
        loadAllData();
      } else {
        showLoginError(resp.message || "خطأ في تسجيل الدخول", false);
      }
    },
    function (error) {
      hideLoading();
      enableButton(loginButton);
      showLoginError("انتهت مهلة الاتصال أو فشل الاتصال. حاول مرة أخرى.", true);
      console.error("خطأ في الاتصال:", error);
    },
    { timeout: 10000, retries: 1 }
  );
}

// تسجيل الخروج
function logout() {
  // مسح token المستخدم
  currentUserToken = null;
  console.log("تم مسح token المستخدم");
  
  document.getElementById("loginOverlay").style.display = "flex";
  document.getElementById("mainContent").style.display = "none";
  // إعادة تعيين نموذج تسجيل الدخول
  document.getElementById("loginForm").reset();
  document.getElementById("loginError").classList.remove("show");
}

// إرسال طلب JSONP إلى خادم Google Apps Script مع timeout محسن
function jsonpRequest(url, successCallback, errorCallback, timeout = 3000) {
  const cbName = "cb_" + Math.random().toString(36).substr(2, 9);
  let isCompleted = false; // منع الاستدعاء المتكرر
  const timeoutId = setTimeout(() => {
    if (!isCompleted && window[cbName]) {
      isCompleted = true;
      delete window[cbName];
      if (errorCallback) {
        errorCallback(new Error("انتهت مهلة الاتصال - جرب مرة أخرى"));
      }
    }
  }, timeout);
  window[cbName] = function (data) {
    if (isCompleted) return;
    isCompleted = true;
    clearTimeout(timeoutId);
    try { successCallback(data); } catch (err) {
      if (errorCallback) errorCallback(new Error("خطأ في معالجة البيانات"));
    }
    delete window[cbName];
    if (script && script.parentNode) { script.parentNode.removeChild(script); }
  };
  const script = document.createElement("script");
  script.src = url + "&callback=" + cbName;
  script.onerror = () => {
    if (!isCompleted) {
      isCompleted = true;
      clearTimeout(timeoutId);
      if (errorCallback) errorCallback(new Error("فشل في تحميل السكريبت"));
    }
  };
  document.body.appendChild(script);
  return () => {
    if (!isCompleted) {
      isCompleted = true;
      clearTimeout(timeoutId);
      delete window[cbName];
      if (script && script.parentNode) { script.parentNode.removeChild(script); }
    }
  };
}

// دالة بديلة أسرع باستخدام Fetch API (إذا كان متاحاً)
function fetchRequest(url, successCallback, errorCallback, timeout = 3000) {
  if (typeof fetch === 'undefined') {
    return jsonpRequest(url, successCallback, errorCallback, timeout);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  fetch(url, { method: 'GET', signal: controller.signal, mode: 'cors' })
    .then(response => { clearTimeout(timeoutId); if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`); return response.json(); })
    .then(data => { successCallback(data); })
    .catch(error => { clearTimeout(timeoutId); if (error.name === 'AbortError') { errorCallback(new Error("انتهت مهلة الاتصال - جرب مرة أخرى")); } else { errorCallback(error); } });
}

// دالة ذكية تختار أفضل طريقة للاتصال
function smartRequest(url, successCallback, errorCallback, timeout = 3000) {
  try { return fetchRequest(url, successCallback, errorCallback, timeout); }
  catch (err) { return jsonpRequest(url, successCallback, errorCallback, timeout); }
}

// دالة ذكية مع إعادة محاولة
function smartRequestWithRetry(url, successCallback, errorCallback, options = {}) {
  const { timeout = 10000, retries = 1 } = options;
  let attempts = 0;

  const attempt = () => {
    attempts += 1;
    console.log(`محاولة ${attempts} من ${retries + 1}`);
    
    smartRequest(
      url,
      (data) => {
        console.log(`نجحت المحاولة ${attempts}`);
        successCallback(data);
      },
      (err) => {
        console.log(`فشلت المحاولة ${attempts}:`, err.message);
        if (attempts <= retries) {
          console.log(`إعادة المحاولة...`);
          setTimeout(attempt, 1000); // انتظار ثانية قبل إعادة المحاولة
        } else {
          console.log(`انتهت جميع المحاولات`);
          errorCallback(err);
        }
      },
      timeout
    );
  };

  attempt();
}

// تحميل جميع البيانات مع تحسينات الأداء
function loadAllData() {
  showLoading(); // عرض مؤشر التحميل
  
  // تحميل البيانات بشكل متوازي لتحسين الأداء
  const promises = [
    loadSheetData('الدخل'),
    loadSheetData('المصروفات'),
    loadSheetData('العمال'),
    loadSheetData('الاسترجاع'),
    loadSheetData('الملخص')
  ];
  
  Promise.all(promises)
    .then(results => {
      const [income, expenses, workers, returns, summary] = results;
      
      // تعبئة الجداول
      populateTable("income", income || []);
      populateTable("expenses", expenses || []);
      populateTable("workers", workers || []);
      populateTable("returns", returns || []);
      
      // تعبئة ملخص لوحة القيادة من شيت الملخص
      if (summary && summary.length > 0) {
        console.log("بيانات الملخص:", summary);
        populateSummary(summary);
      } else {
        console.log("لم يتم العثور على بيانات الملخص");
        // إعادة تحميل بيانات الملخص فقط
        loadSummaryData();
      }
      
      hideLoading();
    })
    .catch(error => {
      hideLoading();
      console.error("خطأ في تحميل البيانات:", error);
      alert("حدث خطأ أثناء تحميل البيانات");
    });
}

// تحميل بيانات شيت واحد
function loadSheetData(sheetName) {
  return new Promise((resolve, reject) => {
    smartRequestWithRetry(
      `${GAS_URL}?action=get&sheet=${encodeURIComponent(sheetName)}`,
      function (resp) {
        if (resp.status === "ok" && resp.data) {
          console.log(`تم تحميل ${resp.data.length} صف من ${sheetName}`);
          resolve(resp.data);
        } else {
          console.error(`خطأ في تحميل ${sheetName}:`, resp);
          resolve([]);
        }
      },
      function (error) {
        console.error(`خطأ في الاتصال بـ ${sheetName}:`, error);
        resolve([]);
      },
      { timeout: 12000, retries: 1 }
    );
  });
}

// تحميل بيانات الملخص فقط - محسنة للأداء
function loadSummaryData() {
  showLoading();
  
  jsonpRequest(
    `${GAS_URL}?action=get&sheet=الملخص`,
    function (resp) {
      hideLoading();
      if (resp.status === "ok" && resp.data) {
        console.log("تم تحميل بيانات الملخص:", resp.data);
        populateSummary(resp.data);
      } else {
        console.error("خطأ في تحميل بيانات الملخص:", resp);
      }
    },
    function (error) {
      hideLoading();
      console.error("❌ فشل في الاتصال:", error);
    }
  );
}

// تعبئة جدول البيانات مع التحقق من صحة البيانات
function populateTable(type, data) {
  const tbody = document.getElementById(type + "TableBody");
  if (!tbody || !Array.isArray(data) || data.length === 0) return;
  
  tbody.innerHTML = "";
  
  data.forEach((row, index) => {
    const tr = document.createElement("tr");
    
    if (type === "income" || type === "expenses" || type === "returns") {
      const sourceKey = 
        type === "income" ? "المصدر (منين جالي)" : 
        type === "expenses" ? "المصدر (اتصرف فين)" : 
        "المصدر (مين رجع)";
      
      tr.innerHTML = `
        <td>${row["التاريخ"] || ""}</td>
        <td>${row[sourceKey] || ""}</td>
        <td>${row["المبلغ"] || ""}</td>
        <td>${row["العملة"] || ""}</td>
        <td>${row["طريقة الدفع"] || ""}</td>
        <td>${row["ملاحظات"] || ""}</td>
        <td>${row["المستخدم"] || ""}</td>
        <td><button class="btn btn-danger" onclick="deleteRow('${type}', ${index})">حذف</button></td>
      `;
    } 
    else if (type === "workers") {
      tr.innerHTML = `
        <td>${row["التاريخ"] || ""}</td>
        <td>${row["الاسم"] || ""}</td>
        <td>${row["المبلغ"] || ""}</td>
        <td>${row["العملة"] || ""}</td>
        <td>${row["طريقة الدفع"] || ""}</td>
        <td>${row["ملاحظات"] || ""}</td>
        <td>${row["المستخدم"] || ""}</td>
        <td><button class="btn btn-danger" onclick="deleteRow('${type}', ${index})">حذف</button></td>
      `;
    }
    
    tbody.appendChild(tr);
  });
}

// تعبئة بيانات الملخص في لوحة القيادة (قراءة مباشرة من ورقة "الملخص")
function populateSummary(summaryRows) {
  if (!Array.isArray(summaryRows)) {
    console.log("بيانات الملخص غير صحيحة:", summaryRows);
    return;
  }

  console.log("بيانات الملخص المستلمة:", summaryRows);

  // البحث عن الأعمدة الصحيحة
  if (summaryRows.length === 0) {
    console.log("لا توجد بيانات في شيت الملخص");
    return;
  }

  // الحصول على العناوين من الصف الأول
  const headers = Object.keys(summaryRows[0] || {});
  console.log("عناوين شيت الملخص:", headers);

  // البحث عن الأعمدة المطلوبة
  const itemNameKey = "البند";
  const egpKey = "EGP (جنيه)";
  const usdKey = "USD (دولار)";

  // التحقق من وجود الأعمدة المطلوبة
  if (!headers.includes(itemNameKey) || !headers.includes(egpKey) || !headers.includes(usdKey)) {
    console.error("الأعمدة المطلوبة غير موجودة في شيت الملخص");
    console.log("الأعمدة الموجودة:", headers);
    return;
  }

  // بناء خريطة بحسب اسم البند
  const rowsMap = {};
  summaryRows.forEach((row, index) => {
    const name = row && row[itemNameKey];
    if (name) {
      const cleanName = String(name).trim();
      rowsMap[cleanName] = row;
      console.log(`صف ${index + 1}: ${cleanName}`, row);
    }
  });

  console.log("خريطة البيانات:", rowsMap);

  // دوال مساعدة لاستخراج الأرقام بأمان
  const num = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    const n = parseFloat(String(val).toString().replace(/[,\s]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const getVal = (name, currencyKey) => {
    const row = rowsMap[name];
    const value = row ? row[currencyKey] : null;
    const result = num(value);
    console.log(`البند: ${name}, العملة: ${currencyKey}, القيمة: ${value}, النتيجة: ${result}`);
    return result;
  };

  // أسماء البنود كما هي في الورقة
  const incomeName = "إجمالي الدخل";
  const expensesName = "المصروفات";
  const netName = "صافي الربح";

  // قراءة القيم
  const incomeEGP = getVal(incomeName, egpKey);
  const incomeUSD = getVal(incomeName, usdKey);
  const expensesEGP = getVal(expensesName, egpKey);
  const expensesUSD = getVal(expensesName, usdKey);
  const netEGP = getVal(netName, egpKey);
  const netUSD = getVal(netName, usdKey);

  console.log("القيم المستخرجة:", {
    incomeEGP, incomeUSD, expensesEGP, expensesUSD, netEGP, netUSD
  });

  // تعبئة الواجهة
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value.toLocaleString('ar-EG');
      console.log(`تم تعيين ${id} = ${value}`);
    } else {
      console.error(`العنصر ${id} غير موجود`);
    }
  };

  setText("summaryIncomeEGP", incomeEGP);
  setText("summaryIncomeUSD", incomeUSD);
  setText("summaryExpensesEGP", expensesEGP);
  setText("summaryExpensesUSD", expensesUSD);
  setText("summaryNetEGP", netEGP);
  setText("summaryNetUSD", netUSD);

  console.log("تم تحديث لوحة التحكم بنجاح");
}

// حذف صف من البيانات (بدون حوار تأكيد)
function deleteRow(type, index) {
  // التحقق من وجود token
  if (!currentUserToken) {
    alert("يرجى تسجيل الدخول أولاً");
    return;
  }
  
  // الحصول على اسم الشيت العربي
  const arabicSheetName = sheetMapping[type] || type;
  
  // حماية شيت الملخص
  if (arabicSheetName === "الملخص") {
    alert("لا يمكن حذف بيانات من شيت الملخص");
    return;
  }
  
  // حساب رقم الصف الصحيح
  // index = 0 يعني الصف الأول من البيانات (بعد العناوين)
  // في Google Sheets: الصف 1 = العناوين، الصف 2 = أول بيانات
  // نحتاج إلى إرسال index + 1 (ليس index + 2)
  const rowNumber = index + 1;
  
  console.log(`حذف من ${arabicSheetName}: index=${index}, rowNumber=${rowNumber}`);
  
  // التحقق من أن رقم الصف صحيح
  if (rowNumber < 1) {
    alert("خطأ في حساب رقم الصف");
    return;
  }
  
  const urlParams = new URLSearchParams();
  urlParams.append('action', 'delete');
  urlParams.append('sheet', arabicSheetName);
  urlParams.append('row', rowNumber); // استخدام الرقم الصحيح
  urlParams.append('token', currentUserToken); // إرسال token
  
  const fullUrl = `${GAS_URL}?${urlParams.toString()}`;
  console.log("URL طلب الحذف:", fullUrl); // لعرض الرقم للتحقق
  
  // إرسال الطلب مع مؤشر تحميل
  showLoading();
  jsonpRequest(fullUrl, function (resp) {
    hideLoading();
    if (resp.status === "ok") {
      // تحديث البيانات فقط للشيت المحدد
      loadAllData(); // تحديث جميع الجداول بما فيها الملخص
      alert("تم حذف البيانات بنجاح");
    } else {
      let errorMessage = "حدث خطأ أثناء الحذف";
      if (resp.message) {
        if (resp.message.includes("رقم الصف خارج النطاق")) {
          errorMessage = "رقم الصف خارج النطاق - تأكد من وجود البيانات";
        } else {
          errorMessage = resp.message;
        }
      }
      alert(errorMessage);
      console.error("خطأ في حذف البيانات:", resp);
    }
  });
}

// فتح نافذة الإضافة
function openAddModal(type) {
  // تعيين العنوان المناسب للمودال
  let title;
  if (type === "income") title = "إضافة دخل";
  else if (type === "expenses") title = "إضافة مصروف";
  else if (type === "workers") title = "إضافة عامل";
  else if (type === "returns") title = "إضافة استرجاع";
  else title = "إضافة بيانات";
  
  document.getElementById("modalTitle").textContent = title;
  
  // تعيين تسمية حقل المصدر المناسبة
  const sourceLabel = document.getElementById("sourceLabel");
  if (type === "income") sourceLabel.textContent = "المصدر (منين جالي)";
  else if (type === "expenses") sourceLabel.textContent = "المصدر (اتصرف فين)";
  else if (type === "returns") sourceLabel.textContent = "المصدر (مين رجع)";
  else if (type === "workers") sourceLabel.textContent = "اسم العامل";
  else sourceLabel.textContent = "المصدر";
  
  // حفظ نوع البيانات للاستخدام لاحقًا
  document.getElementById("addForm").setAttribute("data-type", type);
  
  // تعيين التاريخ الحالي كقيمة افتراضية
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("date").value = today;
  
  // إظهار المودال
  document.getElementById("addModal").classList.add("active");
}

// إغلاق نافذة الإضافة
function closeModal() {
  document.getElementById("addModal").classList.remove("active");
  document.getElementById("addForm").reset();
}

// معالجة إضافة بيانات جديدة مع التحقق من الحقول الأساسية
function handleAddData(e) {
  e.preventDefault();
  
  // التحقق من وجود token
  if (!currentUserToken) {
    alert("يرجى تسجيل الدخول أولاً");
    return;
  }
  
  // تعطيل زر الإضافة
  const addButton = document.querySelector("#addForm [type='submit']");
  disableButton(addButton, "جاري الإرسال...");
  
  showLoading(); // عرض مؤشر التحميل
  
  // التحقق من وجود بيانات في الحقول الأساسية
  const date = document.getElementById("date").value.trim();
  const source = document.getElementById("source").value.trim();
  const amount = document.getElementById("amount").value.trim();
  const currency = document.getElementById("currency").value.trim();
  
  if (!date || !source || !amount || !currency) {
    alert("يرجى ملء جميع الحقول الأساسية (التاريخ، المصدر، المبلغ، العملة)");
    enableButton(addButton);
    hideLoading();
    return;
  }
  
  // الحصول على نوع الشيت من السمة المخزنة
  const sheetType = document.getElementById("addForm").getAttribute("data-type") || "income";
  
  // الحصول على اسم الشيت العربي
  const arabicSheetName = sheetMapping[sheetType] || sheetType;
  
  // تحديد مفتاح حقل المصدر بناءً على نوع البيانات
  let sourceKey;
  if (sheetType === "income") sourceKey = "المصدر (منين جالي)";
  else if (sheetType === "expenses") sourceKey = "المصدر (اتصرف فين)";
  else if (sheetType === "returns") sourceKey = "المصدر (مين رجع)";
  else if (sheetType === "workers") sourceKey = "الاسم";
  
  // تجميع البيانات من النموذج
  const dataObj = {
    "التاريخ": date,
    [sourceKey]: source,
    "المبلغ": amount,
    "العملة": currency,
    "طريقة الدفع": document.getElementById("paymentMethod").value || "",
    "ملاحظات": document.getElementById("notes").value || "",
    "المستخدم": document.getElementById("user").value || ""
  };
  
  // التحقق من صحة المبلغ (يجب أن يكون رقمًا)
  if (isNaN(parseFloat(dataObj["المبلغ"]))) {
    alert("المبلغ يجب أن يكون رقمًا");
    enableButton(addButton);
    hideLoading();
    return;
  }
  
  // استخدام صيغة مختلفة للإرسال تتوافق مع ما يتوقعه الخادم
  const urlParams = new URLSearchParams();
  urlParams.append('action', 'add');
  urlParams.append('sheet', arabicSheetName);
  urlParams.append('token', currentUserToken); // إرسال token
  
  // تحويل كائن البيانات إلى JSON string
  const dataString = JSON.stringify(dataObj);
  urlParams.append('data', dataString);
  
  // طباعة الرابط الكامل للتصحيح
  const fullUrl = `${GAS_URL}?${urlParams.toString()}`;
  console.log("URL طلب الإضافة:", fullUrl);
  
  // إرسال الطلب
  jsonpRequest(fullUrl, function (resp) {
    hideLoading(); // إخفاء مؤشر التحميل
    enableButton(addButton); // إعادة تفعيل الزر
    
    if (resp.status === "ok") {
      closeModal();
      loadAllData(); // تحديث جميع البيانات
      alert("تم إضافة البيانات بنجاح");
    } else {
      alert("حدث خطأ في إضافة البيانات: " + (resp.message || ""));
      console.error("خطأ في إضافة البيانات:", resp);
    }
  });
}

// اختبار الاتصال مع Google Apps Script
function testConnection() {
  console.log("اختبار الاتصال مع Google Apps Script...");
  
  jsonpRequest(
    `${GAS_URL}?action=ping`,
    function (resp) {
      console.log("استجابة اختبار الاتصال:", resp);
      if (resp.status === "ok") {
        console.log("✅ الاتصال يعمل بشكل صحيح");
        alert("✅ الاتصال مع Google Apps Script يعمل بشكل صحيح");
      } else {
        console.log("❌ مشكلة في الاتصال:", resp);
        alert("❌ مشكلة في الاتصال: " + (resp.message || "خطأ غير معروف"));
      }
    },
    function (error) {
      console.error("❌ فشل في الاتصال:", error);
      alert("❌ فشل في الاتصال مع Google Apps Script. تأكد من نشر السكريبت كـ Web App");
    }
  );
}

// إضافة زر اختبار الاتصال في نموذج تسجيل الدخول
function addTestConnectionButton() {
  const loginForm = document.getElementById("loginForm");
  if (loginForm && !document.getElementById("testConnectionBtn")) {
    const testBtn = document.createElement("button");
    testBtn.type = "button";
    testBtn.id = "testConnectionBtn";
    testBtn.className = "btn btn-secondary";
    testBtn.textContent = "اختبار الاتصال";
    testBtn.onclick = testConnection;
    
    // إضافة الزر بعد زر تسجيل الدخول
    const loginBtn = loginForm.querySelector(".login-btn");
    loginBtn.parentNode.insertBefore(testBtn, loginBtn.nextSibling);
  }
}

// إنشاء مؤشر تحميل
function createLoadingSpinner() {
  if (document.getElementById('loadingSpinner')) return;
  const spinner = document.createElement('div');
  spinner.id = 'loadingSpinner';
  spinner.className = 'spinner';
  spinner.innerHTML = `
    <div class="spinner-border" role="status">
      <span class="visually-hidden">جاري التحميل...</span>
    </div>
  `;
  document.body.appendChild(spinner);
}

// إنشاء عنصر إشعارات
function createNotificationElement() {
  if (document.getElementById('notification')) return;
  const notification = document.createElement('div');
  notification.id = 'notification';
  notification.style = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    max-width: 300px;
    padding: 15px;
    background: #333;
    color: white;
    border-radius: 5px;
    display: none;
  `;
  document.body.appendChild(notification);
}

// تحديث البيانات تلقائيًا كل فترة زمنية (اختياري)
let autoRefreshInterval;

function startAutoRefresh(intervalMinutes) {
  // إيقاف أي تحديث تلقائي موجود
  stopAutoRefresh();
  
  // تحديث البيانات كل عدد محدد من الدقائق
  const intervalMs = intervalMinutes * 60 * 1000;
  autoRefreshInterval = setInterval(loadAllData, intervalMs);
  
  console.log(`تم تفعيل التحديث التلقائي كل ${intervalMinutes} دقيقة`);
}

function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
    console.log("تم إيقاف التحديث التلقائي");
  }
}

// البحث عن مستخدم برقم الهاتف - متوافق مع جدول المستخدمين الحالي
function findUserByPhone(phone) {
  try {
    const sheet = getSheet(CONFIG.USERS_SHEET);
    const rows = sheet.getDataRange().getValues();
    
    if (!rows || rows.length < 2) return null;

    const headers = rows[0].map(h => String(h).trim());
    const dataRows = rows.slice(1);
    
    console.log("عناوين جدول المستخدمين:", headers);
    
    // البحث عن الأعمدة المطلوبة
    const phoneCol = headers.indexOf('phone') !== -1 ? headers.indexOf('phone') : 
                     headers.indexOf('الهاتف') !== -1 ? headers.indexOf('الهاتف') : 0;
    
    const passwordCol = headers.indexOf('password') !== -1 ? headers.indexOf('password') : 
                        headers.indexOf('كلمة المرور') !== -1 ? headers.indexOf('كلمة المرور') : 1;
    
    console.log("عمود الهاتف:", phoneCol, "عمود كلمة المرور:", passwordCol);
    
    if (phoneCol === -1 || passwordCol === -1) {
      console.error("لم يتم العثور على الأعمدة المطلوبة");
      return null;
    }

    const normalize = s => String(s || '').replace(/\s+/g, '').trim();
    const wanted = normalize(phone);

    for (var i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const phoneCell = normalize(row[phoneCol]);
      
      if (phoneCell === wanted) {
        const password = String(row[passwordCol] || '');
        
        console.log("تم العثور على مستخدم:", { phone: row[phoneCol], password: password });
        
        return {
          phone: row[phoneCol],
          passwordHash: null,
          passwordRaw: password,
          id: '1',
          role: 'admin',
          name: 'Admin User'
        };
      }
    }
    
    console.log("لم يتم العثور على مستخدم برقم الهاتف:", phone);
    return null;
  } catch (e) {
    console.error('findUserByPhone error:', e);
    return null;
  }
}

// إنشاء مستخدم تجريبي متوافق مع جدول المستخدمين الحالي
function createTestUser() {
  try {
    const sheet = getSheet(CONFIG.USERS_SHEET);
    const headers = getHeaders(sheet);
    
    console.log("عناوين جدول المستخدمين الحالي:", headers);
    
    // التحقق من وجود الأعمدة المطلوبة
    const phoneCol = headers.indexOf('phone') !== -1 ? headers.indexOf('phone') : 
                     headers.indexOf('الهاتف') !== -1 ? headers.indexOf('الهاتف') : 0;
    
    const passwordCol = headers.indexOf('password') !== -1 ? headers.indexOf('password') : 
                        headers.indexOf('كلمة المرور') !== -1 ? headers.indexOf('كلمة المرور') : 1;
    
    if (phoneCol === -1 || passwordCol === -1) {
      console.error("لم يتم العثور على الأعمدة المطلوبة. تأكد من وجود أعمدة 'phone' و 'password'");
      return;
    }
    
    // التحقق من وجود المستخدم التجريبي
    const existingRows = sheet.getDataRange().getValues();
    const testPhone = '123456789';
    
    for (let i = 1; i < existingRows.length; i++) {
      if (String(existingRows[i][phoneCol]).trim() === testPhone) {
        console.log("المستخدم التجريبي موجود بالفعل");
        return;
      }
    }
    
    // إنشاء صف جديد
    const newRow = new Array(headers.length).fill('');
    newRow[phoneCol] = '123456789';
    newRow[passwordCol] = '123456789';
    
    sheet.appendRow(newRow);
    console.log("تم إنشاء المستخدم التجريبي بنجاح");
    console.log("الهاتف: 123456789");
    console.log("كلمة المرور: 123456789");
    
  } catch (err) {
    console.error('خطأ في إنشاء المستخدم التجريبي:', err);
  }
}

// إعداد النظام مع جدول المستخدمين الحالي
function handleSetup() {
  try {
    const ss = getSpreadsheet();
    const names = Object.keys(CONFIG.DEFAULT_HEADERS);
    
    names.forEach(name => {
      let sh = ss.getSheetByName(name);
      if (!sh) {
        sh = ss.insertSheet(name);
        console.log(`تم إنشاء ورقة جديدة: ${name}`);
      }
      
      const headers = CONFIG.DEFAULT_HEADERS[name];
      const current = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
      const same = JSON.stringify(current.slice(0, headers.length)) === JSON.stringify(headers);
      
      if (!same) {
        sh.clear();
        sh.getRange(1, 1, 1, headers.length).setValues([headers]);
        sh.setFrozenRows(1);
        console.log(`تم تحديث العناوين لورقة: ${name}`);
      }
    });
    
    // إنشاء جدول المستخدمين إذا لم يكن موجوداً
    let usersSheet = ss.getSheetByName(CONFIG.USERS_SHEET);
    if (!usersSheet) {
      usersSheet = ss.insertSheet(CONFIG.USERS_SHEET);
      console.log("تم إنشاء ورقة المستخدمين");
    }
    
    // إعداد جدول المستخدمين مع الأعمدة المطلوبة
    const userHeaders = ['phone', 'password'];
    const currentUserHeaders = usersSheet.getRange(1, 1, 1, Math.max(1, usersSheet.getLastColumn())).getValues()[0];
    
    if (JSON.stringify(currentUserHeaders.slice(0, userHeaders.length)) !== JSON.stringify(userHeaders)) {
      usersSheet.clear();
      usersSheet.getRange(1, 1, 1, userHeaders.length).setValues([userHeaders]);
      usersSheet.setFrozenRows(1);
      console.log("تم تحديث عناوين جدول المستخدمين");
    }
    
    return sendJSON({ status: 'ok', message: 'تم إعداد النظام بنجاح. تم إنشاء الجداول والعناوين.' });
  } catch (err) {
    console.error('خطأ في الإعداد:', err);
    return sendJSON({ status: 'error', code: 500, message: 'فشل في الإعداد: ' + err.message });
  }
}

// ===================== دوال مساعدة للتطوير =====================

// ملاحظة مهمة: دالة handleDelete في Google Apps Script تحتاج إلى حماية إضافية
// تأكد من إضافة هذا الكود في Google Apps Script:
/*
function handleDelete(params, callback) {
  const sheetName = str(params.sheet);
  const rowIndex = toInt(params.row);
  
  if (!sheetName || isNaN(rowIndex)) {
    return sendJSON({ status: 'error', code: 400, message: 'sheet and row are required' }, callback);
  }
  
  // حماية شيت الملخص
  if (sheetName === CONFIG.SUMMARY_SHEET) {
    return sendJSON({ status: 'error', code: 403, message: 'لا يمكن حذف بيانات من الملخص' }, callback);
  }
  
  // حماية الصف الأول (العناوين)
  if (rowIndex < 1) {
    return sendJSON({ status: 'error', code: 400, message: 'لا يمكن حذف صف العناوين' }, callback);
  }

  try {
    const sheet = getSheet(sheetName);
    if (rowIndex > sheet.getLastRow() - 1) {
      return sendJSON({ status: 'error', code: 400, message: 'رقم الصف خارج النطاق' }, callback);
    }

    sheet.deleteRow(rowIndex + 1);
    
    console.log(`Deleted row ${rowIndex} from ${sheetName}`);
    
    return sendJSON({ status: 'ok', message: 'تم حذف الصف بنجاح' }, callback);
  } catch (err) {
    console.error(`Error deleting from sheet ${sheetName}:`, err);
    return sendJSON({ status: 'error', code: 500, message: 'خطأ في حذف البيانات: ' + err.message }, callback);
  }
}
*/

// طباعة هاش كلمة المرور (للتطوير فقط)
function printHash(pw) { 
  console.log('SHA-256 hash for "' + pw + '":', hashPassword(String(pw || ''))); 
}

// إعادة المحاولة في حالة فشل الاتصال
function retryLogin() {
  // إخفاء رسالة الخطأ وزر إعادة المحاولة
  const errorElement = document.getElementById("loginError");
  const retryButton = document.getElementById("retryButton");
  
  if (errorElement) errorElement.classList.remove("show");
  if (retryButton) retryButton.style.display = "none";
  
  // إعادة تسجيل الدخول
  const phone = document.getElementById("phone").value.trim();
  const password = document.getElementById("password").value.trim();
  
  if (phone && password) {
    // محاكاة الضغط على زر تسجيل الدخول
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      loginForm.dispatchEvent(submitEvent);
    }
  } else {
    alert("يرجى إدخال رقم الهاتف وكلمة المرور");
  }
}

// تحديث عرض رسائل الخطأ مع زر إعادة المحاولة
function showLoginError(message, showRetry = false) {
  const errorElement = document.getElementById("loginError");
  const retryButton = document.getElementById("retryButton");
  
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.classList.add("show");
  }
  
  if (retryButton) {
    retryButton.style.display = showRetry ? "block" : "none";
  }
}