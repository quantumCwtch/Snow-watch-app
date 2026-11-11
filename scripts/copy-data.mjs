// Copy the committed data/ folder into the built site so the front end can fetch it.
import { cpSync, existsSync } from 'node:fs';
if (existsSync('data')) cpSync('data', 'dist/data', { recursive: true });
console.log('Copied data/ into dist/data');
