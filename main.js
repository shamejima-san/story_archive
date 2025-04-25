const storyList = document.getElementById("storyList");
const storyForm = document.getElementById("storyForm");
const storyDetail = document.getElementById("storyDetail");
const tagFilter = document.getElementById("tagFilter");
const secretToggle = document.getElementById("secretToggle");

const NOTION_API_TOKEN = "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"; // あなたのNotionのIntegrationトークン
const NOTION_DATABASE_ID = "1e04fe9c77ff8014a74ef26d550b8c44";
const NOTION_API_URL = "https://api.notion.com/v1/pages";
const NOTION_VERSION = "2022-06-28"; // Notion APIのバージョン

let editingStoryId = null;
let currentFilter = null;
let showSecret = false;
let sortOrder = "desc"; // 新しい順（デフォルト）
let currentView = "list"; // "list" or "timeline"

// --- イベント系 ---

document.getElementById("newStoryBtn").addEventListener("click", () => {
  storyForm.classList.remove("hidden");
  storyDetail.classList.add("hidden");
  storyList.classList.add("hidden");
  editingStoryId = null;
  document.getElementById("titleInput").value = "";
  document.getElementById("contentInput").value = "";
  document.getElementById("tagsInput").value = "";
});

document.getElementById("cancelBtn").addEventListener("click", () => {
  storyForm.classList.add("hidden");
  storyList.classList.remove("hidden");
});

document.getElementById("saveBtn").addEventListener("click", () => {
  const title = document.getElementById("titleInput").value.trim();
  const content = document.getElementById("contentInput").value.trim();
  const tags = document.getElementById("tagsInput").value
    .split(/[,\s]+/)
    .map(t => t.trim())
    .filter(Boolean);

  if (!title || !content) return alert("タイトルと本文は必須です");

  let stories = JSON.parse(localStorage.getItem("stories") || "[]");

  if (editingStoryId) {
    const index = stories.findIndex(s => s.id === editingStoryId);
    if (index !== -1) {
      stories[index].title = title;
      stories[index].content = content;
      stories[index].tags = tags;
    }
  } else {
    stories.unshift({
      id: crypto.randomUUID(),
      title,
      content,
      tags,
      favorite: false,
      createdAt: new Date().toISOString()
    });
  }

  localStorage.setItem("stories", JSON.stringify(stories));
  if (!editingStoryId) {
    saveToNotion({ title, content, tags });
  }  

  editingStoryId = null;
  storyForm.classList.add("hidden");
  storyList.classList.remove("hidden");
  renderStories(currentFilter);
});

// --- ストーリー描画系 ---

function formatContent(content) {
  const match = content.match(/^CP:(.+)/);
  if (match) {
    return `<strong>${match[1].replace(/\n/g, "<br>")}</strong>`;
  }
  return content.replace(/\n/g, "<br>");
}

function renderStories(filterTag = null) {
  let stories = JSON.parse(localStorage.getItem("stories") || "[]");
  currentFilter = filterTag;

  if (showSecret) {
    stories = stories.filter(s => s.tags.includes("secret"));
  } else {
    stories = stories.filter(s => !s.tags.includes("secret"));
  }

  if (filterTag === "#favorites") {
    stories = stories.filter(s => s.favorite);
  } else if (filterTag && filterTag !== "#favorites") {
    stories = stories.filter(s => s.tags.includes(filterTag));
  }

  stories.sort((a, b) => {
    const timeA = new Date(a.createdAt);
    const timeB = new Date(b.createdAt);
    return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
  });

  renderTagList(JSON.parse(localStorage.getItem("stories") || "[]"));

  const sortBtn = document.getElementById("sortToggleBtn");
  if (sortBtn) {
    sortBtn.innerHTML = sortOrder === "desc" ? '<i class="fa-solid fa-arrow-down"></i><span> 新順</span>' : '<i class="fa-solid fa-arrow-up"></i><span> 古順</span>';
  }

  storyList.innerHTML = "";

  stories.forEach(story => {
    const card = document.createElement("div");
    card.className = "story-card";

    const favIcon = story.favorite
      ? '<i class="fa-solid fa-star"></i>'
      : '<i class="fa-regular fa-star"></i>';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3>${story.title}</h3>
        <span class="fav-icon ${story.favorite ? 'active' : ''}">${favIcon}</span>
      </div>
      <div>${story.tags.map(tag => `<span class="tag">${tag}</span>`).join("")}</div>
    `;

    card.addEventListener("click", () => showDetail(story));
    storyList.appendChild(card);
  });
}

// --- タグリスト描画 ---
function renderTagList(stories) {
  const allTags = new Set();
  stories.forEach(story => story.tags.forEach(tag => allTags.add(tag)));

  tagFilter.innerHTML = `
    <button onclick="renderStories()" class="tag-button">すべて表示</button>
    <button onclick="renderStories('#favorites')" class="tag-button"><i class="fa-solid fa-star"></i> お気に入り</button>
  `;

  const cpTags = [...allTags].filter(tag => tag.startsWith("CP:")).sort();
  const normalTags = [...allTags].filter(tag => !tag.startsWith("CP:") && tag !== "secret").sort();

  if (cpTags.length > 0) {
    const cpGroup = document.createElement("div");
    cpGroup.innerHTML = `<div class="tag-group-title">CP</div>`;
    cpTags.forEach(tag => {
      const btn = document.createElement("button");
      const cpName = tag.replace(/^CP:/, "");
      btn.innerHTML = `<strong>#${cpName}</strong>`;
      btn.className = "tag-button";
      btn.onclick = () => renderStories(tag);
      cpGroup.appendChild(btn);
    });
    tagFilter.appendChild(cpGroup);
  }

  if (normalTags.length > 0) {
    const otherGroup = document.createElement("div");
    otherGroup.innerHTML = `<div class="tag-group-title">タグ</div>`;
    normalTags.forEach(tag => {
      const btn = document.createElement("button");
      btn.textContent = `#${tag}`;
      btn.className = "tag-button";
      btn.onclick = () => renderStories(tag);
      otherGroup.appendChild(btn);
    });
    tagFilter.appendChild(otherGroup);
  }
}

