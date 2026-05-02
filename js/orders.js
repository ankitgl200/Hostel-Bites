let audio = new Audio("asset/notify.mp3");
let lastOrderId = null;
let lastOrders = "";
let firstLoad = true; // 🚀 ADD THIS

function loadOrders() {
    fetch("https://backendhb.onrender.com/api/orders")
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
                let isDelivered = o.status === "delivered";
                let isPending = o.status === "pending";
                let statusClass =
                    o.status === "pending" ? "pending" :
                        o.status === "accepted" ? "accepted" :
                            o.status === "delivered" ? "delivered" :
                                "rejected";


                let div = document.createElement("div");
                div.className = "order";

                div.innerHTML = `
                <div class="order-header">
                    <div class="order-name">${o.name} (Room: ${o.room})</div>
                    <div class="status ${statusClass}">
                        ${o.status.toUpperCase()}
                    </div>
                    <button onclick="toggleDetails('${o._id}')" style="background:#555;">More</button>
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
                    <button class="accept" ${isDelivered ? "disabled" : ""} onclick="update('${o._id}','accepted')">Accept</button>

<button class="reject" ${isDelivered ? "disabled" : ""} onclick="update('${o._id}','rejected')">Reject</button>

<button class="delivered" onclick="update('${o._id}','delivered')">Delivered</button>

<button class="delete" ${isPending ? "disabled" : ""} onclick="del('${o._id}')">Delete</button>
                </div>
                `;

                box.appendChild(div);
            });

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
