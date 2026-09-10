/*
# Revoke anon EXECUTE on subscription SECURITY DEFINER functions

## Summary
Removes the ability for unauthenticated (anon) callers to invoke the
`approve_subscription` and `reject_subscription` functions. These should
only be callable by authenticated owners/admins.

## Security
- REVOKE EXECUTE FROM anon on approve_subscription and reject_subscription.
*/

REVOKE EXECUTE ON FUNCTION approve_subscription(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION reject_subscription(uuid, text) FROM anon;
