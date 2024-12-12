/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { act, render } from "@testing-library/react";
import { expect, test } from "vitest";
import { TooltipProvider } from "@vector-im/compound-web";
import { userEvent } from "@testing-library/user-event";
import { ReactNode } from "react";

import { MockRoom } from "../utils/testReactions";
import { ReactionToggleButton } from "./ReactionToggleButton";
import { ElementCallReactionEventType } from "../reactions";
import { CallViewModel } from "../state/CallViewModel";
import { getBasicCallViewModelEnvironment } from "../utils/test-viewmodel";
import { alice, local, localRtcMember } from "../utils/test-fixtures";
import { MockRTCSession } from "../utils/test";
import { ReactionsProvider } from "../useReactions";
import { MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc/MatrixRTCSession";

const localIdent = `${localRtcMember.sender}:${localRtcMember.deviceId}`;

function TestComponent({
  rtcSession,
  vm,
}: {
  rtcSession: MockRTCSession;
  vm: CallViewModel;
}): ReactNode {
  return (
    <TooltipProvider>
      <ReactionsProvider rtcSession={rtcSession as unknown as MatrixRTCSession}>
        <ReactionToggleButton vm={vm} identifier={localIdent} />
      </ReactionsProvider>
    </TooltipProvider>
  );
}

test("Can open menu", async () => {
  const user = userEvent.setup();
  const { vm, rtcSession } = getBasicCallViewModelEnvironment([alice]);
  const { getByLabelText, container } = render(
    <TestComponent vm={vm} rtcSession={rtcSession} />,
  );
  await user.click(getByLabelText("common.reactions"));
  expect(container).toMatchSnapshot();
});

test("Can raise hand", async () => {
  const user = userEvent.setup();
  const { vm, rtcSession } = getBasicCallViewModelEnvironment([local, alice]);
  const { getByLabelText, container } = render(
    <TestComponent vm={vm} rtcSession={rtcSession} />,
  );
  await user.click(getByLabelText("common.reactions"));
  await user.click(getByLabelText("action.raise_hand"));
  expect(rtcSession.room.client.sendEvent).toHaveBeenCalledWith(
    undefined,
    "m.reaction",
    {
      "m.relates_to": {
        event_id: localRtcMember.eventId,
        key: "🖐️",
        rel_type: "m.annotation",
      },
    },
  );
  await act(() => {
    vm.updateReactions({
      raisedHands: {
        [localIdent]: new Date(),
      },
      reactions: {},
    });
  });
  expect(container).toMatchSnapshot();
});

test.only("Can lower hand", async () => {
  const user = userEvent.setup();
  const { vm, rtcSession } = getBasicCallViewModelEnvironment([local, alice]);
  const { getByLabelText, container } = render(
    <TestComponent vm={vm} rtcSession={rtcSession} />,
  );
  await user.click(getByLabelText("common.reactions"));
  await user.click(getByLabelText("action.raise_hand"));
  await act(() => {
    vm.updateReactions({
      raisedHands: {
        [localIdent]: new Date(),
      },
      reactions: {},
    });
  });
  await user.click(getByLabelText("action.lower_hand"));
  expect(rtcSession.room.client.redactEvent).toHaveBeenCalledWith(
    undefined,
    "m.reaction",
    {
      "m.relates_to": {
        event_id: localRtcMember.eventId,
        key: "🖐️",
        rel_type: "m.annotation",
      },
    },
  );
  await act(() => {
    vm.updateReactions({
      raisedHands: {},
      reactions: {},
    });
  });
  expect(container).toMatchSnapshot();
});

test("Can react with emoji", async () => {
  const user = userEvent.setup();
  const room = new MockRoom(memberUserIdAlice);
  const rtcSession = new MockRTCSession(room, membership);
  const { getByLabelText, getByText } = render(
    <TestComponent rtcSession={rtcSession} />,
  );
  await user.click(getByLabelText("common.reactions"));
  await user.click(getByText("🐶"));
  expect(room.testSentEvents).toEqual([
    [
      undefined,
      ElementCallReactionEventType,
      {
        "m.relates_to": {
          event_id: memberEventAlice,
          rel_type: "m.reference",
        },
        name: "dog",
        emoji: "🐶",
      },
    ],
  ]);
});

test("Can fully expand emoji picker", async () => {
  const user = userEvent.setup();
  const room = new MockRoom(memberUserIdAlice);
  const rtcSession = new MockRTCSession(room, membership);
  const { getByText, container, getByLabelText } = render(
    <TestComponent rtcSession={rtcSession} />,
  );
  await user.click(getByLabelText("common.reactions"));
  await user.click(getByLabelText("action.show_more"));
  expect(container).toMatchSnapshot();
  await user.click(getByText("🦗"));

  expect(room.testSentEvents).toEqual([
    [
      undefined,
      ElementCallReactionEventType,
      {
        "m.relates_to": {
          event_id: memberEventAlice,
          rel_type: "m.reference",
        },
        name: "crickets",
        emoji: "🦗",
      },
    ],
  ]);
});

test("Can close reaction dialog", async () => {
  const user = userEvent.setup();
  const room = new MockRoom(memberUserIdAlice);
  const rtcSession = new MockRTCSession(room, membership);
  const { getByLabelText, container } = render(
    <TestComponent rtcSession={rtcSession} />,
  );
  await user.click(getByLabelText("common.reactions"));
  await user.click(getByLabelText("action.show_more"));
  await user.click(getByLabelText("action.show_less"));
  expect(container).toMatchSnapshot();
});
