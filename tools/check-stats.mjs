#!/usr/bin/env node
// 统计一致性检查：README 里写的条目数、章节数，是否和 book/ 里实际的对得上。
// 只读不改。CI 里跑，防止手改了正文忘了改 README。

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BOOK = path.join(ROOT, 'book');
const README = path.join(ROOT, 'README.md');

let errors = [];

if (!fs.existsSync(BOOK)) {
  console.error('找不到 book/');
  process.exit(1);
}

const files = fs.readdirSync(BOOK).filter(f => f.endsWith('.md')).sort();
let totalItems = 0;
const perFile = [];

for (const f of files) {
  const text = fs.readFileSync(path.join(BOOK, f), 'utf8');
  const heads = [...text.matchAll(/^### (\d+)\.\s/gm)];
  // 检查编号连续性
  const nums = heads.map(m => parseInt(m[1], 10));
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) {
      errors.push(`${f}: 条目编号不连续（第 ${nums[i - 1]} 条之后是第 ${nums[i]} 条）`);
    }
  }
  totalItems += nums.length;
  perFile.push({ file: f, count: nums.length });
}

console.log('章节统计：');
for (const p of perFile) console.log(`  ${p.file}  ${p.count} 条`);
console.log(`合计：${files.length} 章，${totalItems} 条`);

// README 里的 badge
const readme = fs.readFileSync(README, 'utf8');
const badge = readme.match(/条目-(\d+)%20条/);
if (badge) {
  const declared = parseInt(badge[1], 10);
  if (declared !== totalItems) {
    errors.push(`README badge 写的是 ${declared} 条，实际 ${totalItems} 条`);
  }
} else {
  errors.push('README 里找不到「条目-N 条」badge');
}

// README 目录表里的条目数
for (const p of perFile) {
  const links = [...readme.matchAll(/\|\s*(\d+)\s*\|/g)];
  // 宽松检查：只要表格里出现过该章节的条目数即可
  const declaredCounts = links.map(m => parseInt(m[1], 10));
  if (!declaredCounts.includes(p.count)) {
    errors.push(`README 目录表里没有声明 ${p.file} 的条目数（实际 ${p.count} 条）`);
  }
}

if (errors.length) {
  console.log('\n不一致：');
  errors.forEach(e => console.log('  ✗ ' + e));
  process.exit(1);
}

console.log('\n统计一致');
