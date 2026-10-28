# 下载与格式

本书同时提供 5 种格式，全部由 `tools/build-all.mjs` 从 `book/` 下的 Markdown 自动生成，内容一致。

| 格式 | 文件 | 适合 | 大小 |
|---|---|---|---|
| **网页版** | `dist/index.html` | 手机/电脑直接打开，无需安装任何东西 | ~47 KB |
| **Markdown** | `dist/students-howtolivebetter.md` | 导入 Obsidian / Notion / 语雀，可做笔记 | ~33 KB |
| **纯文本** | `dist/students-howtolivebetter.txt` | 贴到任何地方，微信、记事本、邮件 | ~31 KB |
| **EPUB** | `dist/students-howtolivebetter.epub` | 手机阅读器、Kindle、微信读书 | ~19 KB |
| **PDF** | `dist/students-howtolivebetter.pdf` | 打印、存档、离线阅读 | ~700 KB |

## 从 Release 下载

每次正文更新，CI 会自动构建并把产物挂到固定的 Release 标签 `latest` 上，**下载链接永远不变**：

```
https://github.com/yanwaiyue-name/students-howtolivebetter/releases/download/latest/students-howtolivebetter.epub
https://github.com/yanwaiyue-name/students-howtolivebetter/releases/download/latest/students-howtolivebetter.pdf
https://github.com/yanwaiyue-name/students-howtolivebetter/releases/download/latest/students-howtolivebetter.md
https://github.com/yanwaiyue-name/students-howtolivebetter/releases/download/latest/index.html
```

## 自己构建

要求：Node.js ≥ 18。PDF 额外需要 Chrome 或 Edge（用于打印），没有也能构建其它格式。

```bash
git clone https://github.com/yanwaiyue-name/students-howtolivebetter
cd students-howtolivebetter
node tools/build-all.mjs
```

产物在 `dist/`。

单独构建某一种：

```bash
node tools/build-md.mjs      # Markdown + 纯文本
node tools/build-html.mjs    # 单文件 HTML
node tools/build-epub.mjs    # EPUB
node tools/build-pdf.mjs     # PDF（需要浏览器）
```

如果 Chrome 不在默认路径：

```bash
CHROME_PATH="/usr/bin/chromium" node tools/build-pdf.mjs
```

## 为什么不用 pandoc

因为它的部署成本高。本书的读者大多不是开发者，克隆下来直接 `node tools/build-all.mjs` 就能出五份文件，比装一套 TeX 环境现实得多。

代价是排版精细度不如专业排版系统——PDF 用的是浏览器的打印样式，目录层级和分页控制有限。够用，但别期待书籍级排版。
