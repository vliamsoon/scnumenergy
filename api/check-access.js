/**
 * Vercel Serverless Function — /api/check-access
 * -------------------------------------------------------------------
 * The browser calls THIS (same origin as your site, no CORS involved
 * at all) instead of calling Google Apps Script directly. This function
 * makes the actual call to Apps Script server-to-server, where none of
 * the browser-specific problems (Safari forcing downloads on Apps
 * Script's redirected responses, missing CORS headers on Google's side,
 * Cross-Origin Read Blocking, etc.) apply — those are all browser
 * protections, and this code isn't a browser.
 *
 * SETUP:
 * 1. Drop this file at api/check-access.js in your Vercel project (same
 *    project as index.html — Vercel auto-detects anything under /api
 *    as a serverless function, no config needed).
 * 2. Paste your Apps Script Web App /exec URL into APPS_SCRIPT_URL below.
 * 3. Deploy (git push, or `vercel deploy`, or drag-and-drop the whole
 *    project folder again — whatever you're already using).
 * 4. Test directly: visit
 *      https://your-site.vercel.app/api/check-access?email=test@example.com
 *    in any browser. It should return JSON like {"allowed":false}.
 *
 * You do NOT need to touch index.html's checkEmailAllowed() again after
 * this — it already calls /api/check-access and expects exactly this
 * function's response shape.
 */

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxQiAwUeHvhelSMXiz6xrA8NfuJI12rcZUdvgSCo-5yhHZK8-0yCXXj35tRC6isPW0z/exec';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const email = ((req.query.email || '') + '').trim();
  const ua = ((req.query.ua || '') + '').trim();

  if (!email) {
    return res.status(200).json({ allowed: false, error: 'missing-email' });
  }

  try {
    const url = APPS_SCRIPT_URL
      + '?email=' + encodeURIComponent(email)
      + '&ua=' + encodeURIComponent(ua);

    // Plain server-to-server GET. No callback param needed here — this
    // is not a browser, so none of the JSONP/CORS/CORB workarounds the
    // client-side code used to need are relevant. redirect:'follow'
    // handles the script.google.com -> script.googleusercontent.com hop.
    const upstream = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StellarCaiAccessCheck/1.0)' }
    });
    const text = await upstream.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      // Apps Script returned something that isn't JSON (an error page,
      // a login redirect, etc.) — treat as denied, but surface exactly
      // what came back instead of a silent false so this is debuggable
      // by just visiting the URL, no server logs needed.
      return res.status(200).json({
        allowed: false,
        error: 'bad-upstream-response',
        upstreamStatus: upstream.status,
        upstreamSnippet: text.slice(0, 500)
      });
    }

    return res.status(200).json({ allowed: !!(data && data.allowed) });
  } catch (err) {
    return res.status(200).json({ allowed: false, error: 'proxy-failed', detail: String(err && err.message || err) });
  }
}
