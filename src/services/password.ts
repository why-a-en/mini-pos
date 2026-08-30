import { randomInt } from "node:crypto";

// Temporary passwords are read aloud or typed into a chat message by an
// Admin, so the alphabet leaves out every character that gets misheard or
// misread: no 0/O, no 1/l/I, no 5/S, no 8/B. What survives is unambiguous
// over a phone line.
const ALPHABET = "abcdefghjkmnpqrtuvwxyz2346789";
const LENGTH = 12;

/**
 * A one-time password for a newly created or reset account.
 *
 * Generated rather than chosen by the Admin: left to type one, the same
 * weak password ends up on every account in the Organization. It is shown
 * once, never stored in readable form, and the account it belongs to is
 * flagged `must_change_password` so its owner replaces it on first sign-in.
 *
 * `randomInt` is the CSPRNG, not `Math.random()` — this value is a
 * credential, however short-lived.
 */
export function generateTemporaryPassword(): string {
  let out = "";
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
