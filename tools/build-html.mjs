#!/usr/bin/env node
// 生成单文件 HTML：可离线阅读、可分享、可直接用浏览器打印成 PDF。
// 输出 dist/index.html —— 手机打开也没问题。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, loadBook, inline, parseTag } from './lib/parse.mjs';

const DIST = path.join(ROOT, 'dist');
const { chapters, totalItems } = loadBook();

const CSS = `
:root{--bg:#fdfcf9;--fg:#1a1a1a;--muted:#6b6b6b;--line:#e5e2da;--accent:#8a6d3b;--code:#f4f1ea}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
font:16px/1.85 -apple-system,"Segoe UI","Microsoft YaHei","Noto Sans SC",sans-serif;
-webkit-font-smoothing:antialiased}
.wrap{max-width:760px;margin:0 auto;padding:40px 20px 100px}
header.book{border-bottom:2px solid var(--fg);padding-bottom:24px;margin-bottom:36px}
header.book h1{font-size:30px;margin:0 0 10px;letter-spacing:-.5px}
header.book p{margin:4px 0;color:var(--muted);font-size:14px}
nav.toc{background:#fff;border:1px solid var(--line);border-radius:12px;padding:20px 24px;margin:0 0 44px}
nav.toc h2{font-size:15px;margin:0 0 12px;color:var(--muted);letter-spacing:.05em;text-transform:uppercase}
nav.toc ol{margin:0;padding-left:20px}
nav.toc li{margin:6px 0;font-size:15px}
nav.toc a{color:var(--fg);text-decoration:none;border-bottom:1px solid var(--line)}
nav.toc a:hover{border-bottom-color:var(--accent);color:var(--accent)}
nav.toc .count{color:var(--muted);font-size:13px}
section.chapter{margin:0 0 64px;padding-top:12px}
section.chapter > h2{font-size:24px;margin:0 0 18px;padding-bottom:10px;border-bottom:1px solid var(--line)}
.intro{color:var(--muted);font-size:15px;margin:0 0 28px}
.intro p{margin:10px 0}
article.item{margin:0 0 34px;padding:0 0 0 16px;border-left:3px solid var(--line)}
article.item:hover{border-left-color:var(--accent)}
article.item h3{font-size:17px;margin:0 0 10px;line-height:1.6}
article.item h3 .num{color:var(--accent);font-weight:700;margin-right:6px}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}
.tag{font-size:12px;padding:2px 9px;border-radius:999px;background:var(--code);color:var(--muted);white-space:nowrap}
.tag.rev{background:#e8f4e8;color:#2d6a2d}
.tag.half{background:#fdf0e0;color:#8a5a1a}
.tag.irr{background:#fbe6e6;color:#8a2a2a}
.dl{display:grid;grid-template-columns:76px 1fr;gap:4px 12px;margin:0;font-size:15px}
.dl dt{color:var(--muted);font-size:13px;padding-top:2px}
.dl dd{margin:0}
.dl dd.plain{font-size:15.5px}
.dl dd.evidence{font-weight:600}
.dl dd.source{font-size:13px;color:var(--muted);word-break:break-all}
.dl dd.note{font-size:13.5px;color:var(--muted)}
code{background:var(--code);padding:2px 6px;border-radius:4px;font-size:.9em;
font-family:ui-monospace,Consolas,monospace}
a{color:var(--accent)}
footer.end{margin-top:60px;padding-top:20px;border-top:1px solid var(--line);
color:var(--muted);font-size:13px;text-align:center}
@media print{
  body{background:#fff;font-size:11.5pt;line-height:1.7}
  .wrap{max-width:none;padding:0}
  nav.toc{page-break-after:always}
  section.chapter{page-break-before:always}
  article.item{page-break-inside:avoid}
  a{color:#000;text-decoration:none}
  .tag{border:1px solid #ccc;background:#fff!important;color:#000!important}
}
@media (max-width:600px){
  .wrap{padding:24px 14px 70px}
  .dl{grid-template-columns:1fr;gap:0}
  .dl dt{margin-top:8px}
}

/* 安装引导条：固定在底部，避开 iPhone 底部安全区 */
#installBar{
  position:fixed;left:0;right:0;bottom:0;z-index:99;
  display:flex;align-items:center;gap:12px;
  padding:12px 16px calc(12px + env(safe-area-inset-bottom));
  background:var(--fg);color:var(--bg);font-size:14px;
  box-shadow:0 -2px 12px rgba(0,0,0,.15)
}
#installBar[hidden]{display:none}
#installBar span{flex:1;line-height:1.5}
#installBar button{
  border:0;border-radius:6px;padding:7px 14px;font:inherit;cursor:pointer;
  background:var(--bg);color:var(--fg);font-weight:600
}
#installBar #installClose{background:transparent;color:var(--bg);font-size:20px;padding:0 6px;opacity:.7}
@media print{ #installBar{display:none!important} }

/* 自定义图标入口：安静地待在页脚，不抢正文注意力 */
.iconbox{margin-top:22px;display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.iconbox .ghost{
  border:1px solid var(--line);background:transparent;color:var(--muted);
  border-radius:8px;padding:7px 14px;font:inherit;font-size:13px;cursor:pointer
}
.iconbox .ghost:hover{border-color:var(--fg);color:var(--fg)}
.iconbox .hint{font-size:12.5px;color:var(--muted);line-height:1.6}
@media print{ .iconbox{display:none!important} }
`;

