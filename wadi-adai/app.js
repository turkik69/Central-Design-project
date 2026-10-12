import { seed } from "./content.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const viewNames = ["home", "existing", "analysis", "proposals", "recommendations"];
const records = structuredClone(seed);
let cloud = null;
let editor = null;
let stopListeners = [];
let activeFilter = "all";
let pendingCollection = "proposals";
let pendingRecordId = null;
let toastTimer;

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function notify(message) {
  const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3300);
}
function recordId(item, prefix = "item") { return String(item.id ?? item.chapter ?? `${prefix}-${crypto.randomUUID()}`).replace(/[^a-zA-Z0-9_-]/g, "-"); }

function render() {
  $("#metrics").innerHTML = records.metrics.map((m, i) => `<article class="metric-card"><span class="eyebrow">مؤشر 0${i + 1}</span><div class="metric-value">${escapeHTML(m.value)}</div><h3>${escapeHTML(m.title)}</h3><p>${escapeHTML(m.detail)}</p></article>`).join("");
  $("#objectives").innerHTML = records.objectives.map(item => `<li>${escapeHTML(item)}</li>`).join("");
  $("#stages").innerHTML = records.stages.map((s, i) => `<article class="stage-card"><span class="stage-no">0${i + 1}</span><h3>${escapeHTML(s.title)}</h3><p>${escapeHTML(s.text)}</p><time>${escapeHTML(s.date)}</time></article>`).join("");
  $("#stations").innerHTML = records.stations.map(s => {
    const observations = (records.observations || []).filter(o => String(o.stationId) === String(s.id));
    return `<article class="station-card"><div class="station-head"><span class="station-index">محطة رصد ${String(s.id).padStart(2, "0")}</span><span class="live-dot"></span></div><h3>${escapeHTML(s.title)}</h3><p>${escapeHTML(s.finding)}</p><div class="station-counts"><span>${escapeHTML(s.notes)} ملاحظات رصد</span><span>${escapeHTML(s.issues)} مشكلات حرجة</span></div>${observations.map(o => `<div class="observation"><strong>${escapeHTML(o.title)}</strong><p>${escapeHTML(o.description)}</p>${attachmentLinks(o)}${editor ? `<button class="icon-button" data-delete="observations:${escapeHTML(o.id)}">حذف الملاحظة</button>` : ""}</div>`).join("")}</article>`;
  }).join("");
  $("#analyses").innerHTML = records.analyses.map(a => `<article class="analysis-card"><span class="chapter">${escapeHTML(a.chapter)} · فصل تحليلي</span><h3>${escapeHTML(a.title)}</h3><p>${escapeHTML(a.detail)}</p></article>`).join("");
  $("#proposals").innerHTML = records.proposals.map(p => `<article class="proposal-card"><span class="category">${escapeHTML(p.category || "مقترح تطويري")}</span><span class="station-index"> · البند ${escapeHTML(p.id)}</span><h3>${escapeHTML(p.title)}</h3><div class="location">${escapeHTML(p.location || "نطاق الدراسة")}</div><p>${escapeHTML(p.description || "")}</p>${p.challenge ? `<details><summary>التحدي والأثر المتوقع</summary><p><b>التحدي:</b> ${escapeHTML(p.challenge)}</p><p><b>الأثر:</b> ${escapeHTML(p.impact || "")}</p></details>` : ""}${attachmentLinks(p)}${editor ? `<div class="editor-actions"><button class="icon-button" data-edit="proposals:${escapeHTML(p.id)}">تعديل</button><button class="icon-button" data-delete="proposals:${escapeHTML(p.id)}">حذف</button></div>` : ""}</article>`).join("");
  $("#gallery").innerHTML = (records.gallery || []).map(item => {
    const image = item.attachments?.find(file => file.type?.startsWith("image/"));
    const imageMarkup = image ? `<img src="${escapeHTML(image.url)}" alt="${escapeHTML(item.title)}" loading="lazy">` : `<div class="gallery-visual ${escapeHTML(item.style || "visual-grid")}" role="img" aria-label="تصور توضيحي: ${escapeHTML(item.title)}"></div>`;
    return `<article class="gallery-card">${imageMarkup}<div class="gallery-caption"><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.caption || item.location || "توثيق ميداني · وادي عدي")}</p>${editor ? `<div class="editor-actions"><button class="icon-button" data-edit="gallery:${escapeHTML(item.id)}">تعديل</button><button class="icon-button" data-delete="gallery:${escapeHTML(item.id)}">حذف</button></div>` : ""}</div></article>`;
  }).join("");
  $("#roadmap").innerHTML = records.roadmap.map(r => `<article class="roadmap-card"><span class="period">${escapeHTML(r.period)}</span><h3>${escapeHTML(r.title)}</h3><ul>${r.items.map(item => `<li>${escapeHTML(item)}</li>`).join("")}</ul></article>`).join("");
  const recs = records.recommendations.filter(r => activeFilter === "all" || r.priority === activeFilter);
  $("#recommendations").innerHTML = recs.map(r => `<article class="recommendation-card"><div><span class="priority" data-level="${escapeHTML(r.priority)}">${escapeHTML(r.priority)}</span><div class="station-index">البند ${escapeHTML(r.id)}</div></div><div><h3>${escapeHTML(r.title)}</h3><p>${escapeHTML(r.text || r.description || "")}</p>${attachmentLinks(r)}${editor ? `<button class="icon-button" data-edit="recommendations:${escapeHTML(r.id)}">تعديل</button> <button class="icon-button" data-delete="recommendations:${escapeHTML(r.id)}">حذف</button>` : ""}</div></article>`).join("");
  const stationSelect = $("#record-form [name=stationId]");
  stationSelect.innerHTML = `<option value="">اختر المحطة عند إضافة ملاحظة</option>${records.stations.map(s => `<option value="${escapeHTML(s.id)}">محطة ${String(s.id).padStart(2, "0")} · ${escapeHTML(s.title)}</option>`).join("")}`;
  $$(".editor-only").forEach(el => el.classList.toggle("hidden", !editor));
  $("#login-open").classList.toggle("hidden", Boolean(editor)); $("#logout").classList.toggle("hidden", !editor);
  $("#role-label").textContent = editor ? `فريق العمل · ${editor.displayName || editor.email}` : "زائر · اطلاع فقط";
}

