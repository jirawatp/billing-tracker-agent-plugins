#!/usr/bin/env node
// Offline checks for every manifest, skill and doc in this repo.
//
//   node scripts/validate.mjs        run all checks
//   node scripts/validate.mjs --ci   also fail if python3 with tomllib is missing
//
// CI additionally validates the manifests against their published JSON Schemas
// and with the clients' own CLIs (see .github/workflows/ci.yml).

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CI = process.argv.includes('--ci');
const PLUGIN_NAME = 'billing-tracker';
const SERVER_KEY = 'bills';
const TOOL_COUNT = 30;
const MAX_TOOL_NAME = 64;
const AGENT_PLUGINS_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
const AGENT_PLUGINS_MCP_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';
const TOOLS_REFERENCE = 'skills/billing-tracker/references/tools.md';
const TOOL_TOKEN = /`((?:bills|summary|reports|account|lineLink|chat)\.[A-Za-z]+)`/g;
const TEXT_FILES = /\.(md|json|toml|ya?ml|mjs)$|^(LICENSE|\.gitignore|\.editorconfig)$/;

const errors = [];
const warnings = [];
const report = (file, message) => errors.push(`${file}: ${message}`);
const warn = (file, message) => warnings.push(`${file}: ${message}`);

function listFiles(dir = ROOT) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else files.push(relative(ROOT, full).split('\\').join('/'));
  }
  return files.sort();
}

const files = listFiles();
const read = (file) => readFileSync(join(ROOT, file), 'utf8');
const json = new Map();

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function fencedBlocks(text, language) {
  const blocks = [];
  const pattern = /^```([\w-]*)[^\n]*\n([\s\S]*?)^```\s*$/gm;
  for (const match of text.matchAll(pattern)) {
    if (match[1] === language) blocks.push({ code: match[2], line: lineOf(text, match.index) });
  }
  return blocks;
}

function checkHygiene() {
  for (const file of files.filter((f) => TEXT_FILES.test(basename(f)) || TEXT_FILES.test(f))) {
    const text = read(file);
    if (text.includes('\r')) report(file, 'uses CRLF line endings');
    if (text.length && !text.endsWith('\n')) report(file, 'does not end with a newline');
    text.split('\n').forEach((line, i) => {
      if (/[ \t]+$/.test(line)) report(file, `line ${i + 1} has trailing whitespace`);
      if (line.includes('\t') && !file.endsWith('.mjs')) report(file, `line ${i + 1} contains a tab; indent with 2 spaces`);
      if (line.includes('\u2014')) report(file, `line ${i + 1} contains an em dash`);
      if (/\p{Extended_Pictographic}|\uFE0F/u.test(line)) report(file, `line ${i + 1} contains an emoji`);
    });
    if (/(?<!\$)\{\{[^}]+\}\}/.test(text)) report(file, 'contains an unreplaced placeholder in double braces');
  }
}

function checkJsonFiles() {
  for (const file of files.filter((f) => f.endsWith('.json'))) {
    const text = read(file);
    let value;
    try {
      value = JSON.parse(text);
    } catch (error) {
      report(file, `invalid JSON: ${error.message}`);
      continue;
    }
    json.set(file, value);
    if (`${JSON.stringify(value, null, 2)}\n` !== text) {
      report(file, 'is not formatted as 2-space JSON (JSON.stringify(value, null, 2) plus a newline)');
    }
  }
}

