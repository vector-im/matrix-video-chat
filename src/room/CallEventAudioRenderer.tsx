/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { ReactNode, useEffect } from "react";
import { debounce, filter, interval, throttle } from "rxjs";
import { CallViewModel } from "../state/CallViewModel";
import joinCallSoundMp3 from "../sound/join_call.mp3";
import joinCallSoundOgg from "../sound/join_call.ogg";
import leftCallSoundMp3 from "../sound/left_call.mp3";
import leftCallSoundOgg from "../sound/left_call.ogg";
import { prefetchSounds, useAudioContext } from "../useAudioContext";

// Do not play any sounds if the participant count has exceeded this
// number.
export const MAX_PARTICIPANT_COUNT_FOR_SOUND = 8;
export const THROTTLE_SOUND_EFFECT_MS = 500;
export const DEBOUNCE_SOUND_EFFECT_MS = 150;

const Sounds = prefetchSounds({
  join: {
    mp3: joinCallSoundMp3,
    ogg: joinCallSoundOgg,
  },
  left: {
    mp3: leftCallSoundMp3,
    ogg: leftCallSoundOgg,
  },
});

export function CallEventAudioRenderer({
  vm,
}: {
  vm: CallViewModel;
}): ReactNode {
  const audioEngineCtx = useAudioContext({
    sounds: Sounds,
    latencyHint: "interactive",
  });

  useEffect(() => {
    if (!audioEngineCtx) {
      return;
    }

    const joinSub = vm.memberChanges
      .pipe(
        filter(
          ({ joined, ids }) =>
            ids.length <= MAX_PARTICIPANT_COUNT_FOR_SOUND && joined.length > 0,
        ),
        throttle((_) => interval(THROTTLE_SOUND_EFFECT_MS)),
        debounce((_) => interval(DEBOUNCE_SOUND_EFFECT_MS)),
      )
      .subscribe((prev) => {
        console.log("Playing join sound for", ...prev.joined, "|", prev);
        audioEngineCtx.playSound("join");
      });

    const leftSub = vm.memberChanges
      .pipe(
        filter(
          ({ ids, left }) =>
            ids.length <= MAX_PARTICIPANT_COUNT_FOR_SOUND && left.length > 0,
        ),
        throttle((_) => interval(THROTTLE_SOUND_EFFECT_MS)),
        debounce((_) => interval(DEBOUNCE_SOUND_EFFECT_MS)),
      )
      .subscribe(() => {
        audioEngineCtx.playSound("left");
      });

    return (): void => {
      joinSub.unsubscribe();
      leftSub.unsubscribe();
    };
  }, [audioEngineCtx, vm]);

  return <></>;
}
