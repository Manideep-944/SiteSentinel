import axios from 'axios';
import { validateTargetUrl } from './ssrfValidator.js';
import MonitoringCheck from '../models/MonitoringCheck.js';
import Website from '../models/Website.js';
import User from '../models/User.js';
import { sendStateTransitionAlert } from './emailService.js';
import { logger } from '../utils/logger.js';

// Map to track in-flight promises to de-duplicate simultaneous checks
const inFlightCheckPromises = new Map();

/**
 * Standard browser-like request headers to ensure compatibility with modern
 * CDNs, edge proxies, and Web Application Firewalls (WAFs).
 */
const PROBE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (SiteSentinel/1.0; +https://github.com/sitesentinel)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Connection': 'close'
};

/**
 * Executes a lightweight HTTP probe adhering to SSRF rules across redirects.
 *
 * Lightweight Probe Strategy:
 * 1. Attempts a lightweight HEAD request first to fetch HTTP status and headers without any body overhead.
 * 2. If HEAD is unsupported (e.g., returns 405 Method Not Allowed, 501 Not Implemented, 400 Bad Request)
 *    or rejected, gracefully falls back to a streamed GET request.
 * 3. The streamed GET request uses responseType: 'stream'. As soon as response headers arrive,
 *    the stream is immediately destroyed, avoiding buffering or downloading the webpage body.
 *    This completely eliminates "maxContentLength exceeded" errors on large pages (such as Amazon).
 * 4. All redirect destinations are re-validated against the SSRF engine before following.
 *
 * @param {string} targetUrl
 * @param {number} timeoutMs
 * @param {number} maxRedirects
 * @returns {Promise<{ status: number, statusText: string, headers: object, resolvedIp: string, methodUsed: string }>}
 */
async function safeHttpRequest(targetUrl, timeoutMs = 10000, maxRedirects = 5) {
  let currentUrl = targetUrl;
  let redirectsCount = 0;
  let lastResolvedIp = null;

  while (redirectsCount <= maxRedirects) {
    // 1. Validate destination URL against SSRF, DNS rebinding, and private subnet policies
    const validation = await validateTargetUrl(currentUrl);
    lastResolvedIp = validation.resolvedIps[0] || null;

    let response = null;
    let methodUsed = 'HEAD';

    // 2. Attempt lightweight HEAD request first
    try {
      response = await axios({
        method: 'HEAD',
        url: currentUrl,
        timeout: timeoutMs,
        maxRedirects: 0,
        validateStatus: () => true, // capture all status codes without throwing
        headers: PROBE_HEADERS
      });
    } catch (headErr) {
      logger.debug(`[Monitor] HEAD request to ${currentUrl} failed: ${headErr.message}. Attempting GET stream fallback.`);
    }

    // 3. Fallback to streamed GET request if HEAD is unsupported (405, 501, 400, 403) or failed
    if (!response || [405, 501, 400, 403].includes(response.status)) {
      methodUsed = 'GET';
      let getRes = null;
      try {
        getRes = await axios({
          method: 'GET',
          url: currentUrl,
          timeout: timeoutMs,
          maxRedirects: 0,
          responseType: 'stream', // Resolves immediately on headers without buffering body
          validateStatus: () => true,
          headers: PROBE_HEADERS
        });

        response = {
          status: getRes.status,
          statusText: getRes.statusText,
          headers: getRes.headers
        };
      } finally {
        // Crucial: immediately destroy the incoming stream to abort body download
        if (getRes?.data && typeof getRes.data.destroy === 'function') {
          getRes.data.destroy();
        }
      }
    }

    // 4. Handle HTTP Redirects (301, 302, 303, 307, 308)
    if ([301, 302, 303, 307, 308].includes(response.status) && response.headers?.location) {
      redirectsCount++;
      if (redirectsCount > maxRedirects) {
        throw new Error(`Exceeded maximum allowed redirects (${maxRedirects})`);
      }
      const nextUrl = new URL(response.headers.location, currentUrl).href;
      currentUrl = nextUrl;
      continue;
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      resolvedIp: lastResolvedIp,
      methodUsed
    };
  }

  throw new Error('Too many redirects');
}

