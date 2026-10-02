const loginPanel = document.querySelector("#login-panel");
const ordersPanel = document.querySelector("#orders-panel");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const ordersMessage = document.querySelector("#orders-message");
const ordersBody = document.querySelector("#orders-body");
const logoutButton = document.querySelector("#logout");
const statusOptions = ["قيد التأكيد", "مؤكد", "غير مجاب", "ملغى"];
let refreshTimer;

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "تعذر إكمال الطلب.");
  return data;
}

function addCell(row, value, className) {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = value;
  row.append(cell);
  return cell;
}

function renderOrders(orders) {
  ordersBody.replaceChildren();
  if (!orders.length) {
    const row = document.createElement("tr");
    const cell = addCell(row, "لا توجد طلبات بعد.");
    cell.colSpan = 8;
    cell.className = "empty";
    ordersBody.append(row);
    return;
  }

  for (const order of orders) {
    const row = document.createElement("tr");
    const customer = document.createElement("td");
    customer.textContent = order.customer_name;
    if (order.notes) {
      const note = document.createElement("small");
      note.textContent = `ملاحظة: ${order.notes}`;
      customer.append(note);
    }
    row.append(customer);

    const phone = addCell(row, order.phone, "phone");
    const phoneLink = document.createElement("a");
    phoneLink.href = `tel:${order.phone}`;
    phoneLink.textContent = order.phone;
    phone.replaceChildren(phoneLink);

    const address = document.createElement("td");
    address.textContent = `${order.wilaya}، ${order.municipality}`;
    const details = document.createElement("small");
    details.textContent = `${order.address || "—"} · التوصيل: ${order.delivery_type}`;
    address.append(details);
    row.append(address);

    addCell(row, `${order.product} · إجمالي القطع: ${order.quantity}`);
    addCell(row, `${Number(order.total_price).toLocaleString("ar-DZ")} دج`);
    addCell(row, new Date(`${order.order_date.replace(" ", "T")}Z`).toLocaleString("ar-DZ"));

    const controls = document.createElement("td");
    const status = document.createElement("select");
    status.className = "status";
    status.setAttribute("aria-label", `حالة الطلب ${order.id}`);
    for (const value of statusOptions) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      option.selected = value === order.status;
      status.append(option);
    }
    const tracking = document.createElement("input");
    tracking.className = "tracking";
    tracking.value = order.tracking_number || "";
    tracking.maxLength = 100;
    tracking.placeholder = "رقم تتبع الشحنة";
    tracking.setAttribute("aria-label", `رقم تتبع الطلب ${order.id}`);
    controls.append(status, tracking);
    row.append(controls);

    const saveCell = document.createElement("td");
    const save = document.createElement("button");
    save.className = "save";
    save.type = "button";
    save.textContent = "حفظ";
    save.addEventListener("click", async () => {
      save.disabled = true;
      try {
        await request(`/api/admin/orders/${order.id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: status.value, trackingNumber: tracking.value }),
        });
        ordersMessage.textContent = "تم تحديث الطلب.";
      } catch (error) {
        ordersMessage.textContent = error.message;
      } finally {
        save.disabled = false;
      }
    });
    saveCell.append(save);
    row.append(saveCell);
    ordersBody.append(row);
  }
}

async function loadOrders() {
  try {
    const data = await request("/api/admin/orders");
    renderOrders(data.orders);
    ordersMessage.textContent = "";
    document.querySelector("#last-updated").textContent =
      `آخر تحديث: ${new Date().toLocaleTimeString("ar-DZ")}`;
  } catch (error) {
    ordersMessage.textContent = error.message;
    if (error.message === "يلزم تسجيل الدخول للمتابعة.") showLogin();
  }
}

function showLogin() {
  clearInterval(refreshTimer);
  ordersPanel.hidden = true;
  logoutButton.hidden = true;
  loginPanel.hidden = false;
}

function showOrders() {
  loginPanel.hidden = true;
  ordersPanel.hidden = false;
  logoutButton.hidden = false;
  loadOrders();
  clearInterval(refreshTimer);
  refreshTimer = setInterval(loadOrders, 15000);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.querySelector("#login-button");
  button.disabled = true;
  loginMessage.textContent = "";
  try {
    await request("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: document.querySelector("#password").value }),
    });
    loginForm.reset();
    showOrders();
  } catch (error) {
    loginMessage.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#refresh").addEventListener("click", loadOrders);
logoutButton.addEventListener("click", async () => {
  try {
    await request("/api/admin/logout", { method: "POST", body: "{}" });
  } catch (error) {
    ordersMessage.textContent = error.message;
  } finally {
    showLogin();
  }
});

request("/api/admin/orders")
  .then((data) => {
    renderOrders(data.orders);
    ordersPanel.hidden = false;
    loginPanel.hidden = true;
    logoutButton.hidden = false;
    refreshTimer = setInterval(loadOrders, 15000);
  })
  .catch((error) => {
    if (error.message !== "يلزم تسجيل الدخول للمتابعة.") {
      loginMessage.textContent = error.message;
    }
  });
