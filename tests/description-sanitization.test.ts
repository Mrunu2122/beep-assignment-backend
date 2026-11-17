import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeJobDescription, decodeHtmlEntities } from '../../frontend/src/lib/sanitize-description';

test('decodeHtmlEntities: idempotent and decodes single & double encoded entities', () => {
  const single = '&lt;div&gt;Hello World&lt;/div&gt;';
  assert.equal(decodeHtmlEntities(single), '<div>Hello World</div>');

  const double = '&amp;lt;div&amp;gt;Double Encoded&amp;lt;/div&amp;gt;';
  assert.equal(decodeHtmlEntities(double), '<div>Double Encoded</div>');

  const quotes = '&quot;Software Engineer&quot; &amp; &apos;Architect&apos;';
  assert.equal(decodeHtmlEntities(quotes), '"Software Engineer" & \'Architect\'');

  const plain = 'Normal plain text without entities';
  assert.equal(decodeHtmlEntities(plain), plain);
});

test('sanitizeJobDescription: strips dangerous tags, script injections, and event handlers', () => {
  const malicious = `
    <div>
      <p>Clean description text</p>
      <script>alert('XSS')</script>
      <img src="x" onerror="alert(1)" />
      <a href="javascript:alert(2)">Click me</a>
      <a href="https://example.com/apply">Legit link</a>
    </div>
  `;

  const clean = sanitizeJobDescription(malicious);

  // Script tags stripped
  assert.ok(!clean.includes('<script>'));
  assert.ok(!clean.includes('alert(\'XSS\')'));

  // Onerror stripped
  assert.ok(!clean.includes('onerror'));

  // Javascript link stripped or invalidated
  assert.ok(!clean.includes('javascript:'));

  // Legitimate content and link preserved
  assert.ok(clean.includes('Clean description text'));
  assert.ok(clean.includes('https://example.com/apply'));
});

test('sanitizeJobDescription: preserves valid HTML structures (lists, headings, paragraphs)', () => {
  const markup = `
    <h2>Requirements</h2>
    <ul>
      <li>Proficiency in <strong>TypeScript</strong> &amp; <em>Node.js</em></li>
      <li>Experience with REST APIs</li>
    </ul>
  `;

  const sanitized = sanitizeJobDescription(markup);
  assert.ok(sanitized.includes('<h2>Requirements</h2>'));
  assert.ok(sanitized.includes('<ul>'));
  assert.ok(sanitized.includes('<li>Proficiency in <strong>TypeScript</strong> &amp; <em>Node.js</em></li>') || sanitized.includes('<li>Proficiency in <strong>TypeScript</strong> &amp; <em>Node.js</em></li>'));
});

test('sanitizeJobDescription: cleans raw Greenhouse encoded Reddit description sample', () => {
  const rawRedditSample = '&lt;div class=&quot;content-intro&quot;&gt;&lt;div class=&quot;c-message_kit__blocks&quot;&gt;&lt;p&gt;Reddit is hiring.&lt;/p&gt;&lt;/div&gt;&lt;/div&gt;';
  const clean = sanitizeJobDescription(rawRedditSample);

  assert.ok(!clean.includes('&lt;'));
  assert.ok(!clean.includes('&gt;'));
  assert.ok(!clean.includes('&quot;'));
  assert.ok(clean.includes('<p>Reddit is hiring.</p>'));
});
