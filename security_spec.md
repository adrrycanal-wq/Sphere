# Sphere. Firestore Security Specification

## 1. Data Invariants
1. **PII Isolation**: User emails, phone numbers, birthdays, and private settings reside exclusively in `/users/{userId}/private/{docId}` and `/userSecuritySettings/{userId}`, readable/writable only by `request.auth.uid == userId` (or verified admins for profile info).
2. **Self-Assigned Privilege Prevention**: Users creating or updating `/users/{userId}` can never grant themselves `sphereIdCategory: 'verified_organization'` or `verified_individual`, nor modify `/admins/{adminId}` or `/personnelRoles/{userId}`.
3. **Strict RBAC Separation of Duties**:
   - `platform_admin` (`isAdmin()`) manages `/personnelRoles/{userId}` and platform operations, **NOT** Gov ID review decisions or private Gov ID documents.
   - Only `isVerificationOfficer()` (`verification_officer` or `senior_reviewer` in `/personnelRoles`) may read/update `/recoveryRequests/{requestId}`.
   - Only `isSeniorReviewer()` (`senior_reviewer` in `/personnelRoles`) may resolve `/recoveryAppeals/{appealId}`.
   - Only `isSecurityAdmin()` (`security_admin` in `/personnelRoles`) may read `/securityAuditLogs/{logId}` and investigate `/securityAlerts/{alertId}`.
4. **Immutable Ownership & Temporal Integrity**: Every owned entity (`posts`, `albums`, `photos`, `marketplace`, `pages`, `groups`, `adCampaigns`, `donationDrives`, `verificationRequests`, `anonymousPosts`, `recoveryRequests`, `recoveryAppeals`) enforces owner UID match on create, owner immutability on update, and `request.time` on `createdAt`/`updatedAt`.
5. **Master Gate on Subcollections**: `/groups/{groupId}/members/{memberId}` validates existence of parent `/groups/{groupId}`. `/threads/{threadId}/messages/{messageId}` validates parent thread membership.
6. **Terminal State & Audit Immutability**: Once `verificationRequests` or `recoveryRequests` reach terminal outcomes (`approved`, `rejected`, `recovery_completed`), standard users cannot revert state. `/securityAuditLogs` are strictly immutable (`update, delete: if false`).
7. **Verified Identity & Admin Bootstrapping**: Bootstrapped runtime admin `adrrycanal@gmail.com` (`email_verified == true`) or `/admins/$(request.auth.uid)` grants platform admin (`isAdmin()`) without bypassing Gov ID officer separation.

## 2. The "Dirty Dozen+" Adversarial Payloads
Every payload below MUST return `PERMISSION_DENIED`:
1. **Unauthenticated Post Create**: `POST /posts/p1` with `request.auth == null` -> DENIED.
2. **Identity Spoofing on Post**: Logged in as `userA`, create `/posts/p2` with `authorId: 'userB'` -> DENIED.
3. **Self-Verification Escalation on Profile Create**: Logged in as `userA`, create `/users/userA` with `sphereIdCategory: 'verified_organization'` -> DENIED.
4. **Shadow Field Injection on Profile Update**: Logged in as `userA`, update `/users/userA` with extra ghost field `isAdmin: true` -> DENIED (`hasOnly` check).
5. **PII Cross-Read Attack**: Logged in as `userA`, `GET /users/userB/private/info` -> DENIED.
6. **Email Verification Spoof on Admin Endpoint**: Logged in with `token.email == 'adrrycanal@gmail.com'` and `email_verified == false`, attempt to approve `/verificationRequests/req1` -> DENIED.
7. **Resource / ID Poisoning**: Logged in as `userA`, create `/posts/${'x'.repeat(200)}` (invalid long ID) -> DENIED (`isValidId`).
8. **Query Scraping All Notifications**: Logged in as `userA`, `LIST /notifications` without `where('recipientId', '==', 'userA')` -> DENIED (`resource.data.recipientId == request.auth.uid`).
9. **Client Timestamp Forgery**: Logged in as `userA`, create `/posts/p3` with `createdAt` set to past string instead of `request.time` -> DENIED.
10. **Terminal State Tampering on Verification / Recovery Request**: Logged in as `userA`, update own `/recoveryRequests/rec1` status from `'pending_review'` to `'approved'` -> DENIED.
11. **Fake Non-Gov Organization Aid Drive**: Logged in as `userA` (whose `/users/userA` is `unverified`), create `/donationDrives/d1` -> DENIED.
12. **Reading Unowned Direct Messages**: Logged in as `userC`, read `/threads/t_a_b/messages/m1` where thread `ownerId/peerId` are `userA` & `userB` -> DENIED.
13. **Platform Admin Reading Recovery / Gov ID Metadata Without Officer Role**: Logged in as pure `platform_admin` (without `verification_officer` or `senior_reviewer` role), `GET /recoveryRequests/rec1` -> DENIED.
14. **Audit Log Tampering**: Any user or admin attempting `UPDATE /securityAuditLogs/log1` or `DELETE /securityAuditLogs/log1` -> DENIED.
15. **Regular User Self-Escalating Personnel Role**: Logged in as `userA`, `CREATE /personnelRoles/userA` with `roles: ['verification_officer']` -> DENIED.
