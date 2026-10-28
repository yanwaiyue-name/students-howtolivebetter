#!/usr/bin/env node
// 生成单文件 HTML：可离线阅读、可分享、可直接用浏览器打印成 PDF。
// 输出 dist/index.html —— 手机打开也没问题。

import fs from 'node:fs';
import path from 'node:path';
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
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>学生版 · 高性价比人生指南</title>
<meta name="description" content="写给 18–25 岁：在读的、快毕业的、刚毕业三年内的。每条写明成本、收益与证据来源。">
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
  </footer>
</div>
</body>
</html>`;

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), html, 'utf8');
console.log(`已生成 dist/index.html（${chapters.length} 章 ${totalItems} 条，${(html.length / 1024).toFixed(1)} KB）`);
