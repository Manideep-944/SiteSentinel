import dns from 'dns';
import net from 'net';

/**
 * Checks if an IPv4 address belongs to a private, loopback, or reserved subnet.
 * @param {string} ip
 * @returns {boolean} true if blocked
 */
function isBlockedIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return true; // malformed IPv4
  }

  const [b0, b1, b2, b3] = parts;

  // 0.0.0.0/8 - Current network / default route
  if (b0 === 0) return true;

  // 10.0.0.0/8 - Private-Use
  if (b0 === 10) return true;

  // 100.64.0.0/10 - Shared Address Space (Carrier Grade NAT)
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

  // 127.0.0.0/8 - Loopback
  if (b0 === 127) return true;

  // 169.254.0.0/16 - Link Local (includes 169.254.169.254 AWS/GCP/Azure/OCI metadata)
  if (b0 === 169 && b1 === 254) return true;

  // 172.16.0.0/12 - Private-Use (172.16.0.0 - 172.31.255.255)
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

  // 192.0.0.0/24 - IETF Protocol Assignments
  if (b0 === 192 && b1 === 0 && b2 === 0) return true;

  // 192.0.2.0/24 - Documentation (TEST-NET-1)
  if (b0 === 192 && b1 === 0 && b2 === 2) return true;

  // 192.168.0.0/16 - Private-Use
  if (b0 === 192 && b1 === 168) return true;

  // 198.18.0.0/15 - Benchmarking
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

  // 198.51.100.0/24 - Documentation (TEST-NET-2)
  if (b0 === 198 && b1 === 51 && b2 === 100) return true;

  // 203.0.113.0/24 - Documentation (TEST-NET-3)
  if (b0 === 203 && b1 === 0 && b2 === 113) return true;

  // 224.0.0.0/4 - Multicast
  if (b0 >= 224 && b0 <= 239) return true;

  // 240.0.0.0/4 - Reserved for future use
  if (b0 >= 240) return true;

  // 255.255.255.255 - Broadcast
  if (b0 === 255 && b1 === 255 && b2 === 255 && b3 === 255) return true;

  return false;
}

/**
 * Checks if an IPv6 address belongs to a private, loopback, or reserved range.
 * @param {string} ip
 * @returns {boolean} true if blocked
 */
function isBlockedIPv6(ip) {
  const normalized = ip.toLowerCase().trim();

  // :: or ::0 (Unspecified)
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

  // ::1 (Loopback)
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

  // IPv4-mapped IPv6 (::ffff:192.0.2.128 or ::ffff:c000:280)
  if (normalized.startsWith('::ffff:')) {
    const v4Part = normalized.replace('::ffff:', '');
    if (net.isIPv4(v4Part)) {
      return isBlockedIPv4(v4Part);
    }
    return true;
  }

  // fe80::/10 - Link-local
  if (/^fe[89ab]/i.test(normalized)) return true;

  // fc00::/7 - Unique local addresses (fc00:: and fd00::)
  if (/^f[cd]/i.test(normalized)) return true;

  // ff00::/8 - Multicast
  if (normalized.startsWith('ff')) return true;

  // 2001:db8::/32 - Documentation
  if (normalized.startsWith('2001:db8')) return true;

  return false;
}

/**
 * Validates a single IP string.
 * @param {string} ip
 * @returns {boolean} true if IP is safe for outbound monitoring
 */
export function isSafeIP(ip) {
  if (!ip) return false;
  const version = net.isIP(ip);
  if (version === 4) {
    return !isBlockedIPv4(ip);
  } else if (version === 6) {
    return !isBlockedIPv6(ip);
  }
  return false;
}

/**
 * Validates a target URL against SSRF, DNS rebinding, and protocol vulnerabilities.
 * @param {string} rawUrl
 * @returns {Promise<{ valid: boolean, parsedUrl: URL, resolvedIps: string[] }>}
 */
export async function validateTargetUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('URL must be a non-empty string.');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch (err) {
    throw new Error('Invalid URL format. Please provide a valid HTTP or HTTPS address.');
  }

  // 1. Only allow HTTP and HTTPS protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Forbidden protocol: "${parsed.protocol}". Only "http:" and "https:" are allowed.`);
  }

  // 2. Reject credentials in URL
  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials (username/password) are prohibited.');
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // 3. Direct hostname string blacklist
  const blockedHostnames = [
    'localhost',
    'metadata.google.internal',
    'metadata',
    'instance-data',
    '169.254.169.254',
    '0.0.0.0',
    '127.0.0.1',
    '[::1]',
    '::1'
  ];

  if (
    blockedHostnames.includes(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.home') ||
    hostname.endsWith('.corp')
  ) {
    throw new Error(`Prohibited hostname: "${hostname}". Access to localhost and internal hostnames is blocked for security.`);
  }

  // 4. If hostname is already an IP literal
  const ipVersion = net.isIP(hostname);
  if (ipVersion !== 0) {
    if (!isSafeIP(hostname)) {
      throw new Error(`Security Exception: Target IP address "${hostname}" is within a private, loopback, or cloud-metadata range.`);
    }
    return {
      valid: true,
      parsedUrl: parsed,
      resolvedIps: [hostname]
    };
  }

  // 5. Hostname DNS Resolution and Rebinding Protection
  let lookupResults;
  try {
    lookupResults = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  } catch (dnsErr) {
    throw new Error(`DNS resolution failed for host "${hostname}": ${dnsErr.code || dnsErr.message}`);
  }

  if (!lookupResults || lookupResults.length === 0) {
    throw new Error(`Unable to resolve host "${hostname}". No IP addresses returned.`);
  }

  const resolvedIps = lookupResults.map(r => r.address);

  // Check every resolved IP address
  for (const ip of resolvedIps) {
    if (!isSafeIP(ip)) {
      throw new Error(
        `Security Exception (SSRF Prevention): Domain "${hostname}" resolves to protected/internal IP "${ip}". Monitoring this target is disallowed.`
      );
    }
  }

  return {
    valid: true,
    parsedUrl: parsed,
    resolvedIps
  };
}
