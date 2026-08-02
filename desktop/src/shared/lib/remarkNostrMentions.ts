/**
 * Remark plugin that renders NIP-27 inline mention references.
 *
 * NIP-27 lets any client embed a mention directly in the event `content` as a
 * `nostr:` URI (`nostr:nprofile1…` or `nostr:npub1…`) rather than Buzz's own
 * `@KnownDisplayName` convention. Clients like Amethyst (Android) send these,
 * so without this the raw `nostr:nprofile1…` token would print inline.
 *
 * This decodes the bech32 reference to a hex pubkey and emits a `mention` HAST
 * node of the *same shape* `remarkMentions` produces, so the existing `mention`
 * renderer draws the pill unchanged. The pubkey is carried explicitly on the
 * node (`hProperties.pubkey`) so the profile popover still works even when the
 * pubkey has no resolvable display name and the chip falls back to a truncated
 * npub label. Runs before `remarkMentions` in the plugin chain.
 */

import { createRemarkPrefixPlugin } from "./createRemarkPrefixPlugin";
import { pubkeyFromNip19, truncateNpub } from "./nostrUtils";

type RemarkNostrMentionsOptions = {
  /** Lowercase-hex pubkey → display name, from the event's p/mention tags. */
  mentionNamesByPubkey?: Record<string, string>;
};

// Word-boundaried `nostr:` URI limited to the mention entity types. Case
// tolerant even though bech32 is lowercase — decode normalizes. Other entity
// types (note/nevent/naddr) are intentionally left to the message-link path.
const NOSTR_MENTION_PATTERN = /\bnostr:(?:nprofile1|npub1)[0-9a-z]+/gi;

const NOSTR_URI_PREFIX_LENGTH = "nostr:".length;

export default function remarkNostrMentions(
  options?: RemarkNostrMentionsOptions,
) {
  const namesByPubkey = options?.mentionNamesByPubkey;

  return createRemarkPrefixPlugin(NOSTR_MENTION_PATTERN, (matchText) => {
    const token = matchText.slice(NOSTR_URI_PREFIX_LENGTH);
    const pubkey = pubkeyFromNip19(token);
    if (!pubkey) {
      // Undecodable / unsupported reference — leave the raw text untouched.
      return { type: "text", value: matchText };
    }

    const name = namesByPubkey?.[pubkey];
    const label = `@${name ?? truncateNpub(pubkey)}`;
    return {
      type: "mention",
      value: label,
      data: {
        hName: "mention",
        hProperties: { pubkey },
        hChildren: [{ type: "text", value: label }],
      },
    };
  });
}
