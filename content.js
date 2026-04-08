// content.js

const FIREBASE_PROJECT_ID = "facebook-friends-app";
const FIREBASE_API_KEY = "AIzaSyCUISVXs_jPa8tgvAVIOZvCcAYvmQxiaL4";

async function saveToFirebase(friends, userId) {
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

// ✅ This waits between each scroll
// so Facebook has time to load new friends!
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function autoScroll() {
  console.log("Starting auto scroll...");

  let previousFriendCount = 0;
  let noNewFriendsCount = 0;

  // Keep scrolling until no new friends load
  while (true) {
    // Scroll down by a small amount
    window.scrollBy({
      top: 600,
      behavior: 'smooth'
    });

    // Wait 1.5 seconds for Facebook to load new friends
    await sleep(1500);

    // Count how many friends are visible now
    const currentCount = countVisibleFriends();
    console.log("Friends visible so far:", currentCount);

    if (currentCount === previousFriendCount) {
      // No new friends loaded
      noNewFriendsCount++;
      console.log("No new friends, attempt:", noNewFriendsCount);

      if (noNewFriendsCount >= 4) {
        // Tried 4 times with no new friends = we're done!
        console.log("Scrolling complete!");
        break;
      }

      // Wait a bit longer and try again
      await sleep(2000);
    } else {
      // New friends loaded! Reset counter
      noNewFriendsCount = 0;
      previousFriendCount = currentCount;
    }
  }

  // Scroll back to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await sleep(1000);
}

function countVisibleFriends() {
  // Count friend names visible on page right now
  const seen = new Set();
  const spans = document.querySelectorAll('span[dir="auto"]');

  spans.forEach(span => {
    const name = span.innerText?.trim();
    if (
      name && name.length > 2 &&
      !/^\d/.test(name) &&
      !name.toLowerCase().includes("friend") &&
      !name.toLowerCase().includes("mutual") &&
      !name.toLowerCase().includes("facebook") &&
      span.closest('a')
    ) {
      seen.add(name);
    }
  });

  return seen.size;
}

function extractFriends() {
  const friends = [];
  const seen = new Set();

  // Method 1: Get names from span texts
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
      !name.toLowerCase().includes("search") &&
      link
    ) {
      seen.add(name);

      // Try to find avatar image near this name
      const img = link.querySelector('img') ||
                  link.closest('li')?.querySelector('img') ||
                  null;

      friends.push({
        name,
        profileUrl: link.href || "#",
        avatar: img?.src || null
      });
    }
  });

  // Method 2: Get from images with alt text (backup)
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

  return friends;
}

function getUserId() {
  const profileLink = document.querySelector('a[href*="facebook.com/"][aria-label]');
  if (profileLink) {
    const match = profileLink.href.match(/facebook\.com\/([^/?]+)/);
    if (match && match[1] !== 'friends') return match[1];
  }

  // Try from page URL
  const url = window.location.href;
  const match = url.match(/facebook\.com\/([^/?]+)/);
  if (match && match[1] !== 'friends') return match[1];

  return "user_" + Date.now();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getFriends") {
    // Tell popup we started
    sendResponse({ started: true });

    // Start the whole process
    (async () => {
      try {
        // Step 1: Auto scroll to load ALL friends
        chrome.runtime.sendMessage({
          action: "updateStatus",
          message: "📜 Auto-scrolling... please wait!"
        });

        await autoScroll();

        // Step 2: Extract all friends from page
        chrome.runtime.sendMessage({
          action: "updateStatus",
          message: "🔍 Collecting friends..."
        });

        const friends = extractFriends();
        const userId = getUserId();

        // Step 3: Save locally
        chrome.storage.local.set({ friends, userId });

        // Step 4: Save to Firebase
        chrome.runtime.sendMessage({
          action: "updateStatus",
          message: "☁️ Saving to cloud..."
        });

        await saveToFirebase(friends, userId);

        // Step 5: Done!
        chrome.runtime.sendMessage({
          action: "friendsDone",
          count: friends.length,
          userId: userId
        });

      } catch (err) {
        chrome.runtime.sendMessage({
          action: "friendsDone",
          count: 0,
          error: err.message
        });
      }
    })();

    return true;
  }
});