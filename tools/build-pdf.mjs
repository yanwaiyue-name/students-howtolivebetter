#!/usr/bin/env node
// 生成 PDF：先用 build-html.mjs 产出 HTML，再调 headless Chrome 打印。
// 为什么不用 pandoc/typst：这台机器和 CI 上都没有，而 Chrome 到处都有。
// 没有 Chrome 时跳过并给出明确提示，不让整个构建失败。

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/parse.mjs';

const DIST = path.join(ROOT, 'dist');
const HTML = path.join(DIST, 'index.html');
const OUT = path.join(DIST, 'students-howtolivebetter.pdf');

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].filter(Boolean);

const chrome = CANDIDATES.find(p => { try { return fs.existsSync(p); } catch { return false; } });

if (!fs.existsSync(HTML)) {
  console.error('先跑 node tools/build-html.mjs 生成 dist/index.html');
  process.exit(1);
}

if (!chrome) {
  console.log('未找到 Chrome/Edge，跳过 PDF 生成。');
  console.log('设置环境变量 CHROME_PATH 指向浏览器可执行文件即可，例如：');
  console.log('  CHROME_PATH="/usr/bin/chromium" node tools/build-pdf.mjs');
  process.exit(0);
}

console.log('使用浏览器：' + chrome);

const args = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--no-pdf-header-footer',          // 不要浏览器默认的页眉页脚
  '--print-to-pdf-no-header',
  '--virtual-time-budget=10000',     // 等字体和排版稳定
  '--run-all-compositor-stages-before-draw',
  '--print-to-pdf=' + OUT,
  'file:///' + HTML.replace(/\\/g, '/')
];

try {
  execFileSync(chrome, args, { stdio: 'pipe', timeout: 120000 });
} catch (err) {
  const msg = String(err && err.stderr ? err.stderr : err && err.message || err);
  // 老版本 Chrome 不认 --no-pdf-header-footer，去掉重试一次
  if (/no-pdf-header-footer|unrecognized/i.test(msg)) {
    const fallback = args.filter(a => a !== '--no-pdf-header-footer' && a !== '--print-to-pdf-no-header');
    execFileSync(chrome, fallback, { stdio: 'pipe', timeout: 120000 });
  } else {
    console.error('PDF 生成失败：' + msg.slice(0, 400));
    process.exit(1);
  }
}

if (!fs.existsSync(OUT)) {
  console.error('浏览器没有产出 PDF 文件');
  process.exit(1);
}

const size = fs.statSync(OUT).size;
console.log(`已生成 dist/students-howtolivebetter.pdf（${(size / 1024).toFixed(1)} KB）`);
