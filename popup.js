// popup.js
document.getElementById("readBtn").addEventListener("click", async () => {
    const statusEl = document.getElementById("status");
    statusEl.textContent = "⏳ Reading friends...";
  
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
    if (!tab.url.includes("facebook.com")) {
      statusEl.textContent = "❌ Please open Facebook first!";
      return;
    }
  
    chrome.tabs.sendMessage(tab.id, { action: "getFriends" }, (response) => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = "❌ Error: Refresh Facebook & try again.";
        return;
      }
      if (response && response.success) {
        statusEl.textContent = `✅ Found ${response.count} friends! Now click Open Friends App.`;
      } else {
        statusEl.textContent = "⚠️ 0 friends. Scroll down on Facebook first!";
      }
    });
  });
  
  document.getElementById("openBtn").addEventListener("click", () => {
    // Open the BUILT React app from inside the extension (not localhost!)
    const url = chrome.runtime.getURL("index.html");
    chrome.tabs.create({ url: url });
  });