function attachmentLinks(item) {
  if (!Array.isArray(item.attachments) || !item.attachments.length) return "";
  return `<div class="attachments">${item.attachments.map(file => `<a href="${escapeHTML(file.url)}" target="_blank" rel="noreferrer">📎 ${escapeHTML(file.name || "مرفق")}</a>`).join("")}</div>`;
}

function setView(name) {
  if (!viewNames.includes(name)) return;
  $$(".view").forEach(el => el.classList.toggle("active", el.id === `view-${name}`));
  $$(".nav-item").forEach(el => el.classList.toggle("active", el.dataset.view === name));
  history.replaceState(null, "", `#${name}`); window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyCollection(key, docs) {
  if (docs.length) records[key] = docs.map(d => d.data);
  render();
}

async function initCloud() {
  const config = window.WADI_ADAI_FIREBASE_CONFIG;
  if (!config?.apiKey || !config?.appId || !config?.projectId) {
    $("#sync-status").innerHTML = "<i></i> وضع المعاينة · Firebase غير مهيأ";
    return;
  }
  try {
    const [appMod, authMod, storeMod, storageMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/13.0.0/firebase-storage.js")
    ]);
    const app = appMod.initializeApp(config, "wadi-adai-standalone");
    const auth = authMod.getAuth(app);
    const db = storeMod.getFirestore(app, "wadi-adai-db");
    const storage = storageMod.getStorage(app);
    cloud = { auth, db, authMod, storeMod, storage, storageMod };
    $("#sync-status").classList.add("connected");
    $("#sync-status").innerHTML = "<i></i> متصل · مزامنة مباشرة";
    const collectionKeys = ["proposals", "recommendations", "stations", "analyses", "roadmap", "observations", "gallery"];
    collectionKeys.forEach(key => {
      const ref = storeMod.collection(db, "wadi_adai_v2", key, "items");
      const stop = storeMod.onSnapshot(ref, snap => {
        if (snap.empty) return;
        applyCollection(key, snap.docs.map(doc => ({ id: doc.id, data: doc.data() })));
      }, err => notify(`تعذر قراءة ${key}: تحقق من قواعد Firestore`));
      stopListeners.push(stop);
    });
    authMod.onAuthStateChanged(auth, async user => {
      editor = null;
      if (user) {
        try {
          const memberRef = storeMod.doc(db, "wadi_adai_v2_members", user.uid);
          const member = await storeMod.getDoc(memberRef);
          if (member.exists() && member.data().active === true && member.data().role === "editor") editor = { ...user, ...member.data() };
          else await authMod.signOut(auth);
        } catch { await authMod.signOut(auth); }
      }
      if (editor) await seedEmptyCollections();
      render();
    });
  } catch (error) {
    console.error(error); cloud = null;
    $("#sync-status").innerHTML = "<i></i> تعذر الاتصال السحابي";
    notify("تعذر تهيئة Firebase. راجع إعدادات Web App وقواعد Firestore.");
  }
}