// --- 詳細表示 ---

function showDetail(story) {
  storyDetail.classList.remove("hidden");
  storyList.classList.add("hidden");
  storyForm.classList.add("hidden");

  const favBtnLabel = story.favorite
    ? '<i class="fa-solid fa-star"></i> お気に入り解除'
    : '<i class="fa-regular fa-star"></i> お気に入り登録';

  storyDetail.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h2>${story.title}</h2>
      <button onclick="backToList()"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div>${story.tags.map(tag => `<span class="tag">${tag}</span>`).join("")}</div>
    <p style="white-space: pre-wrap;">${formatContent(story.content)}</p>
    <button onclick="toggleFavorite('${story.id}')">${favBtnLabel}</button>
    <button onclick="editStory('${story.id}')"><i class="fa-solid fa-pencil"></i> 編集</button>
    <button onclick="deleteStory('${story.id}')"><i class="fa-solid fa-trash"></i> 削除</button>
    <button onclick="backToList()"><i class="fa-solid fa-arrow-left"></i> 戻る</button>
  `;
}

function backToList() {
  storyDetail.classList.add("hidden");
  storyList.classList.remove("hidden");
  if (currentView === "list") {
    renderStories(currentFilter);
  } else {
    renderTimelineView(currentFilter);
  }
}

// --- 編集・削除・お気に入り ---

function toggleFavorite(id) {
  const stories = JSON.parse(localStorage.getItem("stories") || "[]");
  const idx = stories.findIndex(s => s.id === id);
  if (idx !== -1) {
    stories[idx].favorite = !stories[idx].favorite;
    localStorage.setItem("stories", JSON.stringify(stories));
    showDetail(stories[idx]);
  }
}

function deleteStory(id) {
  if (!confirm("このストーリーを削除しますか？")) return;
  let stories = JSON.parse(localStorage.getItem("stories") || "[]");
  stories = stories.filter(story => story.id !== id);
  localStorage.setItem("stories", JSON.stringify(stories));
  backToList();
}

function editStory(id) {
  const stories = JSON.parse(localStorage.getItem("stories") || "[]");
  const story = stories.find(s => s.id === id);
  if (!story) return;

  editingStoryId = story.id;
  document.getElementById("titleInput").value = story.title;
  document.getElementById("contentInput").value = story.content;
  document.getElementById("tagsInput").value = story.tags.join(", ");

  storyDetail.classList.add("hidden");
  storyForm.classList.remove("hidden");
}

// --- シークレット切替 ---

secretToggle.addEventListener("click", () => {
  showSecret = !showSecret;
  secretToggle.innerHTML = showSecret
    ? '<i class="fa-solid fa-book"></i>'
    : '<i class="fa-solid fa-book-open"></i>';
  if (currentView === "list") {
    renderStories(currentFilter);
  } else {
    renderTimelineView(currentFilter);
  }
});

// --- ソート切替 ---

function toggleSortOrder() {
  sortOrder = (sortOrder === "desc") ? "asc" : "desc";
  if (currentView === "list") {
    renderStories(currentFilter);
  } else {
    renderTimelineView(currentFilter);
  }
}

// --- 年月日グループの年表表示 ---

function renderTimelineView(filterTag = null) {
  const stories = JSON.parse(localStorage.getItem("stories") || "[]");
  const groupedByDate = {};

  stories.forEach(story => {
    if (showSecret) {
      if (!story.tags.includes("secret")) return;
    } else {
      if (story.tags.includes("secret")) return;
    }

    if (filterTag && !story.tags.includes(filterTag)) return;

    const dateKey = new Date(story.createdAt).toISOString().slice(0, 10);
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(story);
  });

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => {
    return sortOrder === "desc" ? b.localeCompare(a) : a.localeCompare(b);
  });

  storyList.innerHTML = "";
  storyList.classList.remove("hidden");
  storyDetail.classList.add("hidden");
  storyForm.classList.add("hidden");

  sortedDates.forEach(date => {
    const section = document.createElement("section");
    section.innerHTML = `<h2 style="margin-top: 2rem;"><i class="fa-solid fa-calendar-days"></i> ${date}</h2>`;

    groupedByDate[date].sort((a, b) => {
      const timeA = new Date(a.createdAt);
      const timeB = new Date(b.createdAt);
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });

    groupedByDate[date].forEach(story => {
      const card = document.createElement("div");
      card.className = "story-card";

      const favIcon = story.favorite
        ? '<i class="fa-solid fa-star"></i>'
        : '<i class="fa-regular fa-star"></i>';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3>${story.title}</h3>
          <span class="fav-icon ${story.favorite ? 'active' : ''}">${favIcon}</span>
        </div>
        <div>${story.tags.map(tag => `<span class="tag">${tag}</span>`).join("")}</div>
      `;

      card.addEventListener("click", () => showDetail(story));
      section.appendChild(card);
    });

    storyList.appendChild(section);
  });
}

