#!/usr/bin/env node
// Regenerates public/version.txt from the current HEAD commit. Run before
// dev/build so the served file always reflects the latest commit.
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function git(format) {
  return execSync(`git log -1 --format=${format}`, { encoding: 'utf8' }).trim();
}

const hash = git('%h');
const title = git('%s');
const committedAt = git('%cI');

const contents = `commit: ${hash}\ntitle: ${title}\ndate: ${committedAt}\n`;

const outPath = path.join(__dirname, '..', 'public', 'version.txt');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, contents);
