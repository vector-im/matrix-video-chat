/*
Copyright 2023 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { Dispatch, SetStateAction, useEffect, useMemo } from "react";
import { IWidgetApiRequest } from "matrix-widget-api";

import { MediaDevice, useMediaDevices } from "../livekit/MediaDevicesContext";
import { useReactiveState } from "../useReactiveState";
import { ElementWidgetActions, widget } from "../widget";

/**
 * If there already are this many participants in the call, we automatically mute
 * the user.
 */
export const MUTE_PARTICIPANT_COUNT = 8;

interface DeviceAvailable {
  enabled: boolean;
  setEnabled: Dispatch<SetStateAction<boolean>>;
}

interface DeviceUnavailable {
  enabled: false;
  setEnabled: null;
}

const deviceUnavailable: DeviceUnavailable = {
  enabled: false,
  setEnabled: null,
};

type MuteState = DeviceAvailable | DeviceUnavailable;

export interface MuteStates {
  audio: MuteState;
  video: MuteState;
}

function useMuteState(
  device: MediaDevice,
  enabledByDefault: () => boolean,
): MuteState {
  const [enabled, setEnabled] = useReactiveState<boolean | undefined>(
    (prev) =>
      device.available.length > 0 ? (prev ?? enabledByDefault()) : undefined,
    [device],
  );
  return useMemo(
    () =>
      device.available.length === 0
        ? deviceUnavailable
        : {
            enabled: enabled ?? false,
            setEnabled: setEnabled as Dispatch<SetStateAction<boolean>>,
          },
    [device, enabled, setEnabled],
  );
}

export function useMuteStates(): MuteStates {
  const devices = useMediaDevices();

  const audio = useMuteState(devices.audioInput, () => true);
  const video = useMuteState(devices.videoInput, () => true);

  useEffect(() => {
    widget?.api.transport.send(ElementWidgetActions.DeviceMute, {
      audio_enabled: audio.enabled,
      video_enabled: video.enabled,
    });
  }, [audio, video]);

  useEffect(() => {
    if (widget) {
      const onMuteStateChangeRequest = (
        ev: CustomEvent<IWidgetApiRequest>,
      ): void => {
        const newState = {
          audio_enabled: audio.enabled,
          video_enabled: video.enabled,
        };
        if (
          ev.detail.data.audio_enabled != null &&
          typeof ev.detail.data.audio_enabled === "boolean"
        ) {
          audio.setEnabled?.(ev.detail.data.audio_enabled);
          newState.audio_enabled = ev.detail.data.audio_enabled;
        }
        if (
          ev.detail.data.video_enabled != null &&
          typeof ev.detail.data.video_enabled === "boolean"
        ) {
          video.setEnabled?.(ev.detail.data.video_enabled);
          newState.video_enabled = ev.detail.data.video_enabled;
        }
        widget!.api.transport.reply(ev.detail, newState);
      };

      widget.lazyActions.on(
        ElementWidgetActions.DeviceMute,
        onMuteStateChangeRequest,
      );

      return (): void => {
        widget!.lazyActions.off(
          ElementWidgetActions.DeviceMute,
          onMuteStateChangeRequest,
        );
      };
    }
  }, [audio, video]);

  return useMemo(() => ({ audio, video }), [audio, video]);
}