function checkToml() {
  const documents = [];
  for (const file of files.filter((f) => f.endsWith('.toml'))) documents.push({ name: file, text: read(file) });
  for (const file of files.filter((f) => f.endsWith('.md'))) {
    for (const block of fencedBlocks(read(file), 'toml')) {
      documents.push({ name: `${file}:${block.line}`, text: block.code });
    }
  }
  if (!documents.length) return;
  const script = [
    'import json, sys, tomllib',
    'problems = []',
    'for doc in json.load(sys.stdin):',
    '    try:',
    '        tomllib.loads(doc["text"])',
    '    except Exception as error:',
    '        problems.append(doc["name"] + ": invalid TOML: " + str(error))',
    'print(json.dumps(problems))',
  ].join('\n');
  const result = spawnSync('python3', ['-c', script], { input: JSON.stringify(documents), encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    const message = 'TOML not checked: needs python3 3.11 or newer (tomllib)';
    if (CI) report('toml', message);
    else warn('toml', message);
    return;
  }
  for (const problem of JSON.parse(result.stdout)) errors.push(problem);
}

function checkMarkdownJsonBlocks() {
  for (const file of files.filter((f) => f.endsWith('.md'))) {
    for (const block of fencedBlocks(read(file), 'json')) {
      try {
        JSON.parse(block.code);
      } catch (error) {
        report(file, `JSON block at line ${block.line} does not parse: ${error.message}`);
      }
    }
  }
}

function slugify(heading) {
  return heading
    .replace(/`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function anchorsOf(text) {
  const anchors = new Set();
  const seen = new Map();
  const withoutCode = text.replace(/^```[\s\S]*?^```\s*$/gm, '');
  for (const match of withoutCode.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = slugify(match[1]);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count ? `${base}-${count}` : base);
  }
  return anchors;
}

function checkMarkdownLinks() {
  for (const file of files.filter((f) => f.endsWith('.md'))) {
    const text = read(file).replace(/^```[\s\S]*?^```\s*$/gm, '');
    for (const match of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const target = match[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      const [path, fragment] = target.split('#');
      const resolved = path ? resolve(ROOT, dirname(file), decodeURIComponent(path)) : join(ROOT, file);
      if (!existsSync(resolved)) {
        report(file, `link to missing file ${target}`);
        continue;
      }
      if (fragment && resolved.endsWith('.md') && statSync(resolved).isFile()) {
        if (!anchorsOf(readFileSync(resolved, 'utf8')).has(fragment)) {
          report(file, `link to missing heading #${fragment} in ${relative(ROOT, resolved) || file}`);
        }
      }
    }
  }
}

function frontmatter(file, text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    report(file, 'missing YAML frontmatter');
    return null;
  }
  const data = {};
  let parent = null;
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const nested = line.match(/^ {2}([\w-]+):\s*(.*)$/);
    const top = line.match(/^([\w-]+):\s*(.*)$/);
    const unquote = (value) => value.replace(/^(['"])(.*)\1$/, '$2');
    if (nested && parent) data[parent][nested[1]] = unquote(nested[2]);
    else if (top && top[2] === '') {
      parent = top[1];
      data[parent] = {};
    } else if (top) {
      parent = null;
      data[top[1]] = unquote(top[2]);
    } else report(file, `cannot parse frontmatter line: ${line}`);
  }
  return { data, body: text.slice(match[0].length) };
}

function checkSkills() {
  const allowed = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
  for (const file of files.filter((f) => /^skills\/[^/]+\/SKILL\.md$/.test(f))) {
    const parsed = frontmatter(file, read(file));
    if (!parsed) continue;
    const { data, body } = parsed;
    const directory = file.split('/')[1];
    for (const key of Object.keys(data)) if (!allowed.has(key)) report(file, `unknown frontmatter field ${key}`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.name ?? '') || data.name.length > 64) {
      report(file, 'name must be 1-64 lowercase letters, digits and single hyphens');
    }
    if (data.name !== directory) report(file, `name "${data.name}" must match its directory "${directory}"`);
    if (!data.description || data.description.length > 1024) report(file, 'description must be 1-1024 characters');
    if (data.compatibility && data.compatibility.length > 500) report(file, 'compatibility must be at most 500 characters');
    if (data.metadata && Object.values(data.metadata).some((v) => typeof v !== 'string')) {
      report(file, 'metadata must map strings to strings');
    }
    if (body.split('\n').length > 500) report(file, 'body is over 500 lines; move detail into references/');
  }
}

