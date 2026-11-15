import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Raw HTML injection is banned everywhere (TRD security requirements).
// All rendering must go through an escaping renderer.
const rawHtmlBan = [
  {
    selector: "MemberExpression[property.name=/^(innerHTML|outerHTML)$/]",
    message: "Raw HTML injection is banned. Render through escaped components.",
  },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: "Raw HTML injection is banned. Render through escaped components.",
  },
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: "dangerouslySetInnerHTML is banned.",
  },
  {
    selector: "JSXAttribute[name.namespace.name='set'][name.name.name='html']",
    message: "set:html is banned.",
  },
];

export default tseslint.config(
  { ignores: ["**/dist/", "**/node_modules/", "**/.wrangler/"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      "no-restricted-syntax": ["error", ...rawHtmlBan],
    },
  },
);
