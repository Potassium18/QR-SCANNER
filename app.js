// Default Fallback Web App URL
const DEFAULT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxOFf12PGYT_TfXp_Tm9Z1aju79cPzpEWlugpboRJmZvWoRr62A_2L08NZzVLFbFZt4Rw/exec";

// Retrieve Active URL from local storage or set fallback
let ACTIVE_SCRIPT_URL = localStorage.getItem("active_script_url") || DEFAULT_SCRIPT_URL;

// ==========================================
// SIDEBAR TOGGLE LOGIC
// ==========================================
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  if (sidebar && overlay) {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("active");
  }
}
// ==========================================
// SCAN PROCESSING & DATA EXTRACTION
// ==========================================

async function handleNewScan(qrCodeMessage) {
  const now = new Date();
  const currentDate = now.toLocaleDateString();
  const currentTime = now.toLocaleTimeString();

  let name = "";
  let college = "N/A";
  let designation = "Member";

  const designationsList = [
    "Vice President",
    "Asst. Business Manager",
    "Asst. Team Leader",
    "Business Manager",
    "Undersecretary",
    "Media Committee Head",
    "Media Committee Graphic Artist",
    "Content Creator",
    "Team Leader",
    "Representative",
    "President",
    "Secretary",
    "Treasurer",
    "PIO"
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

  let remainingText = qrCodeMessage;

  // 1. Extract Designation
  for (const title of designationsList) {
    const regex = new RegExp(`\\b${title}\\b`, "i");
    if (regex.test(remainingText)) {
      designation = title;
      remainingText = remainingText.replace(regex, "").trim();
      break;
    }
  }

  // 2. Identify College Short Code
  for (const mapping of collegeMappings) {
    if (mapping.pattern.test(remainingText)) {
      college = mapping.code;
      break;
    }
  }

  // 3. Strip ALL college patterns from remaining text
  for (const mapping of collegeMappings) {
    remainingText = remainingText.replace(mapping.pattern, "");
  }
  remainingText = remainingText.replace(/College of [A-Za-z\s]+/gi, "");

  // 4. Clean remaining text for Name
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

  playScanPing();

  // STEP 2: Save to Notes under the "Scans" folder every single scan
  appendScanToNotes(scanData);

  //ONLINE STATUS
const isTrulyOnline = await checkRealOnlineStatus();

if (isTrulyOnline) {
  try {
    await fetch(ACTIVE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(scanData).toString()
    });
  } catch (error) {
    console.warn("Fetch failed despite online check, queuing locally.", error);
    saveToLocalStorage(scanData);
  }
} else {
  saveToLocalStorage(scanData);
}
}

function saveToLocalStorage(data) {
  let queue = JSON.parse(localStorage.getItem("offlineScanQueue")) || [];
  queue.push(data);
  localStorage.setItem("offlineScanQueue", JSON.stringify(queue));
  updateQueueUI();
}

function updateQueueUI() {
  const queue = JSON.parse(localStorage.getItem("offlineScanQueue")) || [];
  const countEl = document.getElementById("queue-count");
  const bannerEl = document.getElementById("queue-banner");

  if (countEl && bannerEl) {
    countEl.textContent = queue.length;
    if (queue.length > 0) {
      bannerEl.classList.remove("hidden");
    } else {
      bannerEl.classList.add("hidden");
    }
  }
}

