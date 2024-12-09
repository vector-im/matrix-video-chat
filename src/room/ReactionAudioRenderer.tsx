/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { ReactNode, useDeferredValue, useEffect, useState } from "react";

import { useReactions } from "../useReactions";
import { playReactionsSound, useSetting } from "../settings/settings";
import { GenericReaction, ReactionSet } from "../reactions";
import { prefetchSounds, useAudioContext } from "../useAudioContext";
import { useLatest } from "../useLatest";

const SoundMap = Object.fromEntries([
  ...ReactionSet.filter((v) => v.sound !== undefined).map((v) => [
    v.name,
    v.sound!,
  ]),
  [GenericReaction.name, GenericReaction.sound],
]);

let SoundCache: ReturnType<typeof prefetchSounds> | null = null;

export function ReactionsAudioRenderer(): ReactNode {
  const { reactions } = useReactions();
  const [shouldPlay] = useSetting(playReactionsSound);
  const [soundCache, setSoundCache] = useState(SoundCache);
  const audioEngineCtx = useAudioContext({
    sounds: soundCache,
    latencyHint: "interactive",
  });
  const audioEngineRef = useLatest(audioEngineCtx);
  const oldReactions = useDeferredValue(reactions);
  useEffect(() => {
    if (!shouldPlay || SoundCache) {
      return;
    }
    SoundCache = prefetchSounds(SoundMap);
    setSoundCache(SoundCache);
  }, [shouldPlay]);

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