function checkTools() {
  if (!files.includes(TOOLS_REFERENCE)) {
    report(TOOLS_REFERENCE, 'missing');
    return;
  }
  const catalogue = new Set();
  for (const line of read(TOOLS_REFERENCE).split('\n')) {
    const cell = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (cell && /^(bills|summary|reports|account|lineLink|chat)\.[A-Za-z]+$/.test(cell[1])) {
      if (catalogue.has(cell[1])) report(TOOLS_REFERENCE, `lists ${cell[1]} twice`);
      catalogue.add(cell[1]);
    }
  }
  if (catalogue.size !== TOOL_COUNT) {
    report(TOOLS_REFERENCE, `lists ${catalogue.size} tools; the server contract has ${TOOL_COUNT}`);
  }
  for (const tool of catalogue) {
    const qualified = `mcp__plugin_${PLUGIN_NAME}_${SERVER_KEY}__${tool}`;
    if (qualified.length > MAX_TOOL_NAME) {
      report(TOOLS_REFERENCE, `${qualified} is longer than ${MAX_TOOL_NAME} characters`);
    }
  }
  for (const file of files.filter((f) => f.endsWith('.md'))) {
    for (const match of read(file).matchAll(TOOL_TOKEN)) {
      if (!catalogue.has(match[1])) report(file, `mentions unknown tool ${match[1]}`);
    }
  }
}

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.hash;
  } catch {
    return false;
  }
}

