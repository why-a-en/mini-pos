import * as argon2 from "argon2";

/** Argon2id hash of a plaintext password — never store/log the raw value. */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

/** True if `password` matches the stored `hash`. Never throws on mismatch. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Malformed/foreign hash — treat as a non-match rather than a crash.
    return false;
  }
}
