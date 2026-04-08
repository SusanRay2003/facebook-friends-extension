// content.js
function extractFriends() {
    const friends = [];
    const seen = new Set();
  
    // Facebook renders friend names as text inside specific list containers
    // We look for all elements that have an image with a non-empty alt (= person's name)
    const allImages = document.querySelectorAll('image, img[alt]');
  
    allImages.forEach(img => {
      const name = img.getAttribute('alt')?.trim();
      const link = img.closest('a');
  
      if (
        name &&
        name.length > 2 &&
        !seen.has(name) &&
        name !== "Facebook" &&
        !name.toLowerCase().includes("cover") &&
        !name.toLowerCase().includes("profile picture") &&
        !name.toLowerCase().includes("image") &&
        link
      ) {
        seen.add(name);
        friends.push({
          name: name,
          profileUrl: link.href || "#",
          avatar: img.src || null
        });
      }
    });
  
    // ALSO try grabbing from span text inside friend list rows
    const spans = document.querySelectorAll('span[dir="auto"]');
    spans.forEach(span => {
      const name = span.innerText?.trim();
      const link = span.closest('a');
  
      if (
        name &&
        name.length > 2 &&
        !seen.has(name) &&
        !/^\d/.test(name) &&                        // skip things like "21 friends"
        !name.toLowerCase().includes("friend") &&
        !name.toLowerCase().includes("mutual") &&
        !name.toLowerCase().includes("facebook") &&
        link
      ) {
        seen.add(name);
        friends.push({
          name: name,
          profileUrl: link.href || "#",
          avatar: null
        });
      }
    });
  
    return friends;
  }
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getFriends") {
      const friends = extractFriends();
      chrome.storage.local.set({ friends: friends }, () => {
        sendResponse({ success: true, count: friends.length });
      });
      return true;
    }
  });