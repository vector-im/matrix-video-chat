import { expect, test, vitest } from "vitest";
import { useAudioContext } from "./useAudioContext";
import { FC } from "react";
import { render } from "@testing-library/react";
import { deviceStub, MediaDevicesContext } from "./livekit/MediaDevicesContext";
import { afterEach } from "node:test";
import { soundEffectVolumeSetting } from "./settings/settings";

/**
 * Test explanation.
 * This test suite checks that the useReactions hook appropriately reacts
 * to new reactions, redactions and membership changesin the room. There is
 * a large amount of test structure used to construct a mock environment.
 */

const TestComponent: FC = () => {
  const audioCtx = useAudioContext({
    sounds: Promise.resolve({
      aSound: new ArrayBuffer(32),
    }),
    latencyHint: "balanced",
  });
  if (!audioCtx) {
    return null;
  }
  return (
    <>
      <button role="button" onClick={() => audioCtx.playSound("aSound")}>
        Valid sound
      </button>
      <button
        role="button"
        onClick={() => audioCtx.playSound("not-valid" as any)}
      >
        Invalid sound
      </button>
    </>
  );
};

class MockAudioContext {
  static testContext: MockAudioContext;

  constructor() {
    MockAudioContext.testContext = this;
  }

  public gain = vitest.mocked(
    {
      connect: () => {},
      gain: {
        setValueAtTime: vitest.fn(),
      },
    },
    true,
  );

  public setSinkId = vitest.fn().mockResolvedValue(undefined);
  public decodeAudioData = vitest.fn().mockReturnValue(1);
  public createBufferSource = vitest.fn().mockReturnValue(
    vitest.mocked({
      connect: (v: unknown) => v,
      start: () => {},
    }),
  );
  public createGain = vitest.fn().mockReturnValue(this.gain);
  public close = vitest.fn().mockResolvedValue(undefined);
}

afterEach(() => {
  vitest.unstubAllGlobals();
});

test("can play a single sound", async () => {
  vitest.stubGlobal("AudioContext", MockAudioContext);
  const { findByText } = render(<TestComponent />);
  (await findByText("Valid sound")).click();
  expect(
    MockAudioContext.testContext.createBufferSource,
  ).toHaveBeenCalledOnce();
});
test("will ignore sounds that are not registered", async () => {
  vitest.stubGlobal("AudioContext", MockAudioContext);
  const { findByText } = render(<TestComponent />);
  (await findByText("Invalid sound")).click();
  expect(
    MockAudioContext.testContext.createBufferSource,
  ).not.toHaveBeenCalled();
});

test("will use the correct device", async () => {
  vitest.stubGlobal("AudioContext", MockAudioContext);
  render(
    <MediaDevicesContext.Provider
      value={{
        audioInput: deviceStub,
        audioOutput: {
          selectedId: "chosen-device",
          available: [],
          select: () => {},
        },
        videoInput: deviceStub,
        startUsingDeviceNames: () => {},
        stopUsingDeviceNames: () => {},
      }}
    >
      <TestComponent />
    </MediaDevicesContext.Provider>,
  );
  expect(
    MockAudioContext.testContext.createBufferSource,
  ).not.toHaveBeenCalled();
  expect(MockAudioContext.testContext.setSinkId).toHaveBeenCalledWith(
    "chosen-device",
  );
});

test("will use the correct volume", async () => {
  vitest.stubGlobal("AudioContext", MockAudioContext);
  soundEffectVolumeSetting.setValue(0.33);
  const { findByText } = render(<TestComponent />);
  (await findByText("Valid sound")).click();
  expect(
    MockAudioContext.testContext.gain.gain.setValueAtTime,
  ).toHaveBeenCalledWith(0.33, 0);
});
