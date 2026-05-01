function update(id, status) {
    fetch("https://backendhb.onrender.com/api/orders/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
    })
        .then(res => res.json())
        .then(() => loadOrders())
        .catch(err => console.error(err));
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

function loadOrders() {
    fetch("https://backendhb.onrender.com/api/orders")
        .then(res => res.json())
        .then(data => {

            let box = document.getElementById("orders");
            if (!box) return;

            // 🔔 DETECT NEW ORDER
            if (data.length > 0 && data[0]._id !== lastOrderId) {
                audio.play()
                    .then(() => console.log("🔔 Sound played"))
                    .catch(err => console.error("❌ Sound error:", err));
                lastOrderId = data[0]._id;
            }

            lastOrderCount = data.length;

            box.innerHTML = "";

            data.forEach(o => {

                let statusClass =
                    o.status === "pending" ? "pending" :
                        o.status === "accepted" ? "accepted" :
                            "rejected";

                let isDone = o.status !== "pending";

                let div = document.createElement("div");
                div.className = "order";

                div.innerHTML = `
          <div class="order-header">
            <div class="order-name">${o.name} (Room: ${o.room})</div>
            <div class="status ${statusClass}">
              ${o.status.toUpperCase()}
            </div>
          </div>

          <div class="order-details">
            📞 ${o.phone}<br>
            💰 Total: ₹${o.total}
          </div>

          <div class="order-actions">
            <button class="accept" ${isDone ? "disabled" : ""} onclick="update('${o._id}','accepted')">Accept</button>
            <button class="reject" ${isDone ? "disabled" : ""} onclick="update('${o._id}','rejected')">Reject</button>
            <button class="delete" ${!isDone ? "disabled" : ""} onclick="del('${o._id}')">Delete</button>
          </div>
        `;

                box.appendChild(div);
            });

        })
        .catch(err => console.error(err));
}
let audio = new Audio("notify.mp3");
let lastOrderId = null;
document.addEventListener("click", () => {
    audio.play().then(() => audio.pause()).catch(() => { });
}, { once: true });

let lastOrderCount = 0;


loadOrders();
setInterval(loadOrders, 3000); // optional auto refresh