#!/usr/bin/env node
// 外链检查：把 book/ 和 README 里所有 http(s) 链接抓一遍。
// 分级判定：
//   确定失效  404 / 410 / 域名解析失败  -> 必须修
//   可能失效  超时 / 5xx / 403          -> 记录，连续几周都在才值得处理
//   正常      2xx/3xx
// 退出码恒为 0（只报告不阻断），和 HowToLiveBetter 的做法一致。

import fs from 'node:fs';
import path from 'node:path';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

const ROOT = path.resolve(import.meta.dirname, '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';
const TIMEOUT = 20000;
const CONCURRENCY = 5;

// Node 的 fetch 不认 HTTPS_PROXY 环境变量，必须显式设置 dispatcher。
// 不设的话，在本机开着 Clash 的环境里，境外站点会一律超时（假警报）。
const PROXY = process.env.HTTPS_PROXY || process.env.https_proxy || '';
if (PROXY) {
  setGlobalDispatcher(new ProxyAgent(PROXY));
  console.log('代理：' + PROXY);
}

function collectFiles() {
  const out = [];
  for (const dir of ['book', 'docs', '.']) {
    const full = path.join(ROOT, dir);
    if (!fs.existsSync(full)) continue;
    const entries = fs.readdirSync(full, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith('.md')) out.push(path.join(full, e.name));
    }
  }
  return [...new Set(out)];
}

function extractLinks(text) {
  const links = new Set();
  const add = (u) => {
    // 跳过占位链接：...结尾、或含花括号/中括号的模板
    if (!u || u.endsWith('...') || /[{}[\]]/.test(u)) return;
    links.add(u);
  };
  for (const m of text.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) add(m[1]);
  for (const m of text.matchAll(/<(https?:\/\/[^>\s]+)>/g)) add(m[1]);
  return [...links];
}

async function probe(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' }
    });
    return { url, status: res.status, ok: res.status >= 200 && res.status < 400 };
  } catch (err) {
    return { url, status: 0, ok: false, error: err.name === 'AbortError' ? '超时' : (err.cause?.code || err.message) };
  } finally {
    clearTimeout(timer);
  }
}

const files = collectFiles();
const byUrl = new Map();

for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  for (const u of extractLinks(text)) {
    if (!byUrl.has(u)) byUrl.set(u, new Set());
    byUrl.get(u).add(path.relative(ROOT, f));
  }
}

const urls = [...byUrl.keys()];
console.log(`扫描 ${files.length} 个文件，${urls.length} 个唯一外链`);

const results = [];
let cursor = 0;

async function worker() {
  while (cursor < urls.length) {
    const i = cursor++;
    results[i] = await probe(urls[i]);
  }
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));

const dead = results.filter(r => r.status === 404 || r.status === 410 || r.error === 'ENOTFOUND');
const suspicious = results.filter(r => !dead.includes(r) && !r.ok);

const report = [];
report.push('# 外链检查报告');
report.push('');
report.push(`生成时间：${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
report.push(`检查 ${files.length} 个文件，${urls.length} 个外链`);
report.push('');

if (dead.length) {
  report.push(`## 确定失效（${dead.length}）—— 需要修`);
  report.push('');
  for (const d of dead) {
    const where = [...byUrl.get(d.url)].join(', ');
    report.push(`- ${d.status || d.error} ${d.url}`);
    report.push(`  - 出现在：${where}`);
  }
  report.push('');
}

if (suspicious.length) {
  report.push(`## 可能失效（${suspicious.length}）—— 多半是反爬或境外 IP 被挡`);
  report.push('');
  for (const s of suspicious) {
    report.push(`- ${s.status || s.error} ${s.url}`);
  }
  report.push('');
}

report.push(`## 正常（${results.length - dead.length - suspicious.length}）`);

const text = report.join('\n');
console.log(text);
fs.writeFileSync(path.join(ROOT, 'link-report.txt'), text, 'utf8');
console.log('\n报告已写入 link-report.txt');
