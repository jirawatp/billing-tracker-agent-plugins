#!/usr/bin/env node
// Propagates config.json to every file in this repo that repeats its values.
//
//   node scripts/sync.mjs              rewrite managed files from config.json
//   node scripts/sync.mjs --check      exit 1 if any file disagrees with config.json
//   node scripts/sync.mjs --print      print config.json plus derived values as JSON
//   node scripts/sync.mjs --server-url URL --app-url URL --repository OWNER/NAME
//                         --version X.Y.Z --registry-name NAMESPACE/NAME
//                                      save the given values to config.json, then rewrite
//
// Text that repeats a value verbatim (Markdown, TOML, YAML and JSON strings) is
// rewritten in one pass from the previous value to the new one. Previous values
// are read from the canonical manifest fields in CANONICAL, so editing
// config.json by hand and then running this script works. Values that are not
// safe to replace as plain text, such as versions, are set through SLOTS.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_KEY = 'bills';
const REGISTRY_SERVER_NAME = 'billing-tracker';
const CONNECTED_AGENTS_PATH = '/settings/connected-agents';
const TEXT_EXTENSIONS = new Set(['.md', '.json', '.toml', '.yml', '.yaml']);
const SKIP_ANYWHERE = new Set(['.git', 'node_modules']);
const SKIP_AT_ROOT = new Set(['scripts', 'config.json', 'LICENSE']);

const TEXT_KEYS = [
  'cursorInstallUrl',
  'cursorDeeplink',
  'vscodeInstallUrl',
  'vscodeInsidersInstallUrl',
  'connectedAgentsUrl',
  'serverUrl',
  'appUrl',
  'repoUrl',
  'repository',
  'registryName',
];

