/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { filter, interval, throttle } from "rxjs";
import { logger } from "matrix-js-sdk/src/logger";

import {
  soundEffectVolumeSetting as effectSoundVolumeSetting,
  useSetting,
} from "../settings/settings";
import { CallViewModel } from "../state/CallViewModel";
import joinCallSoundMp3 from "../sound/join_call.mp3";
import joinCallSoundOgg from "../sound/join_call.ogg";
import leftCallSoundMp3 from "../sound/left_call.mp3";
import leftCallSoundOgg from "../sound/left_call.ogg";
import { useMediaDevices } from "../livekit/MediaDevicesContext";

// Do not play any sounds if the participant count has exceeded this
// number.
export const MAX_PARTICIPANT_COUNT_FOR_SOUND = 8;
export const DEBOUNCE_SOUND_EFFECT_MS = 500;

async function loadAudioBuffer(filename: string) {
  // Load an audio file
  const response = await fetch(filename);
  if (!response.ok) {
    throw Error("Could not load sound, resposne was not okay");
  }
  // Decode it
  return await await response.arrayBuffer();
}

function playSound(ctx?: AudioContext, buffer?: AudioBuffer): void {
  if (!ctx || !buffer) {
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
}

function getPreferredAudioFormat() {
  const a = document.createElement("audio");
  if (a.canPlayType("audio/ogg") === "maybe") {
    return "ogg";
  }
  // Otherwise just assume MP3, as that's a
  return "mp3";
}

const preferredFormat = getPreferredAudioFormat();
// Preload sound effects
const JoinSoundBufferPromise = loadAudioBuffer(
  preferredFormat === "ogg" ? joinCallSoundOgg : joinCallSoundMp3,
);
const LeftSoundBufferPromise = loadAudioBuffer(
  preferredFormat === "ogg" ? leftCallSoundOgg : leftCallSoundMp3,
);

export function CallEventAudioRenderer({
  vm,
}: {
  vm: CallViewModel;
}): ReactNode {
  const [effectSoundVolume] = useSetting(effectSoundVolumeSetting);
  const devices = useMediaDevices();
  const audioSourceElement = useRef<HTMLAudioElement>(null);
  const [audioContext, setAudioContext] = useState<AudioContext>();
  const [joinCallBuffer, setJoinSoundNode] = useState<AudioBuffer>();
  const [leaveCallBuffer, setLeaveSoundNode] = useState<AudioBuffer>();

  useEffect(() => {
    const ctx = new AudioContext({
      latencyHint: "interactive",
      // XXX: Types don't include this yet.
      ...{ sinkId: devices.audioOutput.selectedId },
    });
    const controller = new AbortController();
    (async () => {
      if (controller.signal.aborted) {
        return;
      }
      const enterCall = await ctx.decodeAudioData(
        (await JoinSoundBufferPromise).slice(0),
      );
      if (controller.signal.aborted) {
        return;
      }
      const leaveCall = await ctx.decodeAudioData(
        (await LeftSoundBufferPromise).slice(0),
      );
      if (controller.signal.aborted) {
        return;
      }
      setJoinSoundNode(enterCall);
      setLeaveSoundNode(leaveCall);
      if (controller.signal.aborted) {
        return;
      }
    })();

    setAudioContext(ctx);
    return () => {
      controller.abort("Closing");
      void ctx.close().catch((ex) => {
        logger.warn("Failed to close audio engine", ex);
      });
      setAudioContext(undefined);
    };
  }, [devices.audioOutput]);

  useEffect(() => {
    const joinSub = vm.memberChanges
      .pipe(
        filter(
          ({ joined, ids }) =>
            // Only play when more than one person is in the room.
            ids.length > 1 &&
            ids.length <= MAX_PARTICIPANT_COUNT_FOR_SOUND &&
            joined.length > 0,
        ),
        throttle((_) => interval(DEBOUNCE_SOUND_EFFECT_MS)),
      )
      .subscribe(() => {
        playSound(audioContext, joinCallBuffer);
      });

    const leftSub = vm.memberChanges
      .pipe(
        filter(
          ({ ids, left }) =>
            ids.length <= MAX_PARTICIPANT_COUNT_FOR_SOUND && left.length > 0,
        ),
        throttle((_) => interval(DEBOUNCE_SOUND_EFFECT_MS)),
      )
      .subscribe(() => {
        playSound(audioContext, leaveCallBuffer);
      });

    return (): void => {
      joinSub.unsubscribe();
      leftSub.unsubscribe();
    };
  }, [joinCallBuffer, leaveCallBuffer, vm]);

  // Set volume.
  useEffect(() => {
    if (audioSourceElement.current) {
      audioSourceElement.current.volume = effectSoundVolume;
    }
  }, [effectSoundVolume]);

  return <audio ref={audioSourceElement} hidden />;
}
