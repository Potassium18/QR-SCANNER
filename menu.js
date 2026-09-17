// ==========================================
// SIDEBAR & TAB NAVIGATION LOGIC
// ==========================================

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  
  sidebar.classList.toggle("open");
  overlay.classList.toggle("active");
}

function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll(".tab-content").forEach(tab => tab.classList.add("hidden"));
  
  // Deactivate all nav buttons
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("active"));
  
  // Show target tab
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) {
    targetTab.classList.remove("hidden");
  }

  // Close sidebar after click
  toggleSidebar();
}

function saveNotes() {
  const notes = document.getElementById("event-notes").value;
  localStorage.setItem("scanner_notes", notes);
  alert("Notes saved locally!");
}

function saveSettings() {
  const urlInput = document.getElementById("script-url-input").value.trim();
  if (urlInput) {
    localStorage.setItem("custom_script_url", urlInput);
    alert("Google Script URL updated!");
  }
}

function clearQueueData() {
  if (confirm("Are you sure you want to clear all queued scans?")) {
    localStorage.removeItem("offlineScanQueue");
    location.reload();
  }
}

// Restore saved notes on load
document.addEventListener("DOMContentLoaded", () => {
  const savedNotes = localStorage.getItem("scanner_notes");
  if (savedNotes) {
    document.getElementById("event-notes").value = savedNotes;
  }
});