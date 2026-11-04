import { defineConfig } from "vite";

export default defineConfig(({ command, isPreview }) => ({
  // GitHub project Pages serves this application below the repository name.
  // Keep the existing development-server URLs unchanged.
  base: (command === "build" || isPreview) ? "/DS-9-Drum-Machine/" : "/",
}));
