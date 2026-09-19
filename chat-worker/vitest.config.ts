import { defineConfig } from "vitest/config";

// wrangler imports *.md as text (the [[rules]] block in wrangler.toml); tests do the same.
export default defineConfig({
  plugins: [
    {
      name: "md-as-text",
      transform(code, id) {
        if (id.endsWith(".md")) return { code: `export default ${JSON.stringify(code)};`, map: null };
      },
    },
  ],
});
