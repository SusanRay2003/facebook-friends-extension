// background.js
// This runs in the background, always ready to help

chrome.runtime.onInstalled.addListener(() => {
    console.log("Facebook Friends Reader installed!");
  });
  
  // You can add more background tasks here in the future
  // For now, Chrome storage handles the data passing