async function seedEmptyCollections() {
  const seedKeys = ["proposals", "recommendations", "stations", "analyses", "roadmap", "gallery"];
  const { db, storeMod } = cloud;
  for (const key of seedKeys) {
    const ref = storeMod.collection(db, "wadi_adai_v2", key, "items");
    const snapshot = await storeMod.getDocs(ref);
    if (!snapshot.empty) continue;
    const batch = storeMod.writeBatch(db);
    for (const item of seed[key]) {
      const id = recordId(item, key);
      batch.set(storeMod.doc(db, "wadi_adai_v2", key, "items", id), { ...item, id, seededFromPublicOverview: true });
    }
    await batch.commit();
  }
}

async function writeRecord(collectionKey, item) {
  if (!editor || !cloud) throw new Error("يلزم تسجيل دخول عضو مفعل للكتابة.");
  const { db, storeMod } = cloud;
  const id = recordId(item, collectionKey);
  const ref = storeMod.doc(db, "wadi_adai_v2", collectionKey, "items", id);
  await storeMod.setDoc(ref, { ...item, id, updatedAt: storeMod.serverTimestamp(), updatedBy: editor.uid }, { merge: true });
}

async function deleteRecord(collectionKey, id) {
  if (!editor || !cloud) return;
  const { db, storeMod } = cloud;
  await storeMod.deleteDoc(storeMod.doc(db, "wadi_adai_v2", collectionKey, "items", String(id)));
  records[collectionKey] = records[collectionKey].filter(item => String(item.id) !== String(id));
  render(); notify("حُذف السجل من مساحة وادي عدي.");
}

function bind() {
  $$(".nav-item").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
  $$('[data-jump]').forEach(button => button.addEventListener("click", () => setView(button.dataset.jump)));
  $("#login-open").addEventListener("click", () => {
    if (!cloud) return notify("تحتاج المنصة إلى إعداد Firebase قبل تسجيل أعضاء الفريق.");
    $("#auth-dialog").showModal();
  });
  $("#login-close").addEventListener("click", () => $("#auth-dialog").close());
  $("#logout").addEventListener("click", async () => { if (cloud) await cloud.authMod.signOut(cloud.auth); });
  $("#login-form").addEventListener("submit", async event => {
    event.preventDefault(); $("#login-error").textContent = "";
    const data = new FormData(event.currentTarget);
    try {
      await cloud.authMod.signInWithEmailAndPassword(cloud.auth, data.get("email"), data.get("password"));
      $("#auth-dialog").close(); event.currentTarget.reset(); notify("تم تسجيل الدخول. جارٍ التحقق من صلاحيات الفريق.");
    } catch { $("#login-error").textContent = "تعذر الدخول. تحقق من بيانات الحساب وصلاحيات الفريق."; }
  });
  $$(".filter").forEach(button => button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    $$(".filter").forEach(item => item.classList.toggle("active", item === button)); render();
  }));
  $("#add-proposal").addEventListener("click", () => openRecord("proposals", "مقترح معماري"));
  $("#add-recommendation").addEventListener("click", () => openRecord("recommendations", "توصية قطاعية"));
  $("#add-observation").addEventListener("click", () => openRecord("observations", "ملاحظة ميدانية"));
  $("#add-gallery").addEventListener("click", () => openRecord("gallery", "صورة أو مخطط"));
  $("#backup").addEventListener("click", exportBackup);
  $("#compare-slider").addEventListener("input", event => $(".compare-box").style.setProperty("--split", `${event.target.value}%`));
  $("#record-close").addEventListener("click", () => $("#record-dialog").close());
  $("#record-form").addEventListener("submit", submitRecord);
  document.addEventListener("click", async event => {
    const edit = event.target.closest("[data-edit]");
    if (edit) {
      const [key, id] = edit.dataset.edit.split(":");
      const item = records[key].find(entry => String(entry.id) === id);
      if (item) openRecord(key, ({ proposals: "مقترح معماري", recommendations: "توصية قطاعية", gallery: "صورة أو مخطط" })[key] || "ملاحظة ميدانية", item);
      return;
    }
    const button = event.target.closest("[data-delete]"); if (!button) return;
    const [key, id] = button.dataset.delete.split(":");
    if (confirm("هل تريد حذف هذا السجل من مساحة وادي عدي؟")) {
      try { await deleteRecord(key, id); } catch { notify("تعذر الحذف. تحقق من صلاحيات Firestore."); }
    }
  });
  window.addEventListener("hashchange", () => setView(location.hash.slice(1) || "home"));
  const initial = location.hash.slice(1); if (viewNames.includes(initial)) setView(initial);
}

