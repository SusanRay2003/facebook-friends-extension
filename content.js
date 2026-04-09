// content.js

const FIREBASE_PROJECT_ID = "facebook-friends-app";
const FIREBASE_API_KEY = "AIzaSyCUISVXs_jPa8tgvAVIOZvCcAYvmQxiaL4";

let allFriends = new Map();

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

function getUserId() {
  const links = document.querySelectorAll('a[href*="facebook.com/"]');
  for (let link of links) {
    const match = link.href.match(/facebook\.com\/([^/?]+)/);
    if (match && match[1] !== 'friends' && match[1] !== 'list') {
      return match[1];
    }
  }
  return "user_" + Date.now();
}

// ✅ Get Facebook's internal token from cookies
function getFacebookToken() {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === 'c_user') return value; // Facebook user ID
  }
  return null;
}

// ✅ Get DTSGToken - Facebook's internal security token
function getDTSGToken() {
  const scripts = document.querySelectorAll('script');
  for (let script of scripts) {
    const match = script.innerText.match(/"dtsg":{"token":"([^"]+)"/);
    if (match) return match[1];
  }
  // Try another pattern
  const metaTag = document.querySelector('input[name="fb_dtsg"]');
  if (metaTag) return metaTag.value;
  return null;
}

// ✅ Fetch ALL friends using Facebook's internal GraphQL API
async function fetchAllFriendsFromAPI() {
  const userId = getFacebookToken();
  const dtsg = getDTSGToken();

  if (!userId || !dtsg) {
    // Fallback to DOM scraping if tokens not found
    return null;
  }

  let allFetchedFriends = [];
  let cursor = null;
  let hasMore = true;
  let page = 0;

  while (hasMore) {
    page++;

    chrome.runtime.sendMessage({
      action: "updateStatus",
      message: `📥 Loading page ${page} of friends...`
    });

    // Facebook's internal friends API
    const variables = {
      count: 30, // fetch 30 at a time
      cursor: cursor,
      scale: 1,
      search: null
    };

    const formData = new FormData();
    formData.append('fb_dtsg', dtsg);
    formData.append('variables', JSON.stringify(variables));
    formData.append('doc_id', '884987748570211'); // Facebook's internal friends query ID

    try {
      const response = await fetch('https://www.facebook.com/api/graphql/', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const text = await response.text();

      // Parse the response
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        // Sometimes Facebook returns multiple JSON objects
        const firstLine = text.split('\n')[0];
        data = JSON.parse(firstLine);
      }

      // Extract friends from response
      const edges = data?.data?.viewer?.all_friends?.edges ||
                    data?.data?.node?.all_friends?.edges || [];

      if (edges.length === 0) {
        hasMore = false;
        break;
      }

      edges.forEach(edge => {
        const node = edge.node;
        if (node && node.name) {
          allFetchedFriends.push({
            name: node.name,
            profileUrl: `https://www.facebook.com/${node.username || node.id}`,
            avatar: node.profile_picture?.uri || null
          });
        }
      });

      // Get next page cursor
      const pageInfo = data?.data?.viewer?.all_friends?.page_info ||
                       data?.data?.node?.all_friends?.page_info;

      if (pageInfo?.has_next_page && pageInfo?.end_cursor) {
        cursor = pageInfo.end_cursor;
      } else {
        hasMore = false;
      }

      // Small delay between requests
      await new Promise(r => setTimeout(r, 1000));

    } catch (err) {
      console.log("API fetch failed:", err);
      hasMore = false;
    }
  }

  return allFetchedFriends.length > 0 ? allFetchedFriends : null;
}

// ✅ Fallback — DOM scraping with MutationObserver + forced scroll
async function fetchFriendsFromDOM() {
  return new Promise((resolve) => {
    const friends = new Map();

    function scan() {
      document.querySelectorAll('span[dir="auto"]').forEach(span => {
        const name = span.innerText?.trim();
        const link = span.closest('a');
        if (
          name && name.length > 2 && name.length < 60 &&
          !friends.has(name) &&
          !/^\d/.test(name) &&
          !name.toLowerCase().includes("friend") &&
          !name.toLowerCase().includes("mutual") &&
          !name.toLowerCase().includes("facebook") &&
          link?.href.includes("facebook.com")
        ) {
          const img = link.querySelector('img') ||
                      link.closest('li')?.querySelector('img');
          friends.set(name, {
            name,
            profileUrl: link.href,
            avatar: img?.src || null
          });
        }
      });
    }

    // Watch for new content
    const observer = new MutationObserver(() => {
      scan();
      chrome.runtime.sendMessage({
        action: "liveCount",
        count: friends.size
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    scan();

    let lastCount = 0;
    let noChangeCount = 0;

    // Scroll using multiple techniques at once
    const scrollInterval = setInterval(() => {
      // Technique 1: scrollBy
      window.scrollBy(0, 500);

      // Technique 2: scrollTop
      document.documentElement.scrollTop += 500;

      // Technique 3: wheel event
      window.dispatchEvent(new WheelEvent('wheel', {
        deltaY: 500,
        bubbles: true
      }));

      // Technique 4: key event (like pressing Page Down)
      document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'PageDown',
        code: 'PageDown',
        keyCode: 34,
        bubbles: true
      }));

      scan();

      const currentCount = friends.size;
      chrome.runtime.sendMessage({
        action: "liveCount",
        count: currentCount
      });

      if (currentCount === lastCount) {
        noChangeCount++;
        if (noChangeCount >= 8) {
          clearInterval(scrollInterval);
          observer.disconnect();
          window.scrollTo(0, 0);
          resolve(Array.from(friends.values()));
        }
      } else {
        noChangeCount = 0;
        lastCount = currentCount;
      }
    }, 1200);
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getFriends") {
    sendResponse({ started: true });
    allFriends.clear();

    (async () => {
      try {
        chrome.runtime.sendMessage({
          action: "updateStatus",
          message: "🔑 Trying Facebook API..."
        });

        // Try API first
        let friends = await fetchAllFriendsFromAPI();

        if (!friends) {
          // Fallback to DOM
          chrome.runtime.sendMessage({
            action: "updateStatus",
            message: "📜 Scrolling page to load friends..."
          });
          friends = await fetchFriendsFromDOM();
        }

        const userId = getUserId();

        chrome.runtime.sendMessage({
          action: "updateStatus",
          message: `☁️ Saving ${friends.length} friends to cloud...`
        });

        chrome.storage.local.set({ friends, userId });
        await saveToFirebase(friends, userId);

        chrome.runtime.sendMessage({
          action: "friendsDone",
          count: friends.length,
          userId
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