import nx from "@nx/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-plugin-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  ...nx.configs["flat/base"],
  ...nx.configs["flat/typescript"],
  ...nx.configs["flat/javascript"],

  {
    ignores: [
      "**/dist",
      "**/.next",
      "**/coverage",
      "**/vite.config.*.timestamp*",
      "**/vitest.config.*.timestamp*",
      "**/*.d.ts",
    ],
  },

  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.cjs", "**/*.mjs"],
    plugins: { import: importPlugin },
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          enforceBuildableLibDependency: true,
          allow: ["^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$"],
          depConstraints: [
            { sourceTag: "type:app", onlyDependOnLibsWithTags: ["type:ui", "type:feature", "type:util"] },
            { sourceTag: "type:ui", onlyDependOnLibsWithTags: ["type:util"] },
            { sourceTag: "type:feature", onlyDependOnLibsWithTags: ["type:util"] },
            { sourceTag: "*", onlyDependOnLibsWithTags: ["*"] },
          ],
        },
      ],

      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
      "@typescript-eslint/no-inferrable-types": "off",

      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "smart"],
      curly: ["error", "multi-line"],
      "no-console": ["warn", { allow: ["warn", "error", "info", "time", "timeEnd"] }],
      "no-debugger": "error",
      "no-shadow": "error",
      "no-param-reassign": "warn",
      "no-multiple-empty-lines": ["error", { max: 1 }],
      "object-curly-spacing": ["error", "always"],
      "array-bracket-spacing": ["error", "never"],
      "comma-dangle": ["error", "always-multiline"],
      "spaced-comment": ["warn", "always", { exceptions: ["-", "+"] }],
      "arrow-body-style": ["warn", "as-needed"],
      "prefer-template": "warn",
      "no-return-await": "error",

      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"]],
          pathGroups: [{ pattern: "react", group: "external", position: "before" }],
          pathGroupsExcludedImportTypes: ["react"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/newline-after-import": ["error", { count: 1 }],
      "import/no-duplicates": "error",
      "import/no-self-import": "error",
      "import/no-mutable-exports": "error",
    },
  },

  {
    files: ["**/*.tsx", "**/*.jsx"],
    plugins: { react, reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "react/jsx-no-useless-fragment": "warn",
      "react/self-closing-comp": "error",
    },
  },

  {
    files: ["apps/**/src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },

  {
    files: ["**/*.spec.ts", "**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },

  {
    plugins: { prettier },
    rules: {
      "prettier/prettier": [
        "error",
        {
          printWidth: 120,
          tabWidth: 2,
          singleQuote: false,
          bracketSpacing: true,
          bracketSameLine: true,
          semi: true,
          trailingComma: "all",
          arrowParens: "avoid",
          endOfLine: "auto",
        },
      ],
    },
  },
];
