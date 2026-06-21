const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const staticFiles = ["index.html", "login.html", "admin.html", "mobile-scanner.html", "tutorial.html", "tutorial-video.html", "styles.css"];
const jsEntries = ["app.js", "login.js", "admin.js", "mobile-scanner.js", "moldelab-assistant.jsx"];

async function build() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });

  await esbuild.build({
    entryPoints: jsEntries.map((file) => path.join(root, file)),
    outdir: dist,
    bundle: true,
    minify: true,
    legalComments: "none",
    target: ["es2020"],
    format: "iife",
    sourcemap: false,
    drop: ["console", "debugger"],
    logLevel: "info",
  });

  const buildInfo = {
    builtAt: new Date().toISOString(),
    commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || "local",
  };
  const version = Date.now();

  for (const file of staticFiles) {
    let content = fs.readFileSync(path.join(root, file), "utf8");
    if (file.endsWith(".html")) {
      // Inject cache-busting version into JS and CSS references
      content = content
        .replace(/(href="styles\.css)(")/g, `$1?v=${version}$2`)
        .replace(/(src="app\.js)(")/g, `$1?v=${version}$2`)
        .replace(/(src="login\.js)(")/g, `$1?v=${version}$2`)
        .replace(/(src="admin\.js)(")/g, `$1?v=${version}$2`)
        .replace(/(src="mobile-scanner\.js)(")/g, `$1?v=${version}$2`)
        .replace(/(src="moldelab-assistant\.js)(")/g, `$1?v=${version}$2`);
    }
    fs.writeFileSync(path.join(dist, file), content);
  }

  fs.writeFileSync(path.join(dist, "build.json"), JSON.stringify(buildInfo));

  const loginSize = fs.statSync(path.join(dist, "login.js")).size;
  const appSize = fs.statSync(path.join(dist, "app.js")).size;
  const sourceLoginSize = fs.statSync(path.join(root, "login.js")).size;
  if (loginSize >= sourceLoginSize * 0.9) {
    console.warn("Aviso: login.js nao reduziu tanto quanto esperado durante a minificacao.");
  }
  console.log(`Frontend de producao gerado em ${dist} (app.js ${appSize} bytes, login.js ${loginSize} bytes, version=${version})`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
