/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { ReactNode, useEffect, useRef } from "react";
import { filter } from "rxjs";

import {
  playReactionsSound,
  soundEffectVolumeSetting as effectSoundVolumeSetting,
  useSetting,
} from "../settings/settings";
import { CallViewModel } from "../state/CallViewModel";
import enterCallSoundMp3 from "../sound/join_call.mp3";
import enterCallSoundOgg from "../sound/join_call.ogg";
import leftCallSoundMp3 from "../sound/left_call.mp3";
import leftCallSoundOgg from "../sound/left_call.ogg";

// Do not play any sounds if the participant count has exceeded this
// number.
export const MAX_PARTICIPANT_COUNT_FOR_SOUND = 8;

export function CallEventAudioRenderer({
  vm,
}: {
  vm: CallViewModel;
}): ReactNode {
  const [effectSoundVolume] = useSetting(effectSoundVolumeSetting);
  const callEntered = useRef<HTMLAudioElement>(null);
  const callLeft = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (effectSoundVolume === 0) {
      return;
    } 
    const joinSub = vm.memberChanges
      .pipe(
        filter(
          ({ joined, ids }) =>
            ids.length <= MAX_PARTICIPANT_COUNT_FOR_SOUND && joined.length > 0,
        ),
      )
      .subscribe(({ joined }) => {
        console.log("Join", joined);
        if (callEntered.current?.paused) {
          void callEntered.current.play();
        }
      });

    const leftSub = vm.memberChanges
      .pipe(
        filter(
          ({ ids, left }) =>
            ids.length <= MAX_PARTICIPANT_COUNT_FOR_SOUND && left.length > 0,
        ),
      )
      .subscribe(() => {
        if (callLeft.current?.paused) {
          void callLeft.current.play();
        }
      });

    return (): void => {
      joinSub.unsubscribe();
      leftSub.unsubscribe();
    };
  }, [effectSoundVolume, callEntered, callLeft, vm]);

  // Set volume.
  useEffect(() => {
    if (callEntered.current) {
      callEntered.current.volume = effectSoundVolume;
    }

    if (callLeft.current) {
      callLeft.current.volume = effectSoundVolume;
    }
  }, [callEntered, callLeft, effectSoundVolume]);

  // Do not render any audio elements if playback is disabled. Will save
  // audio file fetches.
  if (effectSoundVolume === 0) {
    return null;
  }

  return (
    // Will play as soon as it's mounted, which is what we want as this will
    // play when the call is entered.
    <>
      <audio ref={callEntered} preload="auto" hidden>
        <source src={enterCallSoundOgg} type="audio/ogg; codecs=vorbis" />
        <source src={enterCallSoundMp3} type="audio/mpeg" />
      </audio>
      <audio ref={callLeft} preload="auto" hidden>
        <source src={leftCallSoundOgg} type="audio/ogg; codecs=vorbis" />
        <source src={leftCallSoundMp3} type="audio/mpeg" />
      </audio>
    </>
  );
}
