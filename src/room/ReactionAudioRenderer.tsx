/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { ReactNode, useDeferredValue, useEffect } from "react";

import { useReactions } from "../useReactions";
import { playReactionsSound, useSetting } from "../settings/settings";
import { ReactionSet } from "../reactions";
import { prefetchSounds, useAudioContext } from "../useAudioContext";

const SoundMap = Object.fromEntries(
  ReactionSet.filter((v) => v.sound !== undefined).map((v) => [
    v.name,
    v.sound!,
  ]),
);

const Sounds = prefetchSounds(SoundMap);

export function ReactionsAudioRenderer(): ReactNode {
  const { reactions } = useReactions();
  const [shouldPlay] = useSetting(playReactionsSound);
  const audioEngineCtx = useAudioContext({
    sounds: Sounds,
    latencyHint: "interactive",
  });
  const oldReactions = useDeferredValue(reactions);

  useEffect(() => {
    if (!audioEngineCtx) {
      return;
    }

    if (!shouldPlay) {
      return;
    }
    for (const [sender, reaction] of Object.entries(reactions)) {
      if (oldReactions[sender]) {
        // Don't replay old reactions
        return;
      }
      if (SoundMap[reaction.name]) {
        audioEngineCtx.playSound(reaction.name);
      } else {
        // Fallback sounds.
        audioEngineCtx.playSound("generic");
      }
    }
  }, [shouldPlay, oldReactions, reactions]);
  return <></>;
}
