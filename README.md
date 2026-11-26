# f-Matter (`obsidian-f-matter`)

> **Version**: `0.2.0` · **Min Obsidian**: `1.11.0+` · **Platform**: Desktop & Mobile · **Author**: KrayZerld & Geminyan

一款专注于 **Markdown 自动格式化（Linter）** 与 **新建笔记自动化（目录 Frontmatter 模板注入 + 时间戳自动重命名）** 的 Obsidian 插件。基于两阶段块级状态机解析器与 Obsidian 1.11+ 原生设计语言打造，在不干扰日常输入、不破坏代码块与公式的前提下，让笔记格式与新建流程保持整洁一致。

---

## 核心特性

### 1. Markdown 自动格式化（Linter）
- **无干扰触发与防跳动写回**
  - 安全 Hook 手动保存命令（`Ctrl/Cmd + S` 对应 `editor:save-file`），不监听打字时的自动保存（`modify`），彻底避免输入干扰与递归死循环。
  - 同时提供命令面板手动触发：`Format current file`。
  - 采用公共前后缀最小差量 `replaceRange` 写回，保留完整撤销栈（`Ctrl/Cmd + Z`），并尽量保持光标与视口滚动位置不跳动；无改动时零写入。
- **两阶段管线 + 保护区强隔离**
  - 通过块级状态机严格识别并原样保护 **围栏代码块**（`` ``` `` / `~~~`，含引用块与列表内嵌套围栏，自动排除行内 `` ```code``` ``）及 **块级 LaTeX**（单行/多行 `$$...$$`）；Frontmatter 仅应用专属空行规则，不误判正文 `---` 分割线。
- **三项可独立开关的格式化规则**
  - **自动空行**：删除 Frontmatter 顶部与内部空行；确保 8 类块级元素（引用/Callout、代码块、分割线、块级 LaTeX、表格、ATX 标题、无序/有序列表、CheckList）前后留空；紧缩列表/CheckList 内部多余空行（保留列表内嵌套代码块空行）；合并正文连续多空行为唯一空行；规范文件末尾为单一换行。
  - **自动空格**：为 `##` ~ `######` 缺空格标题补齐空格（**保留单 `#` 行首标签**如 `#tag` / `#项目/归档` 不误伤）；为无序列表（`-` / `*` / `+`）、有序列表（`1.`）及 Checkbox（`- [ ]` / `- [x]`）补齐空格（自动排除 `---` / `***` / `*italic*` / `**bold**` / `--flag` / 小数 `1.5`）；按盘古之白风格在中文汉字（除标点外）与英文/数字（`[A-Za-z0-9]`）及行内代码、行内公式、英文粗斜体边界自动补空格（保护 URL、HTML、WikiLink、链接地址与 `#tag` 内部）；清理非保护行行尾空格与 Tab。
  - **表格对齐**：按 **East Asian Width** 等宽字体显示宽度（CJK 汉字、假名、韩文、全角标点与宽符号按 `2` 计算，ASCII 按 `1` 计算）精确对齐中英文混排表格；完整保留左对齐（`:---`）、居中（`:---:`）、右对齐（`---:`）与默认（`---`）样式；正确识别转义竖线 `\|` 与行内代码 `` `a|b` `` 中的 `|`。

### 2. 新建笔记自动化（Frontmatter 模板 + 时间戳重命名）
- **启动安全防线**
  - 仅在 `workspace.onLayoutReady()` 之后注册 `vault.on('create')`，严防 Obsidian 启动扫描已有文件时误触发。
  - 仅针对 **5 秒内新建的空白 `.md` 文件**生效，避免外部同步或拖入已有笔记时被意外覆写或改名。
- **严格串行执行（防路径竞态）**
  1. **Step 1：目录匹配与 Frontmatter 模板注入**
     - 按父目录路径采用 **最长路径优先（最精确匹配）** 策略匹配映射规则，支持根目录 `/` 兜底与嵌套子目录覆盖。
     - 读取对应模板文件，仅提取顶部的 YAML Frontmatter 块（`--- ... ---`）原样注入，不包含模板正文。
  2. **Step 2：时间戳自动重命名**
     - 若设置了时间戳格式（基于 Obsidian 内置 `moment`，如 `YYYYMMDDHHmmss`），自动生成文件名并清洗非法路径字符。
     - 若同目录下已存在同名 `.md` 文件，自动追加递增后缀（如 `20261124203000-1.md`、`-2.md`）防冲突；格式留空则跳过重命名。

### 3. 原生设置页面（Obsidian 1.11+）
- 顶部提供 **Linter** / **Frontmatter** / **Timestamp** 三个左对齐下划线 Tab（含完整 `tablist`/`tab`/`tabpanel` 无障碍语义），全面采用 Obsidian 1.11+ 原生 **`SettingGroup`** 分组卡片、**`ExtraButtonComponent`** 无框图标按钮与原生 CSS 变量，自动兼容亮/暗双主题与社区主题。
- `Frontmatter` 映射弹窗采用原生 `Modal.setTitle()` 与 `ButtonComponent`，内置基于 `AbstractInputSuggest` + **`prepareFuzzySearch()`** 的 Vault 文件夹路径（含 `/`）与 `.md` 模板文件模糊补全，校验非空、防重复路径与模板文件存在性。
- `Timestamp` 页通过 `DocumentFragment` + 原生 `.u-pop` 样式内嵌当前时间戳命名实时预览。

---

## 安装与部署（手动安装）

> 最低支持 **Obsidian 1.11.0**。

1. 在本地执行构建（或获取已构建产物），准备好以下 3 个文件：
   - `manifest.json`
   - `main.js`
   - `styles.css`
2. 在你的 Obsidian Vault 目录下创建插件目录：
   ```text
   <YourVault>/.obsidian/plugins/obsidian-f-matter/
   ```