const ORDER = ['成本', '说人话', '收益', '为什么'];
const CLASS = { '成本': 'cost', '说人话': 'plain', '收益': 'gain', '为什么': 'why',
                '证据等级': 'evidence', '来源': 'source', '备注': 'note' };

function tagClass(v) {
  if (v === '可逆') return 'tag rev';
  if (v === '半可逆') return 'tag half';
  if (v === '不可逆') return 'tag irr';
  return 'tag';
}

function renderItem(item) {
  const tags = parseTag(item.tag);
  const tagHtml = ['钱', '时间', '毅力', '收益', '口径']
    .filter(k => tags[k])
    .map(k => `<span class="${k === '口径' ? tagClass(tags[k]) : 'tag'}">${k} · ${tags[k]}</span>`)
    .join('');

  const rows = [...ORDER, '证据等级', '来源', '备注']
    .filter(k => item.fields[k])
    .map(k => `<dt>${k}</dt><dd class="${CLASS[k]}">${inline(item.fields[k])}</dd>`)
    .join('\n      ');

  return `<article class="item" id="c${item.num}">
      <h3><span class="num">${item.num}.</span>${inline(item.title)}</h3>
      <div class="tags">${tagHtml}</div>
      <dl class="dl">
      ${rows}
      </dl>
    </article>`;
}

const toc = chapters.map(c =>
  `<li><a href="#ch${c.num}">${inline(c.title)}</a> <span class="count">（${c.items.length} 条）</span></li>`
).join('\n    ');

const body = chapters.map(c => `<section class="chapter" id="ch${c.num}">
    <h2>${inline(c.title)}</h2>
    <div class="intro">${c.intro.split('\n').filter(Boolean).map(p => `<p>${inline(p)}</p>`).join('')}</div>
    ${c.items.map(renderItem).join('\n    ')}
  </section>`).join('\n\n  ');

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>学生版 · 高性价比人生指南</title>
<meta name="description" content="写给 18–25 岁：在读的、快毕业的、刚毕业三年内的。每条写明成本、收益与证据来源。">

<!-- PWA：让手机浏览器「添加到主屏幕」后像 App 一样全屏离线阅读 -->
<meta name="theme-color" content="#1f6feb">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="学生指南">
<link rel="manifest" id="appManifest" href="manifest.webmanifest">
<!-- icon / apple-touch-icon 的 href 会被下面的脚本按用户自定义图标覆盖 -->
<link rel="apple-touch-icon" id="appleIcon" href="icon-192.png">
<link rel="icon" id="favIcon" href="icon-192.png">

