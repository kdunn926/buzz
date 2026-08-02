import { decode, npubEncode } from "nostr-tools/nip19";
import { getPublicKey } from "nostr-tools/pure";

import { truncatePubkey } from "./pubkey";

/**
 * Convert a hex-encoded Nostr public key to its npub (bech32) representation.
 *
 * @param hexPubkey — 64-character hex string
 * @returns npub1… bech32-encoded public key
 */
export function pubkeyToNpub(hexPubkey: string): string {
  return npubEncode(hexPubkey);
}

/**
 * Like `pubkeyToNpub`, but returns null instead of throwing on malformed
 * input. For display surfaces that must degrade gracefully.
 */
export function safeNpub(pubkey: string): string | null {
  try {
    return npubEncode(pubkey);
  } catch {
    return null;
  }
}

/**
 * Decode a NIP-19 `nprofile1…` or `npub1…` token into a lowercase hex pubkey.
 * Returns null for any other entity type (note/nevent/naddr) or malformed
 * input. Used to resolve NIP-27 inline `nostr:` mention references embedded in
 * message content by other clients (e.g. Amethyst).
 */
export function pubkeyFromNip19(token: string): string | null {
  try {
    const decoded = decode(token);
    if (decoded.type === "npub") {
      return decoded.data.toLowerCase();
    }
    if (decoded.type === "nprofile") {
      return decoded.data.pubkey.toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * A compact, human-recognizable label for a pubkey whose profile we can't
 * resolve to a name (e.g. `npub1abc…wxyz`). Used as the fallback label for
 * NIP-27 mention chips. Routes through the canonical `truncatePubkey` so this
 * stays the ONE truncation form (see check-pubkey-truncation).
 */
export function truncateNpub(hexPubkey: string): string {
  return truncatePubkey(safeNpub(hexPubkey) ?? hexPubkey);
}

const HEX_PUBKEY_REGEX = /^[0-9a-f]{64}$/;

/**
 * Parse user-entered public key input — either a 64-character hex pubkey or
 * a bech32 `npub1…` string — into a lowercase hex pubkey. Returns null for
 * anything else (does NOT throw — intended for live form validation).
 *
 * The input is trimmed first; surrounding whitespace from copy-paste is
 * tolerated.
 */
export function parsePubkeyInput(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (HEX_PUBKEY_REGEX.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("npub1")) {
    try {
      const decoded = decode(trimmed);
      if (decoded.type === "npub") {
        return decoded.data;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Decode a bech32 nsec string and derive the matching npub. Returns null if
 * the input is not a syntactically valid `nsec1…` (does NOT throw — this is
 * intended for live form validation where the user is mid-typing).
 *
 * The input is trimmed first; surrounding whitespace from copy-paste or a
 * dropped `.key` file is tolerated.
 */
export function nsecToNpub(nsec: string): string | null {
  const trimmed = nsec.trim();
  if (!trimmed.startsWith("nsec1")) {
    return null;
  }
  try {
    const decoded = decode(trimmed);
    if (decoded.type !== "nsec") {
      return null;
    }
    const pubkeyHex = getPublicKey(decoded.data);
    return npubEncode(pubkeyHex);
  } catch {
    return null;
  }
}
