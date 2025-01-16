/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import {
  removeDirectionOverrideChars,
  removeHiddenChars,
} from "matrix-js-sdk/src/utils";

import type { Room } from "matrix-js-sdk/src/matrix";
import type { CallMembership } from "matrix-js-sdk/src/matrixrtc";

// Borrowed from https://github.com/matrix-org/matrix-js-sdk/blob/f10deb5ef2e8f061ff005af0476034382ea128ca/src/models/room-member.ts#L409
export function shouldDisambiguate(
  member: { rawDisplayName?: string; userId: string },
  memberships: CallMembership[],
  room: Room,
): boolean {
  const { rawDisplayName: displayName, userId } = member;
  if (!displayName || displayName === userId) return false;

  // First check if the displayname is something we consider truthy
  // after stripping it of zero width characters and padding spaces
  const strippedDisplayName = removeHiddenChars(displayName);
  if (!strippedDisplayName) return false;

  // Next check if the name contains something that look like a mxid
  // If it does, it may be someone trying to impersonate someone else
  // Show full mxid in this case
  if (/@.+:.+/.test(displayName)) return true;

  // Also show mxid if the display name contains any LTR/RTL characters as these
  // make it very difficult for us to find similar *looking* display names
  // E.g "Mark" could be cloned by writing "kraM" but in RTL.
  if (/[\u200E\u200F\u202A-\u202F]/.test(displayName)) return true;

  // Also show mxid if there are other people with the same or similar
  // displayname, after hidden character removal.
  return (
    memberships
      .map((m) => m.sender && room.getMember(m.sender))
      // NOTE: We *should* have a room member for everyone.
      .filter((m) => !!m)
      .filter((m) => m.userId !== userId)
      .some(
        (m) =>
          removeHiddenChars(calculateDisplayName(m, false)) ===
          strippedDisplayName,
      )
  );
}

export function calculateDisplayName(
  member: { rawDisplayName?: string; userId: string },
  disambiguate: boolean,
): string {
  const { rawDisplayName: displayName, userId } = member;
  if (!displayName || displayName === userId) return userId;

  const resultDisplayname = removeDirectionOverrideChars(displayName);

  if (disambiguate) return resultDisplayname + " (" + userId + ")";

  // First check if the displayname is something we consider truthy
  // after stripping it of zero width characters and padding spaces
  if (!removeHiddenChars(displayName)) return userId;

  // We always strip the direction override characters (LRO and RLO).
  // These override the text direction for all subsequent characters
  // in the paragraph so if display names contained these, they'd
  // need to be wrapped in something to prevent this from leaking out
  // (which we can do in HTML but not text) or we'd need to add
  // control characters to the string to reset any overrides (eg.
  // adding PDF characters at the end). As far as we can see,
  // there should be no reason these would be necessary - rtl display
  // names should flip into the correct direction automatically based on
  // the characters, and you can still embed rtl in ltr or vice versa
  // with the embed chars or marker chars.
  return resultDisplayname;
}