<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <header class="book">
    <h1>🎓 学生版 · 高性价比人生指南</h1>
    <p>写给 18–25 岁：在读的、快毕业的、刚毕业三年内的</p>
    <p>共 ${chapters.length} 章 · ${totalItems} 条 · 每条标明成本、收益与证据等级</p>
  </header>

  <nav class="toc">
    <h2>目录</h2>
    <ol>
    ${toc}
    </ol>
  </nav>

  ${body}

  <footer class="end">
    本书汇总公开信息，供参考；不构成法律、医疗、投资建议。<br>
    每条可核对「来源」行；发现错误请提 Issue。

    <div class="iconbox">
      <button id="pickIcon" type="button" class="ghost">换个图标</button>
      <button id="resetIcon" type="button" class="ghost" hidden>恢复默认</button>
      <span class="hint" id="iconHint"></span>
      <input id="iconFile" type="file" accept="image/*" hidden>
    </div>
  </footer>
</div>

<!-- 安装引导：只在"能装但还没装"时出现，装完自动消失，关闭后记住选择 -->
<div id="installBar" hidden>
  <span>在手机上装成 App，可离线读</span>
  <button id="installBtn" type="button">安装</button>
  <button id="installClose" type="button" aria-label="关闭">×</button>
</div>

<script>
(function () {
  // 注册 Service Worker（离线缓存）。用相对路径，兼容 GitHub Pages 子路径部署。
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 离线能力失败不影响阅读 */ });
    });
  }

  var bar = document.getElementById('installBar');
  var btn = document.getElementById('installBtn');
  var close = document.getElementById('installClose');
  var deferred = null;

  if (localStorage.getItem('hideInstallBar') === '1') return;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (bar) bar.hidden = false;
  });

  if (btn) btn.addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function () { deferred = null; if (bar) bar.hidden = true; });
  });

  if (close) close.addEventListener('click', function () {
    if (bar) bar.hidden = true;
    localStorage.setItem('hideInstallBar', '1');
  });

  window.addEventListener('appinstalled', function () {
    if (bar) bar.hidden = true;
  });
})();

/* ---------- 自定义桌面图标 ----------
 * 做法：把用户选的图裁成正方形，画到 canvas 上导出 PNG(data URL)，
 * 再换掉 <link rel=icon> / <link rel=apple-touch-icon>，
 * 并用 blob URL 重写一份 manifest 指向新图标。
 *
 * 有一个物理限制必须讲清楚：
 *   图标一旦被系统"安装到桌面"，Android/iOS 就把它固化了。
 *   网页改的只是"下次安装时用哪张图"。所以要看到新图标，
 *   得先卸载再重新安装。这一点在界面上明说了，不骗用户。
 */
