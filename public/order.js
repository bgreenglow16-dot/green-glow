const orderForm = document.querySelector("#fm");
const orderButton = document.querySelector("#go");
const feedback = document.createElement("p");
feedback.className = "order-feedback";
feedback.setAttribute("role", "alert");
feedback.setAttribute("aria-live", "polite");
orderForm.prepend(feedback);

const feedbackStyle = document.createElement("style");
feedbackStyle.textContent =
  ".order-feedback{color:#9a362a;min-height:1.5em;margin:0 0 12px}.order-feedback:empty{display:none}";
document.head.append(feedbackStyle);

orderForm.addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    feedback.textContent = "";

    const value = (id) => document.querySelector(`#${id}`).value.trim();
    const deliveryType = document.querySelector('[name="dl"]:checked')?.value;
    const items = Object.entries(qty)
      .filter(([, count]) => count > 0)
      .map(([id, quantity]) => ({ id, quantity }));
    const phone = value("ph").replace(/[ .-]/g, "").replace(/^\+?213/, "0");
    const checks = {
      nm: value("nm").length >= 3,
      ph: /^0[567]\d{8}$/.test(phone),
      wl: Boolean(value("wl")),
      cm: value("cm").length >= 2,
      ad: deliveryType !== "home" || value("ad").length >= 4,
    };

    for (const [id, valid] of Object.entries(checks)) {
      document.querySelector(`#${id}`).closest(".fd").classList.toggle("bad", !valid);
    }
    if (!items.length) {
      feedback.textContent = "اختر منتجا واحدا على الأقل.";
      document.querySelector("#tiles").scrollIntoView({ block: "center" });
      return;
    }
    const invalidField = Object.keys(checks).find((id) => !checks[id]);
    if (invalidField) {
      feedback.textContent = "يرجى مراجعة البيانات المدخلة.";
      document.querySelector(`#${invalidField}`).focus();
      return;
    }

    orderButton.disabled = true;
    orderButton.classList.add("ld");
    orderButton.querySelector("i").textContent = "◌";
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName: value("nm"),
          phone,
          wilaya: value("wl"),
          municipality: value("cm"),
          address: value("ad"),
          deliveryType,
          items,
          notes: value("nt"),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "تعذر تسجيل الطلب. حاول مرة أخرى.");
      }

      document.querySelector("#okt").textContent =
        `رقم طلبك: ${result.orderId}\nسنتصل بك قريبا لتأكيد الطلب.`;
      const waText = [
        `طلب جديد #${result.orderId}`,
        `الاسم: ${value("nm")}`,
        `الهاتف: ${phone}`,
        `الولاية: ${value("wl")}`,
        `البلدية: ${value("cm")}`,
        `العنوان: ${value("ad") || "-"}`,
        `الطلب: ${items.map((item) => `${item.id === "oil" ? "زيت ذكر الثوم" : "لبان ذكر الثوم"} × ${item.quantity}`).join("، ")}`,
      ].join(String.fromCharCode(10));
      const waLink = document.querySelector("#wa");
      waLink.href = `https://wa.me/${CFG.sellerWA}?text=${encodeURIComponent(waText)}`;
      waLink.hidden = false;
      document.querySelector("#ob").hidden = true;
      document.querySelector("#ok").hidden = false;
      document.querySelector("#ok").scrollIntoView({ block: "center" });
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      orderButton.disabled = false;
      orderButton.classList.remove("ld");
      orderButton.querySelector("i").textContent = "←";
    }
  },
  true,
);
