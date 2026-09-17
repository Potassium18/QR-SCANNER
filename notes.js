let activeFolder = "All";
let editingNoteId = null;

document.addEventListener("DOMContentLoaded", () => {
  initFolders();
  renderApp();
});

function initFolders() {
  // Only keep standard user folders (excluding Scans)
  let folders = JSON.parse(localStorage.getItem("app_folders")) || ["General", "Personal", "Work"];
  folders = folders.filter(f => f !== "Scans"); 
  localStorage.setItem("app_folders", JSON.stringify(folders));
}

function renderApp() {
  renderFolders();
  renderNotesGrid();
  renderScannedDataList();
}

// 1. RENDER USER FOLDERS
function renderFolders() {
  const container = document.getElementById("folders-grid");
  const select = document.getElementById("note-folder-select");
  if (!container) return;

  const folders = JSON.parse(localStorage.getItem("app_folders")) || [];
  const notes = (JSON.parse(localStorage.getItem("app_notes_list")) || []).filter(n => n.folder !== "Scans");

  container.innerHTML = `
    <div class="folder-card ${activeFolder === 'All' ? 'active' : ''}" onclick="selectFolder('All')">
      <span>📂 All</span>
      <small>${notes.length}</small>
    </div>
  `;

  select.innerHTML = "";

  folders.forEach(folder => {
    const count = notes.filter(n => n.folder === folder).length;
    
    const card = document.createElement("div");
    card.className = `folder-card ${activeFolder === folder ? 'active' : ''}`;
    card.onclick = () => selectFolder(folder);
    card.innerHTML = `<span>📁 ${folder}</span><small>${count}</small>`;
    container.appendChild(card);

    const opt = document.createElement("option");
    opt.value = folder;
    opt.textContent = folder;
    select.appendChild(opt);
  });
}

// 2. RENDER PERSONAL NOTES (CARDS)
function renderNotesGrid() {
  const pinnedGrid = document.getElementById("pinned-notes-grid");
  const notesGrid = document.getElementById("notes-grid");
  const pinnedSection = document.getElementById("pinned-section");
  const label = document.getElementById("main-notes-label");

  // Filter OUT "Scans" notes so they only show in the Scanned Data section
  let notes = (JSON.parse(localStorage.getItem("app_notes_list")) || []).filter(n => n.folder !== "Scanned Data");



  if (activeFolder !== "All") {
    notes = notes.filter(n => n.folder === activeFolder);
    label.textContent = `Personal Notes (${activeFolder})`;
  } else {
    label.textContent = "Personal Notes";
  }

  pinnedGrid.innerHTML = "";
  notesGrid.innerHTML = "";

  const pinned = notes.filter(n => n.pinned);
  const unpinned = notes.filter(n => !n.pinned);

  if (pinned.length > 0) {
    pinnedSection.classList.remove("hidden");
    pinned.forEach(n => pinnedGrid.appendChild(createNoteElement(n)));
  } else {
    pinnedSection.classList.add("hidden");
  }

  if (unpinned.length === 0 && pinned.length === 0) {
    notesGrid.innerHTML = '<p style="grid-column: span 2; color: #888; font-size: 0.85rem;">No notes in this folder.</p>';
  } else {
    unpinned.forEach(n => notesGrid.appendChild(createNoteElement(n)));
  }
}

function createNoteElement(note) {
  const card = document.createElement("div");
  card.className = "note-card";
  card.style.backgroundColor = note.color || "#e3f2fd";

  card.innerHTML = `
    <div>
      <h4>
        <span>${escapeHtml(note.title || "Note")}</span>
        <button onclick="event.stopPropagation(); togglePin(${note.id})" title="Pin note">${note.pinned ? "📌" : "📍"}</button>
      </h4>
      <p>${escapeHtml(note.text)}</p>
    </div>
    <div class="note-footer">
      <span>${note.date}</span>
      <div class="card-actions">
        <button onclick="event.stopPropagation(); editNote(${note.id})" title="Edit Note">✏️</button>
        <button onclick="event.stopPropagation(); deleteNote(${note.id})" title="Delete">🗑️</button>
      </div>
    </div>
  `;

  card.onclick = () => editNote(note.id);
  return card;
}

