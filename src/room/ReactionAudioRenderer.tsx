/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { ReactNode, useEffect, useState } from "react";

import { playReactionsSound, useSetting } from "../settings/settings";
import { GenericReaction, ReactionSet } from "../reactions";
import { useAudioContext } from "../useAudioContext";
import { prefetchSounds } from "../soundUtils";
import { useLatest } from "../useLatest";
import { CallViewModel } from "../state/CallViewModel";

const soundMap = Object.fromEntries([
  ...ReactionSet.filter((v) => v.sound !== undefined).map((v) => [
    v.name,
    v.sound!,
  ]),
  [GenericReaction.name, GenericReaction.sound],
]);

export function ReactionsAudioRenderer({
  vm,
}: {
  vm: CallViewModel;
}): ReactNode {
  const [shouldPlay] = useSetting(playReactionsSound);
  const [soundCache, setSoundCache] = useState<ReturnType<
    typeof prefetchSounds
  > | null>(null);
  const audioEngineCtx = useAudioContext({
    sounds: soundCache,
    latencyHint: "interactive",
  });
  const audioEngineRef = useLatest(audioEngineCtx);

  useEffect(() => {
    if (!shouldPlay || soundCache) {
      return;
    }
    // This is fine even if we load the component multiple times,
    // as the browser's cache should ensure once the media is loaded
    // once that future fetches come via the cache.
    setSoundCache(prefetchSounds(soundMap));
  }, [soundCache, shouldPlay]);

  useEffect(() => {
    const sub = vm.audibleReactions.subscribe((newReactions) => {
      for (const reactionName of newReactions) {
        if (soundMap[reactionName]) {
          audioEngineRef.current?.playSound(reactionName);
        } else {
          // Fallback sounds.
          audioEngineRef.current?.playSound("generic");
        }
      }
    });
    return (): void => {
      sub.unsubscribe();
    };
  }, [vm, audioEngineRef]);
  return null;
}