/**
 * Evaluates the HTTP response against the project's monitoring success criteria
 * and produces a descriptive diagnostic message and classification.
 *
 * Success Criteria Policy:
 * - UP: HTTP status 200 - 399 (Successful response or completed redirect chain).
 * - DOWN:
 *   - ACCESS_DENIED: HTTP 401 or 403 (Server is online, but requires authentication or WAF blocked probe).
 *   - RATE_LIMITED: HTTP 429 (Server is online, but rate-limiting client).
 *   - HTTP_ERROR: HTTP 404, 500, 502, 503, 504 (Server is reachable, but returned client/server error).
 *   - TIMEOUT / NETWORK_ERROR / DNS_ERROR / BLOCKED_SSRF (Underlying network or connection failure).
 *
 * @param {object} response
 * @returns {{ status: 'UP' | 'DOWN', failureType: string, errorMessage: string | null }}
 */
function evaluateResponseStatus(response) {
  const code = response.status;
  const text = response.statusText || '';

  // 2xx and 3xx are treated as operational (UP)
  if (code >= 200 && code < 400) {
    return {
      status: 'UP',
      failureType: 'NONE',
      errorMessage: null
    };
  }

  // 401 Unauthorized
  if (code === 401) {
    return {
      status: 'DOWN',
      failureType: 'ACCESS_DENIED',
      errorMessage: `HTTP 401 Unauthorized: Server is online; authentication credentials required.`
    };
  }

  // 403 Forbidden / WAF bot filter
  if (code === 403) {
    return {
      status: 'DOWN',
      failureType: 'ACCESS_DENIED',
      errorMessage: `HTTP 403 Forbidden: Server is online; access denied or automated requests filtered (WAF/Bot protection).`
    };
  }

  // 429 Too Many Requests
  if (code === 429) {
    return {
      status: 'DOWN',
      failureType: 'RATE_LIMITED',
      errorMessage: `HTTP 429 Too Many Requests: Server is online; client is currently rate-limited.`
    };
  }

  // 404 Not Found
  if (code === 404) {
    return {
      status: 'DOWN',
      failureType: 'HTTP_ERROR',
      errorMessage: `HTTP 404 Not Found: Server is online; the requested URL path does not exist.`
    };
  }

  // Other 4xx Client Errors
  if (code >= 400 && code < 500) {
    return {
      status: 'DOWN',
      failureType: 'HTTP_ERROR',
      errorMessage: `HTTP ${code} ${text || 'Client Error'}: Server is online but rejected the request.`
    };
  }

  // 500 Internal Server Error
  if (code === 500) {
    return {
      status: 'DOWN',
      failureType: 'HTTP_ERROR',
      errorMessage: `HTTP 500 Internal Server Error: Origin server is reachable but encountered an internal server error.`
    };
  }

  // 502 Bad Gateway
  if (code === 502) {
    return {
      status: 'DOWN',
      failureType: 'HTTP_ERROR',
      errorMessage: `HTTP 502 Bad Gateway: Reverse proxy/gateway received an invalid response from upstream server.`
    };
  }

  // 503 Service Unavailable
  if (code === 503) {
    return {
      status: 'DOWN',
      failureType: 'HTTP_ERROR',
      errorMessage: `HTTP 503 Service Unavailable: Origin server is temporarily overloaded or down for maintenance.`
    };
  }

  // 504 Gateway Timeout
  if (code === 504) {
    return {
      status: 'DOWN',
      failureType: 'HTTP_ERROR',
      errorMessage: `HTTP 504 Gateway Timeout: Gateway or proxy timed out waiting for upstream server.`
    };
  }

  // Other 5xx Server Errors
  return {
    status: 'DOWN',
    failureType: 'HTTP_ERROR',
    errorMessage: `HTTP ${code} ${text || 'Server Error'}: Origin server returned an error response.`
  };
}

/**
 * Internal worker that executes the check logic for a website.
 */
