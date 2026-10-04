import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderJourneyInterface } from '../../finnovation-interface.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const target = process.argv[2] || 'index4-6-3.html';
const html = (await fs.readFile(path.resolve(root,target),'utf8')).replace(/\r\n/g,'\n');
const canonical = 'https://qq7636946.github.io/3Dmountain/3Dmountain-3/index3.html';
const base = new URL('.',canonical);
const meta = name => {
  const matches = [...html.matchAll(new RegExp(`<meta (?:name|property)="${name.replaceAll(':','\\:')}" content="([^"]*)">`,'g'))];
  assert.equal(matches.length,1,`Expected exactly one ${name} meta`);
  return matches[0][1];
};
const title = [...html.matchAll(/<title>(.*?)<\/title>/g)];
assert.equal(title.length,1);
assert.equal(meta('og:title'),title[0][1]);
assert.equal(meta('twitter:title'),title[0][1]);
assert.equal(meta('description'),meta('og:description'));
assert.equal(meta('description'),meta('twitter:description'));
assert(!/noindex|nofollow/.test(meta('robots')));
assert.deepEqual([...html.matchAll(/<link rel="canonical" href="([^"]*)">/g)].map(m=>m[1]),[canonical]);
assert.equal(meta('og:url'),canonical);
assert.equal(meta('og:type'),'website');
assert.equal(meta('twitter:card'),'summary_large_image');
assert.equal(meta('og:image'),new URL('images/finnovation-social-card.png',base).href);
assert.equal(meta('twitter:image'),meta('og:image'));
assert(meta('og:image:alt'));assert(meta('twitter:image:alt'));
const blocks=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
assert.equal(blocks.length,1);
const graph=JSON.parse(blocks[0][1]);
assert.equal(graph['@context'],'https://schema.org');
assert.deepEqual(graph['@graph'].map(n=>n['@type']),['Organization','WebSite','WebPage']);
const ids=new Set(graph['@graph'].map(n=>n['@id']));
for(const node of graph['@graph']){
  assert.equal(node.url,canonical);
  for(const key of ['publisher','isPartOf','about'])if(node[key])assert(ids.has(node[key]['@id']));
}
for(const [file,width,height] of [['images/finnovation-social-card.png',1200,630],['images/finnovation-logo.png',512,512]]){
 const png=await fs.readFile(path.join(root,file));
 assert.equal(png.subarray(1,4).toString(),'PNG');
 assert.equal(png.readUInt32BE(16),width);assert.equal(png.readUInt32BE(20),height);
 assert(png.length<250*1024,`${file} exceeds the social asset budget`);
}
const start=html.indexOf('<!-- FINNOVATION_STATIC_UI_START -->'),end=html.indexOf('<!-- FINNOVATION_STATIC_UI_END -->');
assert(start>0&&end>start);
const content=html.slice(start,end);
assert(content.includes(renderJourneyInterface()),'Static HTML is out of date: run build-static-interface.mjs');
assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1);
assert.equal((html.match(/<main(?:\s|>)/g)||[]).length,1);
const articles=[...content.matchAll(/<article\b[^>]*>/g)];
assert.equal(articles.length,10);
for(const [tag] of articles)assert(!/\binert\b|aria-hidden/.test(tag),'Initial content must remain accessible without hydration');
for(const word of ['AI 量化交易','上市櫃投資','未上市與 PRE-IPO','衍生性商品'])assert(content.includes(word));
assert(html.includes('<noscript><link rel="stylesheet" href="./finnovation-readable.css"></noscript>'));
await fs.access(path.join(root,'finnovation-readable.css'));
const sitemap=await fs.readFile(path.join(root,'sitemap.xml'),'utf8');
assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]),[canonical]);
console.log(JSON.stringify({page:target,canonical,structuredData:graph['@graph'].map(n=>n['@type']),staticChapters:articles.length,socialImage:'1200x630',logo:'512x512',result:'passed'},null,2));