const CANONICAL = {
  serverUrl: ['mcp.json', ['mcpServers', SERVER_KEY, 'url']],
  appUrl: ['plugin.json', ['extensions', 'com.openai', 'interface', 'websiteURL']],
  repository: ['plugin.json', ['repository'], (url) => url.replace(/^https:\/\/github\.com\//, '')],
  version: ['plugin.json', ['version']],
  registryName: ['server.json', ['name']],
};

const SLOTS = [
  ['plugin.json', ['version'], (v) => v.version],
  ['plugin.json', ['homepage'], (v) => `${v.repoUrl}#readme`],
  ['plugin.json', ['repository'], (v) => v.repoUrl],
  ['plugin.json', ['extensions', 'com.openai', 'interface', 'websiteURL'], (v) => v.appUrl],
  ['.claude-plugin/plugin.json', ['version'], (v) => v.version],
  ['.claude-plugin/plugin.json', ['homepage'], (v) => `${v.repoUrl}#readme`],
  ['.claude-plugin/plugin.json', ['repository'], (v) => v.repoUrl],
  ['mcp.json', ['mcpServers', SERVER_KEY, 'url'], (v) => v.serverUrl],
  ['.mcp.json', ['mcpServers', SERVER_KEY, 'url'], (v) => v.serverUrl],
  ['mcp_config.json', ['mcpServers', SERVER_KEY, 'serverUrl'], (v) => v.serverUrl],
  ['gemini-extension.json', ['version'], (v) => v.version],
  ['gemini-extension.json', ['mcpServers', SERVER_KEY, 'httpUrl'], (v) => v.serverUrl],
  ['server.json', ['name'], (v) => v.registryName],
  ['server.json', ['version'], (v) => v.version],
  ['server.json', ['websiteUrl'], (v) => `${v.repoUrl}#readme`],
  ['server.json', ['repository', 'url'], (v) => v.repoUrl],
  ['server.json', ['remotes', 0, 'url'], (v) => v.serverUrl],
];

// Files that must contain these values. Catches a copy that a hand edit missed.
const REQUIRED_TEXT = {
  'README.md': [
    'serverUrl',
    'connectedAgentsUrl',
    'repository',
    'repoUrl',
    'registryName',
    'cursorInstallUrl',
    'cursorDeeplink',
    'vscodeInstallUrl',
    'vscodeInsidersInstallUrl',
  ],
  'skills/billing-tracker/SKILL.md': ['serverUrl', 'connectedAgentsUrl', 'repoUrl'],
};

const FLAGS = {
  '--server-url': 'serverUrl',
  '--app-url': 'appUrl',
  '--repository': 'repository',
  '--version': 'version',
  '--registry-name': 'registryName',
};

function derive(config) {
  const { serverUrl, appUrl, repository, version } = config;
  const owner = repository.split('/')[0];
  const cursorConfig = encodeURIComponent(
    Buffer.from(JSON.stringify({ url: serverUrl })).toString('base64'),
  );
  const vscodeServer = encodeURIComponent(
    JSON.stringify({ name: SERVER_KEY, type: 'http', url: serverUrl }),
  );
  return {
    serverUrl,
    appUrl,
    repository,
    version,
    connectedAgentsUrl: `${appUrl}${CONNECTED_AGENTS_PATH}`,
    repoUrl: `https://github.com/${repository}`,
    registryName: config.registryName ?? `io.github.${owner}/${REGISTRY_SERVER_NAME}`,
    cursorInstallUrl: `https://cursor.com/install-mcp?name=${SERVER_KEY}&config=${cursorConfig}`,
    cursorDeeplink: `cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER_KEY}&config=${cursorConfig}`,
    vscodeInstallUrl: `https://vscode.dev/redirect?url=${encodeURIComponent(`vscode:mcp/install?${vscodeServer}`)}`,
    vscodeInsidersInstallUrl: `https://insiders.vscode.dev/redirect?url=${encodeURIComponent(`vscode-insiders:mcp/install?${vscodeServer}`)}`,
  };
}

function validateConfig(config) {
  const problems = [];
  for (const key of ['serverUrl', 'appUrl']) {
    let url;
    try {
      url = new URL(config[key]);
    } catch {
      problems.push(`${key} is not a URL: ${config[key]}`);
      continue;
    }
    if (url.protocol !== 'https:') problems.push(`${key} must use https: ${config[key]}`);
    if (url.search || url.hash || url.username) problems.push(`${key} must not have a query, fragment or credentials`);
    if (config[key].endsWith('/')) problems.push(`${key} must not end with a slash: ${config[key]}`);
  }
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(config.repository ?? '')) {
    problems.push(`repository must look like owner/name: ${config.repository}`);
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(config.version ?? '')) {
    problems.push(`version must be semantic, like 1.2.3: ${config.version}`);
  }
  if (config.registryName !== undefined && !/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/.test(config.registryName)) {
    problems.push(`registryName must look like namespace/name: ${config.registryName}`);
  }
  if (problems.length) fail(['config.json is invalid:', ...problems.map((p) => `  - ${p}`)]);
}

function parseArgs(argv) {
  const args = { check: false, print: false, set: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') args.check = true;
    else if (arg === '--print') args.print = true;
    else if (FLAGS[arg]) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) fail([`${arg} needs a value`]);
      args.set[FLAGS[arg]] = value;
      i += 1;
    } else {
      fail([`Unknown argument: ${arg}`, 'See the comment at the top of scripts/sync.mjs for usage.']);
    }
  }
  return args;
}

function fail(lines) {
  console.error(lines.join('\n'));
  process.exit(1);
}

function readText(file) {
  return readFileSync(join(ROOT, file), 'utf8');
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (error) {
    fail([`Cannot read ${file}: ${error.message}`]);
  }
}

function toJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function getPath(object, path) {
  return path.reduce((node, key) => (node == null ? undefined : node[key]), object);
}

function setPath(object, path, value) {
  let node = object;
  for (const key of path.slice(0, -1)) {
    if (node[key] == null || typeof node[key] !== 'object') {
      throw new Error(`missing ${path.join('.')}`);
    }
    node = node[key];
  }
  node[path.at(-1)] = value;
}

function readCanonical() {
  const current = {};
  for (const [key, [file, path, transform]] of Object.entries(CANONICAL)) {
    const value = getPath(readJson(file), path);
    if (typeof value !== 'string' || value === '') {
      fail([`Cannot find the current ${key} at ${file} -> ${path.join('.')}.`]);
    }
    current[key] = transform ? transform(value) : value;
  }
  return current;
}

