import type { UserProfileSummary } from "@/shared/api/types";

export const MENTION_REFERENCE_TAG = "mention";

export function getMentionTagPubkey(tag: string[]): string | null {
  if ((tag[0] !== "p" && tag[0] !== MENTION_REFERENCE_TAG) || !tag[1]) {
    return null;
  }

  return tag[1].toLowerCase();
}

/**
 * All names a profile can be @mentioned by. Message text is matched against
 * the sender's view of the profile at send time (agents and the CLI resolve
 * mentions against `display_name` *or* `name`, and renames happen after the
 * fact), so a single-alias match leaves chips that render but never resolve
 * to a pubkey. Emitting every known alias — display name, kind-0 `name`, and
 * the NIP-05 local part — keeps rendered chips and pubkey resolution in sync.
 */
function collectProfileAliases(
  profile: UserProfileSummary | undefined,
): string[] {
  if (!profile) {
    return [];
  }

  const aliases: string[] = [];
  const displayName = profile.displayName?.trim();
  if (displayName) {
    aliases.push(displayName);
  }

  const name = profile.name?.trim();
  if (name) {
    aliases.push(name);
  }

  // "_" is the NIP-05 root identifier, not a mentionable handle.
  const nip05Local = profile.nip05Handle?.trim().split("@")[0]?.trim();
  if (nip05Local && nip05Local !== "_") {
    aliases.push(nip05Local);
  }

  return aliases;
}

export type ResolvedMentionProps = {
  mentionNames: string[] | undefined;
  mentionPubkeysByName: Record<string, string> | undefined;
};

/**
 * Resolves mention render names and the name→pubkey map for mentioned users
 * from message `p` tags and non-notifying `mention` reference tags, in one
 * pass over the tags.
 *
 * `p` tags drive notification/search semantics. `mention` tags only preserve
 * render metadata for reference-only mentions.
 *
 * Both outputs come from the same alias set, so any `@name` chip the markdown
 * renderer matches is guaranteed to resolve to a pubkey.
 */
export function resolveMentionProps(
  tags: string[][] | undefined,
  profiles: Record<string, UserProfileSummary> | undefined,
): ResolvedMentionProps {
  if (!profiles || !tags) {
    return { mentionNames: undefined, mentionPubkeysByName: undefined };
  }

  const names = new Set<string>();
  const pubkeysByName: Record<string, string> = {};

  for (const tag of tags) {
    const pubkey = getMentionTagPubkey(tag);
    if (!pubkey) {
      continue;
    }

    for (const alias of collectProfileAliases(profiles[pubkey])) {
      names.add(alias);
      pubkeysByName[alias.toLowerCase()] = pubkey;
    }
  }

  return {
    mentionNames: names.size > 0 ? [...names] : undefined,
    mentionPubkeysByName:
      Object.keys(pubkeysByName).length > 0 ? pubkeysByName : undefined,
  };
}

export function resolveMentionNames(
  tags: string[][] | undefined,
  profiles: Record<string, UserProfileSummary> | undefined,
): string[] | undefined {
  return resolveMentionProps(tags, profiles).mentionNames;
}

export function resolveMentionPubkeysByName(
  tags: string[][] | undefined,
  profiles: Record<string, UserProfileSummary> | undefined,
): Record<string, string> | undefined {
  return resolveMentionProps(tags, profiles).mentionPubkeysByName;
}

/**
 * Invert the resolved mention data into a `pubkey → display name` map (keys
 * lowercase hex) for rendering NIP-27 inline `nostr:` references, whose chip
 * label must be looked up *from* the referenced pubkey rather than matched
 * text.
 *
 * Joins the two already-resolved outputs the markdown renderer receives:
 * `mentionNames` carries the original-case aliases and `mentionPubkeysByName`
 * maps each lowercased alias to its pubkey. Deriving from these avoids
 * re-plumbing a new prop through every call site while preserving the display
 * name's original casing (the `mentionPubkeysByName` keys are lowercased).
 * The first alias per pubkey wins — `collectProfileAliases` emits the display
 * name first, so the richest label is preferred.
 */
export function buildMentionNamesByPubkey(
  mentionNames: readonly string[] | undefined,
  mentionPubkeysByName: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!mentionNames || !mentionPubkeysByName) {
    return undefined;
  }

  const namesByPubkey: Record<string, string> = {};
  for (const name of mentionNames) {
    const pubkey = mentionPubkeysByName[name.toLowerCase()];
    if (pubkey && !(pubkey in namesByPubkey)) {
      namesByPubkey[pubkey] = name;
    }
  }

  return Object.keys(namesByPubkey).length > 0 ? namesByPubkey : undefined;
}