// STEP 1: Helper function to record scan data into LocalStorage for Notes
function appendScanToNotes(scanData) {
  let notes = JSON.parse(localStorage.getItem("app_notes_list")) || [];
  const now = new Date();

  const titleText = typeof scanData === "object" && scanData.name ? scanData.name : "QR Scan Record";
  const bodyText = typeof scanData === "object" 
    ? `${scanData.name || 'N/A'} | ${scanData.college || 'N/A'} - ${scanData.designation || 'N/A'}`
    : String(scanData);

  const newScanNote = {
    id: Date.now(),
    title: `Scan: ${titleText}`,
    text: bodyText,
    folder: "ScanData",
    color: "#e8f5e9",
    pinned: false,
    date: `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  };

  notes.unshift(newScanNote);
  localStorage.setItem("app_notes_list", JSON.stringify(notes));
}

// Sync Offline Queue when back online
window.addEventListener("online", syncOfflineData);
async function syncOfflineData() {
  let queue = JSON.parse(localStorage.getItem("offlineScanQueue")) || [];
  if (queue.length === 0) return;

  try {
    await fetch(ACTIVE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ batchData: JSON.stringify(queue) }).toString()
    });
    localStorage.removeItem("offlineScanQueue");
    updateQueueUI();
  } catch (err) {
    console.error("Sync failed", err);
  }
}
// ==========================================
// SETTINGS & NOTES LOGIC
// ==========================================

function saveNotes() {
  const notes = document.getElementById("event-notes").value;
  localStorage.setItem("scanner_notes", notes);
  alert("Notes saved successfully!");
}

function saveAccountInfo() {
  const accountName = document.getElementById("account-name").value.trim();
  if (accountName) {
    localStorage.setItem("operator_account", accountName);
    alert("Account info saved!");
  }
}

function saveAndRenameUrl() {
  const label = document.getElementById("preset-name-input").value.trim();
  const url = document.getElementById("script-url-input").value.trim();

  if (!label || !url) {
    alert("Please enter both a label and a URL.");
    return;
  }

  let presets = JSON.parse(localStorage.getItem("script_url_presets")) || [];
  const existingIndex = presets.findIndex(p => p.label.toLowerCase() === label.toLowerCase());
  
  if (existingIndex > -1) {
    presets[existingIndex].url = url;
  } else {
    presets.push({ label: label, url: url });
  }

  localStorage.setItem("script_url_presets", JSON.stringify(presets));
  localStorage.setItem("active_script_url", url);
  ACTIVE_SCRIPT_URL = url;

  populatePresetDropdown();
  alert(`Preset "${label}" saved and activated!`);
}

function populatePresetDropdown() {
  const select = document.getElementById("url-presets");
  if (!select) return;

  const presets = JSON.parse(localStorage.getItem("script_url_presets")) || [];
  const currentActive = localStorage.getItem("active_script_url") || ACTIVE_SCRIPT_URL;

  select.innerHTML = '<option value="">-- Select a saved URL --</option>';

  presets.forEach(preset => {
    const option = document.createElement("option");
    option.value = preset.url;
    option.textContent = preset.label + (preset.url === currentActive ? " (Active)" : "");
    if (preset.url === currentActive) option.selected = true;
    select.appendChild(option);
  });
}

function loadSelectedPreset() {
  const select = document.getElementById("url-presets");
  if (!select) return;

  const selectedUrl = select.value;
  const presets = JSON.parse(localStorage.getItem("script_url_presets")) || [];

  if (selectedUrl) {
    const found = presets.find(p => p.url === selectedUrl);
    if (found) {
      document.getElementById("preset-name-input").value = found.label;
      document.getElementById("script-url-input").value = found.url;
      ACTIVE_SCRIPT_URL = found.url;
      localStorage.setItem("active_script_url", found.url);
      populatePresetDropdown();
    }
  }
}

function deleteSelectedPreset() {
  const select = document.getElementById("url-presets");
  if (!select || !select.value) {
    alert("Please select a preset to delete.");
    return;
  }

  let presets = JSON.parse(localStorage.getItem("script_url_presets")) || [];
  presets = presets.filter(p => p.url !== select.value);
  
  localStorage.setItem("script_url_presets", JSON.stringify(presets));
  document.getElementById("preset-name-input").value = "";
  document.getElementById("script-url-input").value = "";
  
  populatePresetDropdown();
  alert("Preset removed!");
}

function clearQueueData() {
  if (confirm("Clear all queued scans?")) {
    localStorage.removeItem("offlineScanQueue");
    updateQueueUI();
  }
}
// ==========================================
// CAMERA & DYNAMIC TRACKING SCANNER
// ==========================================
let videoStream = null;
let animationFrameId = null;
let isScanning = false;
let lastScannedText = "";
let lastScanTime = 0;

// Initialize Available Cameras
async function initScanner() {
  const cameraSelect = document.getElementById("camera-select");
  if (!cameraSelect) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach(track => track.stop());

    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');

    if (videoDevices.length > 0) {
      cameraSelect.innerHTML = "";
      videoDevices.forEach((device, index) => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent = device.label || `Camera ${index + 1}`;
        cameraSelect.appendChild(option);
      });
    } else {
      cameraSelect.innerHTML = '<option value="">No cameras found</option>';
    }
  } catch (err) {
    console.error("Error accessing camera permissions:", err);
    cameraSelect.innerHTML = '<option value="">Camera access denied</option>';
  }
}

// Start / Stop Scanner Lifecycle
async function toggleScanning() {
  const btn = document.getElementById("toggle-scan-btn");
  const cameraSelect = document.getElementById("camera-select");

  if (isScanning) {
    stopScanning();
    btn.textContent = "Start Scanning";
    btn.classList.remove("danger-btn");
    btn.classList.add("primary-btn");
  } else {
    if (!cameraSelect.value) {
      alert("Please select a valid camera.");
      return;
    }
    await startScanning(cameraSelect.value);
    btn.textContent = "Stop Scanning";
    btn.classList.remove("primary-btn");
    btn.classList.add("danger-btn");
  }
}

async function startScanning(deviceId) {
  const video = document.getElementById("webcam");
  const canvas = document.getElementById("tracker-canvas");
  if (!video || !canvas) return;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const hasNativeDetector = "BarcodeDetector" in window;
  const barcodeDetector = hasNativeDetector ? new BarcodeDetector({ formats: ["qr_code"] }) : null;

  const constraints = {
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 },
      advanced: [{ focusMode: "continuous" }]
    }
  };

  try {
    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = videoStream;

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      isScanning = true;
      detectAndDraw();
    };
  } catch (err) {
    console.error("Camera startup failed:", err);
    alert("Unable to access the camera stream.");
  }

  async function detectAndDraw() {
    if (!isScanning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (hasNativeDetector) {
      // 1. Native High-Speed Detector
      try {
        const barcodes = await barcodeDetector.detect(video);
        barcodes.forEach(barcode => drawAndProcess(barcode.topLeftCorner, barcode.topRightCorner, barcode.bottomRightCorner, barcode.bottomLeftCorner, barcode.rawValue));
      } catch (e) {
        console.error(e);
      }
    } else if (typeof jsQR !== "undefined") {
      // 2. JavaScript Fallback Detector for Untested Browsers
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
      
      ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear image frame after reading

      if (code) {
        drawAndProcess(code.location.topLeftCorner, code.location.topRightCorner, code.location.bottomRightCorner, code.location.bottomLeftCorner, code.data);
      }
    }

    animationFrameId = requestAnimationFrame(detectAndDraw);
  }

  function drawAndProcess(tl, tr, br, bl, textValue) {
    // Draw animated box following the QR code
    ctx.strokeStyle = "#00FF66";
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.stroke();

    // Prevent duplicate scans
    const now = Date.now();
    if (textValue !== lastScannedText || (now - lastScanTime) > 2000) {
      lastScannedText = textValue;
      lastScanTime = now;
      handleNewScan(textValue);
    }
  }
}

function stopScanning() {
  isScanning = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  const canvas = document.getElementById("tracker-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
// ==========================================
// PAGE INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  updateQueueUI();

  // Load scanner on index.html
  if (document.getElementById("webcam")) {
    initScanner();
  }

  // Load notes on notes.html
  const notesEl = document.getElementById("event-notes");
  if (notesEl) {
    notesEl.value = localStorage.getItem("scanner_notes") || "";
  }

  // Load settings on settings.html
  const accountEl = document.getElementById("account-name");
  if (accountEl) {
    accountEl.value = localStorage.getItem("operator_account") || "";
    document.getElementById("script-url-input").value = ACTIVE_SCRIPT_URL;
    populatePresetDropdown();
  }
});


// Call this function right when a QR code is successfully scanned
function appendScanToNotes(scanData) {
  try {
    let notes = JSON.parse(localStorage.getItem("app_notes_list")) || [];
    const now = new Date();

    const titleText = (typeof scanData === "object" && scanData && scanData.name) 
      ? scanData.name 
      : "QR Scan Record";

    const bodyText = (typeof scanData === "object" && scanData)
      ? `${scanData.name || 'N/A'} | ${scanData.college || 'N/A'} - ${scanData.designation || 'N/A'}`
      : String(scanData);

    const newScanNote = {
      id: Date.now(),
      title: `Scan: ${titleText}`,
      text: bodyText,
      folder: "Scanned Data",
      color: "#e8f5e9",
      pinned: false,
      date: `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    };

    notes.unshift(newScanNote);
    localStorage.setItem("app_notes_list", JSON.stringify(notes));
  } catch (err) {
    console.error("Error saving scan to notes:", err);
  }
}