function listFiles(dir = ROOT) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_ANYWHERE.has(entry.name)) continue;
    if (dir === ROOT && SKIP_AT_ROOT.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else if (TEXT_EXTENSIONS.has(extname(entry.name))) files.push(relative(ROOT, full).split('\\').join('/'));
  }
  return files.sort();
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceValues(text, pairs) {
  if (pairs.length === 0) return text;
  const alternatives = pairs.map(([from]) => escapeRegExp(from)).join('|');
  const pattern = new RegExp(`(?<![A-Za-z0-9_-])(?:${alternatives})(?![A-Za-z0-9_-])`, 'g');
  const lookup = new Map(pairs);
  return text.replace(pattern, (match) => lookup.get(match));
}

function installLinkProblems(file, text, values) {
  const problems = [];
  const cursorLinks = /(?:https:\/\/cursor\.com\/(?:[a-z]{2}\/)?install-mcp|cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install)\?name=([^&\s)"'<>]+)&config=([^\s)"'<>]+)/g;
  for (const match of text.matchAll(cursorLinks)) {
    try {
      const server = JSON.parse(Buffer.from(decodeURIComponent(match[2]), 'base64').toString('utf8'));
      if (match[1] !== SERVER_KEY || server.url !== values.serverUrl) {
        problems.push(`${file}: Cursor install link targets ${match[1]} at ${server.url}`);
      }
    } catch {
      problems.push(`${file}: cannot decode Cursor install link ${match[0].slice(0, 80)}...`);
    }
  }
  const vscodeLinks = /https:\/\/(?:insiders\.)?vscode\.dev\/redirect\?url=([^\s)"'<>]+)/g;
  for (const match of text.matchAll(vscodeLinks)) {
    try {
      const inner = decodeURIComponent(match[1]);
      const server = JSON.parse(decodeURIComponent(inner.slice(inner.indexOf('?') + 1)));
      if (server.name !== SERVER_KEY || server.url !== values.serverUrl) {
        problems.push(`${file}: VS Code install link targets ${server.name} at ${server.url}`);
      }
    } catch {
      problems.push(`${file}: cannot decode VS Code install link ${match[0].slice(0, 80)}...`);
    }
  }
  return problems;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let config = readJson('config.json');
  if (Object.keys(args.set).length) {
    if (args.check) fail(['--check cannot be combined with value flags']);
    config = { ...config, ...args.set };
    validateConfig(config);
    writeFileSync(join(ROOT, 'config.json'), toJson(config));
  }
  validateConfig(config);
  const next = derive(config);
  if (args.print) {
    console.log(JSON.stringify(next, null, 2));
    return;
  }

  const previous = derive(readCanonical());
  const pairs = TEXT_KEYS.filter((key) => previous[key] !== next[key])
    .map((key) => [previous[key], next[key]])
    .sort((a, b) => b[0].length - a[0].length);

  const updated = new Map();
  for (const file of listFiles()) {
    const before = readText(file);
    const after = replaceValues(before, pairs);
    if (after !== before) updated.set(file, after);
  }
  for (const [file, path, value] of SLOTS) {
    const json = JSON.parse(updated.get(file) ?? readText(file));
    const wanted = value(next);
    if (getPath(json, path) === wanted) continue;
    try {
      setPath(json, path, wanted);
    } catch (error) {
      fail([`${file}: ${error.message}`]);
    }
    updated.set(file, toJson(json));
  }

  const problems = [];
  for (const [file, keys] of Object.entries(REQUIRED_TEXT)) {
    const text = updated.get(file) ?? readText(file);
    for (const key of keys) {
      if (!text.includes(next[key])) problems.push(`${file}: does not mention ${key} (${next[key].slice(0, 80)})`);
    }
  }
  for (const file of listFiles()) {
    problems.push(...installLinkProblems(file, updated.get(file) ?? readText(file), next));
  }

  if (args.check) {
    if (updated.size) {
      problems.unshift(...[...updated.keys()].map((file) => `${file}: out of date with config.json`));
    }
    if (problems.length) {
      fail([...problems, '', 'Run `node scripts/sync.mjs` and commit the changes.']);
    }
    console.log('sync: every file matches config.json');
    return;
  }

  for (const [file, text] of updated) writeFileSync(join(ROOT, file), text);
  console.log(updated.size ? `sync: updated ${[...updated.keys()].join(', ')}` : 'sync: nothing to change');
  if (problems.length) fail(['sync: fix these by hand:', ...problems.map((p) => `  - ${p}`)]);
}

main();
