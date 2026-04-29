import tseslint from "typescript-eslint";

export default tseslint.config(
  // 全局忽略
  {
    ignores: ["dist/**", "node_modules/**", "*.cjs", "media/**"],
  },

  // 基础规则：对所有 JS/TS 文件生效
  ...tseslint.configs.recommended,

  // TypeScript 文件的严格规则
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // ===== 错误预防 =====

      // 禁止显式 any，避免类型逃逸
      "@typescript-eslint/no-explicit-any": "error",

      // 禁止非空断言（!），使用类型守卫代替
      "@typescript-eslint/no-non-null-assertion": "error",

      // 禁止悬空 promises（忘记 await 的异步调用）
      "@typescript-eslint/no-floating-promises": "error",

      // 禁止误导性的瞬间箭头函数（async () => await xxx 没有包裹 Promise）
      "@typescript-eslint/no-misused-promises": "error",

      // switch 必须穷尽所有 case
      "@typescript-eslint/switch-exhaustiveness-check": "error",

      // ===== 代码质量 =====

      // 函数必须有显式返回类型，提升可读性
      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],

      // 禁止未使用的变量（排除下划线前缀的变量）
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // 禁止重复的类成员
      "no-dupe-class-members": "off",
      "@typescript-eslint/no-dupe-class-members": "error",

      // ===== 一致性 =====

      // 方法签名使用 property 风格（fn: () => void）而非 method 风格（fn(): void）
      "@typescript-eslint/method-signature-style": ["error", "property"],

      // 优先使用 interface 而非 type 做对象类型定义
      "@typescript-eslint/consistent-type-definitions": ["warn", "interface"],

      // 优先使用 as const 而非字面量类型声明
      "@typescript-eslint/prefer-as-const": "error",

      // 枚举成员必须有初始化值
      "@typescript-eslint/prefer-enum-initializers": "warn",

      // ===== 禁止危险模式 =====

      // 禁止在循环中使用 await（应使用 Promise.all）
      "no-await-in-loop": "warn",

      // 禁止将同一构造函数既当类又当值使用
      "@typescript-eslint/no-extraneous-class": "warn",

      // ===== 放宽规则 =====

      // 允许 require（VSCode 插件运行在 Node 环境）
      "@typescript-eslint/no-require-imports": "off",

      // 允许 namespace（用于消息协议等类型分组）
      "@typescript-eslint/no-namespace": "off",
    },
  },

  // 禁用未使用变量的误报：类型导入不算
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-unused-vars": "off",
    },
  },
);
