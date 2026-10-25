# 挑页

本机 PDF 挑页工具：打开今天的书、预览页面、把当前页导出成 PNG。数据只留在浏览器里，不会上传。

开发服务绑定 `127.0.0.1:3000`。选择导出目录需要浏览器的文件系统接口，请用 **Chrome** 或 **Edge**。

## 环境

克隆仓库后，先确认本机已安装：

| 工具 | 版本 |
| --- | --- |
| [Node.js](https://nodejs.org) | **20.19** 及以上，或 **22.12** 及以上（推荐 22 长期支持版） |
| [pnpm](https://pnpm.io) | **10** 及以上（本仓库使用 12） |

Vite 8 不接受更旧的 Node。用 `node -v` 查看，若是 `v20.18`、`v21` 这类版本，依赖装不上，服务也起不来。

### 安装 Node.js

macOS 可用 Homebrew：

```bash
brew install node@22
```

也可从 [nodejs.org](https://nodejs.org) 下载长期支持版安装包。

装完后确认：

```bash
node -v
```

应看到 `v20.19` 以上，或 `v22.12` 以上。

### 安装 pnpm

Node 自带 Corepack，启用后固定本仓库使用的 pnpm 版本：

```bash
corepack enable
corepack prepare pnpm@12.15.0 --activate
pnpm -v
```

没有 Corepack 时：

```bash
npm install -g pnpm@12
pnpm -v
```

不要用 npm 或 yarn 安装本仓库依赖，否则对不上 `pnpm-lock.yaml`。

## 运行

```bash
pnpm install
pnpm dev
```

用浏览器打开 [http://127.0.0.1:3000/](http://127.0.0.1:3000/)。`pnpm install` 会同时拷贝 pdf.js 所需的静态资源。

## 测试与构建

```bash
pnpm test
pnpm build
pnpm preview
```
