
// 🔐 LOGIN
function login() {
    let pass = document.getElementById("adminPass").value;

    fetch("https://backendhb.onrender.com/api/auth/admin-login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ password: pass })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                localStorage.setItem("adminLoggedIn", "true");

                document.getElementById("loginBox").style.display = "none";
                document.getElementById("adminPanel").style.display = "flex";
            } else {
                alert("Wrong password ❌");
            }
        });
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

document.addEventListener("DOMContentLoaded", () => {

    let loginBox = document.getElementById("loginBox");
    let adminPanel = document.getElementById("adminPanel");

    let isLoggedIn = localStorage.getItem("adminLoggedIn");

    if (isLoggedIn === "true") {
        loginBox.style.display = "none";
        adminPanel.style.display = "flex"; // 🔥 control here
    } else {
        loginBox.style.display = "block";
        adminPanel.style.display = "none";
    }

});

function logout() {
    localStorage.removeItem("adminLoggedIn");

    document.getElementById("adminPanel").style.display = "none";
    document.getElementById("loginBox").style.display = "block";

    // 🔥 optional hard reset
    location.reload();
}