function exportBackup() {
  const payload = { exportedAt: new Date().toISOString(), project: "wadi-adai-standalone", database: "wadi-adai-db", data: records };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = `wadi-adai-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  notify("تم تنزيل نسخة احتياطية من البيانات المعروضة.");
}

function openRecord(key, label, item = null) {
  if (!editor) return notify("تسجيل الدخول كعضو مفعل مطلوب لإضافة السجلات.");
  if (!cloud) return notify("المزامنة السحابية غير مهيأة بعد.");
  pendingCollection = key; pendingRecordId = item?.id ?? null;
  $("#record-kicker").textContent = label;
  $("#record-title").textContent = `${item ? "تعديل" : "إضافة"} ${label}`;
  const form = $("#record-form"); form.reset();
  if (item) {
    form.elements.title.value = item.title || "";
    form.elements.category.value = item.category || "";
    form.elements.location.value = item.location || "";
    form.elements.priority.value = item.priority || "";
    form.elements.stationId.value = item.stationId || "";
    form.elements.description.value = item.description || item.text || "";
    form.elements.challenge.value = item.challenge || "";
    form.elements.impact.value = item.impact || "";
    form.elements.location.value = item.caption || item.location || "";
  }
  $("#record-dialog").showModal();
}

async function submitRecord(event) {
  event.preventDefault(); if (!editor) return;
  const data = new FormData(event.currentTarget);
  const item = {
    id: pendingRecordId || `${pendingCollection}-${Date.now()}`,
    title: String(data.get("title")).trim(),
    category: String(data.get("category") || "").trim(),
    location: String(data.get("location") || "").trim(),
    description: String(data.get("description") || "").trim(),
    priority: String(data.get("priority") || "متوسط المدى").trim(),
    challenge: String(data.get("challenge") || "").trim(),
    impact: String(data.get("impact") || "").trim(),
    stationId: String(data.get("stationId") || "").trim(),
    caption: pendingCollection === "gallery" ? String(data.get("location") || "").trim() : "",
    createdAt: new Date().toISOString()
  };
  try {
    const files = [...event.currentTarget.elements.attachments.files];
    if (files.length) {
      const { storage, storageMod } = cloud;
      item.attachments = await Promise.all(files.map(async file => {
        const fileRef = storageMod.ref(storage, `wadi_adai_v2/${pendingCollection}/${item.id}/${crypto.randomUUID()}-${file.name}`);
        const uploaded = await storageMod.uploadBytes(fileRef, file);
        return { name: file.name, url: await storageMod.getDownloadURL(uploaded.ref), type: file.type };
      }));
    }
    const existing = records[pendingCollection].find(entry => String(entry.id) === String(item.id));
    if (existing?.attachments?.length && !item.attachments) item.attachments = existing.attachments;
    if (pendingCollection === "recommendations") item.text = item.description;
    await writeRecord(pendingCollection, item);
    records[pendingCollection] = existing ? records[pendingCollection].map(entry => String(entry.id) === String(item.id) ? item : entry) : [...records[pendingCollection], item];
    render(); $("#record-dialog").close(); event.currentTarget.reset(); pendingRecordId = null;
    notify("حُفظ السجل سحابياً، وسيظهر مباشرة للمستخدمين المتصلين.");
  } catch (error) { console.error(error); notify("لم يُحفظ السجل. تحقق من اتصال Firebase وقواعد الوصول."); }
}

bind(); render(); initCloud();
