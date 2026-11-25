/* Epitome Elan landing pages: shared behaviour (DRAFT)
   Two-step lead form:
   - Step 1 (name, phone, consent) saves the lead at once and fires `generate_lead`.
   - Step 2 (optional chips: budget, timeline, purpose...) updates the same lead (same lead_id) and fires `lead_qualified`.
   - UTM params and gclid/fbclid are stored with the lead so every lead can be tied to its source.
   - ENDPOINT is empty in this draft: set it to the lead-capture URL (sheet / CRM webhook) before launch.
     Your endpoint should upsert by lead_id: step 1 creates the row, step 2 (update:true) adds the extra columns.
   - The hero film plays only on tap (no autoplay). Set data-video on .poster to an MP4 URL to enable it.
*/
(function () {
  var ENDPOINT = ""; // TODO: lead-capture URL. Empty = preview only (nothing is sent).
  var THANKS = "thanks.html";
  window.dataLayer = window.dataLayer || [];

  var params = {};
  new URLSearchParams(location.search).forEach(function (v, k) { params[k] = v; });
  var keep = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid", "wbraid", "gbraid"];
  try { keep.forEach(function (k) { if (params[k]) sessionStorage.setItem("ee_" + k, params[k]); }); } catch (e) {}
  function stored(k) { try { return sessionStorage.getItem("ee_" + k) || params[k] || ""; } catch (e) { return params[k] || ""; } }

  function post(payload) {
    if (!ENDPOINT) return Promise.resolve();
    // text/plain + no-cors = a "simple request": no browser pre-flight, which Google Apps Script cannot answer.
    // The response is opaque by design; the page does not need it.
    return fetch(ENDPOINT, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload), keepalive: true })
      .catch(function () {});
  }
  function newId() { return "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  document.querySelectorAll("form[data-lead]").forEach(function (form) {
    var type = form.getAttribute("data-lead");
    var card = form.closest(".card");
    var step1 = card.querySelector("#step1");
    var step2 = card.querySelector("#step2");

    keep.forEach(function (k) { var i = form.querySelector('input[name="' + k + '"]'); if (i) i.value = stored(k); });
    var pg = form.querySelector('input[name="landing_page"]');
    if (pg) pg.value = location.pathname.split("/").pop() || "index";

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var ok = true;
      var phone = form.querySelector('input[name="phone"]');
      var name = form.querySelector('input[name="name"]');
      var consent = form.querySelector('input[name="consent"]');
      form.querySelectorAll(".err").forEach(function (x) { x.style.display = "none"; });
      function bad(el, msg) { ok = false; var er = el.closest("div").querySelector(".err"); if (er) { er.textContent = msg; er.style.display = "block"; } }
      var digits = (phone.value || "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
      if (!name.value.trim()) bad(name, "Please enter your name.");
      if (!/^[6-9]\d{9}$/.test(digits)) bad(phone, "Enter a valid 10-digit mobile number.");
      if (!consent.checked) { ok = false; var ce = form.querySelector(".err.consent-err"); if (ce) ce.style.display = "block"; }
      if (!ok) return;

      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      data.phone = digits;
      data.lead_id = newId();
      data.lead_type = type;
      data.step = 1;
      data.page = location.href;
      data.submitted_at = new Date().toISOString();
      try { sessionStorage.setItem("ee_lead_id", data.lead_id); } catch (er) {}

      window.dataLayer.push({ event: "generate_lead", lead_type: type, lead_id: data.lead_id });
      post(data);

      step1.hidden = true;
      step2.hidden = false;
      var h = step2.querySelector("h3"); if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
    });

    // chips: one choice per group, tap again to clear
    step2.querySelectorAll(".chips").forEach(function (group) {
      group.addEventListener("click", function (e) {
        var b = e.target.closest(".chip"); if (!b) return;
        var wasOn = b.getAttribute("aria-pressed") === "true";
        group.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        if (!wasOn) b.setAttribute("aria-pressed", "true");
      });
    });

    function goThanks() { location.href = THANKS + "?type=" + encodeURIComponent(type); }

    var send = step2.querySelector("#send2");
    if (send) send.addEventListener("click", function () {
      var upd = { update: true, lead_type: type, step: 2, lead_id: (function () { try { return sessionStorage.getItem("ee_lead_id") || ""; } catch (er) { return ""; } })() };
      step2.querySelectorAll(".qgroup").forEach(function (g) {
        var on = g.querySelector('.chip[aria-pressed="true"]');
        upd[g.getAttribute("data-group")] = on ? on.textContent.trim() : "";
      });
      window.dataLayer.push({ event: "lead_qualified", lead_type: type, lead_id: upd.lead_id });
      post(upd).then(goThanks);
      setTimeout(goThanks, 1500); // never trap the visitor if the network is slow
    });
  });

  // film: still photo first; the player opens only when tapped (no autoplay, no weight until then).
  // Set data-video on .poster to a web-sized MP4 (vertical 9:16 is fine). Until then the play button stays hidden.
  document.querySelectorAll(".poster").forEach(function (p) {
    var btn = p.querySelector(".play");
    if (!btn) return;
    var src = p.getAttribute("data-video");
    btn.hidden = !src;
    function openFilm() {
      if (!src) return;
      stopPreview();
      var m = document.createElement("div");
      m.className = "vmodal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-label", "Project film");
      var v = document.createElement("video");
      v.src = src; v.controls = true; v.autoplay = true; v.playsInline = true;
      var x = document.createElement("button");
      x.type = "button"; x.className = "vclose"; x.setAttribute("aria-label", "Close film"); x.textContent = "\u00d7";
      function close() { document.removeEventListener("keydown", onKey); m.remove(); btn.focus(); }
      function onKey(e) { if (e.key === "Escape") close(); }
      x.addEventListener("click", close);
      m.addEventListener("click", function (e) { if (e.target === m) close(); });
      document.addEventListener("keydown", onKey);
      m.appendChild(v); m.appendChild(x); document.body.appendChild(m); x.focus();
    }
    // hover preview: muted, looping, desktop pointers only; loads nothing until hovered
    var pv = null;
    function startPreview() {
      if (!src || pv || document.querySelector(".vmodal")) return;
      pv = document.createElement("video");
      pv.className = "pvideo"; pv.src = src; pv.muted = true; pv.loop = true; pv.playsInline = true; pv.setAttribute("aria-hidden", "true");
      p.insertBefore(pv, p.querySelector(".cap"));
      var pr = pv.play(); if (pr && pr.catch) pr.catch(function () {});
    }
    function stopPreview() { if (pv) { pv.pause(); pv.remove(); pv = null; } }
    if (src) {
      p.classList.add("clickable"); p.setAttribute("tabindex", "-1");
      p.addEventListener("click", function (e) { if (e.target.closest(".vmodal")) return; openFilm(); });
      if (window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        p.addEventListener("mouseenter", startPreview);
        p.addEventListener("mouseleave", stopPreview);
      }
    }
  });

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-track]");
    if (!el) return;
    window.dataLayer.push({ event: el.getAttribute("data-track"), location: el.getAttribute("data-where") || "" });
  });
})();