(function () {
  var KEY = 'customIconDataUrl';
  var pick = document.getElementById('pickIcon');
  var reset = document.getElementById('resetIcon');
  var file = document.getElementById('iconFile');
  var hint = document.getElementById('iconHint');
  var appleLink = document.getElementById('appleIcon');
  var favLink = document.getElementById('favIcon');
  if (!pick || !file) return;

  function say(t) { if (hint) hint.textContent = t; }

  // 把任意图片裁成正方形并缩放，返回 dataURL
  function toSquareDataUrl(img, size) {
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var ctx = c.getContext('2d');
    var s = Math.min(img.width, img.height);          // 取短边，保证不变形
    var sx = (img.width - s) / 2, sy = (img.height - s) / 2;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
    return c.toDataURL('image/png');
  }

  // 用 blob URL 生成一份指向自定义图标的 manifest
  function rewriteManifest(dataUrl) {
    var link = document.getElementById('appManifest');
    if (!link) return;
    var mf = {
      name: '学生版 · 高性价比人生指南',
      short_name: '学生指南',
      description: '写给 18–25 岁：每条写明成本、收益与证据来源。',
      start_url: './', scope: './', display: 'standalone',
      orientation: 'portrait',
      background_color: '#fdfcf9', theme_color: '#1f6feb', lang: 'zh-CN',
      icons: [
        { src: dataUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: dataUrl, sizes: '192x192', type: 'image/png', purpose: 'any' }
      ]
    };
    var blob = new Blob([JSON.stringify(mf)], { type: 'application/manifest+json' });
    link.href = URL.createObjectURL(blob);
  }

  function apply(dataUrl, announce) {
    if (favLink) favLink.href = dataUrl;
    if (appleLink) appleLink.href = dataUrl;
    rewriteManifest(dataUrl);
    if (reset) reset.hidden = false;
    if (announce !== false) {
      // 判断是否已经在独立窗口里跑（说明已安装）
      var standalone = window.matchMedia('(display-mode: standalone)').matches
                    || window.navigator.standalone === true;
      say(standalone
        ? '已换好。桌面图标是安装时固定的，要看到新图标请先删除再重新添加。'
        : '已换好。现在用浏览器菜单「添加到主屏幕」，就会用这张图。');
    }
  }

  // 启动时套用已保存的图标
  try {
    var saved = localStorage.getItem(KEY);
    if (saved) apply(saved, false);
  } catch (e) {}

  pick.addEventListener('click', function () { file.click(); });

  file.addEventListener('change', function () {
    var f = file.files && file.files[0];
    if (!f) return;
    // 用 indexOf 判类型：在模板字符串里写正则的 \/ 会被转义吃掉，
    // 生成出 ^image// 这种非法正则，整段脚本会静默中断。
    if (f.type.indexOf('image/') !== 0) { say('这个文件不是图片，换一张试试。'); return; }

    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        try {
          var big = toSquareDataUrl(img, 512);
          // 太大的图 base64 会撑爆 localStorage，压到能存下的程度
          if (big.length > 1.6 * 1024 * 1024) {
            big = toSquareDataUrl(img, 256);
            say('图片较大，已压缩到 256px 保存。');
          }
          localStorage.setItem(KEY, big);
          apply(big);
        } catch (e) {
          say('这张图处理失败了，换一张试试（JPG / PNG 最稳）。');
        }
      };
      img.onerror = function () { say('这张图读不出来，可能已损坏。'); };
      img.src = reader.result;
    };
    reader.onerror = function () { say('读取文件失败。'); };
    reader.readAsDataURL(f);
    file.value = '';
  });

  if (reset) reset.addEventListener('click', function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    if (favLink) favLink.href = 'icon-192.png';
    if (appleLink) appleLink.href = 'icon-192.png';
    var link = document.getElementById('appManifest');
    if (link) link.href = 'manifest.webmanifest';
    reset.hidden = true;
    say('已恢复默认图标。同样需要重新添加到主屏幕才会生效。');
  });
})();
</script>
</body>
</html>`;

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), html, 'utf8');
console.log(`已生成 dist/index.html（${chapters.length} 章 ${totalItems} 条，${(html.length / 1024).toFixed(1)} KB）`);

// ---------- PWA 附属文件 ----------
// 为什么把 manifest / sw 单独生成而不是手写：
//   sw.js 里要写缓存版本号，版本必须跟内容走。写死一个常量，改了书忘了改版本，
//   用户就会一直看到旧缓存。这里用内容哈希当版本，内容一变缓存自动失效。

const ICONS = ['icon-192.png', 'icon-512.png'];
for (const f of ICONS) {
  const src = path.join(ROOT, 'assets', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, f));
}

const manifest = {
  name: '学生版 · 高性价比人生指南',
  short_name: '学生指南',
  description: '写给 18–25 岁：每条写明成本、收益与证据来源。',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#fdfcf9',
  theme_color: '#1f6feb',
  lang: 'zh-CN',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
};
fs.writeFileSync(path.join(DIST, 'manifest.webmanifest'),
  JSON.stringify(manifest, null, 2), 'utf8');

// 内容哈希做缓存版本：只要 HTML 变了，缓存名就变，旧缓存自动淘汰
const version = crypto.createHash('sha256').update(html).digest('hex').slice(0, 12);

const sw = `// 本文件由 tools/build-html.mjs 自动生成，不要手改。
// 缓存版本跟着正文内容走：内容一变就换缓存名，避免用户一直看到旧版本。
const CACHE = 'students-${version}';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 网络优先、失败回缓存：书的内容低频变化，但希望一联网就看到最新版；
// 断网时退回缓存，保证飞机上/地铁里也能读。
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
`;
fs.writeFileSync(path.join(DIST, 'sw.js'), sw, 'utf8');

console.log(`已生成 PWA 文件：manifest.webmanifest / sw.js（缓存版本 ${version}）/ ${ICONS.length} 个图标`);
