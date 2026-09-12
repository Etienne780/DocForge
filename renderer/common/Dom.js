import DOMPurify from 'dompurify';

const trustedTypesPolicy = globalThis.trustedTypes
  ? (globalThis.trustedTypes.defaultPolicy ?? globalThis.trustedTypes.createPolicy('app-html', {
      createHTML(html) {
        return DOMPurify.sanitize(html, { RETURN_TRUSTED_TYPE: false });
      },
    }))
  : null;

/**
 * Sanitize an HTML string and return TrustedHTML when Trusted Types
 * are available.
 *
 * @param {string} html - Untrusted or application-generated HTML
 * @returns {TrustedHTML|string}
 */
export function sanitizeHTML(html) {
  if (typeof html !== 'string')
    throw new TypeError('html must be a string');

  if (trustedTypesPolicy)
    return trustedTypesPolicy.createHTML(html);

  return DOMPurify.sanitize(html);
}