3. 将上述 3 个文件复制到该目录中。
4. 打开 Obsidian → **设置 → 第三方插件**，刷新插件列表并启用 **f-Matter**。

---

## 快速上手

1. **配置 Linter 规则**：打开 **设置 → f-Matter → Linter**，按需开关「自动空行」「自动空格」「表格对齐」。编辑笔记时按 `Ctrl/Cmd + S` 或在命令面板执行 `Format current file` 即可自动格式化。
2. **配置 Frontmatter 映射**：切换到 **Frontmatter** Tab，点击右上角 `+` 按钮添加「文件夹路径 ↔ 模板 `.md` 文件」映射（例如根目录 `/` 绑定通用模板，`Notes/Daily` 绑定日记模板）。
3. **配置时间戳重命名**：切换到 **Timestamp** Tab，输入 Moment.js 时间格式（如 `YYYYMMDDHHmmss`），下方实时预览生成效果；留空即关闭自动重命名。

---

## 规则与行为速查

### 最长路径优先匹配示例

假设存在以下映射：

| 文件夹路径 | 模板文件 |
| :--- | :--- |
| `/` | `Templates/default.md` |
| `Notes` | `Templates/note.md` |
| `Notes/Daily` | `Templates/daily.md` |

- 在 `Inbox/` 下新建笔记 → 命中 `/`（`Templates/default.md`）
- 在 `Notes/Projects/` 下新建笔记 → 命中 `Notes`（`Templates/note.md`）
- 在 `Notes/Daily/2026/` 下新建笔记 → 命中 `Notes/Daily`（`Templates/daily.md`）

### 中英文混排表格对齐示例

格式化前：
```markdown
| 姓名 | Age | 备注 | 评分 |
| :--- | ---: | :---: | --- |
| 张三 | 18 | 测试数据 | A+ |
| Alice | 7 | OK | 优秀 |
```

格式化后：
```markdown
| 姓名  | Age |   备注   | 评分 |
| :---- | --: | :------: | ---- |
| 张三  |  18 | 测试数据 | A+   |
| Alice |   7 |    OK    | 优秀 |
```

---

## 项目结构

```text
obsidian-f-matter/
├── manifest.json                 # 插件清单（minAppVersion: 1.11.0）
├── styles.css                    # 原生变量样式（Tab / 连体卡片 / Modal）
├── src/
│   ├── main.ts                   # 插件入口与生命周期管理
│   ├── types.ts                  # 设置接口与默认配置
│   ├── linter/                   # Linter 核心引擎（纯 TypeScript，无运行时耦合）
│   │   ├── index.ts              # 两阶段格式化管线
│   │   ├── parser.ts             # 块级解析状态机与保护区扫描
│   │   ├── width.ts              # East Asian Width 等宽字符宽度计算
│   │   └── rules/
│   │       ├── autoSpacing.ts    # 自动空格规则
│   │       ├── tableAlign.ts     # 表格解析与列对齐规则
│   │       └── autoBlankLine.ts  # 自动空行与列表紧缩规则
│   ├── editor/
│   │   └── saveHook.ts           # editor:save-file 钩子、防重入锁与无跳动写回
│   ├── automation/
│   │   ├── newFileHandler.ts     # onLayoutReady 监听、防误触守卫与串行调度
│   │   ├── frontmatterInjector.ts# 最长路径匹配与 YAML Frontmatter 提取写入
│   │   └── timestampRenamer.ts   # moment 格式化、重名后缀冲突处理与重命名
│   └── ui/
│       ├── SettingTab.ts         # 3 Tab 设置页面
│       ├── AddMappingModal.ts    # 新增映射弹窗与校验
│       └── PathSuggest.ts        # 文件夹与 .md 文件路径自动补全
└── tests/                        # Vitest 单元测试套件（25 用例全覆盖）
```

---

## 更新日志

### `0.2.0`
- **新增**：盘古之白风格中英文/数字混排自动空格（并入「自动空格」开关），支持中文汉字（除标点外）与 `[A-Za-z0-9]` 自动补空格；完整保护行内代码、行内公式（防 `$100` 货币误判）、URL、HTML、WikiLink、链接地址与 `#tag` 内部，并在行内代码/公式/URL 及英文粗斜体边界自动补空格。
- **优化**：前端控件全面 Obsidian 1.11+ 原生化重构——设置分组改用原生 `SettingGroup`、加减图标改用 `ExtraButtonComponent`、弹窗标题与按钮改用 `Modal.setTitle()` + `ButtonComponent`、路径补全接入原生 `prepareFuzzySearch()`、时间戳预览以 `.u-pop` 原生嵌入描述行，大幅精简 `styles.css`。

### `0.1.0`
- **新增**：Markdown Linter 引擎，支持自动空行、自动空格（保留单 `#` 标签）、中英文混排表格对齐，完整保护代码块、块级 LaTeX 与 Frontmatter。
- **新增**：Hook `editor:save-file` 手动保存触发与 `Format current file` 命令，支持最小差量写回与光标/视口位置保持。
- **新增**：新建空笔记串行自动化（目录最长路径优先 Frontmatter 模板注入 + `moment` 时间戳重命名与重名递增后缀处理）。
- **新增**：Obsidian 1.11+ 原生风格设置页（`Linter` / `Frontmatter` / `Timestamp` 三下划线 Tab、路径自动补全弹窗、时间戳实时预览）。

---

## 本地开发

```bash
# 安装依赖
npm install

# 开发监听构建
npm run dev

# 类型检查
npm run typecheck

# 运行单元测试（Vitest）
npm test

# 生产构建（输出 main.js）
npm run build
```

---

## License / Credits

Created by **KrayZerld & Geminyan**.
