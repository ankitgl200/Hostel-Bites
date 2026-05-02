

let PRODUCTS = [];


// 🔄 LOAD PRODUCTS FROM DB
function loadProducts() {
    fetch("https://backendhb.onrender.com/api/products")
        .then(res => res.json())
        .then(data => {
            PRODUCTS = data;

            let select = document.getElementById("productSelect");
            select.innerHTML = "";

            data.forEach(p => {
                let opt = document.createElement("option");
                opt.value = p._id;
                opt.textContent = p.name;
                select.appendChild(opt);
            });
        });
} // ✅ THIS WAS MISSING
// 🔀 SWITCH MODE
function switchMode() {
    let mode = document.querySelector("input[name='mode']:checked").value;
    let btn = document.querySelector("button[onclick='submitData()']");

    if (mode === "add") {
        btn.innerText = "Add Product";
    } else {
        btn.innerText = "Update Product";
    }
    if (mode === "update") {
        loadProducts(); // 🔥 reload products when entering update mode
    }

    document.getElementById("addFields").classList.add("hidden");
    document.getElementById("updateFields").classList.add("hidden");

    document.getElementById("productSelect").classList.add("hidden");
    document.getElementById("updateType").classList.add("hidden");
    document.getElementById("updateValue").classList.add("hidden");

    if (mode === "add") {
        document.getElementById("addFields").classList.remove("hidden");
    } else {
        document.getElementById("updateFields").classList.remove("hidden");
        document.getElementById("productSelect").classList.remove("hidden");
        document.getElementById("updateType").classList.remove("hidden");
    }
}


function showUpdateInput() {
    let type = document.getElementById("updateType").value;
    let input = document.getElementById("updateValue");

    if (!type) {
        input.classList.add("hidden");
        return;
    }

    input.classList.remove("hidden");

    // Change input type dynamically
    if (type === "stock" || type === "price" || type === "oprice") {
        input.type = "number";
    } else {
        input.type = "text";
    }

    input.placeholder = "Enter new " + type;
}


// 🚀 SUBMIT DATA
function submitData() {
    let selected = document.querySelector("input[name='mode']:checked");

    if (!selected) {
        alert("Select Add or Update");
        return;
    }

    let mode = selected.value;
    if (mode === "add") {

        let name = document.getElementById("name").value.trim();

        if (!name) {
            alert("Enter product name");
            return;
        }

        // 🔥 DUPLICATE CHECK (ADD HERE)
        let exists = PRODUCTS.some(p =>
            p.name.toLowerCase() === name.toLowerCase()
        );

        if (exists) {
            alert("Product already exists ❌");
            return;
        }

        let data = {
            name: name,
            src: document.getElementById("src").value.trim(),
            price: parseInt(document.getElementById("price").value),
            oprice: parseInt(document.getElementById("oprice").value),
            cat: document.getElementById("cat").value,
            stock: parseInt(document.getElementById("stockAdd").value)
        };

        fetch("https://backendhb.onrender.com/api/products/add-product", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        })
            .then(res => res.json())
            .then(() => {
                document.getElementById("msg").innerText = "✅ Product Added!";
                loadProducts();
            });
    }
    else {
        let id = document.getElementById("productSelect").value;
        let field = document.getElementById("updateType").value;
        let value = document.getElementById("updateValue").value;

        if (!field || value.trim() === "") {
            alert("Enter valid value");
            return;
        }

        let data = { id };

        // dynamic field update
        if (field === "stock" || field === "price" || field === "oprice") {
            data[field] = parseInt(value) || 0;
        } else {
            if (field === "name") {
                data[field] = value.trim();
            } else {
                data[field] = value;
            }
        }

        fetch("https://backendhb.onrender.com/api/products/update-product", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        })
            .then(res => res.json())
            .then(() => {
                document.getElementById("msg").innerText = "✅ Product Updated!";
                loadProducts();
            });
    }
}

document.addEventListener("DOMContentLoaded", () => {

    if (localStorage.getItem("adminLoggedIn") !== "true") {
        window.location.href = "admin.html";
    }

});


function goBack() {
    window.location.href = "admin.html";
}
