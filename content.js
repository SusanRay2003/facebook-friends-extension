// content.js

const FIREBASE_PROJECT_ID = "facebook-friends-app";
const FIREBASE_API_KEY = "AIzaSyCUISVXs_jPa8tgvAVIOZvCcAYvmQxiaL4";

// ------------------ FIREBASE SAVE ------------------
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

// ------------------ USER ID ------------------
function getUserId() {
  const links = document.querySelectorAll('a[href*="facebook.com/"]');
  for (let link of links) {
    const match = link.href.match(/facebook\.com\/([^/?]+)/);
    if (match && match[1] !== 'friends' && match[1] !== 'profile.php') {
      return match[1];
    }
  }
  return "user_" + Date.now();
}

// ------------------ TOKENS ------------------
function getFacebookToken() {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === 'c_user') return value;
  }
  return null;
}

function getDTSGToken() {
  const input = document.querySelector('input[name="fb_dtsg"]');
  if (input) return input.value;

  const scripts = document.querySelectorAll('script');
  for (let script of scripts) {
    const match = script.innerText.match(/"dtsg":{"token":"([^"]+)"/);
    if (match) return match[1];
  }
  return null;
}

// ------------------ GRAPHQL FETCH ------------------
async function fetchAllFriendsFromAPI() {
  const userId = getFacebookToken();
  const dtsg = getDTSGToken();

  if (!userId || !dtsg) return null;

  let allFriends = [];
  let cursor = null;
  let hasNextPage = true;

  const docIds = [
    "8752443744796374",
    "884987748570211",
    "9725600514167082"
  ];

  let attempt = 0;

  while (hasNextPage && attempt < 50) {
    attempt++;

    chrome.runtime.sendMessage({
      action: "updateStatus",
      message: `📥 Fetching friends batch ${attempt}...`
    });

    const variables = {
      count: 50,
      cursor: cursor,
      scale: 1
    };

    const formData = new FormData();
    formData.append("fb_dtsg", dtsg);
    formData.append("variables", JSON.stringify(variables));

    let success = false;

    for (let doc_id of docIds) {
      formData.set("doc_id", doc_id);

      try {
        const res = await fetch("https://www.facebook.com/api/graphql/", {
          method: "POST",
          body: formData,
          credentials: "include"
        });

        const text = await res.text();
        const json = JSON.parse(text.split("\n")[0]);

        const edges =
          json?.data?.viewer?.all_friends?.edges ||
          json?.data?.node?.all_friends?.edges;

        if (!edges || edges.length === 0) continue;

        edges.forEach(edge => {
          const node = edge.node;
          if (node?.name) {
            allFriends.push({
              name: node.name,
              profileUrl: `https://www.facebook.com/${node.username || node.id}`,
              avatar: node.profile_picture?.uri || null
            });
          }
        });

        const pageInfo =
          json?.data?.viewer?.all_friends?.page_info ||
          json?.data?.node?.all_friends?.page_info;

        if (pageInfo?.has_next_page) {
          cursor = pageInfo.end_cursor;
        } else {
          hasNextPage = false;
        }

        success = true;
        break;

      } catch (err) {
        console.log("doc_id failed:", doc_id);
      }
    }

    if (!success) {
      console.log("GraphQL failed, switching to DOM...");
      break;
    }

    await new Promise(r => setTimeout(r, 1200));
  }

  return allFriends.length ? allFriends : null;
}

// ------------------ DOM FALLBACK ------------------
async function fetchFriendsFromDOM() {
  return new Promise((resolve) => {
    const friends = new Map();

    function collect() {
      document.querySelectorAll('a[href*="facebook.com"]').forEach(link => {
        const name = link.innerText?.trim();

        if (
          name &&
          name.length > 2 &&
          name.length < 60 &&
          !friends.has(link.href)
        ) {
          const img = link.querySelector("img");

          friends.set(link.href, {
            name,
            profileUrl: link.href,
            avatar: img?.src || null
          });
        }
      });
    }

    const observer = new MutationObserver(() => {
      collect();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    let lastCount = 0;
    let stableRounds = 0;

    const interval = setInterval(() => {
      const container =
        document.querySelector('[role="main"]') ||
        document.scrollingElement;

      container.scrollTop = container.scrollHeight;

      collect();

      const current = friends.size;

      chrome.runtime.sendMessage({
        action: "liveCount",
        count: current
      });

      if (current === lastCount) {
        stableRounds++;
        if (stableRounds > 10) {
          clearInterval(interval);
          observer.disconnect();
          resolve(Array.from(friends.values()));
        }
      } else {
        stableRounds = 0;
        lastCount = current;
      }
    }, 1500);
  });
}

// ------------------ MAIN LISTENER ------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getFriends") {
    sendResponse({ started: true });

    (async () => {
      try {
        chrome.runtime.sendMessage({
          action: "updateStatus",
          message: "🔑 Trying Facebook API..."
        });

        let friends = await fetchAllFriendsFromAPI();

        if (!friends) {
          chrome.runtime.sendMessage({
            action: "updateStatus",
            message: "📜 Falling back to smart scrolling..."
          });

          friends = await fetchFriendsFromDOM();
        }

        const userId = getUserId();

        chrome.runtime.sendMessage({
          action: "updateStatus",
          message: `☁️ Saving ${friends.length} friends...`
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