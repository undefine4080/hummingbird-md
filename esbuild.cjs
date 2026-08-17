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
  fs.cpSync(
    path.join(sourceRoot, "fonts"),
    path.join(targetRoot, "fonts"),
    { recursive: true },
  );
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

  if (isProduction) {
    await Promise.all([
      extensionCtx.rebuild(),
      readerCtx.rebuild(),
      tocCtx.rebuild(),
    ]);
    await Promise.all([
      extensionCtx.dispose(),
      readerCtx.dispose(),
      tocCtx.dispose(),
    ]);
  } else {
    await Promise.all([
      extensionCtx.watch(),
      readerCtx.watch(),
      tocCtx.watch(),
    ]);
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
