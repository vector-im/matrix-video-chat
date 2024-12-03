import { logger } from "matrix-js-sdk/src/logger";
import { useState, useEffect } from "react";
import {
  soundEffectVolumeSetting as effectSoundVolumeSetting,
  useSetting,
} from "./settings/settings";
import { useMediaDevices } from "./livekit/MediaDevicesContext";

type SoundDefinition = { mp3?: string; ogg: string };

async function fetchBuffer(filename: string) {
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

type PrefetchedSounds<S extends string> = Promise<Record<string, ArrayBuffer>>;

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
  logger.debug(`Loading sounds`);
  const buffers: Record<string, ArrayBuffer> = {};
  await Promise.all(
    Object.entries(sounds).map(async ([name, file]) => {
      const { mp3, ogg } = file as SoundDefinition;
      // Use preferred format, fallback to ogg if no mp3 is provided.
      buffers[name] = await fetchBuffer(
        PreferredFormat === "ogg" ? ogg : (mp3 ?? ogg),
      );
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

export function useAudioContext<S extends string>(
  props: Props<S>,
): UseAudioContext<S> | null {
  const [effectSoundVolume] = useSetting(effectSoundVolumeSetting);
  const devices = useMediaDevices();
  const [audioContext, setAudioContext] = useState<AudioContext>();
  const [audioBuffers, setAudioBuffers] = useState<Record<S, AudioBuffer>>();

  useEffect(() => {
    const ctx = new AudioContext({
      // We want low latency for these effects.
      latencyHint: props.latencyHint,
      // XXX: Types don't include this yet.
      ...{ sinkId: devices.audioOutput.selectedId },
    });
    const controller = new AbortController();
    (async () => {
      const buffers: Record<string, AudioBuffer> = {};
      controller.signal.throwIfAborted();
      for (const [name, buffer] of Object.entries(await props.sounds)) {
        controller.signal.throwIfAborted();
        const audioBuffer = await ctx.decodeAudioData(buffer.slice(0));
        buffers[name] = audioBuffer;
        // Store as we go.
        setAudioBuffers(buffers as Record<S, AudioBuffer>);
      }
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

  if (!audioContext || !audioBuffers) {
    logger.debug("Audio not ready yet");
    return null;
  }
  return {
    playSound: (name) => {
      playSound(effectSoundVolume, audioContext, audioBuffers[name]);
    },
  };
}