// --- ビュー切替 ---

function toggleViewMode() {
  currentView = (currentView === "list") ? "timeline" : "list";
  const viewBtn = document.getElementById("viewModeBtn");
  viewBtn.innerHTML = currentView === "list" ? '<i class="fa-solid fa-calendar-days"></i><span> 年表モード</span>' : '<i class="fa-solid fa-list"></i><span> 通常モード</span>';

  if (currentView === "list") {
    renderStories(currentFilter);
  } else {
    renderTimelineView(currentFilter);
  }
}



// Notion API

async function saveToNotion({ title, content, tags }) {
  const response = await fetch(NOTION_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NOTION_API_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION
    },
    body: JSON.stringify({
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        Name: {
          title: [{ text: { content: title } }]
        },
        Tags: {
          multi_select: tags.map(tag => ({ name: tag }))
        },
        Content: {
          rich_text: [{ text: { content } }]
        },
        Created: {
          date: { start: new Date().toISOString() }
        }
      }
    })
  });

  if (!response.ok) {
    console.error("Notionへの保存に失敗:", await response.text());
  }
}

async function fetchNotionStories() {
  const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NOTION_API_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION
    }
  });

  const data = await response.json();
  const stories = data.results.map(page => ({
    id: page.id,
    title: page.properties.Name.title[0]?.text?.content || "無題",
    content: page.properties.Content.rich_text[0]?.text?.content || "",
    tags: (page.properties.Tags.multi_select || []).map(t => t.name),
    favorite: false,
    createdAt: page.properties.Created?.date?.start || new Date().toISOString()
  }));

  localStorage.setItem("stories", JSON.stringify(stories));
  renderStories(currentFilter);
}



// async function saveToNotion(story) {
//   const res = await fetch("https://api.notion.com/v1/pages", {
//     method: "POST",
//     headers: {
//       "Authorization": `Bearer ${NOTION_TOKEN}`,
//       "Content-Type": "application/json",
//       "Notion-Version": "2022-06-28" // 最新のAPIバージョン
//     },
//     body: JSON.stringify({
//       parent: { database_id: DATABASE_ID },
//       properties: {
//         "タイトル": {
//           title: [
//             {
//               text: {
//                 content: story.title
//               }
//             }
//           ]
//         },
//         "本文": {
//           rich_text: [
//             {
//               text: {
//                 content: story.content
//               }
//             }
//           ]
//         },
//         "タグ": {
//           multi_select: story.tags.map(tag => ({ name: tag }))
//         },
//         "お気に入り": {
//           checkbox: story.favorite || false
//         },
//         "投稿日時": {
//           date: {
//             start: story.createdAt || new Date().toISOString()
//           }
//         },
//         "UUID": {
//           rich_text: [
//             {
//               text: { content: story.id }
//             }
//           ]
//         }
//       }
//     })
//   });

//   if (!res.ok) {
//     const err = await res.json();
//     console.error("Notionへの保存に失敗", err);
//     throw new Error("保存失敗");
//   } else {
//     console.log("Notionに保存成功！");
//   }
// }

// async function fetchStoriesFromNotion() {
//   const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
//     method: "POST",
//     headers: {
//       "Authorization": `Bearer ${NOTION_TOKEN}`,
//       "Content-Type": "application/json",
//       "Notion-Version": "2022-06-28"
//     }
//   });

//   const data = await res.json();
//   const stories = data.results.map(page => {
//     const props = page.properties;
//     return {
//       id: props.UUID.rich_text[0]?.text.content,
//       title: props["タイトル"].title[0]?.text.content || "無題",
//       content: props["本文"].rich_text[0]?.text.content || "",
//       tags: props["タグ"].multi_select.map(t => t.name),
//       favorite: props["お気に入り"].checkbox,
//       createdAt: props["投稿日時"].date.start
//     };
//   });

//   return stories;
// }


renderStories();
