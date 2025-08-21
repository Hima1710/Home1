// finance-system.js - النظام المالي لحسابات خالي عادل
// ==================================================

// عنوان Google Apps Script
const GAS_URL = "https://script.google.com/macros/s/AKfycbw5k0xGJYIGBppEQsOJbh-J6QnMaCpqq8TGe8Jh2H13ErU6_U5E3j2L0L69FAS0WoSrlA/exec";

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", function () {
  setupNavigation();
  setupEventListeners();
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
function showLoading() {
  const spinner = document.getElementById("loadingSpinner");
  if (spinner) spinner.classList.add("active");
}

function hideLoading() {
  const spinner = document.getElementById("loadingSpinner");
  if (spinner) spinner.classList.remove("active");
}

// معالجة تسجيل الدخول
function handleLogin(e) {
  e.preventDefault();
  
  const phone = document.getElementById("phone").value;
  const password = document.getElementById("password").value;
  
  jsonpRequest(
    `${GAS_URL}?action=login&phone=${encodeURIComponent(phone)}&password=${encodeURIComponent(password)}`,
    function (resp) {
      if (resp.status === "ok") {
        document.getElementById("loginOverlay").style.display = "none";
        document.getElementById("mainContent").style.display = "block";
        loadAllData();
      } else {
        const errorElement = document.getElementById("loginError");
        errorElement.textContent = resp.message || "خطأ في تسجيل الدخول";
        errorElement.classList.add("show");
      }
    }
  );
}

// تسجيل الخروج
function logout() {
  document.getElementById("loginOverlay").style.display = "flex";
  document.getElementById("mainContent").style.display = "none";
  // إعادة تعيين نموذج تسجيل الدخول
  document.getElementById("loginForm").reset();
  document.getElementById("loginError").classList.remove("show");
}

// إرسال طلب JSONP إلى خادم Google Apps Script
function jsonpRequest(url, callback) {
  const cbName = "cb_" + Math.random().toString(36).substr(2, 9);
  window[cbName] = function (data) {
    callback(data);
    delete window[cbName];
    script.remove();
  };
  const script = document.createElement("script");
  script.src = url + "&callback=" + cbName;
  document.body.appendChild(script);
}

// تحميل جميع البيانات
function loadAllData() {
  jsonpRequest(`${GAS_URL}?action=all`, function (resp) {
    if (resp.status === "ok") {
      // تعبئة الجداول
      populateTable("income", resp.data["الدخل"]);
      populateTable("expenses", resp.data["المصروفات"]);
      populateTable("workers", resp.data["العمال"]);
      populateTable("returns", resp.data["الاسترجاع"]);
      
      // تعبئة ملخص لوحة القيادة
      if (resp.data["الملخص"]) {
        populateSummary(resp.data["الملخص"]);
      }
    } else {
      alert("حدث خطأ أثناء تحميل البيانات: " + (resp.message || ""));
    }
  });
}

// تعبئة جدول البيانات
function populateTable(type, data) {
  const tbody = document.getElementById(type + "TableBody");
  if (!tbody || !data) return;
  
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

// تعبئة بيانات الملخص في لوحة القيادة
function populateSummary(data) {
  document.getElementById("summaryIncomeEGP").textContent = data.incomeEGP || 945082;
  document.getElementById("summaryIncomeUSD").textContent = data.incomeUSD || 5100;
  document.getElementById("summaryExpensesEGP").textContent = data.expensesEGP || 0;
  document.getElementById("summaryExpensesUSD").textContent = data.expensesUSD || 2000;
  document.getElementById("summaryNetEGP").textContent = data.netEGP || 945082;
  document.getElementById("summaryNetUSD").textContent = data.netUSD || 3100;
}

// حذف صف من البيانات
function deleteRow(type, index) {
  if (confirm("هل أنت متأكد من أنك تريد حذف هذا السجل؟")) {
    jsonpRequest(
      `${GAS_URL}?action=delete&type=${type}&index=${index}`,
      function (resp) {
        if (resp.status === "ok") {
          loadAllData();
        } else {
          alert("حدث خطأ أثناء الحذف: " + (resp.message || ""));
        }
      }
    );
  }
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

// معالجة إضافة بيانات جديدة
function handleAddData(e) {
  e.preventDefault();
  
  // الحصول على نوع الشيت من السمة المخزنة
  const sheetType = document.getElementById("addForm").getAttribute("data-type") || "income";
  
  // ترجمة أنواع الأقسام الإنجليزية إلى العربية التي يتوقعها الخادم
  const sheetMapping = {
    "income": "الدخل",
    "expenses": "المصروفات",
    "workers": "العمال",
    "returns": "الاسترجاع"
  };
  
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
    "التاريخ": document.getElementById("date").value,
    [sourceKey]: document.getElementById("source").value,
    "المبلغ": document.getElementById("amount").value,
    "العملة": document.getElementById("currency").value,
    "طريقة الدفع": document.getElementById("paymentMethod").value || "",
    "ملاحظات": document.getElementById("notes").value || "",
    "المستخدم": document.getElementById("user").value || ""
  };
  
  // استخدام صيغة مختلفة للإرسال تتوافق مع ما يتوقعه الخادم
  // تضمين البيانات في رابط الطلب مباشرة بدلاً من كائن JSON
  const urlParams = new URLSearchParams();
  urlParams.append('action', 'add');
  urlParams.append('sheet', arabicSheetName);
  
  // تحويل كائن البيانات إلى JSON string
  const dataString = JSON.stringify(dataObj);
  urlParams.append('data', dataString);
  
  // طباعة الرابط الكامل للتصحيح
  const fullUrl = `${GAS_URL}?${urlParams.toString()}`;
  console.log("URL الطلب:", fullUrl);
  
  // إرسال الطلب
  jsonpRequest(fullUrl, function (resp) {
    if (resp.status === "ok") {
      closeModal();
      loadAllData();
    } else {
      alert("حدث خطأ في إضافة البيانات: " + (resp.message || ""));
      console.error("خطأ في إضافة البيانات:", resp);
    }
  });
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