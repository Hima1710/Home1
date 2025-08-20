// script.js

// رابط Web App الخاص بك في Google Apps Script
const GAS_URL = "https://script.google.com/macros/s/AKfycbw5k0xGJYIGBppEQsOJbh-J6QnMaCpqq8TGe8Jh2H13ErU6_U5E3j2L0L69FAS0WoSrlA/exec";

// ----------------------
// Login
// ----------------------
document.getElementById("loginForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const phone = document.getElementById("phone").value;
    const password = document.getElementById("password").value;

    jsonpRequest(`${GAS_URL}?action=login&phone=${encodeURIComponent(phone)}&password=${encodeURIComponent(password)}`, function(response) {
        if(response.status === "ok") {
            document.getElementById("loginOverlay").style.display = "none";
            document.getElementById("mainContent").style.display = "block";
            loadAllData();
        } else {
            document.getElementById("loginError").textContent = response.message;
        }
    });
});

function logout() {
    document.getElementById("loginOverlay").style.display = "flex";
    document.getElementById("mainContent").style.display = "none";
}

// ----------------------
// JSONP helper
// ----------------------
function jsonpRequest(url, callback) {
    const callbackName = "cb_" + Math.random().toString(36).substr(2, 9);
    window[callbackName] = function(data) {
        callback(data);
        delete window[callbackName];
        script.remove();
    };
    const script = document.createElement("script");
    script.src = url + "&callback=" + callbackName;
    document.body.appendChild(script);
}

// ----------------------
// Load all data
// ----------------------
function loadAllData() {
    showLoading(true);
    jsonpRequest(`${GAS_URL}?action=all`, function(response) {
        if(response.status === "ok") {
            populateTable("income", response.data["الدخل"]);
            populateTable("expenses", response.data["المصروفات"]);
            populateTable("workers", response.data["العمال"]);
            populateTable("returns", response.data["الاسترجاع"]);
            populateSummary(response.data["الملخص"]);
        }
        showLoading(false);
    });
}

// ----------------------
// Populate tables
// ----------------------
function populateTable(type, data) {
    const tbody = document.getElementById(type + "TableBody");
    tbody.innerHTML = "";
    if(!data) return;
    data.forEach((row, index) => {
        const tr = document.createElement("tr");
        if(type === "income" || type === "expenses" || type === "returns") {
            tr.innerHTML = `
                <td>${row["التاريخ"]}</td>
                <td>${row["المصدر (منين جالي)"] || row["المصدر (اتصرف فين)"] || row["المصدر (مين رجع)"]}</td>
                <td>${row["المبلغ"]}</td>
                <td>${row["العملة"]}</td>
                <td>${row["طريقة الدفع"]}</td>
                <td>${row["ملاحظات"] || ""}</td>
                <td>${row["المستخدم"]}</td>
                <td><button onclick="deleteRow('${type}', ${index})" class="btn btn-danger">حذف</button></td>
            `;
        } else if(type === "workers") {
            tr.innerHTML = `
                <td>${row["التاريخ"]}</td>
                <td>${row["اسم العامل"]}</td>
                <td>${row["المبلغ"]}</td>
                <td>${row["العملة"]}</td>
                <td>${row["طريقة الدفع"]}</td>
                <td>${row["ملاحظات"] || ""}</td>
                <td>${row["المستخدم"]}</td>
                <td><button onclick="deleteRow('${type}', ${index})" class="btn btn-danger">حذف</button></td>
            `;
        }
        tbody.appendChild(tr);
    });
}

// ----------------------
// Populate summary
// ----------------------
function populateSummary(data) {
    if(!data) return;
    document.getElementById("summaryIncomeEGP").textContent = data[0] ? data[0]["EGP (جنيه)"] : 0;
    document.getElementById("summaryIncomeUSD").textContent = data[0] ? data[0]["USD (دولار)"] : 0;
    document.getElementById("summaryExpensesEGP").textContent = data[1] ? data[1]["EGP (جنيه)"] : 0;
    document.getElementById("summaryExpensesUSD").textContent = data[1] ? data[1]["USD (دولار)"] : 0;
    document.getElementById("summaryNetEGP").textContent = data[2] ? data[2]["EGP (جنيه)"] : 0;
    document.getElementById("summaryNetUSD").textContent = data[2] ? data[2]["USD (دولار)"] : 0;
}

// ----------------------
// Loading spinner
// ----------------------
function showLoading(show) {
    document.getElementById("loadingSpinner").style.display = show ? "flex" : "none";
}

// ----------------------
// Delete row
// ----------------------
function deleteRow(type, index) {
    if(!confirm("هل تريد حذف هذا الصف؟")) return;
    jsonpRequest(`${GAS_URL}?action=delete&sheet=${encodeURIComponent(sheetMap(type))}&row=${index}`, function(response) {
        if(response.status === "ok") loadAllData();
        else alert(response.message);
    });
}

function sheetMap(type) {
    switch(type) {
        case "income": return "الدخل";
        case "expenses": return "المصروفات";
        case "workers": return "العمال";
        case "returns": return "الاسترجاع";
        default: return type;
    }
}

// ----------------------
// Show Add Modal
// ----------------------
function showAddModal(type) {
    document.getElementById("addModal").style.display = "block";
    document.getElementById("modalTitle").textContent = "إضافة جديد - " + type;
    document.getElementById("addForm").onsubmit = function(e) {
        e.preventDefault();
        const formData = {
            "التاريخ": document.getElementById("date").value,
            "المصدر (منين جالي)": document.getElementById("source").value || "",
            "المصدر (اتصرف فين)": document.getElementById("source").value || "",
            "المصدر (مين رجع)": document.getElementById("source").value || "",
            "المبلغ": document.getElementById("amount").value,
            "العملة": document.getElementById("currency").value,
            "طريقة الدفع": document.getElementById("paymentMethod").value,
            "ملاحظات": document.getElementById("notes").value,
            "المستخدم": document.getElementById("user").value
        };
        jsonpRequest(`${GAS_URL}?action=add&sheet=${encodeURIComponent(sheetMap(type))}&data=${encodeURIComponent(JSON.stringify(formData))}`, function(response){
            if(response.status==="ok") {
                closeModal();
                loadAllData();
            } else {
                alert(response.message);
            }
        });
    };
}

function closeModal() {
    document.getElementById("addModal").style.display = "none";
}
