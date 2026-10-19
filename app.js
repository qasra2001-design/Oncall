import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, doc, setDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const specialities = [
  "Medicine",
  "Surgery",
  "Orthopedic",
  "ENT",
  "Opthalmology",
  "Nephrology",
  "cardiology",
  "pediatrics",
  "Gyne",
  "Pediatric surgery",
  "Dental",
  "Dermatology",
  "Psychiatry"
];

const rowsEl = document.getElementById("rows");
const datePicker = document.getElementById("datePicker");
const modeSelect = document.getElementById("modeSelect");
const specialitySelect = document.getElementById("specialitySelect");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");

// Build speciality dropdown
specialities.forEach(sp => {
  const opt = document.createElement("option");
  opt.textContent = sp;
  opt.value = sp;
  specialitySelect.appendChild(opt);
});

// Default date = today (local)
function toISODate(d) {
  const tzOffset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - tzOffset);
  return local.toISOString().split("T")[0];
}
datePicker.value = toISODate(new Date());

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;')
    .replaceAll("'", "&#039;");
}

function renderEmptyTable() {
  rowsEl.innerHTML = "";
  for (const sp of specialities) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="speciality">${escapeHtml(sp)}</td>
      <td id="${sp}-first"></td>
      <td id="${sp}-second"></td>
    `;
    rowsEl.appendChild(tr);
  }
}
renderEmptyTable();

function renderCell(sp, slot, data) {
  const cell = document.getElementById(`${sp}-${slot}`);
  const name = data?.name || "";
  const phone = data?.phone || "";

  const isEditMode = modeSelect.value === "edit" && specialitySelect.value === sp;

  if (isEditMode) {
    cell.innerHTML = `
      <div class="slot-block edit">
        <div class="slot-title">Name (${slot.toUpperCase()})</div>
        <input id="${sp}-${slot}-name" placeholder="Doctor name" value="${escapeHtml(name)}" />

        <div class="slot-title">Phone No. (${slot.toUpperCase()})</div>
        <input id="${sp}-${slot}-phone" placeholder="Phone number" value="${escapeHtml(phone)}" />
      </div>
    `;
  } else {
    cell.innerHTML = `
      <div class="slot-block">
        <div class="slot-title">${slot.toUpperCase()}</div>
        <div class="person">${escapeHtml(name) ? escapeHtml(name) : `<span class="muted">Not set</span>`}</div>
        <div class="phone">${escapeHtml(phone || "")}</div>
      </div>
    `;
  }
}

let unsubscribeFns = [];
function clearListeners() {
  for (const fn of unsubscribeFns) fn?.();
  unsubscribeFns = [];
}

function listenToRoster(dateStr) {
  clearListeners();
  setStatus("Loading roster...");

  for (const sp of specialities) {
    const firstRef = doc(db, "rosters", dateStr, "specialities", sp, "slots", "first");
    const secondRef = doc(db, "rosters", dateStr, "specialities", sp, "slots", "second");

    const unsub1 = onSnapshot(firstRef, (snap) => {
      renderCell(sp, "first", snap.exists() ? snap.data() : null);
      setStatus("");
    });

    const unsub2 = onSnapshot(secondRef, (snap) => {
      renderCell(sp, "second", snap.exists() ? snap.data() : null);
      setStatus("");
    });

    unsubscribeFns.push(unsub1, unsub2);
  }
}

async function saveForSelectedSpeciality(dateStr) {
  const sp = specialitySelect.value;

  const first = {
    name: document.getElementById(`${sp}-first-name`)?.value.trim() || "",
    phone: document.getElementById(`${sp}-first-phone`)?.value.trim() || ""
  };
  const second = {
    name: document.getElementById(`${sp}-second-name`)?.value.trim() || "",
    phone: document.getElementById(`${sp}-second-phone`)?.value.trim() || ""
  };

  const firstDoc = doc(db, "rosters", dateStr, "specialities", sp, "slots", "first");
  const secondDoc = doc(db, "rosters", dateStr, "specialities", sp, "slots", "second");

  await setDoc(firstDoc, first, { merge: true });
  await setDoc(secondDoc, second, { merge: true });
  setStatus("Saved. (Screen will update instantly)");
}

function updateUIByMode() {
  const isEdit = modeSelect.value === "edit";
  saveBtn.style.display = isEdit ? "inline-block" : "none";
  setStatus(isEdit ? "Edit mode: only the selected speciality row is editable." : "View mode: realtime display.");
  // Re-listen to ensure edit inputs get rendered for selected speciality
  listenToRoster(datePicker.value);
}

datePicker.addEventListener("change", () => updateUIByMode());
modeSelect.addEventListener("change", () => updateUIByMode());
specialitySelect.addEventListener("change", () => {
  if (modeSelect.value === "edit") updateUIByMode();
});

saveBtn.addEventListener("click", async () => {
  try {
    await saveForSelectedSpeciality(datePicker.value);
  } catch (e) {
    console.error(e);
    setStatus("Save failed. Check browser console + Firebase rules.");
  }
});

// Start
listenToRoster(datePicker.value);
