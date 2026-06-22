const http = require('http');
const https = require('https');

const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Fetch a URL and return HTML as a string. Works on Node 16+ (no global fetch required).
 */
function fetchHtml(url, { userAgent = DEFAULT_UA, maxRedirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.request(
      url,
      {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
      (res) => {
        const { statusCode, headers } = res;

        if (statusCode >= 300 && statusCode < 400 && headers.location && maxRedirects > 0) {
          res.resume();
          const next = new URL(headers.location, url).toString();
          fetchHtml(next, { userAgent, maxRedirects: maxRedirects - 1 })
            .then(resolve)
            .catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          res.resume();
          const err = new Error(`HTTP ${statusCode} for ${url}`);
          err.status = statusCode;
          reject(err);
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }
    );

    req.on('error', reject);
    req.end();
  });
}

module.exports = { fetchHtml, DEFAULT_UA };
