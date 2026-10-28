#!/usr/bin/env node
// 生成 EPUB 3：手机阅读器（Apple Books / 微信读书 / Kindle App）可直接打开。
// 用 Node 内置 zlib 手写 zip，不依赖任何第三方库 —— 部署环境没有 npm 也能跑。

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ROOT, loadBook, inline, parseTag } from './lib/parse.mjs';

const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'students-howtolivebetter.epub');
const { chapters, totalItems } = loadBook();

const TITLE = '学生版 · 高性价比人生指南';
const AUTHOR = 'yanwaiyue-name';
const UUID = 'urn:uuid:students-howtolivebetter-2026';
const UPDATED = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

// ---------- zip 写入（store + deflate）----------
function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xFF;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const crc = crc32(raw);

    // storeOnly 的条目（EPUB 的 mimetype）必须不压缩且必须是第一个
    let body = raw, method = 0;
    if (!f.storeOnly && raw.length > 64) {
      const def = zlib.deflateRawSync(raw, { level: 9 });
      if (def.length < raw.length) { body = def; method = 8; }
    }

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);

    locals.push(lh, nameBuf, body);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);

    offset += lh.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, end]);
}

// ---------- 内容 ----------
const CSS = `
body{font-family:"Noto Serif SC","Songti SC",serif;line-height:1.8;margin:0;color:#1a1a1a}
h1{font-size:1.6em;border-bottom:1px solid #ccc;padding-bottom:.4em;margin:1em 0}
h2{font-size:1.25em;margin:1.4em 0 .6em}
h3{font-size:1.05em;margin:1.2em 0 .4em;line-height:1.5}
.num{color:#8a6d3b;font-weight:bold}
.tags{margin:.3em 0 .8em}
.tag{font-size:.75em;color:#555;border:1px solid #ddd;border-radius:3px;padding:.1em .4em;margin-right:.3em}
dl{margin:0;font-size:.92em}
dt{color:#777;font-size:.82em;margin-top:.5em}
dd{margin:0 0 .2em}
dd.plain{font-size:1em}
dd.evidence{font-weight:bold}
dd.source{font-size:.8em;color:#666;word-break:break-all}
dd.note{font-size:.85em;color:#666}
code{background:#f4f1ea;padding:0 .25em;font-size:.9em}
a{color:#8a6d3b}
.intro{color:#666;font-size:.92em}
`;

const ORDER = ['成本', '说人话', '收益', '为什么', '证据等级', '来源', '备注'];
const CLASS = { 成本: 'cost', 说人话: 'plain', 收益: 'gain', 为什么: 'why',
                证据等级: 'evidence', 来源: 'source', 备注: 'note' };

function xhtmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderItem(item) {
  const tags = parseTag(item.tag);
  const tagHtml = ['钱', '时间', '毅力', '收益', '口径']
    .filter(k => tags[k])
    .map(k => `<span class="tag">${xhtmlEscape(k)}·${xhtmlEscape(tags[k])}</span>`).join('');

  const rows = ORDER.filter(k => item.fields[k])
    .map(k => `<dt>${k}</dt><dd class="${CLASS[k]}">${inline(item.fields[k])}</dd>`).join('\n');

  return `<article>
<h3><span class="num">${item.num}.</span>${inline(item.title)}</h3>
<p class="tags">${tagHtml}</p>
<dl>${rows}</dl>
</article>`;
}

const chapterFiles = chapters.map((c, i) => {
  const fname = `ch${String(i + 1).padStart(2, '0')}.xhtml`;
  const intro = c.intro.split('\n').filter(Boolean).map(p => `<p class="intro">${inline(p)}</p>`).join('');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN">
<head><title>${xhtmlEscape(c.title)}</title><link rel="stylesheet" href="style.css" type="text/css"/></head>
<body>
<h1>${inline(c.title)}</h1>
${intro}
${c.items.map(renderItem).join('\n')}
</body>
</html>`;
  return { fname, title: c.title, body };
});

const navItems = chapterFiles.map((c, i) =>
  `<li><a href="${c.fname}">${xhtmlEscape(c.title)}</a></li>`).join('\n');

const nav = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN">
<head><title>目录</title></head>
<body>
<nav epub:type="toc" id="toc">
<h1>目录</h1>
<ol>
${navItems}
</ol>
</nav>
</body>
</html>`;

const titlePage = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
<head><title>${xhtmlEscape(TITLE)}</title><link rel="stylesheet" href="style.css" type="text/css"/></head>
<body>
<h1>${xhtmlEscape(TITLE)}</h1>
<p class="intro">写给 18–25 岁：在读的、快毕业的、刚毕业三年内的。</p>
<p class="intro">每条写明成本、收益与证据来源；查不到的写「没有公开数据」。</p>
<p class="intro">共 ${chapters.length} 章 · ${totalItems} 条</p>
</body>
</html>`;

const manifestItems = [
  '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
  '<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>',
  '<item id="css" href="style.css" media-type="text/css"/>',
  ...chapterFiles.map((c, i) => `<item id="ch${i + 1}" href="${c.fname}" media-type="application/xhtml+xml"/>`)
].join('\n    ');

const spineItems = ['<itemref idref="title"/>', '<itemref idref="nav"/>',
  ...chapterFiles.map((c, i) => `<itemref idref="ch${i + 1}"/>`)].join('\n    ');

const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${UUID}</dc:identifier>
    <dc:title>${xhtmlEscape(TITLE)}</dc:title>
    <dc:creator>${xhtmlEscape(AUTHOR)}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:description>学生版高性价比人生指南：18-25 岁的决策账本</dc:description>
    <dc:publisher>GitHub</dc:publisher>
    <meta property="dcterms:modified">${UPDATED}</meta>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`;

const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const files = [
  { name: 'mimetype', data: 'application/epub+zip' },   // 必须第一个且不压缩
  { name: 'META-INF/container.xml', data: container },
  { name: 'OEBPS/content.opf', data: opf },
  { name: 'OEBPS/nav.xhtml', data: nav },
  { name: 'OEBPS/title.xhtml', data: titlePage },
  { name: 'OEBPS/style.css', data: CSS },
  ...chapterFiles.map(c => ({ name: 'OEBPS/' + c.fname, data: c.body }))
];

// mimetype 放第一个、store 不压缩 —— 这是 EPUB 规范的硬要求，顺序错了阅读器直接拒开
const epubBuf = zip([
  { name: 'mimetype', data: 'application/epub+zip', storeOnly: true },
  { name: 'META-INF/container.xml', data: container },
  { name: 'OEBPS/content.opf', data: opf },
  { name: 'OEBPS/nav.xhtml', data: nav },
  { name: 'OEBPS/title.xhtml', data: titlePage },
  { name: 'OEBPS/style.css', data: CSS },
  ...chapterFiles.map(c => ({ name: 'OEBPS/' + c.fname, data: c.body }))
]);

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(OUT, epubBuf);
console.log(`已生成 dist/students-howtolivebetter.epub（${chapters.length} 章 ${totalItems} 条，${(fs.statSync(OUT).size / 1024).toFixed(1)} KB）`);
