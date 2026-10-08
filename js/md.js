/* Tiny, safe markdown renderer shared by the blog reader and the /admin editor.
   Supports: ## heading, ### sub-heading, > quote, ``` code ```, - list, 1. list, ---,
   **bold**, *italic*, `code`, [text](https://link). Everything is HTML-escaped first, so a post can never inject markup or script. */
(function (root) {
  'use strict';

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SAFE_URL = /^(https?:\/\/|mailto:|#|\/(?!\/))/i;

  function inline(src) {
    const hold = [];
    const stash = (html) => '\u0000' + (hold.push(html) - 1) + '\u0000';
    let s = String(src).replace(/\u0000/g, '');
    s = s.replace(/`([^`\n]+)`/g, (_, c) => stash('<code>' + esc(c) + '</code>'));
    s = s.replace(/\\([\\`*_\[\]()#>.\-!])/g, (_, c) => stash(esc(c)));
    s = esc(s);
    s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
      if (!SAFE_URL.test(url)) return text;
      const ext = /^(https?:|mailto:)/i.test(url);
      return '<a href="' + url + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + text + '</a>';
    });
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => hold[+i]);
  }

  function render(md) {
    const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let para = [];
    const flush = () => {
      if (para.length) out.push('<p>' + para.map(inline).join('<br>') + '</p>');
      para = [];
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^```/.test(line)) {
        flush();
        const code = [];
        for (i++; i < lines.length && !/^```/.test(lines[i]); i++) code.push(lines[i]);
        out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
      } else if (!line.trim()) {
        flush();
      } else if (/^---+\s*$/.test(line)) {
        flush();
        out.push('<hr>');
      } else if (/^###\s+/.test(line)) {
        flush();
        out.push('<h4>' + inline(line.replace(/^###\s+/, '')) + '</h4>');
      } else if (/^#{1,2}\s+/.test(line)) {
        flush();
        out.push('<h3>' + inline(line.replace(/^#{1,2}\s+/, '')) + '</h3>');
      } else if (/^>\s?/.test(line)) {
        flush();
        const q = [];
        for (; i < lines.length && /^>\s?/.test(lines[i]); i++) q.push(lines[i].replace(/^>\s?/, ''));
        i--;
        out.push('<blockquote>' + q.map(inline).join('<br>') + '</blockquote>');
      } else if (/^(-|\d+\.)\s+/.test(line)) {
        flush();
        const ordered = /^\d+\./.test(line);
        const re = ordered ? /^\d+\.\s+/ : /^-\s+/;
        const items = [];
        for (; i < lines.length && re.test(lines[i]); i++) items.push('<li>' + inline(lines[i].replace(re, '')) + '</li>');
        i--;
        out.push((ordered ? '<ol>' : '<ul>') + items.join('') + (ordered ? '</ol>' : '</ul>'));
      } else {
        para.push(line);
      }
    }
    flush();
    return out.join('');
  }

  const words = (md) => (String(md || '').match(/\S+/g) || []).length;

  root.MD = { render, inline, esc, words };
})(window);
