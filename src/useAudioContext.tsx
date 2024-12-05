/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { useState, useEffect } from "react";

import {
  soundEffectVolumeSetting as effectSoundVolumeSetting,
  useSetting,
} from "./settings/settings";
import { useMediaDevices } from "./livekit/MediaDevicesContext";
import { useInitial } from "./useInitial";

type SoundDefinition = { mp3?: string; ogg: string };

/**
 * Play a sound though a given AudioContext. Will take
 * care of connecting the correct buffer and gating
 * through gain.
 * @param volume The volume to play at.
 * @param ctx The context to play through.
 * @param buffer The buffer to play.
 * @returns A promise that resolves when the sound has finished playing.
 */
function playSound(
  ctx: AudioContext,
  buffer: AudioBuffer,
  volume: number,
): Promise<void> {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, 0);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(gain).connect(ctx.destination);
  const p = new Promise<void>((r) => src.addEventListener("ended", () => r()));
  src.start();
  return p;
}

/**
 * Determine the best format we can use to play our sounds
 * through. We prefer ogg support if possible, but will fall
 * back to MP3.
 * @returns "ogg" if the browser is likely to support it, or "mp3" otherwise.
 */
function getPreferredAudioFormat(): "ogg" | "mp3" {
  const a = document.createElement("audio");
  if (a.canPlayType("audio/ogg") === "maybe") {
    return "ogg";
  }
  // Otherwise just assume MP3, as that has a chance of being more widely supported.
  return "mp3";
}

type PrefetchedSounds<S extends string> = Promise<Record<S, ArrayBuffer>>;

// We prefer to load these sounds ahead of time, so there
// is no delay on call join.
const PreferredFormat = getPreferredAudioFormat();

/**
 * Prefetch sounds to be used by the AudioContext. This should
 * be called outside the scope of a component to ensure the
 * sounds load ahead of time.
 * @param sounds A set of sound files that may be played.
 * @returns A map of sound files to buffers.
 */
export async function prefetchSounds<S extends string>(
  sounds: Record<S, SoundDefinition>,
): PrefetchedSounds<S> {
  const buffers: Record<string, ArrayBuffer> = {};
  await Promise.all(
    Object.entries(sounds).map(async ([name, file]) => {
      const { mp3, ogg } = file as SoundDefinition;
      // Use preferred format, fallback to ogg if no mp3 is provided.
      // Load an audio file
      const response = await fetch(
        PreferredFormat === "ogg" ? ogg : (mp3 ?? ogg),
      );
      if (!response.ok) {
        // If the sound doesn't load, it's not the end of the world. We won't play
        // the sound when requested, but it's better than failing the whole application.
        logger.warn(`Could not load sound ${name}, resposne was not okay`);
        return;
      }
      // Decode it
      buffers[name] = await response.arrayBuffer();
    }),
  );
  return buffers as Record<S, ArrayBuffer>;
}

interface Props<S extends string> {
  sounds: PrefetchedSounds<S>;
  latencyHint: AudioContextLatencyCategory;
}

interface UseAudioContext<S> {
  playSound(soundName: S): void;
}

/**
 * Add an audio context which can be used to play
 * a set of preloaded sounds.
 * @param props
 * @returns Either an instance that can be used to play sounds, or null if not ready.
 */
export function useAudioContext<S extends string>(
  props: Props<S>,
): UseAudioContext<S> | null {
  const [effectSoundVolume] = useSetting(effectSoundVolumeSetting);
  const devices = useMediaDevices();
  const [audioContext, setAudioContext] = useState<AudioContext>();
  const [audioBuffers, setAudioBuffers] = useState<Record<S, AudioBuffer>>();
  const soundCache = useInitial(async () => props.sounds);

  useEffect(() => {
    const ctx = new AudioContext({
      // We want low latency for these effects.
      latencyHint: props.latencyHint,
    });

    // We want to clone the content of our preloaded
    // sound buffers into this context. The context may
    // close during this process, so it's okay if it throws.
    (async (): Promise<void> => {
      const buffers: Record<string, AudioBuffer> = {};
      for (const [name, buffer] of Object.entries(await soundCache)) {
        const audioBuffer = await ctx.decodeAudioData(
          // Type quirk, this is *definitely* a ArrayBuffer.
          (buffer as ArrayBuffer).slice(0),
        );
        buffers[name] = audioBuffer;
      }
      setAudioBuffers(buffers as Record<S, AudioBuffer>);
    })().catch((ex) => {
      logger.debug("Failed to setup audio context", ex);
    });

    setAudioContext(ctx);
    return (): void => {
      void ctx.close().catch((ex) => {
        logger.debug("Failed to close audio engine", ex);
      });
      setAudioContext(undefined);
    };
  }, [soundCache, props.latencyHint]);

  // Update the sink ID whenever we change devices.
  useEffect(() => {
    if (audioContext && "setSinkId" in audioContext) {
      // https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/setSinkId
      // @ts-expect-error - setSinkId doesn't exist yet in types, maybe because it's not supported everywhere.
      audioContext.setSinkId(devices.audioOutput.selectedId).catch((ex) => {
        logger.warn("Unable to change sink for audio context", ex);
      });
    }
  }, [audioContext, devices]);

  // Don't return a function until we're ready.
  if (!audioContext || !audioBuffers) {
    return null;
  }
  return {
    playSound: (name): Promise<void> => {
      if (!audioBuffers[name]) {
        logger.debug(`Tried to play a sound that wasn't buffered (${name})`);
        return;
      }
      return playSound(audioContext, audioBuffers[name], effectSoundVolume);
    },
  };
}
