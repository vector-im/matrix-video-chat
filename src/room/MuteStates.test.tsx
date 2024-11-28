/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import React, { ReactNode } from "react";
import { beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { useMuteStates } from "./MuteStates";
import {
  MediaDevice,
  MediaDevices,
  MediaDevicesContext,
} from "../livekit/MediaDevicesContext";
import { mockConfig } from "../utils/test";

function TestComponent(): ReactNode {
  const muteStates = useMuteStates();
  return (
    <div>
      <div data-testid="audio-enabled">
        {muteStates.audio.enabled.toString()}
      </div>
      <div data-testid="video-enabled">
        {muteStates.video.enabled.toString()}
      </div>
    </div>
  );
}

const mockMicrophone: MediaDeviceInfo = {
  deviceId: "",
  kind: "audioinput",
  label: "",
  groupId: "",
  toJSON() {
    return {};
  },
};

const mockSpeaker: MediaDeviceInfo = {
  deviceId: "",
  kind: "audiooutput",
  label: "",
  groupId: "",
  toJSON() {
    return {};
  },
};

const mockCamera: MediaDeviceInfo = {
  deviceId: "",
  kind: "videoinput",
  label: "",
  groupId: "",
  toJSON() {
    return {};
  },
};

function mockDevices(available: MediaDeviceInfo[]): MediaDevice {
  return {
    available,
    selectedId: "",
    select: (): void => {},
  };
}

function mockMediaDevices(
  {
    microphone,
    speaker,
    camera,
  }: {
    microphone?: boolean;
    speaker?: boolean;
    camera?: boolean;
  } = { microphone: true, speaker: true, camera: true },
): MediaDevices {
  return {
    audioInput: mockDevices(microphone ? [mockMicrophone] : []),
    audioOutput: mockDevices(speaker ? [mockSpeaker] : []),
    videoInput: mockDevices(camera ? [mockCamera] : []),
    startUsingDeviceNames: (): void => {},
    stopUsingDeviceNames: (): void => {},
  };
}

describe("useMuteStates", () => {
  beforeEach(() => {
    vi.spyOn(React, "useContext").mockReturnValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  it("disabled when no input devices", () => {
    mockConfig();

    render(
      <MemoryRouter>
        <MediaDevicesContext.Provider
          value={mockMediaDevices({
            microphone: false,
            camera: false,
          })}
        >
          <TestComponent />
        </MediaDevicesContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("audio-enabled").textContent).toBe("false");
    expect(screen.getByTestId("video-enabled").textContent).toBe("false");
  });

  it("should be enabled by default", () => {
    mockConfig();

    render(
      <MemoryRouter>
        <MediaDevicesContext.Provider value={mockMediaDevices()}>
          <TestComponent />
        </MediaDevicesContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("audio-enabled").textContent).toBe("true");
    expect(screen.getByTestId("video-enabled").textContent).toBe("true");
  });

  it("uses defaults from config", () => {
    mockConfig({
      media_devices: {
        enable_audio: false,
        enable_video: false,
      },
    });

    render(
      <MemoryRouter>
        <MediaDevicesContext.Provider value={mockMediaDevices()}>
          <TestComponent />
        </MediaDevicesContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("audio-enabled").textContent).toBe("false");
    expect(screen.getByTestId("video-enabled").textContent).toBe("false");
  });

  it("skipLobby mutes inputs on SPA", () => {
    mockConfig();
    vi.mock("../widget", () => {
      return {
        widget: null,
        ElementWidgetActions: {},
      };
    });

    render(
      <MemoryRouter initialEntries={["/room/?skipLobby=true"]}>
        <MediaDevicesContext.Provider value={mockMediaDevices()}>
          <TestComponent />
        </MediaDevicesContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("audio-enabled").textContent).toBe("false");
    expect(screen.getByTestId("video-enabled").textContent).toBe("false");
  });

  it("skipLobby does not mute inputs in widget mode", () => {
    mockConfig();
    vi.mock("../widget", () => {
      return {
        widget: {
          api: {
            transport: {
              send: async (): Promise<void> => new Promise((r) => r()),
            },
          },
          lazyActions: { on: vi.fn(), off: vi.fn() },
        },
        ElementWidgetActions: {},
      };
    });

    render(
      <MemoryRouter initialEntries={["/room/?skipLobby=true"]}>
        <MediaDevicesContext.Provider value={mockMediaDevices()}>
          <TestComponent />
        </MediaDevicesContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("audio-enabled").textContent).toBe("true");
    expect(screen.getByTestId("video-enabled").textContent).toBe("true");
  });
});