async function executeCheckWorker(websiteId, isManualCheck) {
  const website = await Website.findById(websiteId);
  if (!website) {
    throw new Error(`Website not found with ID: ${websiteId}`);
  }

  if (!website.isMonitoringEnabled && !isManualCheck) {
    logger.info(`[Monitor] Site "${website.name}" monitoring is disabled. Skipping scheduled check.`);
    return null;
  }

  const previousStatus = website.lastStatus;
  const startTime = process.hrtime.bigint();
  const checkedAt = new Date();

  let checkResult = {
    websiteId: website._id,
    ownerId: website.ownerId,
    checkedAt,
    status: 'DOWN',
    responseTimeMs: 0,
    httpStatusCode: null,
    errorMessage: null,
    failureType: 'NONE',
    resolvedIp: null
  };

  const timeout = website.timeoutMs || Number(process.env.REQUEST_TIMEOUT_MS) || 10000;

  try {
    const response = await safeHttpRequest(website.url, timeout);
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const roundedMs = Math.max(1, Math.round(durationMs));

    checkResult.responseTimeMs = roundedMs;
    checkResult.httpStatusCode = response.status;
    checkResult.resolvedIp = response.resolvedIp;

    // Evaluate response code against defined success criteria
    const evaluation = evaluateResponseStatus(response);
    checkResult.status = evaluation.status;
    checkResult.failureType = evaluation.failureType;
    checkResult.errorMessage = evaluation.errorMessage;
  } catch (err) {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    checkResult.responseTimeMs = Math.max(1, Math.round(durationMs));
    checkResult.status = 'DOWN';

    const errMsg = err.message || '';

    if (errMsg.includes('Security Exception') || errMsg.includes('Prohibited') || errMsg.includes('Forbidden')) {
      checkResult.failureType = 'BLOCKED_SSRF';
      checkResult.errorMessage = errMsg;
    } else if (err.code === 'ECONNABORTED' || errMsg.toLowerCase().includes('timeout')) {
      checkResult.failureType = 'TIMEOUT';
      checkResult.errorMessage = `Request timed out after ${timeout}ms: Destination server did not respond in time.`;
    } else if (err.code === 'ENOTFOUND' || errMsg.includes('DNS resolution failed') || errMsg.includes('Unable to resolve host')) {
      checkResult.failureType = 'DNS_ERROR';
      checkResult.errorMessage = `Domain resolution failed: Unable to resolve hostname for "${website.url}".`;
    } else if (['ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ECONNRESET'].includes(err.code)) {
      checkResult.failureType = 'NETWORK_ERROR';
      checkResult.errorMessage = `Network unreachable (${err.code}): Connection failed or reset by destination host.`;
    } else {
      checkResult.failureType = 'NETWORK_ERROR';
      checkResult.errorMessage = errMsg || 'Unknown network failure';
    }
  }

  // Persist check result to MongoDB
  const savedCheck = await MonitoringCheck.create(checkResult);

  // Update website record
  website.lastStatus = checkResult.status;
  website.lastCheckedAt = checkedAt;
  website.lastResponseTimeMs = checkResult.responseTimeMs;
  website.lastHttpStatusCode = checkResult.httpStatusCode;
  website.lastErrorMessage = checkResult.errorMessage;

  if (checkResult.status === 'DOWN') {
    website.consecutiveFails = (website.consecutiveFails || 0) + 1;
  } else {
    website.consecutiveFails = 0;
  }

  await website.save();

  logger.info(
    `[Monitor] Check complete: ${website.name} (${website.url}) -> ${checkResult.status} ` +
    `[Code: ${checkResult.httpStatusCode || 'N/A'}, Duration: ${checkResult.responseTimeMs}ms, Type: ${checkResult.failureType}]`
  );

  // Trigger state transition alert if status changed (e.g. UP -> DOWN or DOWN -> UP)
  if (previousStatus && previousStatus !== 'PENDING' && previousStatus !== checkResult.status) {
    try {
      const user = await User.findById(website.ownerId);
      if (user) {
        sendStateTransitionAlert({
          user,
          website,
          previousStatus,
          newStatus: checkResult.status,
          checkResult
        }).catch(mailErr => logger.error(`[Alert Error] ${mailErr.message}`));
      }
    } catch (userErr) {
      logger.error(`[Monitor] Failed to fetch user for alert: ${userErr.message}`);
    }
  }

  return savedCheck;
}

/**
 * Public method to perform a check. If an identical check is already in-flight,
 * awaits the active promise to avoid duplicate simultaneous requests.
 */
export async function performCheck(websiteId, isManualCheck = false) {
  const websiteIdStr = websiteId.toString();

  if (inFlightCheckPromises.has(websiteIdStr)) {
    logger.info(`[Monitor] In-flight check already running for ${websiteIdStr}. Joining existing check promise.`);
    return inFlightCheckPromises.get(websiteIdStr);
  }

  const checkPromise = executeCheckWorker(websiteId, isManualCheck).finally(() => {
    inFlightCheckPromises.delete(websiteIdStr);
  });

  inFlightCheckPromises.set(websiteIdStr, checkPromise);
  return checkPromise;
}
