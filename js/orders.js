let audio = new Audio("asset/notify.mp3");
let lastOrderId = null;
let lastOrders = "";
let firstLoad = true; // 🚀 ADD THIS

function formatDateTime(dateStr) {
    const d = new Date(dateStr);

    const date = d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });

    const time = d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit"
    });

    return `${date} • ${time}`;
}

function loadOrders() {
    fetch("https://backendhb.onrender.com/api/orders", {
        credentials: "include"
    })
        .then(res => res.json())
        .then(data => {

            let box = document.getElementById("orders");
            if (!box) return;

            // 🔔 DETECT NEW ORDER (FIXED)
            if (!firstLoad && data.length > 0 && data[0]._id !== lastOrderId) {
                audio.currentTime = 0; // reset sound
                audio.play()
                    .then(() => console.log("🔔 New order sound"))
                    .catch(err => console.error("❌ Sound error:", err));
            }

            // After first fetch, disable firstLoad
            firstLoad = false;

            // Update last order id
            if (data.length > 0) {
                lastOrderId = data[0]._id;
            }

            box.innerHTML = "";

            data.forEach(o => {
                let isPending = o.status === "pending";
                let isAccepted = o.status === "accepted";
                let isRejected = o.status === "rejected";
                let isDelivered = o.status === "delivered";
                let s = o.status.toLowerCase();

                let statusClass =
                    s === "pending" ? "pending" :
                        s === "accepted" ? "accepted" :
                            s === "delivered" ? "delivered" :
                                "rejected";


                let div = document.createElement("div");
                div.className = "order";

                div.innerHTML = `
                <div class="order-header">
    <div>
        <div class="order-name">${o.name} (Room: ${o.room})</div>

        <!-- 🔥 NEW DATE TIME -->
        <div style="font-size:12px; color:#aaa;">
            📅 ${formatDateTime(o.createdAt)}
        </div>
    </div>

    <div class="status ${statusClass}">
        ${o.status.toUpperCase()}
    </div>

    <div id="timer-${o._id}" style="
        font-size:12px;
        font-weight:bold;
        color:#ff6a00;
    ">
        ⏱ Loading...
    </div>
</div>

                <div class="order-details hidden" id="details-${o._id}">
                        📞 ${o.phone}<br>
                        🛒 Items:<br>
                        ${o.items && o.items.length > 0
                        ? o.items.map(i => `• ${i.name} x ${i.qty}`).join("<br>")
                        : "No items"
                    }
    <br><br>
    💰 Total: ₹${o.total}
</div>

                <div class="order-actions">

<button class="accept"
${isDelivered ? "disabled" : ""}
onclick="update('${o._id}','accepted')">
Accept
</button>

<button class="reject"
${isDelivered ? "disabled" : ""}
onclick="update('${o._id}','rejected')">
Reject
</button>

<button class="delivered"
${(isPending || isRejected || isDelivered) ? "disabled" : ""}
onclick="update('${o._id}','delivered')">
Delivered
</button>

<button class="delete"
${(isPending || isAccepted) ? "disabled" : ""}
onclick="del('${o._id}')">
Delete
</button>

</div>
                `;

                box.appendChild(div);
            });
            startAdminTimers(data);

        })
        .catch(err => console.error(err));
}

function toggleDetails(id) {
    let el = document.getElementById("details-" + id);

    if (el.classList.contains("hidden")) {
        el.classList.remove("hidden");
    } else {
        el.classList.add("hidden");
    }
}

function update(id, status) {
    fetch("https://backendhb.onrender.com/api/orders/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
    })
        .then(res => res.json())
        .then(() => {
            setTimeout(loadOrders, 500); // 🔥 wait for backend update
        });
}

function del(id) {
    fetch("https://backendhb.onrender.com/api/orders/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
    })
        .then(res => res.json())
        .then(() => loadOrders())
        .catch(err => console.error(err));
}

function startAdminTimers(orders) {
    if (window.adminTimers) {
        window.adminTimers.forEach(clearInterval);
    }
    window.adminTimers = [];

    orders.forEach(o => {

        const timerEl = document.getElementById("timer-" + o._id);
        if (!timerEl) return;

        const startTime = new Date(o.createdAt).getTime();

        function updateTimer() {

            let now = Date.now();
            let diff = now - startTime;
            let remaining = 7 * 60 * 1000 - diff;

            // ✅ STATUS BASED
            if (o.status === "delivered") {
                timerEl.innerHTML = "✅ Completed";
                return;
            }

            if (o.status === "rejected") {
                timerEl.innerHTML = "❌ Rejected";
                return;
            }

            // ⏱ RUNNING
            if (remaining > 0) {
                let min = Math.floor(remaining / 60000);
                let sec = Math.floor((remaining % 60000) / 1000);

                timerEl.innerHTML =
                    `Estimated: ⏱ ${min}:${sec.toString().padStart(2, '0')}`;

                if (remaining < 60000) {
                    timerEl.style.color = "red";
                }

            } else {
                timerEl.innerHTML = "⏰ Delay!";
            }
        }

        updateTimer();
        let interval = setInterval(updateTimer, 1000);
        window.adminTimers.push(interval);
    });
}

document.addEventListener("click", () => {
    audio.play().then(() => audio.pause()).catch(() => { });
}, { once: true });

let lastOrderCount = 0;


loadOrders();
setInterval(() => {
    fetch("https://backendhb.onrender.com/api/orders")
        .then(res => res.json())
        .then(data => {
            if (JSON.stringify(data) !== lastOrders) {
                lastOrders = JSON.stringify(data);
                loadOrders(); // only update when changed
            }
        });
}, 3000);
