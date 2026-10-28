#!/usr/bin/env node
// 生成单文件 Markdown：把全书拼成一份，方便导入 Obsidian / Notion / 语雀。
// 同时生成一份纯文本版，方便贴到任何地方。

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadBook } from './lib/parse.mjs';

const DIST = path.join(ROOT, 'dist');
const { chapters, totalItems } = loadBook();

const ORDER = ['成本', '说人话', '收益', '为什么', '证据等级', '来源', '备注'];
const now = new Date().toISOString().slice(0, 10);

// ---------- 完整 Markdown ----------
const lines = [];
lines.push('# 学生版 · 高性价比人生指南');
lines.push('');
lines.push('> 写给 18–25 岁：在读的、快毕业的、刚毕业三年内的。');
lines.push('>');
lines.push(`> 共 ${chapters.length} 章 · ${totalItems} 条 · 每条标明成本、收益与证据等级 · 导出于 ${now}`);
lines.push('');
lines.push('---');
lines.push('');
lines.push('## 目录');
lines.push('');
for (const c of chapters) {
  lines.push(`- [${c.title}](#ch${c.num})（${c.items.length} 条）`);
}
lines.push('');
lines.push('---');
lines.push('');

for (const c of chapters) {
  lines.push(`<a id="ch${c.num}"></a>`);
  lines.push('');
  lines.push(`# ${c.title}`);
  lines.push('');
  if (c.intro) {
    lines.push(c.intro);
    lines.push('');
  }
  for (const item of c.items) {
    lines.push(`## ${item.num}. ${item.title}`);
    lines.push('');
    if (item.tag) {
      lines.push(item.tag);
      lines.push('');
    }
    for (const k of ORDER) {
      if (item.fields[k]) {
        lines.push(`- **${k}**：${item.fields[k]}`);
      }
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
}

lines.push(`> 本书汇总公开信息，供参考；不构成法律、医疗、投资建议。`);
lines.push(`> 导出于 ${now}，正文以仓库版本为准。`);

fs.mkdirSync(DIST, { recursive: true });
const mdPath = path.join(DIST, 'students-howtolivebetter.md');
fs.writeFileSync(mdPath, lines.join('\n'), 'utf8');
console.log(`已生成 dist/students-howtolivebetter.md（${(fs.statSync(mdPath).size / 1024).toFixed(1)} KB）`);

// ---------- 纯文本版（去掉 markdown 标记，方便直接贴）----------
const plain = [];
plain.push('学生版 · 高性价比人生指南');
plain.push(`${chapters.length} 章 ${totalItems} 条 · 导出于 ${now}`);
plain.push('='.repeat(50));
plain.push('');

const stripMd = (s) => String(s)
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 ($2)')
  .replace(/<(https?:\/\/[^>]+)>/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\*([^*]+)\*/g, '$1')
  .replace(/`([^`]+)`/g, '$1');

for (const c of chapters) {
  plain.push('');
  plain.push(c.title);
  plain.push('-'.repeat(40));
  plain.push('');
  if (c.intro) {
    plain.push(stripMd(c.intro));
    plain.push('');
  }
  for (const item of c.items) {
    plain.push(`${item.num}. ${item.title}`);
    plain.push('');
    for (const k of ORDER) {
      if (item.fields[k]) plain.push(`【${k}】${stripMd(item.fields[k])}`);
    }
    plain.push('');
  }
}

const txtPath = path.join(DIST, 'students-howtolivebetter.txt');
fs.writeFileSync(txtPath, plain.join('\n'), 'utf8');
console.log(`已生成 dist/students-howtolivebetter.txt（${(fs.statSync(txtPath).size / 1024).toFixed(1)} KB）`);
