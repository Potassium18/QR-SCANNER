// ==========================================
// GLOBAL VARIABLES & INITIALIZATION
// ==========================================
let html5QrCode = null;
let isScanning = false;
const ACTIVE_SCRIPT_URL = localStorage.getItem("google_script_url") || "";

// ==========================================
// CAMERA SCANNER ENGINE (MOBILE OPTIMIZED)
// ==========================================
async function toggleScanning() {
  const btn = document.getElementById("toggle-scan-btn");

  if (isScanning) {
    stopScanner();
    if (btn) btn.textContent = "Start Scanning";
    return;
  }

  startScanner();
}

async function startScanner() {
  const btn = document.getElementById("toggle-scan-btn");
  const cameraSelect = document.getElementById("camera-select");

  try {
    if (!html5QrCode) {
      html5QrCode = new Html5Qrcode("reader");
    }

    // Get available cameras for dropdown population
    const devices = await Html5Qrcode.getCameras();
    if (devices && devices.length > 0 && cameraSelect && cameraSelect.children.length === 0) {
      cameraSelect.innerHTML = "";
      devices.forEach(device => {
        const option = document.createElement("option");
        option.value = device.id;
        option.textContent = device.label || `Camera ${cameraSelect.children.length + 1}`;
        cameraSelect.appendChild(option);
      });
    }

    // Mobile-optimized scan configuration
    const scanConfig = {
      fps: 10, // Gives mobile camera sensors time to continuous auto-focus
      qrbox: undefined, // Scans whole video frame so alignment isn't rigid
      aspectRatio: 1.0,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true // Uses native OS hardware acceleration if available
      }
    };

    const selectedCameraId = cameraSelect && cameraSelect.value ? cameraSelect.value : null;
    const cameraConstraint = selectedCameraId ? selectedCameraId : { facingMode: "environment" };

    await html5QrCode.start(
      cameraConstraint,
      scanConfig,
      onScanSuccess,
      onScanFailure
    );

    isScanning = true;
    if (btn) btn.textContent = "Stop Scanning";

  } catch (err) {
    console.error("Camera startup error:", err);
    alert("Camera access failed. Please ensure HTTPS is active and camera permissions are allowed.");
    if (btn) btn.textContent = "Start Scanning";
    isScanning = false;
  }
}

async function stopScanner() {
  if (html5QrCode && isScanning) {
    try {
      await html5QrCode.stop();
      isScanning = false;
    } catch (err) {
      console.error("Failed to stop scanner cleanly:", err);
    }
  }
}

// ==========================================
// SCAN SUCCESS & PARSING
// ==========================================
function onScanSuccess(decodedText, decodedResult) {
  // Prevent duplicate accidental scans within 2 seconds
  stopScanner();
  const btn = document.getElementById("toggle-scan-btn");
  if (btn) btn.textContent = "Start Scanning";

  handleNewScan(decodedText);
}

function onScanFailure(error) {
  // Silent frame parse error handler
}

function handleNewScan(qrCodeMessage) {
  try {
    const now = new Date();
    const currentDate = now.toLocaleDateString();
    const currentTime = now.toLocaleTimeString();

    let name = "";
    let college = "N/A";
    let designation = "Member";

    const designationsList = [
      "Vice President", "Asst. Business Manager", "Asst. Team Leader",
      "Business Manager", "Undersecretary", "Media Committee Head",
      "Media Committee Graphic Artist", "Content Creator", "Team Leader",
      "Representative", "President", "Secretary", "Treasurer", "PIO"
    ];

    const collegeMappings = [
      { code: "COED & SHS", pattern: /College of Education and Senior High\s*School|College of Education|Senior High\s*School|\bCOED\b|\bSHS\b/gi },
      { code: "CBAA", pattern: /College of Business Administration and Accountancy|\bCBAA\b/gi },
      { code: "CSSH", pattern: /College of Social Sciences and Humanities|\bCSSH\b/gi },
      { code: "CNSM", pattern: /College of Natural Sciences and Mathematics|\bCNSM\b/gi },
      { code: "CFAS", pattern: /College of Fisheries and Aquatic Sciences?|\bCFAS\b/gi },
      { code: "IIAIS", pattern: /Institute of Islamic, Arabic, and International Studies|\bIIAIS\b/gi },
      { code: "CHS", pattern: /College of Health Sciences|\bCHS\b/gi },
      { code: "COE", pattern: /College of Engineering|\bCOE\b/gi },
      { code: "COA", pattern: /College of Agriculture|\bCOA\b/gi }
    ];

    let remainingText = qrCodeMessage || "";

    for (const title of designationsList) {
      const regex = new RegExp(`\\b${title}\\b`, "i");
      if (regex.test(remainingText)) {
        designation = title;
        remainingText = remainingText.replace(regex, "").trim();
        break;
      }
    }

    for (const mapping of collegeMappings) {
      if (mapping.pattern.test(remainingText)) {
        college = mapping.code;
        break;
      }
    }

    for (const mapping of collegeMappings) {
      remainingText = remainingText.replace(mapping.pattern, "");
    }
    remainingText = remainingText.replace(/College of [A-Za-z\s]+/gi, "");

    name = remainingText.replace(/\s+/g, " ").trim() || "Unknown";

    const scanData = {
      scanDate: currentDate,
      scanTime: currentTime,
      name: name,
      college: college,
      designation: designation,
      rawQrData: qrCodeMessage
    };

    const lastResultEl = document.getElementById("last-result");
    if (lastResultEl) {
      lastResultEl.textContent = `${scanData.name} | ${scanData.college} | ${scanData.designation}`;
    }

    // Play two-tone notification ping
    if (typeof playScanPing === "function") {
      playScanPing();
    }

    // Route scan strictly to Scanned Data logs
    appendScanToNotes(scanData);

    // Sync or Queue depending on true network status
    checkRealOnlineStatus(async function (isTrulyOnline) {
      if (isTrulyOnline && ACTIVE_SCRIPT_URL) {
        try {
          await fetch(ACTIVE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(scanData).toString()
          });
        } catch (error) {
          saveToLocalStorage(scanData);
        }
      } else {
        saveToLocalStorage(scanData);
      }
    });

  } catch (err) {
    console.error("Error processing QR code data:", err);
  }
}

