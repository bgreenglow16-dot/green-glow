const $ = (selector) => document.querySelector(selector);

/* Icon set (24px grid, 1.8 stroke): trusted constants only, never user data. */
const ICONS = {
  refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01"/><path d="M10 21v-4h4v4"/>',
  truck: '<path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  save: '<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3"/><path d="M8 21v-7h8v7"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4h6v3"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.500l3 3 5-6"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.500h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  note: '<path d="M5 3h10l4 4v14H5z"/><path d="M14 3v5h5"/><path d="M8 13h8M8 17h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cart: '<path d="M3 4h2l2.500 11h11L21 7H6"/><circle cx="9" cy="20" r="1.500"/><circle cx="17" cy="20" r="1.500"/>',
  banknote: '<rect x="2" y="6" width="20" height="12" rx="2.500"/><circle cx="12" cy="12" r="2.500"/><path d="M6 12h.01M18 12h.01"/>',
  phoneOff: '<path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/><path d="M3 3l18 18"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
};
const WHATSAPP =
  '<path d="M12 2a10 10 0 0 0-8.600 15L2 22l5.200-1.400A10 10 0 1 0 12 2zm0 18.200a8.200 8.200 0 0 1-4.200-1.200l-.300-.200-3 .800.800-2.900-.200-.300A8.200 8.200 0 1 1 12 20.200zm4.500-6.100c-.2-.1-1.500-.7-1.700-.8s-.4-.1-.6.100-.7.800-.8 1-.3.200-.6.100a6.700 6.700 0 0 1-3.300-2.900c-.3-.4.300-.4.800-1.400.1-.2 0-.3 0-.5l-.8-1.800c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.300 3 3 0 0 0-.9 2.200c0 1.300.9 2.600 1 2.800s1.800 2.800 4.500 3.900c1.700.7 2.300.7 3.100.6a2.600 2.600 0 0 0 1.700-1.200 2.100 2.100 0 0 0 .1-1.200c-.1-.1-.2-.2-.5-.3z"/>';

