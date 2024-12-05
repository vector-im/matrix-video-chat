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
import { useLatest } from "../useLatest";

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
  const audioEngineRef = useLatest(audioEngineCtx);
  const oldReactions = useDeferredValue(reactions);

  useEffect(() => {
    if (!shouldPlay || !audioEngineRef.current) {
      return;
    }
    const oldReactionSet = new Set(
      Object.values(oldReactions).map((r) => r.name),
    );
    for (const reactionName of new Set(
      Object.values(reactions).map((r) => r.name),
    )) {
      if (oldReactionSet.has(reactionName)) {
        // Don't replay old reactions
        return;
      }
      if (SoundMap[reactionName]) {
        audioEngineRef.current.playSound(reactionName);
      } else {
        // Fallback sounds.
        audioEngineRef.current.playSound("generic");
      }
    }
  }, [audioEngineRef, shouldPlay, oldReactions, reactions]);
  return <></>;
}
