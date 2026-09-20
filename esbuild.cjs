const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

const isProduction = process.argv.includes("--production");

/** 复制 KaTeX 样式和字体，保证 VS Code Webview 离线可用。 */
function copyKatexAssets() {
  const sourceRoot = path.join("node_modules", "katex", "dist");
  const targetRoot = path.join("dist", "katex");
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.copyFileSync(
    path.join(sourceRoot, "katex.min.css"),
    path.join(targetRoot, "katex.min.css"),
  );
  fs.cpSync(path.join(sourceRoot, "fonts"), path.join(targetRoot, "fonts"), {
    recursive: true,
  });
}

/** 复制 Vditor 静态资源（lute/mermaid/katex 等），供编辑器 Webview 离线加载。
 * 依赖升级后需删除 dist/vendor 重新构建（体积裁剪在 P0 处理）。 */
function copyVditorAssets() {
  const sourceRoot = path.join("node_modules", "vditor", "dist");
  const targetRoot = path.join("dist", "vendor", "vditor", "dist");
  if (fs.existsSync(path.join(targetRoot, "index.css"))) {
    return;
  }
  fs.cpSync(sourceRoot, targetRoot, { recursive: true });
}

const sharedConfig = {
  bundle: true,
  sourcemap: !isProduction,
  minify: isProduction,
};

async function build() {
  copyKatexAssets();

  // 插件主进程
  const extensionCtx = await esbuild.context({
    ...sharedConfig,
    entryPoints: ["src/extension.ts"],
    external: ["vscode"],
    format: "cjs",
    platform: "node",
    target: "node18",
    outdir: "dist",
  });

  // Webview 阅读器前端（运行在浏览器环境）
  const readerCtx = await esbuild.context({
    ...sharedConfig,
    entryPoints: ["src/webview/frontend/reader-entry.ts"],
    format: "iife",
    platform: "browser",
    target: "chrome100",
    outfile: "dist/reader.js",
    define: {
      "process.env.NODE_ENV": isProduction ? '"production"' : '"development"',
    },
  });

  // Webview TOC 侧边栏前端
  const tocCtx = await esbuild.context({
    ...sharedConfig,
    entryPoints: ["src/webview/frontend/toc-entry.ts"],
    format: "iife",
    platform: "browser",
    target: "chrome100",
    outfile: "dist/toc.js",
  });

  // Webview 编辑器前端（Vditor 以脚本标签从 vendor 资源加载，不打包）
  copyVditorAssets();
  const editorCtx = await esbuild.context({
    ...sharedConfig,
    entryPoints: ["src/editor/frontend/editor-entry.ts"],
    format: "iife",
    platform: "browser",
    target: "chrome100",
    outfile: "dist/editor.js",
  });

  if (isProduction) {
    await Promise.all([
      extensionCtx.rebuild(),
      readerCtx.rebuild(),
      tocCtx.rebuild(),
      editorCtx.rebuild(),
    ]);
    await Promise.all([
      extensionCtx.dispose(),
      readerCtx.dispose(),
      tocCtx.dispose(),
      editorCtx.dispose(),
    ]);
  } else {
    await Promise.all([
      extensionCtx.watch(),
      readerCtx.watch(),
      tocCtx.watch(),
      editorCtx.watch(),
    ]);
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