// ==========================================
// STORAGE & LOCAL QUEUE
// ==========================================
function appendScanToNotes(scanData) {
  try {
    let notes = JSON.parse(localStorage.getItem("app_notes_list")) || [];
    const now = new Date();

    const newScanNote = {
      id: Date.now(),
      title: `Scan: ${scanData.name || 'QR Log'}`,
      text: `${scanData.name || 'N/A'} | ${scanData.college || 'N/A'} - ${scanData.designation || 'N/A'}`,
      folder: "Scanned Data",
      color: "#e8f5e9",
      pinned: false,
      date: `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    };

    notes.unshift(newScanNote);
    localStorage.setItem("app_notes_list", JSON.stringify(notes));
  } catch (err) {
    console.error("Error saving scan to local storage:", err);
  }
}

function saveToLocalStorage(scanData) {
  let queue = JSON.parse(localStorage.getItem("offline_scan_queue")) || [];
  queue.push(scanData);
  localStorage.setItem("offline_scan_queue", JSON.stringify(queue));
  updateQueueUI();
}

function updateQueueUI() {
  const queue = JSON.parse(localStorage.getItem("offline_scan_queue")) || [];
  const banner = document.getElementById("queue-banner");
  const countEl = document.getElementById("queue-count");

  if (banner && countEl) {
    if (queue.length > 0) {
      banner.classList.remove("hidden");
      countEl.textContent = queue.length;
    } else {
      banner.classList.add("hidden");
    }
  }
}

// ==========================================
// TWO-TONE NOTIFICATION AUDIO PING
// ==========================================
function playScanPing() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();

    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(1318.51, now, 0.12);
    playTone(1567.98, now + 0.08, 0.2);
  } catch (err) {
    console.error("Audio playback error:", err);
  }
}

// ==========================================
// ACCURATE ONLINE / OFFLINE DETECTOR
// ==========================================
function checkRealOnlineStatus(callback) {
  if (!navigator.onLine) {
    return callback(false);
  }

  const xhr = new XMLHttpRequest();
  xhr.open("HEAD", "https://www.google.com/favicon.ico?_=" + new Date().getTime(), true);
  xhr.timeout = 1500;

  xhr.onload = function () {
    callback(xhr.status >= 200 && xhr.status < 400);
  };
  xhr.onerror = function () { callback(false); };
  xhr.ontimeout = function () { callback(false); };

  try {
    xhr.send();
  } catch (e) {
    callback(false);
  }
}

function updateOnlineStatusUI() {
  const statusBadge = document.getElementById("status-badge");
  if (!statusBadge) return;

  checkRealOnlineStatus(function (isOnline) {
    const newText = isOnline ? "Online" : "Offline";
    const newClass = isOnline ? "status-badge online" : "status-badge offline";

    if (statusBadge.textContent !== newText) {
      statusBadge.style.transform = "scale(0.9)";
      setTimeout(() => {
        statusBadge.textContent = newText;
        statusBadge.className = newClass;
        statusBadge.style.transform = "scale(1)";
      }, 150);
    }
  });
}

// Global Sidebar Switch
window.toggleSidebar = function() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  if (sidebar) sidebar.classList.toggle("open");
  if (overlay) overlay.classList.toggle("active");
};

// Application Initialization
document.addEventListener("DOMContentLoaded", () => {
  updateOnlineStatusUI();
  updateQueueUI();
  setInterval(updateOnlineStatusUI, 4000);

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
