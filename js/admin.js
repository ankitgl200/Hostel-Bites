async function checkAuth() {
    const res = await fetch("https://backendhb.onrender.com/api/auth/check", {
        credentials: "include"
    });

    if (!res.ok) {
        document.getElementById("loginBox").style.display = "block";
        document.getElementById("adminPanel").style.display = "none";
    } else {
        document.getElementById("loginBox").style.display = "none";
        document.getElementById("adminPanel").style.display = "flex";
    }
}

document.addEventListener("DOMContentLoaded", checkAuth);

// 🔐 LOGIN
async function login() {
    const btn = document.getElementById("loginBtn");
    const msg = document.getElementById("msg");
    const pass = document.getElementById("adminPass").value.trim();

    // 🔴 VALIDATION
    if (!pass) {
        msg.innerText = "⚠️ Please enter password";
        return;
    }

    // 🔄 LOADER START
    btn.classList.add("loading");
    btn.innerHTML = `<span class="spinner"></span> Logging in...`;
    msg.innerText = "";

    try {
        const res = await fetch("https://backendhb.onrender.com/api/auth/admin-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ password: pass })
        });

        const data = await res.json();

        if (data.success) {
            msg.style.color = "#22c55e";
            msg.innerText = "✅ Login successful";
            setTimeout(() => location.reload(), 500);
        } else {
            msg.style.color = "#ef4444";
            msg.innerText = "❌ Wrong password";
        }

    } catch (err) {
        msg.style.color = "#ef4444";
        msg.innerText = "⚠️ Server error. Try again.";
    }

    // 🔄 LOADER END
    btn.classList.remove("loading");
    btn.innerHTML = "Login";
}

function goto() {
    window.location.href = "order.html";
}

function gotoProducts() {
    window.location.href = "mproduct.html";
}

function gotoFeedbacks() {
    window.location.href = "feedbackget.html";
}

function logout() {
    localStorage.removeItem("adminLoggedIn");

    document.getElementById("adminPanel").style.display = "none";
    document.getElementById("loginBox").style.display = "block";

    // 🔥 optional hard reset
    location.reload();
}
