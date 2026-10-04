// Runs after `ng build` (see the "build" script in package.json).
//
// The site is drawn entirely by JavaScript, so anything that reads a page without running
// JavaScript (Google's sign-in branding check, link previews, some crawlers) sees an empty page.
// This puts real text into the built HTML:
//
//   index.html           the site's name, what it is, and a link to the privacy policy
//   privacy-policy.html  the full privacy policy, served at /privacy-policy
//
// The text sits inside <app-root>, which Angular replaces as soon as the app starts, so visitors
// see the normal site. Netlify serves privacy-policy.html for /privacy-policy because a real file
// takes priority over the catch-all rule in src/_redirects.
//
// The policy text is read from the Angular component, so there is only one copy to keep up to date.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'dist', 'final-feedback', 'browser');
const policyDir = path.join(root, 'src', 'app', 'components', 'privacy-policy-content');

const DESCRIPTION =
  'FinalFeedback is where you rate movies and shows on acting, visuals, story, pacing and ending, ' +
  'and see what the people you follow thought.';

// Plain styling for the moment before the app starts: dark like the site, readable on its own.
const WRAPPER_STYLE =
  'min-height:100vh;margin:0;padding:32px 24px;box-sizing:border-box;background:#111;color:#fff;' +
  'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5';
const INNER_STYLE = 'max-width:760px;margin:0 auto';
const LINK_STYLE = 'color:#fff';

function wrap(innerHtml) {
  return `<div style="${WRAPPER_STYLE}"><div style="${INNER_STYLE}">${innerHtml}</div></div>`;
}

/** Returns `html` with whatever is inside <app-root> replaced, so running this twice is harmless. */
function fillAppRoot(html, content) {
  const pattern = /<app-root>[\s\S]*?<\/app-root>/;
  if (!pattern.test(html)) {
    throw new Error('Could not find <app-root> in the built index.html.');
  }
  return html.replace(pattern, () => `<app-root>${content}</app-root>`);
}

/** Turns the privacy policy component's template into plain HTML. */
function renderPolicy() {
  const component = readFileSync(path.join(policyDir, 'privacy-policy-content.component.ts'), 'utf8');
  let template = readFileSync(path.join(policyDir, 'privacy-policy-content.component.html'), 'utf8');

  // The values the template prints, e.g. lastUpdated = 'October 4, 2026';
  const values = {};
  for (const [, name, value] of component.matchAll(/^\s*(\w+)\s*=\s*'([^']*)';/gm)) {
    values[name] = value;
  }

  template = template
    .replace(/<!--[\s\S]*?-->/g, '')
    // The copyright year is printed as the third word of the "last updated" date.
    .replace(/\{\{\s*lastUpdated\.split\(' '\)\[2\]\s*\}\}/g, () => (values.lastUpdated ?? '').split(' ')[2] ?? '')
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name) => (name in values ? values[name] : match))
    .replace(/\[href\]="(\w+)"/g, (match, name) => (name in values ? `href="${values[name]}"` : match))
    .replace(/<a /g, `<a style="${LINK_STYLE}" `);

  // Anything Angular-specific left over would be published as raw text, so stop the build instead.
  const leftover = template.match(/\{\{[^}]*\}\}|\*ng\w+|\[\w+\]=|\(\w+\)=|@if|@for/);
  if (leftover) {
    throw new Error(
      `The privacy policy template uses "${leftover[0]}", which scripts/add-static-text.mjs ` +
        'does not know how to turn into plain HTML. Update the script to handle it.'
    );
  }
  return template;
}

const shell = readFileSync(path.join(outDir, 'index.html'), 'utf8');

const home = wrap(
  '<h1>FinalFeedback</h1>' +
    `<p>${DESCRIPTION}</p>` +
    `<p><a style="${LINK_STYLE}" href="/login">Sign in or register</a> &middot; ` +
    `<a style="${LINK_STYLE}" href="/privacy-policy">Privacy Policy</a></p>`
);
writeFileSync(path.join(outDir, 'index.html'), fillAppRoot(shell, home));

const policy = wrap(
  `<p><a style="${LINK_STYLE}" href="/">FinalFeedback</a></p>` + renderPolicy()
);
const policyPage = fillAppRoot(shell, policy).replace(
  /<title>[^<]*<\/title>/,
  '<title>Privacy Policy | FinalFeedback</title>'
);
writeFileSync(path.join(outDir, 'privacy-policy.html'), policyPage);

console.log('Added readable text to index.html and wrote privacy-policy.html in', outDir);