// 3. RENDER DEDICATED SCANNED DATA LIST (ATTENDANCE LOGS)
function renderScannedDataList() {
  const tableBody = document.getElementById("scanned-logs-body");
  if (!tableBody) return;

  const allNotes = JSON.parse(localStorage.getItem("app_notes_list")) || [];
  
  // Catch all scanned entries regardless of folder tag history
  const scanLogs = allNotes.filter(n => 
    n.folder === "Scanned Data" || 
    n.folder === "Scans" || 
    (n.title && n.title.toLowerCase().startsWith("scan:"))
  );

  tableBody.innerHTML = "";

  if (scanLogs.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; padding: 15px; color: #888;">No attendance data scanned yet.</td>
      </tr>
    `;
    return;
  }

  scanLogs.forEach(scan => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #eee";

    const cleanTitle = scan.title.replace(/^Scan:\s*/i, "");

    tr.innerHTML = `
      <td style="padding: 8px 10px; white-space: nowrap; color: #666; font-size: 0.75rem;">${scan.date}</td>
      <td style="padding: 8px 10px; font-weight: 500;">
        <div>${escapeHtml(cleanTitle)}</div>
        <small style="color: #666; font-weight: normal;">${escapeHtml(scan.text)}</small>
      </td>
      <td style="padding: 8px 10px; text-align: right;">
        <button onclick="deleteNote(${scan.id})" style="background: none; border: none; cursor: pointer;" title="Delete Record">🗑️</button>
      </td>
    `;

    tableBody.appendChild(tr);
  });
}

// Clear all attendance scans
function clearScannedLogs() {
  if (!confirm("Are you sure you want to clear all scanned attendance records?")) return;
  let notes = JSON.parse(localStorage.getItem("app_notes_list")) || [];
  notes = notes.filter(n => n.folder !== "Scans");
  localStorage.setItem("app_notes_list", JSON.stringify(notes));
  renderApp();
}

// ACTIONS
function selectFolder(folder) {
  activeFolder = folder;
  renderApp();
}

function promptNewFolder() {
  const name = prompt("Enter new folder name:");
  if (!name) return;

  let folders = JSON.parse(localStorage.getItem("app_folders")) || [];
  if (!folders.includes(name.trim())) {
    folders.push(name.trim());
    localStorage.setItem("app_folders", JSON.stringify(folders));
    renderApp();
  }
}

function toggleNoteModal(reset = true) {
  const modal = document.getElementById("note-modal");
  const modalTitle = modal.querySelector("h3");

  if (reset) {
    editingNoteId = null;
    document.getElementById("note-title-input").value = "";
    document.getElementById("note-content-input").value = "";
    document.getElementById("note-color-input").value = "#e3f2fd";
    if (modalTitle) modalTitle.textContent = "Create Note";
  }

  modal.classList.toggle("hidden");
}

function editNote(id) {
  let notes = JSON.parse(localStorage.getItem("app_notes_list")) || [];
  const note = notes.find(n => n.id === id);
  if (!note) return;

  editingNoteId = note.id;

  document.getElementById("note-title-input").value = note.title || "";
  document.getElementById("note-content-input").value = note.text || "";
  document.getElementById("note-folder-select").value = note.folder || "General";
  document.getElementById("note-color-input").value = note.color || "#e3f2fd";

  const modal = document.getElementById("note-modal");
  const modalTitle = modal.querySelector("h3");
  if (modalTitle) modalTitle.textContent = "Edit Note";

  modal.classList.remove("hidden");
}

function saveCustomNote() {
  const title = document.getElementById("note-title-input").value.trim();
  const text = document.getElementById("note-content-input").value.trim();
  const folder = document.getElementById("note-folder-select").value;
  const color = document.getElementById("note-color-input").value;

  if (!text) {
    alert("Please enter note content.");
    return;
  }

  let notes = JSON.parse(localStorage.getItem("app_notes_list")) || [];
  const now = new Date();
  const formattedDate = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  if (editingNoteId !== null) {
    notes = notes.map(n => {
      if (n.id === editingNoteId) {
        return {
          ...n,
          title: title || "Untitled",
          text: text,
          folder: folder || "General",
          color: color,
          date: formattedDate
        };
      }
      return n;
    });
  } else {
    const newNote = {
      id: Date.now(),
      title: title || "Untitled",
      text: text,
      folder: folder || "General",
      color: color,
      pinned: false,
      date: formattedDate
    };
    notes.unshift(newNote);
  }

  localStorage.setItem("app_notes_list", JSON.stringify(notes));
  toggleNoteModal(true);
  renderApp();
}

function togglePin(id) {
  let notes = JSON.parse(localStorage.getItem("app_notes_list")) || [];
  notes = notes.map(n => {
    if (n.id === id) n.pinned = !n.pinned;
    return n;
  });
  localStorage.setItem("app_notes_list", JSON.stringify(notes));
  renderApp();
}

function deleteNote(id) {
  if (!confirm("Delete this item?")) return;
  let notes = JSON.parse(localStorage.getItem("app_notes_list")) || [];
  notes = notes.filter(n => n.id !== id);
  localStorage.setItem("app_notes_list", JSON.stringify(notes));
  renderApp();
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
// 1. Remove 'Scans' and 'Scanned Data' from folder defaults
function initFolders() {
  let folders = JSON.parse(localStorage.getItem("app_folders")) || ["General", "Personal", "Work"];
  folders = folders.filter(f => f !== "Scans" && f !== "Scanned Data"); 
  localStorage.setItem("app_folders", JSON.stringify(folders));
}

// 2. Filter out scanned entries from counting towards personal notes
function renderFolders() {
  const container = document.getElementById("folders-grid");
  const select = document.getElementById("note-folder-select");
  if (!container) return;

  const folders = JSON.parse(localStorage.getItem("app_folders")) || [];
  const notes = (JSON.parse(localStorage.getItem("app_notes_list")) || []).filter(n => n.folder !== "Scanned Data" && n.folder !== "Scans");

  container.innerHTML = `
    <div class="folder-card ${activeFolder === 'All' ? 'active' : ''}" onclick="selectFolder('All')">
      <span>📂 All</span>
      <small>${notes.length}</small>
    </div>
  `;

  select.innerHTML = "";

  folders.forEach(folder => {
    const count = notes.filter(n => n.folder === folder).length;
    
    const card = document.createElement("div");
    card.className = `folder-card ${activeFolder === folder ? 'active' : ''}`;
    card.onclick = () => selectFolder(folder);
    card.innerHTML = `<span>📁 ${folder}</span><small>${count}</small>`;
    container.appendChild(card);

    const opt = document.createElement("option");
    opt.value = folder;
    opt.textContent = folder;
    select.appendChild(opt);
  });
}

// 3. Render table logs by checking both "Scanned Data" and legacy "Scans"
function renderScannedDataList() {
  const tableBody = document.getElementById("scanned-logs-body");
  if (!tableBody) return;

  const allNotes = JSON.parse(localStorage.getItem("app_notes_list")) || [];
  // Pulls records from "Scanned Data" and legacy "Scans"
  const scanLogs = allNotes.filter(n => n.folder === "Scanned Data" || n.folder === "Scans");

  tableBody.innerHTML = "";

  if (scanLogs.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; padding: 15px; color: #888;">No attendance data scanned yet.</td>
      </tr>
    `;
    return;
  }

  scanLogs.forEach(scan => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #eee";

    tr.innerHTML = `
      <td style="padding: 8px 10px; white-space: nowrap; color: #666; font-size: 0.75rem;">${scan.date}</td>
      <td style="padding: 8px 10px; font-weight: 500;">
        <div>${escapeHtml(scan.title.replace("Scan: ", ""))}</div>
        <small style="color: #666; font-weight: normal;">${escapeHtml(scan.text)}</small>
      </td>
      <td style="padding: 8px 10px; text-align: right;">
        <button onclick="deleteNote(${scan.id})" style="background: none; border: none; cursor: pointer;" title="Delete Record">🗑️</button>
      </td>
    `;

    tableBody.appendChild(tr);
  });
}

// Clear button logic update
function clearScannedLogs() {
  if (!confirm("Are you sure you want to clear all scanned attendance records?")) return;
  let notes = JSON.parse(localStorage.getItem("app_notes_list")) || [];
  notes = notes.filter(n => n.folder !== "Scanned Data" && n.folder !== "Scans");
  localStorage.setItem("app_notes_list", JSON.stringify(notes));
  renderApp();
}