/**
 * Security Rule Verification Harness for Sphere. Firestore Rules
 * Tests all Dirty Dozen+ adversarial payloads against rule expectations.
 */

export const DIRTY_DOZEN_ASSERTIONS = [
  { id: 1, name: 'Unauthenticated post create', path: 'posts/p1', expectDenied: true },
  { id: 2, name: 'Identity spoofing on post create (authorId mismatch)', path: 'posts/p2', expectDenied: true },
  { id: 3, name: 'Self-assigned verified_organization on user create', path: 'users/userA', expectDenied: true },
  { id: 4, name: 'Shadow field injection (isAdmin: true) on user update', path: 'users/userA', expectDenied: true },
  { id: 5, name: 'Cross-user PII private subcollection read', path: 'users/userB/private/info', expectDenied: true },
  { id: 6, name: 'Email verification spoof on admin review update', path: 'verificationRequests/req1', expectDenied: true },
  { id: 7, name: 'Resource / long document ID poisoning (>128 chars)', path: `posts/${'x'.repeat(200)}`, expectDenied: true },
  { id: 8, name: 'Blanket notification list scraping without recipient filter', path: 'notifications', expectDenied: true },
  { id: 9, name: 'Client timestamp forgery (not request.time)', path: 'posts/p3', expectDenied: true },
  { id: 10, name: 'Terminal status tampering on recovery request', path: 'recoveryRequests/rec1', expectDenied: true },
  { id: 11, name: 'Unverified org Aid Drive creation', path: 'donationDrives/d1', expectDenied: true },
  { id: 12, name: 'Reading unowned direct message subcollection', path: 'threads/t_a_b/messages/m1', expectDenied: true },
  { id: 13, name: 'Platform admin reading Gov ID recovery metadata without officer role', path: 'recoveryRequests/rec1', expectDenied: true },
  { id: 14, name: 'Audit log mutation / deletion attempt', path: 'securityAuditLogs/log1', expectDenied: true },
  { id: 15, name: 'Regular user self-assigning verification_officer role', path: 'personnelRoles/userA', expectDenied: true },
];
