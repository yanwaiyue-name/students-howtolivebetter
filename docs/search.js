/**
 * 轻量级全文搜索 - 为学生指南添加搜索功能
 */

let searchIndex = null;
let searchData = [];

function initSearch() {
  const items = document.querySelectorAll('article.item');
  searchData = Array.from(items).map((item, idx) => {
    const title = item.querySelector('h3')?.textContent || '';
    const content = item.textContent || '';
    const chapter = item.closest('section.chapter')?.querySelector('h2')?.textContent || '';
    return { id: idx, title, content, chapter, element: item };
  });
  searchIndex = searchData;
}

function search(query) {
  if (!query.trim()) return [];
  const keywords = query.toLowerCase().split(/\s+/);
  return searchIndex
    .map(item => {
      const text = (item.title + ' ' + item.content).toLowerCase();
      const score = keywords.reduce((sum, kw) => {
        const count = (text.match(new RegExp(kw, 'g')) || []).length;
        return sum + count;
      }, 0);
      return { ...item, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

function renderSearchResults(results, query) {
  const resultsBox = document.getElementById('searchResults');
  if (!resultsBox) return;

  if (results.length === 0) {
    resultsBox.innerHTML = '<p style="color:var(--muted);padding:20px;text-align:center;">未找到相关内容</p>';
    return;
  }

  resultsBox.innerHTML = results.map(item => `
    <div class="search-result-item" onclick="scrollToItem(${item.id})" style="padding:12px;border-bottom:1px solid var(--line);cursor:pointer;">
      <div style="color:var(--muted);font-size:12px;margin-bottom:4px;">${item.chapter}</div>
      <div style="font-size:14px;">${highlightText(item.title, query)}</div>
    </div>
  `).join('');
}

function highlightText(text, query) {
  const keywords = query.toLowerCase().split(/\s+/);
  let result = text;
  keywords.forEach(kw => {
    const regex = new RegExp(`(${kw})`, 'gi');
    result = result.replace(regex, '<mark style="background:yellow;padding:2px;">$1</mark>');
  });
  return result;
}

function scrollToItem(id) {
  const item = searchData[id];
  if (item && item.element) {
    item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    item.element.style.backgroundColor = 'var(--code)';
    setTimeout(() => { item.element.style.backgroundColor = ''; }, 2000);
  }
  closeSearchModal();
}

function setupSearchUI() {
  const searchButton = document.createElement('button');
  searchButton.id = 'searchButton';
  searchButton.innerHTML = '🔍 搜索';
  searchButton.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 100;
    padding: 10px 16px; border: 1px solid var(--line);
    border-radius: 8px; background: var(--bg); color: var(--fg);
    cursor: pointer; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  `;
  searchButton.onclick = openSearchModal;
  document.body.appendChild(searchButton);

  const modal = document.createElement('div');
  modal.id = 'searchModal';
  modal.style.cssText = `
    display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5); z-index: 200; padding: 60px 20px; overflow-y: auto;
  `;
  modal.innerHTML = `
    <div style="max-width:760px;margin:0 auto;background:var(--bg);border-radius:12px;padding:24px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <input type="text" id="searchInput" placeholder="输入关键词搜索..."
          style="flex:1;padding:12px;border:1px solid var(--line);border-radius:8px;font-size:16px;">
        <button onclick="closeSearchModal()" style="padding:12px;border:none;background:transparent;cursor:pointer;font-size:20px;">✕</button>
      </div>
      <div id="searchResults"></div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('searchInput').addEventListener('input', (e) => {
    const results = search(e.target.value);
    renderSearchResults(results, e.target.value);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeSearchModal();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openSearchModal();
    }
    if (e.key === 'Escape') closeSearchModal();
  });
}

function openSearchModal() {
  const modal = document.getElementById('searchModal');
  const input = document.getElementById('searchInput');
  if (modal && input) {
    modal.style.display = 'block';
    input.focus();
  }
}

function closeSearchModal() {
  const modal = document.getElementById('searchModal');
  if (modal) {
    modal.style.display = 'none';
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').innerHTML = '';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initSearch();
    setupSearchUI();
  });
} else {
  initSearch();
  setupSearchUI();
}
