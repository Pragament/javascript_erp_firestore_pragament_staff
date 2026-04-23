import { mkdir, readFile, rm, writeFile, cp, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { minify as terserMinify } from 'terser';
import CleanCSS from 'clean-css';
import { minify as minifyHtml } from 'html-minifier-terser';
import JavaScriptObfuscator from 'javascript-obfuscator';

const mode = process.argv[2] || process.env.BUILD_MODE || 'dev';
const root = process.cwd();
const distRoot = join(root, 'dist');
const outDir = join(distRoot, mode);

const DEV_ONLY_FILES = ['user-test.js'];
const TESTS_DIR = 'tests';

function isModuleFile(fileName) {
  return fileName === 'firebase.js' || fileName === 'user-test.js' || fileName.startsWith('tests/');
}

function removeTestSurface(html) {
  return html
    .replace(/\s*<h2>Tests<\/h2>\s*<ul id="test-list"><\/ul>/, '')
    .replace(/\s*<script src="https:\/\/unpkg\.com\/mocha@10\.2\.0\/mocha\.js"><\/script>/g, '')
    .replace(/\s*<script src="https:\/\/unpkg\.com\/chai@4\.3\.7\/chai\.js"><\/script>/g, '')
    .replace(/\s*<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net\/npm\/mocha\/mocha\.css" \/>/g, '')
    .replace(/\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/mocha\/mocha\.js"><\/script>/g, '')
    .replace(/\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/chai\/chai\.js"><\/script>/g, '')
    .replace(/\s*<script>\s*\(function waitForChai\([\s\S]*?<\/script>/, '')
    .replace(/\s*<script type="module" src="user-test\.js"><\/script>/, '');
}

async function ensureDirFor(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function processJsFile(srcRel, destRel, { sourceMaps, minify, obfuscate }) {
  const srcPath = join(root, srcRel);
  const destPath = join(outDir, destRel);
  await ensureDirFor(destPath);

  const code = await readFile(srcPath, 'utf8');

  const terserOptions = {
    module: isModuleFile(srcRel),
    compress: !!minify,
    mangle: !!minify,
    format: minify
      ? { comments: false }
      : { beautify: true, comments: true, semicolons: true },
    sourceMap: sourceMaps
      ? {
          filename: destRel,
          url: `${destRel}.map`
        }
      : false
  };

  const terserResult = await terserMinify(code, terserOptions);

  if (!terserResult.code) {
    throw new Error(`Failed to build ${srcRel}`);
  }

  let finalCode = terserResult.code;

  if (obfuscate) {
    const rawConfig = await readFile(join(root, 'obfuscator.prod.json'), 'utf8');
    const obfuscatorConfig = JSON.parse(rawConfig);
    finalCode = JavaScriptObfuscator.obfuscate(finalCode, obfuscatorConfig).getObfuscatedCode();
  }

  await writeFile(destPath, finalCode, 'utf8');

  if (sourceMaps && terserResult.map) {
    await writeFile(`${destPath}.map`, terserResult.map, 'utf8');
  }
}

async function processCssFile(srcRel, { minify }) {
  const srcPath = join(root, srcRel);
  const destPath = join(outDir, srcRel);
  await ensureDirFor(destPath);

  const css = await readFile(srcPath, 'utf8');

  if (!minify) {
    await writeFile(destPath, css, 'utf8');
    return;
  }

  const result = new CleanCSS({ level: 2 }).minify(css);

  if (result.errors.length) {
    throw new Error(`CSS minify failed for ${srcRel}: ${result.errors.join('; ')}`);
  }

  await writeFile(destPath, result.styles, 'utf8');
}

async function processHtml({ minify, releaseMode }) {
  const srcPath = join(root, 'index.html');
  const destPath = join(outDir, 'index.html');

  let html = await readFile(srcPath, 'utf8');

  if (releaseMode) {
    html = removeTestSurface(html);
  }

  if (minify) {
    html = await minifyHtml(html, {
      collapseWhitespace: true,
      removeComments: true,
      removeRedundantAttributes: true,
      useShortDoctype: true,
      minifyCSS: true,
      minifyJS: true
    });
  }

  await writeFile(destPath, html, 'utf8');
}

async function copyIfExists(relPath) {
  const srcPath = join(root, relPath);
  const destPath = join(outDir, relPath);
  await ensureDirFor(destPath);
  await cp(srcPath, destPath, { recursive: true });
}

async function copyTestsToDev() {
  const testsPath = join(root, TESTS_DIR);
  const entries = await readdir(testsPath);
  if (!entries.length) {
    return;
  }

  for (const testFile of entries) {
    if (!testFile.endsWith('.js')) {
      continue;
    }
    await processJsFile(join(TESTS_DIR, testFile), join(TESTS_DIR, testFile), {
      sourceMaps: true,
      minify: false,
      obfuscate: false
    });
  }
}

async function runClean() {
  await rm(distRoot, { recursive: true, force: true });
  console.log('Cleaned dist/');
}

async function runBuild(buildMode) {
  if (buildMode !== 'dev' && buildMode !== 'prod') {
    throw new Error(`Unsupported mode: ${buildMode}. Use dev|prod|clean.`);
  }

  const isProd = buildMode === 'prod';
  const sourceMaps = !isProd;

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await processHtml({ minify: isProd, releaseMode: isProd });
  await processCssFile('styles.css', { minify: isProd });
  await processJsFile('app.js', 'app.js', {
    sourceMaps,
    minify: isProd,
    obfuscate: isProd
  });
  await processJsFile('firebase.js', 'firebase.js', {
    sourceMaps,
    minify: isProd,
    obfuscate: false
  });

  for (const file of ['LICENSE']) {
    await copyIfExists(file);
  }

  if (!isProd) {
    for (const devFile of DEV_ONLY_FILES) {
      await processJsFile(devFile, devFile, {
        sourceMaps: true,
        minify: false,
        obfuscate: false
      });
    }
    await copyTestsToDev();
  }

  console.log(`Built ${buildMode} output in ${outDir}`);
}

if (mode === 'clean') {
  await runClean();
} else {
  await runBuild(mode);
}