function icon(name, extra = "") {
  const wrapper = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  wrapper.setAttribute("viewBox", "0 0 24 24");
  wrapper.setAttribute("class", `i${extra ? ` ${extra}` : ""}`);
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.innerHTML = name === "whatsapp" ? WHATSAPP : ICONS[name];
  return wrapper;
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const statusOptions = ["قيد التأكيد", "مؤكد", "لم يرد 1", "لم يرد 2", "غير مجاب", "ملغى"];
const statusTone = {
  "قيد التأكيد": "new",
  "مؤكد": "ok",
  "لم يرد 1": "warn",
  "لم يرد 2": "orange",
  "غير مجاب": "bad",
  "ملغى": "idle",
};

const loginPanel = $("#login-panel");
const ordersPanel = $("#orders-panel");
const loginForm = $("#login-form");
const loginMessage = $("#login-message");
const logoutButton = $("#logout");
const refreshButton = $("#refresh");
const list = $("#orders-list");

$("#pw-field").prepend(icon("lock"));
$("#search-wrap").prepend(icon("search"));
refreshButton.append(icon("refresh"));
logoutButton.append(icon("logout"));

let allOrders = [];
let statusFilter = "";
let searchText = "";
let refreshTimer;
let knownIds = null;
const freshIds = new Set();
let dialogOpen = false;

const money = (value) => `${Number(value).toLocaleString("fr-DZ")} دج`;
const parseDate = (value) => new Date(`${String(value).replace(" ", "T")}Z`);

function toast(message, kind = "info") {
  const node = el(
    "div",
    { class: `toast ${kind}`, role: "status" },
    icon(kind === "err" ? "alert" : kind === "ok" ? "check" : "info"),
    el("span", { text: message }),
  );
  $("#toasts").append(node);
  setTimeout(() => node.remove(), kind === "err" ? 6500 : 4200);
}

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

async function shipOrder(order, communeId) {
  const response = await fetch(`/api/admin/orders/${order.id}/ship`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(communeId ? { communeId } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (response.ok) return data;
  if (data.needCommune) {
    const chosen = await chooseCommune(data);
    if (!chosen) throw new Error("تم إلغاء الإرسال.");
    return shipOrder(order, chosen);
  }
  throw new Error(data.error || "تعذر إرسال الطلب.");
}

function chooseCommune(data) {
  return new Promise((resolve) => {
    dialogOpen = true;
    const select = el("select", { "aria-label": "البلدية" }, new Option("اختر البلدية", ""));
    for (const commune of data.communes) {
      select.append(new Option(`${commune.nameArabic || ""} · ${commune.name}`, commune.id));
    }
    const dialog = el("dialog");
    const finish = (value) => {
      dialogOpen = false;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.append(
      el("h2", { text: "تحديد البلدية" }),
      el("p", { text: data.error }),
      select,
      el(
        "div",
        { class: "btns" },
        el("button", { class: "btn gold", type: "button", onclick: () => select.value && finish(select.value) }, icon("send"), "إرسال إلى ZR"),
        el("button", { class: "btn soft", type: "button", onclick: () => finish("") }, "إلغاء"),
      ),
    );
    dialog.addEventListener("cancel", () => finish(""));
    document.body.append(dialog);
    dialog.showModal();
  });
}

/* ---------- stats, chips, list ---------- */

function renderStats() {
  const count = (...names) => allOrders.filter((order) => names.includes(order.status)).length;
  const confirmedTotal = allOrders
    .filter((order) => order.status === "مؤكد")
    .reduce((sum, order) => sum + Number(order.total_price), 0);
  const cards = [
    { label: "كل الطلبات", value: allOrders.length, tone: "idle", icon: "cart" },
    { label: "قيد التأكيد", value: count("قيد التأكيد"), tone: "new", icon: "clock" },
    { label: "مؤكدة", value: count("مؤكد"), tone: "ok", icon: "check" },
    { label: "بلا رد", value: count("لم يرد 1", "لم يرد 2", "غير مجاب"), tone: "warn", icon: "phoneOff" },
  ];
  const stats = $("#stats");
  stats.replaceChildren(
    ...cards.map((card) =>
      el(
        "div",
        { class: "stat" },
        el("div", { class: `ico tone-${card.tone}` }, icon(card.icon)),
        el("div", {}, el("b", { text: String(card.value) }), el("span", { text: card.label })),
      ),
    ),
    el(
      "div",
      { class: "stat gold-card wide" },
      el("div", { class: "ico" }, icon("banknote")),
      el("div", {}, el("b", { text: money(confirmedTotal) }), el("span", { text: "مبيعات الطلبات المؤكدة" })),
    ),
  );
}

function renderChips() {
  const chips = [["", "الكل"], ...statusOptions.map((value) => [value, value])];
  $("#chips").replaceChildren(
    ...chips.map(([value, label]) => {
      const total = value ? allOrders.filter((order) => order.status === value).length : allOrders.length;
      return el(
        "button",
        {
          class: `chip${statusFilter === value ? " on" : ""}`,
          type: "button",
          role: "tab",
          "aria-selected": String(statusFilter === value),
          onclick: () => {
            statusFilter = value;
            renderChips();
            renderList();
          },
        },
        label,
        el("em", { text: String(total) }),
      );
    }),
  );
}

function matches(order) {
  if (statusFilter && order.status !== statusFilter) return false;
  const needle = searchText.trim().toLowerCase();
  if (!needle) return true;
  return [order.customer_name, order.phone, order.wilaya, order.municipality, order.tracking_number, order.product, String(order.id)]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

function orderCard(order) {
  const tone = statusTone[order.status] || "idle";
  const isDesk = order.delivery_type === "مكتب";
  const created = parseDate(order.order_date);
  const initial = [...String(order.customer_name).trim()][0] || "?";

  const status = el("select", { "aria-label": `حالة الطلب ${order.id}` });
  for (const value of statusOptions) {
    const option = new Option(value, value);
    option.selected = value === order.status;
    status.append(option);
  }
  const tracking = el("input", {
    type: "text",
    maxlength: "100",
    placeholder: "رقم تتبع الشحنة",
    value: order.tracking_number || "",
    "aria-label": `رقم تتبع الطلب ${order.id}`,
  });
  tracking.value = order.tracking_number || "";

  const badge = el("span", { class: `badge tone-${tone}`, text: order.status });
  status.addEventListener("change", () => {
    const next = statusTone[status.value] || "idle";
    badge.className = `badge tone-${next}`;
    badge.textContent = status.value;
  });

  const save = el("button", { class: "btn dark sm", type: "button" }, icon("save"), "حفظ");
  save.addEventListener("click", async () => {
    save.disabled = true;
    try {
      await request(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: status.value, trackingNumber: tracking.value }),
      });
      order.status = status.value;
      order.tracking_number = tracking.value.trim();
      renderStats();
      renderChips();
      toast(`تم تحديث الطلب #${order.id}`, "ok");
    } catch (error) {
      toast(error.message, "err");
    } finally {
      save.disabled = false;
    }
  });

  const shipped = Boolean(order.tracking_number);
  const ship = el(
    "button",
    { class: `btn sm ${shipped ? "done" : "gold"}`, type: "button", disabled: shipped },
    icon(shipped ? "check" : "send"),
    shipped ? "تم الإرسال" : "إرسال إلى ZR",
  );
  ship.addEventListener("click", async () => {
    ship.disabled = true;
    toast("جار الإرسال إلى ZR Express...");
    try {
      const result = await shipOrder(order, undefined);
      order.tracking_number = result.trackingNumber;
      tracking.value = result.trackingNumber;
      ship.className = "btn sm done";
      ship.replaceChildren(icon("check"), "تم الإرسال");
      toast(`تم إرسال الطلب #${order.id}. رقم التتبع: ${result.trackingNumber}`, "ok");
    } catch (error) {
      toast(error.message, "err");
      ship.disabled = false;
    }
  });

  const remove = el("button", { class: "btn danger sm icon", type: "button", title: "حذف الطلب", "aria-label": `حذف الطلب ${order.id}` }, icon("trash"));
  remove.addEventListener("click", async () => {
    if (!confirm(`حذف طلب ${order.customer_name} (#${order.id}) نهائيا؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    remove.disabled = true;
    try {
      await request(`/api/admin/orders/${order.id}`, { method: "DELETE" });
      allOrders = allOrders.filter((item) => item.id !== order.id);
      renderStats();
      renderChips();
      renderList();
      toast("تم حذف الطلب", "ok");
    } catch (error) {
      toast(error.message, "err");
      remove.disabled = false;
    }
  });

  const waNumber = `213${String(order.phone).replace(/^0/, "")}`;
  return el(
    "article",
    { class: `order${freshIds.has(order.id) ? " fresh" : ""}` },
    el(
      "div",
      { class: "o-head" },
      el("div", { class: "avatar", text: initial }),
      el(
        "div",
        { class: "o-name" },
        el("b", { text: order.customer_name }),
        el(
          "small",
          {},
          `#${order.id}`,
          "·",
          Number.isNaN(created.getTime()) ? "" : created.toLocaleString("ar-DZ", { dateStyle: "medium", timeStyle: "short" }),
          freshIds.has(order.id) && el("span", { class: "new-tag", text: "جديد" }),
        ),
      ),
      badge,
    ),
    el(
      "div",
      { class: "rows" },
      el(
        "div",
        { class: "row phone-row" },
        el("span", { class: "num", text: order.phone }),
        el(
          "div",
          { class: "acts" },
          el("a", { class: "circle call", href: `tel:${order.phone}`, title: "اتصال", "aria-label": "اتصال" }, icon("phone")),
          el("a", { class: "circle wa", href: `https://wa.me/${waNumber}`, target: "_blank", rel: "noopener", title: "واتساب", "aria-label": "واتساب" }, icon("whatsapp", "fill")),
        ),
      ),
      el(
        "div",
        { class: "row" },
        icon("pin"),
        el(
          "div",
          {},
          el("b", { text: `${order.wilaya}، ${order.municipality}` }),
          order.address && el("small", { text: order.address }),
          el("span", { class: "pill" }, icon(isDesk ? "building" : "home"), isDesk ? "إلى المكتب" : "إلى المنزل"),
        ),
      ),
      el("div", { class: "row" }, icon("box"), el("div", {}, el("span", { text: order.product }))),
    ),
    el("div", { class: "price-row" }, el("span", { text: "المبلغ عند الاستلام" }), el("b", { text: money(order.total_price) })),
    order.notes && el("div", { class: "note" }, icon("note"), el("span", { text: order.notes })),
    el(
      "div",
      { class: "o-foot" },
      el(
        "div",
        { class: "ctrl" },
        el("div", { class: "sel" }, status, icon("chevron")),
        el("div", { class: "trk" }, icon("truck"), tracking),
      ),
      el("div", { class: "btns" }, save, ship, remove),
    ),
  );
}

function renderList() {
  const visible = allOrders.filter(matches);
  list.replaceChildren(...visible.map(orderCard));
  const empty = $("#empty");
  empty.hidden = visible.length > 0;
  if (!visible.length) {
    const filtered = statusFilter || searchText.trim();
    empty.replaceChildren(
      icon("inbox"),
      el("b", { text: filtered ? "لا توجد نتائج مطابقة" : "لا توجد طلبات بعد" }),
      el("span", { text: filtered ? "جرّب تغيير البحث أو التصفية." : "ستظهر الطلبات هنا فور وصولها." }),
    );
  }
}

function detectNewOrders(orders) {
  const ids = new Set(orders.map((order) => order.id));
  if (knownIds) {
    const added = orders.filter((order) => !knownIds.has(order.id));
    for (const order of added) freshIds.add(order.id);
    if (added.length) toast(added.length === 1 ? `وصل طلب جديد من ${added[0].customer_name}` : `وصلت ${added.length} طلبات جديدة`, "ok");
  }
  knownIds = ids;
}

async function loadOrders({ manual = false } = {}) {
  if (manual) refreshButton.classList.add("spin");
  try {
    const data = await request("/api/admin/orders");
    detectNewOrders(data.orders);
    allOrders = data.orders;
    renderStats();
    renderChips();
    // Do not wipe what the manager is typing or a dialog in progress during auto-refresh.
    const editing = list.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName);
    if (manual || !(editing || dialogOpen)) renderList();
    $("#last-updated").textContent = `آخر تحديث: ${new Date().toLocaleTimeString("ar-DZ")}`;
  } catch (error) {
    if (error.message === "يلزم تسجيل الدخول للمتابعة.") showLogin();
    else toast(error.message, "err");
  } finally {
    refreshButton.classList.remove("spin");
  }
}

function showLogin() {
  clearInterval(refreshTimer);
  ordersPanel.hidden = true;
  logoutButton.hidden = true;
  refreshButton.hidden = true;
  loginPanel.hidden = false;
  knownIds = null;
}

function showOrders() {
  loginPanel.hidden = true;
  ordersPanel.hidden = false;
  logoutButton.hidden = false;
  refreshButton.hidden = false;
  loadOrders();
  clearInterval(refreshTimer);
  refreshTimer = setInterval(loadOrders, 15000);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#login-button");
  button.disabled = true;
  loginMessage.textContent = "";
  try {
    await request("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: $("#password").value }),
    });
    loginForm.reset();
    showOrders();
  } catch (error) {
    loginMessage.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

let searchTimer;
$("#search").addEventListener("input", (event) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchText = event.target.value;
    renderList();
  }, 150);
});

refreshButton.addEventListener("click", () => loadOrders({ manual: true }));
logoutButton.addEventListener("click", async () => {
  try {
    await request("/api/admin/logout", { method: "POST", body: "{}" });
  } catch (error) {
    toast(error.message, "err");
  } finally {
    showLogin();
  }
});

request("/api/admin/orders")
  .then((data) => {
    knownIds = new Set(data.orders.map((order) => order.id));
    allOrders = data.orders;
    ordersPanel.hidden = false;
    loginPanel.hidden = true;
    logoutButton.hidden = false;
    refreshButton.hidden = false;
    renderStats();
    renderChips();
    renderList();
    $("#last-updated").textContent = `آخر تحديث: ${new Date().toLocaleTimeString("ar-DZ")}`;
    refreshTimer = setInterval(loadOrders, 15000);
  })
  .catch((error) => {
    loginPanel.hidden = false;
    if (error.message !== "يلزم تسجيل الدخول للمتابعة.") loginMessage.textContent = error.message;
  });
