import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // API downloads (/api/...) are plain <a> links; pages always use next-intl's <Link>.
    // The rule mistakes /api routes for pages because of the [locale]/[...rest] catch-all.
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Chrome extension: separate package with its own tsconfig and build.
    "extension/**",
  ]),
]);

export default eslintConfig;
