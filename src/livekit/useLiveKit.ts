import { LocalAudioTrack, LocalVideoTrack, Room } from "livekit-client";
import React, { useState } from "react";
import { usePreviewDevice } from "@livekit/components-react";

import { MediaDevicesState, MediaDevices } from "../settings/mediaDevices";
import { LocalMediaInfo, MediaInfo } from "../room/VideoPreview";
import { roomOptions } from "./options";

type LiveKitState = {
  // The state of the media devices (changing the devices will also change them in the room).
  mediaDevices: MediaDevicesState;
  // The local media (audio and video) that can be referenced in an e.g. lobby view.
  localMedia: LocalMediaInfo;
  // A reference to the newly constructed (but not yet entered) room for future use with the LiveKit hooks.
  // TODO: Abstract this away, so that the user doesn't have to deal with the LiveKit room directly.
  room: Room;
};

// Returns the React state for the LiveKit's Room class.
// The actual return type should be `LiveKitState`, but since this is a React hook, the initialisation is
// delayed (done after the rendering, not during the rendering), because of that this function may return `undefined`.
// But soon this state is changed to the actual `LiveKitState` value.
export function useLiveKit(): LiveKitState | undefined {
  // TODO: Pass the proper paramters to configure the room (supported codecs, simulcast, adaptive streaming, etc).
  const [room] = React.useState<Room>(() => {
    return new Room(roomOptions);
  });

  // Create a React state to store the available devices and the selected device for each kind.
  const mediaDevices = useMediaDevicesState(room);

  // Create local video track.
  const [videoEnabled, setVideoEnabled] = React.useState<boolean>(true);
  const selectedVideoId = mediaDevices.state.get("videoinput")?.selectedId;
  const video = usePreviewDevice(
    videoEnabled,
    selectedVideoId ?? "",
    "videoinput"
  );

  // Create local audio track.
  const [audioEnabled, setAudioEnabled] = React.useState<boolean>(true);
  const selectedAudioId = mediaDevices.state.get("audioinput")?.selectedId;
  const audio = usePreviewDevice(
    audioEnabled,
    selectedAudioId ?? "",
    "audioinput"
  );

  // Create final LiveKit state.
  const [state, setState] = React.useState<LiveKitState | undefined>(undefined);
  React.useEffect(() => {
    // Helper to create local media without the copy-paste.
    const createLocalMedia = (
      track: LocalVideoTrack | LocalAudioTrack | undefined,
      enabled: boolean,
      setEnabled: React.Dispatch<React.SetStateAction<boolean>>
    ): MediaInfo | undefined => {
      if (!track) {
        return undefined;
      }

      return {
        track,
        muted: !enabled,
        toggle: async () => {
          setEnabled(!enabled);
        },
      };
    };

    const state: LiveKitState = {
      mediaDevices: mediaDevices,
      localMedia: {
        audio: createLocalMedia(
          audio.localTrack,
          audioEnabled,
          setAudioEnabled
        ),
        video: createLocalMedia(
          video.localTrack,
          videoEnabled,
          setVideoEnabled
        ),
      },
      room,
    };

    setState(state);
  }, [
    mediaDevices,
    audio.localTrack,
    video.localTrack,
    audioEnabled,
    videoEnabled,
    room,
  ]);

  return state;
}

function useMediaDevicesState(room: Room): MediaDevicesState {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<
    MediaDeviceInfo[]
  >([]);

  const [activeAudioDevice, setActiveAudioDevice] = useState<string>();
  const [activeVideoDevice, setActiveVideoDevice] = useState<string>();
  const [activeAudioOutputDevice, setActiveAudioOutputDevice] =
    useState<string>();

  React.useEffect(() => {
    Room.getLocalDevices(undefined, true).then((devices) => {
      setDevices(devices);
    });
  }, []);

  React.useEffect(() => {
    setAudioDevices(devices.filter((d) => d.kind === "audioinput"));
    setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
    setAudioOutputDevices(devices.filter((d) => d.kind === "audiooutput"));
  }, [devices]);

  const selectActiveDevice = React.useCallback(
    async (kind: MediaDeviceKind, id: string) => {
      room.switchActiveDevice(kind, id);
      switch (kind) {
        case "audioinput":
          setActiveAudioDevice(id);
          break;
        case "videoinput":
          setActiveVideoDevice(id);
          break;
        case "audiooutput":
          setActiveAudioOutputDevice(id);
          break;
      }
    },
    [room]
  );

  const [mediaDevicesState, setMediaDevicesState] =
    React.useState<MediaDevicesState>(() => {
      const state: MediaDevicesState = {
        state: new Map(),
        selectActiveDevice,
      };
      return state;
    });

  React.useEffect(() => {
    const state = new Map<MediaDeviceKind, MediaDevices>();
    state.set("videoinput", {
      available: videoDevices,
      selectedId: activeVideoDevice,
    });
    state.set("audioinput", {
      available: audioDevices,
      selectedId: activeAudioDevice,
    });
    state.set("audiooutput", {
      available: audioOutputDevices,
      selectedId: activeAudioOutputDevice,
    });
    setMediaDevicesState({
      state,
      selectActiveDevice,
    });
  }, [
    videoDevices,
    activeVideoDevice,
    audioDevices,
    activeAudioDevice,
    audioOutputDevices,
    activeAudioOutputDevice,
    selectActiveDevice,
  ]);

  return mediaDevicesState;
}
