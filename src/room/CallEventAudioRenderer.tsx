/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { filter, interval, skip, throttle } from "rxjs";
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
import { useLatest } from "../useLatest";

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

function playSound(
  volume: number,
  ctx?: AudioContext,
  buffer?: AudioBuffer,
): void {
  if (!ctx || !buffer) {
    return;
  }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, 0);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(gain).connect(ctx.destination);
  src.start();
}

function getPreferredAudioFormat() {
  const a = document.createElement("audio");
  if (a.canPlayType("audio/ogg") === "maybe") {
    return "ogg";
  }
  // Otherwise just assume MP3, as that has a chance of being more widely supported.
  return "mp3";
}

// We prefer to load these sounds ahead of time, so there
// is no delay on call join.
const preferredFormat = getPreferredAudioFormat();
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
      // We want low latency for these effects.
      latencyHint: "interactive",
      // XXX: Types don't include this yet.
      ...{ sinkId: devices.audioOutput.selectedId },
    });
    const controller = new AbortController();
    (async () => {
      controller.signal.throwIfAborted();
      const enterCall = await ctx.decodeAudioData(
        (await JoinSoundBufferPromise).slice(0),
      );
      controller.signal.throwIfAborted();
      const leaveCall = await ctx.decodeAudioData(
        (await LeftSoundBufferPromise).slice(0),
      );
      controller.signal.throwIfAborted();
      setJoinSoundNode(enterCall);
      setLeaveSoundNode(leaveCall);
    })().catch((ex) => {
      logger.debug("Failed to setup audio context", ex);
    });

    setAudioContext(ctx);
    return () => {
      controller.abort("Closing");
      void ctx.close().catch((ex) => {
        logger.debug("Failed to close audio engine", ex);
      });
      setAudioContext(undefined);
    };
  }, []);

  // Update the sink ID whenever we change devices.
  useEffect(() => {
    if (audioContext && "setSinkId" in audioContext) {
      // setSinkId doesn't exist in types but does exist for some browsers.
      // https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/setSinkId
      // @ts-ignore
      audioContext.setSinkId(devices.audioOutput.selectedId).catch((ex) => {
        logger.warn("Unable to change sink for audio context", ex);
      });
    }
  }, [audioContext, devices]);

  // Prevent a rerender when t he
  const soundVolume = useLatest(effectSoundVolume);

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
        playSound(soundVolume.current, audioContext, joinCallBuffer);
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
        playSound(soundVolume.current, audioContext, leaveCallBuffer);
      });

    return (): void => {
      joinSub.unsubscribe();
      leftSub.unsubscribe();
    };
  }, [joinCallBuffer, leaveCallBuffer, soundVolume, vm]);

  return <audio ref={audioSourceElement} hidden />;
}
