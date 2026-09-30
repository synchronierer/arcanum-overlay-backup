const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const resources = path.join(__dirname, '../src/main/resources');
const login = fs.readFileSync(path.join(resources, 'templates/html/login.html'), 'utf8');
const routes = JSON.parse(fs.readFileSync(path.join(resources, 'meta/paths/get_paths.json'), 'utf8'));

test('login artwork uses content-hashed public WebP routes', () => {
    const urls = [...login.matchAll(/(?:url\(|src\s*=\s*)["'](\/arcanum-[^"')]+\.webp)["']/g)].map(match => match[1]);
    assert.ok(urls.length >= 4);
    assert.ok(urls.every(url => /-[a-f0-9]{16}\.webp$/.test(url)));
    for (const url of urls) {
        assert.deepEqual(routes[url]?.type, 'GET');
        assert.deepEqual(routes[url]?.handler_type, 'FileRequestHandler');
        assert.deepEqual(routes[url]?.access_level, 'public');
        assert.deepEqual(routes[url]?.context, 'imgs');
        const namespace = url.includes('inspiration-') ? 'inspiration' : 'login';
        assert.deepEqual(routes[url]?.namespaces, [namespace]);
    }
});

test('login chooses its inspiration before assigning a single image source', () => {
    const quoteImage = login.match(/<img\s+id="quoteCardImage"[^>]*>/s)?.[0];
    assert.ok(quoteImage);
    assert.doesNotMatch(quoteImage, /\ssrc=/i);
    assert.match(login, /quoteCardImage\.src\s*=\s*selectedInspiration\.image/);
    assert.equal((login.match(/id="quoteCardImage"/g) || []).length, 1);
    assert.doesNotMatch(login, /src="\/arcanum-inspiration-[^"]+\.png"/);
});