function checkManifests() {
  const get = (file) => {
    if (!json.has(file)) report(file, 'missing or invalid');
    return json.get(file) ?? {};
  };
  const plugin = get('plugin.json');
  const allowed = ['$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'extensions'];
  for (const key of Object.keys(plugin)) if (!allowed.includes(key)) report('plugin.json', `field ${key} is not part of Agent Plugins 1.0`);
  if (plugin.$schema !== AGENT_PLUGINS_SCHEMA) report('plugin.json', `$schema must be ${AGENT_PLUGINS_SCHEMA}`);
  if (!/^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(plugin.name ?? '') || plugin.name.length > 64) {
    report('plugin.json', 'name breaks the Agent Plugins naming rules');
  }
  for (const key of Object.keys(plugin.author ?? {})) {
    if (!['name', 'email', 'url'].includes(key)) report('plugin.json', `author.${key} is not allowed`);
  }

  const mcp = get('mcp.json');
  if (mcp.$schema !== AGENT_PLUGINS_MCP_SCHEMA) report('mcp.json', `$schema must be ${AGENT_PLUGINS_MCP_SCHEMA}`);
  for (const key of Object.keys(mcp)) if (!['$schema', 'mcpServers'].includes(key)) report('mcp.json', `unexpected field ${key}`);
  for (const [name, server] of Object.entries(mcp.mcpServers ?? {})) {
    if (server.type !== 'streamable-http') report('mcp.json', `${name}.type must be streamable-http`);
    for (const key of Object.keys(server)) if (!['type', 'url', 'headers'].includes(key)) report('mcp.json', `${name}.${key} is not allowed`);
  }

  const claudePlugin = get('.claude-plugin/plugin.json');
  if (/^(claude|anthropic|anthropics|cc-plugin)-/.test(claudePlugin.name ?? '')) {
    report('.claude-plugin/plugin.json', 'name is reserved by Anthropic');
  }

  const claudeMarket = get('.claude-plugin/marketplace.json');
  const codexMarket = get('.agents/plugins/marketplace.json');
  for (const [file, market, sourcePath] of [
    ['.claude-plugin/marketplace.json', claudeMarket, (entry) => entry.source],
    ['.agents/plugins/marketplace.json', codexMarket, (entry) => entry.source?.path ?? entry.source],
  ]) {
    if (!/^[A-Za-z0-9_-]+$/.test(market.name ?? '')) report(file, 'name must use letters, digits, - and _ only');
    if (!Array.isArray(market.plugins) || market.plugins.length === 0) report(file, 'has no plugins');
    for (const entry of market.plugins ?? []) {
      const path = sourcePath(entry);
      if (typeof path !== 'string' || !path.startsWith('./')) report(file, `${entry.name}: source must be a ./ path`);
      else if (!existsSync(join(ROOT, path, 'plugin.json'))) report(file, `${entry.name}: no plugin.json at ${path}`);
    }
  }
  for (const entry of codexMarket.plugins ?? []) {
    if (!entry.policy?.installation || !entry.policy?.authentication || !entry.category) {
      report('.agents/plugins/marketplace.json', `${entry.name}: needs policy.installation, policy.authentication and category`);
    }
  }

  const server = get('server.json');
  if (!/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/.test(server.name ?? '')) report('server.json', 'name must be namespace/name');
  if (!server.description || server.description.length > 100) report('server.json', 'description must be 1-100 characters');
  if (server.title && server.title.length > 100) report('server.json', 'title must be at most 100 characters');
  if (/[\^~><=*x]/i.test((server.version ?? '').replace(/-.*/, ''))) report('server.json', 'version must not be a range');
  if (server.remotes?.[0]?.type !== 'streamable-http') report('server.json', 'remotes[0].type must be streamable-http');

  const names = {
    'plugin.json': plugin.name,
    '.claude-plugin/plugin.json': claudePlugin.name,
    '.claude-plugin/marketplace.json': claudeMarket.plugins?.[0]?.name,
    '.agents/plugins/marketplace.json': codexMarket.plugins?.[0]?.name,
    'gemini-extension.json': get('gemini-extension.json').name,
  };
  for (const [file, name] of Object.entries(names)) {
    if (name !== PLUGIN_NAME) report(file, `plugin name is "${name}", expected "${PLUGIN_NAME}"`);
  }

  const versions = {
    'plugin.json': plugin.version,
    '.claude-plugin/plugin.json': claudePlugin.version,
    'gemini-extension.json': get('gemini-extension.json').version,
    'server.json': server.version,
  };
  if (new Set(Object.values(versions)).size !== 1) {
    report('versions', `differ: ${Object.entries(versions).map(([f, v]) => `${f}=${v}`).join(', ')}`);
  }

  const servers = {
    'mcp.json': [mcp.mcpServers, 'url'],
    '.mcp.json': [get('.mcp.json').mcpServers, 'url'],
    'mcp_config.json': [get('mcp_config.json').mcpServers, 'serverUrl'],
    'gemini-extension.json': [get('gemini-extension.json').mcpServers, 'httpUrl'],
  };
  const urls = new Set([server.remotes?.[0]?.url]);
  for (const [file, [map, field]] of Object.entries(servers)) {
    const keys = Object.keys(map ?? {});
    if (keys.length !== 1 || keys[0] !== SERVER_KEY) report(file, `must define exactly one MCP server named "${SERVER_KEY}"`);
    const url = map?.[SERVER_KEY]?.[field];
    if (!isHttpsUrl(url)) report(file, `${SERVER_KEY}.${field} must be an https URL`);
    urls.add(url);
  }
  if (get('.mcp.json').mcpServers?.[SERVER_KEY]?.type !== 'http') report('.mcp.json', `${SERVER_KEY}.type must be http`);
  if (urls.size !== 1) report('server URLs', `differ across manifests: ${[...urls].join(', ')}`);
}

checkHygiene();
checkJsonFiles();
checkToml();
checkMarkdownJsonBlocks();
checkMarkdownLinks();
checkSkills();
checkTools();
checkManifests();

for (const message of warnings) console.warn(`warning: ${message}`);
if (errors.length) {
  for (const message of errors) console.error(`error: ${message}`);
  console.error(`\nvalidate: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log(`validate: ${files.length} files OK`);
