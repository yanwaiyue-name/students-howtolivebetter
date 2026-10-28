// 共享的 Markdown 解析：把 book/*.md 拆成章节与条目。
// 三个导出器（HTML / EPUB / PDF）都从这里取数据，保证四个出口内容一致。

import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const BOOK = path.join(ROOT, 'book');

/** 读所有章节，返回 { chapters: [{num, title, file, items:[...], intro}], totalItems } */
export function loadBook() {
  if (!fs.existsSync(BOOK)) throw new Error('找不到 book/ 目录');

  const files = fs.readdirSync(BOOK).filter(f => f.endsWith('.md')).sort();
  const chapters = [];
  let totalItems = 0;

  for (const file of files) {
    const raw = fs.readFileSync(path.join(BOOK, file), 'utf8');
    const lines = raw.split(/\r?\n/);

    // 章标题（第一个 # ）
    const h1 = lines.find(l => /^#\s+/.test(l));
    const title = h1 ? h1.replace(/^#\s+/, '').trim() : file.replace(/\.md$/, '');
    const numMatch = title.match(/^(\d+)\./);
    const num = numMatch ? numMatch[1] : '';

    // 按 ### 切条目
    const heads = [];
    lines.forEach((line, i) => {
      if (/^### \d+\.\s/.test(line)) heads.push(i);
    });

    const items = [];
    for (let k = 0; k < heads.length; k++) {
      const start = heads[k];
      const end = k + 1 < heads.length ? heads[k + 1] : lines.length;
      const block = lines.slice(start, end);

      const headLine = block[0];
      const m = headLine.match(/^### (\d+)\.\s+(.*)$/);
      const tagLine = (block[1] || '').trim();

      // 收集字段
      const fields = { 成本: '', 说人话: '', 收益: '', 为什么: '', 证据等级: '', 来源: '', 备注: '' };
      for (const line of block) {
        for (const key of Object.keys(fields)) {
          if (line.startsWith('- ' + key + '：')) {
            fields[key] = line.slice(('- ' + key + '：').length).trim();
          }
        }
      }

      items.push({
        num: m ? m[1] : '',
        title: m ? m[2].trim() : headLine.replace(/^###\s*/, ''),
        tag: tagLine,
        fields
      });
    }

    // 章节导语：第一个 ### 之前、去掉 h1 与导航行的部分
    const firstHead = heads.length ? heads[0] : lines.length;
    const intro = lines
      .slice(0, firstHead)
      .filter(l => !/^#\s+/.test(l))
      .filter(l => !/^\[←/.test(l.trim()))
      .filter(l => !/^---\s*$/.test(l.trim()))
      .join('\n')
      .trim();

    chapters.push({ num, title, file, intro, items });
    totalItems += items.length;
  }

  return { chapters, totalItems };
}

/** 把 markdown 行内语法转成 HTML：粗体、行内代码、链接、尖括号裸链 */
export function inline(text) {
  let s = String(text ?? '');
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // 先处理 <url> 形式（转义后是 &lt;url&gt;）
  s = s.replace(/&lt;(https?:\/\/[^&\s]+?)&gt;/g, '<a href="$1">$1</a>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(?<![\w*])\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  return s;
}

/** 成本标签注释 -> 对象 */
export function parseTag(tagLine) {
  const m = String(tagLine).match(/<!--\s*成本标签:\s*(.*?)\s*-->/);
  if (!m) return {};
  const out = {};
  for (const part of m[1].split(/\s+/)) {
    const [k, v] = part.split('=');
    if (k && v) out[k] = v;
  }
  return out;
}