// Plays a soft 2-tone digital notification ping (Ding-Dong)
function playScanPing() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();

    // Helper tone generator
    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      // Smooth decay envelope for a pleasant chime effect
      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Tone 1 (High chime) - E6 note (1318.5 Hz)
    playTone(1318.51, now, 0.12);
    // Tone 2 (Notification ping) - G#6 note (1567.98 Hz)
    playTone(1567.98, now + 0.08, 0.2);

  } catch (err) {
    console.error("Audio play failed:", err);
  }
}

// Reliable network status test using image ping with a 3-second timeout
function checkRealOnlineStatus() {
  return new Promise((resolve) => {
    // 1. Quick browser check
    if (!navigator.onLine) {
      return resolve(false);
    }

    // 2. Ping an image endpoint (bypasses CORS restrictions completely)
    const img = new Image();
    let completed = false;

    const timeout = setTimeout(() => {
      if (!completed) {
        completed = true;
        img.src = ""; // Cancel load
        resolve(false); // Timed out -> Offline
      }
    }, 3000);

    img.onload = () => {
      if (!completed) {
        completed = true;
        clearTimeout(timeout);
        resolve(true); // Successfully loaded -> Online
      }
    };

    img.onerror = () => {
      if (!completed) {
        completed = true;
        clearTimeout(timeout);
        resolve(false); // Network error -> Offline
      }
    };

    // Lightweight icon with cache buster
    img.src = "https://www.google.com/favicon.ico?" + Date.now();
  });
}

// UI Status Badge Updater
async function updateOnlineStatusUI() {
  const statusBadge = document.getElementById("status-badge");
  if (!statusBadge) return;

  const isOnline = await checkRealOnlineStatus();

  if (isOnline) {
    statusBadge.textContent = "Online";
    statusBadge.className = "status-badge online";
  } else {
    statusBadge.textContent = "Offline";
    statusBadge.className = "status-badge offline";
  }
}

// Event Listeners for Automatic Switching
window.addEventListener("online", updateOnlineStatusUI);
window.addEventListener("offline", updateOnlineStatusUI);

document.addEventListener("DOMContentLoaded", () => {
  updateOnlineStatusUI();
  // Periodically verify connection every 8 seconds
  setInterval(updateOnlineStatusUI, 8000);
});

// Register Service Worker for PWA Offline Support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker Registered successfully:', reg.scope))
      .catch((err) => console.error('Service Worker Registration failed:', err));
  });
}