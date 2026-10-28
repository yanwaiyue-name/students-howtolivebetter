#!/usr/bin/env node
// 一次生成全部格式：Markdown / HTML / EPUB / PDF
// 用法：node tools/build-all.mjs

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { ROOT } from './lib/parse.mjs';

const steps = [
  ['build-md.mjs', 'Markdown / 纯文本'],
  ['build-html.mjs', '单文件 HTML'],
  ['build-epub.mjs', 'EPUB 电子书'],
  ['build-pdf.mjs', 'PDF']
];

const failed = [];

for (const [script, label] of steps) {
  process.stdout.write(`[${label}] `);
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'tools', script)], {
      cwd: ROOT, encoding: 'utf8', stdio: 'pipe'
    });
    console.log((out || '').trim().split('\n').pop());
  } catch (err) {
    const msg = String(err.stdout || '') + String(err.stderr || '');
    console.log('失败');
    console.log('  ' + msg.trim().split('\n').slice(-3).join('\n  '));
    failed.push(script);
  }
}

console.log('');
const dist = path.join(ROOT, 'dist');
if (fs.existsSync(dist)) {
  const files = fs.readdirSync(dist).sort();
  console.log('dist/ 产物：');
  for (const f of files) {
    const size = fs.statSync(path.join(dist, f)).size;
    console.log(`  ${f.padEnd(42)} ${(size / 1024).toFixed(1)} KB`);
  }
}

if (failed.length) {
  console.error('\n有 ' + failed.length + ' 个步骤失败：' + failed.join(', '));
  process.exit(1);
}
console.log('\n全部完成');
