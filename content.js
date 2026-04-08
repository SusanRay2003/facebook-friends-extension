// content.js

const FIREBASE_PROJECT_ID = "facebook-friends-app";
const FIREBASE_API_KEY = "AIzaSyCUISVXs_jPa8tgvAVIOZvCcAYvmQxiaL4";

async function saveToFirebase(friends, userId) {
  // Each user gets their OWN document using their Facebook username!
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/friendslists/${userId}?key=${FIREBASE_API_KEY}`;

  const fields = {};
  friends.forEach((f, i) => {
    fields[`friend_${i}`] = {
      mapValue: {
        fields: {
          name: { stringValue: f.name || "" },
          profileUrl: { stringValue: f.profileUrl || "" },
          avatar: { stringValue: f.avatar || "" }
        }
      }
    };
  });

  fields["total"] = { integerValue: friends.length };
  fields["updatedAt"] = { stringValue: new Date().toISOString() };

  await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields })
  });
}

function extractFriends() {
  const friends = [];
  const seen = new Set();

  const allImages = document.querySelectorAll('img[alt]');
  allImages.forEach(img => {
    const name = img.getAttribute('alt')?.trim();
    const link = img.closest('a');
    if (
      name && name.length > 2 &&
      !seen.has(name) &&
      name !== "Facebook" &&
      !name.toLowerCase().includes("cover") &&
      !name.toLowerCase().includes("profile picture") &&
      !name.toLowerCase().includes("image") &&
      link
    ) {
      seen.add(name);
      friends.push({
        name,
        profileUrl: link.href || "#",
        avatar: img.src || null
      });
    }
  });

  const spans = document.querySelectorAll('span[dir="auto"]');
  spans.forEach(span => {
    const name = span.innerText?.trim();
    const link = span.closest('a');
    if (
      name && name.length > 2 &&
      !seen.has(name) &&
      !/^\d/.test(name) &&
      !name.toLowerCase().includes("friend") &&
      !name.toLowerCase().includes("mutual") &&
      !name.toLowerCase().includes("facebook") &&
      link
    ) {
      seen.add(name);
      friends.push({
        name,
        profileUrl: link.href || "#",
        avatar: null
      });
    }
  });

  return friends;
}

function autoScroll() {
  return new Promise((resolve) => {
    let lastHeight = 0;
    let tries = 0;

    const timer = setInterval(() => {
      window.scrollBy(0, 800);
      const newHeight = document.body.scrollHeight;

      if (newHeight === lastHeight) {
        tries++;
        if (tries >= 3) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      } else {
        tries = 0;
        lastHeight = newHeight;
      }
    }, 800);
  });
}

// Get Facebook username from the URL or page
function getUserId() {
  // Try to get from profile link
  const profileLink = document.querySelector('a[href*="facebook.com/"][aria-label]');
  if (profileLink) {
    const href = profileLink.href;
    const match = href.match(/facebook\.com\/([^/?]+)/);
    if (match) return match[1];
  }
  // Fallback: use timestamp as unique id
  return "user_" + Date.now();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getFriends") {
    sendResponse({ started: true });

    autoScroll().then(async () => {
      const friends = extractFriends();
      const userId = getUserId();

      // Save userId so popup can build the link
      chrome.storage.local.set({ friends, userId });

      try {
        await saveToFirebase(friends, userId);
        chrome.runtime.sendMessage({
          action: "friendsDone",
          count: friends.length,
          userId: userId
        });
      } catch (e) {
        chrome.runtime.sendMessage({
          action: "friendsDone",
          count: friends.length,
          userId: userId,
          error: "Firebase save failed"
        });
      }
    });

    return true;
  }
});