const esbuild = require("esbuild");

const isProduction = process.argv.includes("--production");

const sharedConfig = {
  bundle: true,
  sourcemap: !isProduction,
  minify: isProduction,
};

async function build() {
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
