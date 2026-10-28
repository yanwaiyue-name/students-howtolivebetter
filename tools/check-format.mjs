#!/usr/bin/env node
// 条目格式检查：每条必须七行齐全，成本标签必须合法。
// 零依赖，CI 和本地都能跑。退出码 0 = 通过，1 = 有问题。

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BOOK = path.join(ROOT, 'book');

const REQUIRED = ['- 成本：', '- 说人话：', '- 收益：', '- 为什么：', '- 证据等级：', '- 来源：', '- 备注：'];
const GRADES = ['A', 'B', 'C'];

let errors = [];
let warnings = [];
let itemCount = 0;

function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

if (!fs.existsSync(BOOK)) {
  console.error('找不到 book/ 目录');
  process.exit(1);
}

const files = fs.readdirSync(BOOK).filter(f => f.endsWith('.md')).sort();

for (const file of files) {
  const full = path.join(BOOK, file);
  const text = fs.readFileSync(full, 'utf8');
  const lines = text.split(/\r?\n/);

  // 按 "### " 切条目
  const heads = [];
  lines.forEach((line, i) => {
    if (/^### \d+\.\s/.test(line)) heads.push(i);
  });

  if (heads.length === 0) {
    warn(`${file}: 没有找到任何条目（### 编号. 标题）`);
    continue;
  }

  heads.forEach((start, idx) => {
    const end = idx + 1 < heads.length ? heads[idx + 1] : lines.length;
    const body = lines.slice(start, end);
    itemCount++;

    const headLine = body[0];
    const numMatch = headLine.match(/^### (\d+)\./);
    const num = numMatch ? numMatch[1] : '?';
    const tag = `${file} 第${num}条`;

    // 1. 标题后必须有成本标签注释
    if (!body[1] || !/^<!--\s*成本标签:/.test(body[1].trim())) {
      fail(`${tag}: 标题下一行缺少「成本标签」注释`);
    } else {
      const t = body[1];
      for (const k of ['钱=', '时间=', '毅力=', '收益=', '口径=']) {
        if (!t.includes(k)) fail(`${tag}: 成本标签缺少 ${k}`);
      }
      if (t.includes('口径=')) {
        const m = t.match(/口径=([^\s\-]+)/);
        if (m && !['可逆', '半可逆', '不可逆'].includes(m[1])) {
          fail(`${tag}: 口径只能是 可逆/半可逆/不可逆，实际是「${m[1]}」`);
        }
      }
    }

    // 2. 七个字段齐全
    const joined = body.join('\n');
    for (const field of REQUIRED) {
      if (!joined.includes(field)) fail(`${tag}: 缺少字段「${field}」`);
    }

    // 3. 证据等级合法
    const gradeLine = body.find(l => l.startsWith('- 证据等级：'));
    if (gradeLine) {
      const g = gradeLine.replace('- 证据等级：', '').trim();
      if (!GRADES.includes(g)) fail(`${tag}: 证据等级只能是 A/B/C，实际是「${g}」`);
    }

    // 4. 来源必须带链接或明确写"无公开数据"
    const srcLine = body.find(l => l.startsWith('- 来源：'));
    if (srcLine) {
      const hasLink = /https?:\/\//.test(srcLine);
      const hasNoData = srcLine.includes('没有公开数据') || srcLine.includes('无权威数据');
      if (!hasLink && !hasNoData) fail(`${tag}: 来源既没有链接，也没写「没有公开数据」`);
    }

    // 5. C 级必须说明是经验判断
    if (gradeLine && gradeLine.trim() === '- 证据等级：C') {
      const noteLine = body.find(l => l.startsWith('- 备注：'));
      const ok = joined.includes('没有权威数据') || joined.includes('经验判断') || joined.includes('因校而异');
      if (!ok) warn(`${tag}: C 级条目建议在备注里写明「无权威数据/经验判断」`);
    }

    // 6. 不许出现"应该"型结论（软检查）
    const 收益 = body.find(l => l.startsWith('- 收益：'));
    if (收益 && /你应该|你必须去|一定要去/.test(收益)) {
      warn(`${tag}: 收益行出现「应该/必须」型表述，本书给的是账不是主张`);
    }
  });
}

console.log(`检查 ${files.length} 个章节，${itemCount} 条条目`);

if (warnings.length) {
  console.log(`\n警告 ${warnings.length} 条：`);
  warnings.forEach(w => console.log('  ! ' + w));
}

if (errors.length) {
  console.log(`\n错误 ${errors.length} 条：`);
  errors.forEach(e => console.log('  ✗ ' + e));
  process.exit(1);
}

console.log('\n格式检查通过');
