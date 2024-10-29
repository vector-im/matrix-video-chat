/*
Copyright 2024 Milton Moura <miltonmoura@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import {
  EventType,
  MatrixEvent,
  RelationType,
  RoomEvent as MatrixRoomEvent,
} from "matrix-js-sdk/src/matrix";
import { ReactionEventContent } from "matrix-js-sdk/src/types";
import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { MatrixRTCSession } from "matrix-js-sdk/src/matrixrtc/MatrixRTCSession";
import { logger } from "matrix-js-sdk/src/logger";

import { useMatrixRTCSessionMemberships } from "./useMatrixRTCSessionMemberships";
import { useClientState } from "./ClientContext";

interface ReactionsContextType {
  raisedHands: Record<string, Date>;
  addRaisedHand: (userId: string, info: RaisedHandInfo) => void;
  removeRaisedHand: (userId: string) => void;
  supportsReactions: boolean;
  myReactionId: string | null;
}

const ReactionsContext = createContext<ReactionsContextType | undefined>(
  undefined,
);

interface RaisedHandInfo {
  /**
   * Call membership event that was reacted to.
   */
  membershipEventId: string;
  /**
   * Event ID of the reaction itself.
   */
  reactionEventId: string;
  /**
   * The time when the reaction was raised.
   */
  time: Date;
}

export const useReactions = (): ReactionsContextType => {
  const context = useContext(ReactionsContext);
  if (!context) {
    throw new Error("useReactions must be used within a ReactionsProvider");
  }
  return context;
};

/**
 * Provider that handles raised hand reactions for a given `rtcSession`.
 */
export const ReactionsProvider = ({
  children,
  rtcSession,
}: {
  children: ReactNode;
  rtcSession: MatrixRTCSession;
}): JSX.Element => {
  const [raisedHands, setRaisedHands] = useState<
    Record<string, RaisedHandInfo>
  >({});
  const memberships = useMatrixRTCSessionMemberships(rtcSession);
  const clientState = useClientState();
  const supportsReactions =
    clientState?.state === "valid" && clientState.supportedFeatures.reactions;
  const room = rtcSession.room;

  // Calculate our own reaction event.
  const myReactionId = useMemo((): string | null => {
    const myUserId = room.client.getUserId();
    if (myUserId) {
      return raisedHands[myUserId]?.reactionEventId;
    }
    return null;
  }, [raisedHands, room]);

  // Reduce the data down for the consumers.
  const resultRaisedHands = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(raisedHands).map(([uid, data]) => [uid, data.time]),
      ),
    [raisedHands],
  );

  const addRaisedHand = useCallback(
    (userId: string, info: RaisedHandInfo) => {
      setRaisedHands({
        ...raisedHands,
        [userId]: info,
      });
    },
    [raisedHands],
  );

  const removeRaisedHand = useCallback(
    (userId: string) => {
      delete raisedHands[userId];
      setRaisedHands({ ...raisedHands });
    },
    [raisedHands],
  );

  // This effect will check the state whenever the membership of the session changes.
  useEffect(() => {
    // Fetches the first reaction for a given event. We assume no more than
    // one reaction on an event here.
    const getLastReactionEvent = (eventId: string): MatrixEvent | undefined => {
      const relations = room.relations.getChildEventsForEvent(
        eventId,
        RelationType.Annotation,
        EventType.Reaction,
      );
      const allEvents = relations?.getRelations() ?? [];
      return allEvents.length > 0 ? allEvents[0] : undefined;
    };

    // Remove any raised hands for users no longer joined to the call.
    for (const userId of Object.keys(raisedHands).filter(
      (rhId) => !memberships.find((u) => u.sender == rhId),
    )) {
      removeRaisedHand(userId);
    }

    // For each member in the call, check to see if a reaction has
    // been raised and adjust.
    for (const m of memberships) {
      if (!m.sender || !m.eventId) {
        continue;
      }
      if (
        raisedHands[m.sender] &&
        raisedHands[m.sender].membershipEventId !== m.eventId
      ) {
        // Membership event for sender has changed since the hand
        // was raised, reset.
        removeRaisedHand(m.sender);
      }
      const reaction = getLastReactionEvent(m.eventId);
      const eventId = reaction?.getId();
      if (!eventId) {
        continue;
      }
      if (reaction && reaction.getType() === EventType.Reaction) {
        const content = reaction.getContent() as ReactionEventContent;
        if (content?.["m.relates_to"]?.key === "🖐️") {
          addRaisedHand(m.sender, {
            membershipEventId: m.eventId,
            reactionEventId: eventId,
            time: new Date(reaction.localTimestamp),
          });
        }
      }
    }
    // Deliberately ignoring addRaisedHand, raisedHands which was causing looping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, memberships]);

  // This effect handles any *live* reaction/redactions in the room.
  useEffect(() => {
    const handleReactionEvent = (event: MatrixEvent): void => {
      const sender = event.getSender();
      const reactionEventId = event.getId();
      if (!sender || !reactionEventId) {
        // Skip any event without a sender or event ID.
        return;
      }

      if (event.getType() === EventType.Reaction) {
        const content = event.getContent() as ReactionEventContent;
        const membershipEventId = content["m.relates_to"].event_id;

        // Check to see if this reaction was made to a membership event (and the
        // sender of the reaction matches the membership)
        if (
          !memberships.some(
            (e) => e.eventId === membershipEventId && e.sender === sender,
          )
        ) {
          logger.warn(
            `Reaction target was not a membership event for ${sender}, ignoring`,
          );
          return;
        }

        if (content?.["m.relates_to"].key === "🖐️") {
          addRaisedHand(sender, {
            reactionEventId,
            membershipEventId,
            time: new Date(event.localTimestamp),
          });
        }
      } else if (event.getType() === EventType.RoomRedaction) {
        const targetEvent = event.event.redacts;
        const targetUser = Object.entries(raisedHands).find(
          ([_u, r]) => r.reactionEventId === targetEvent,
        )?.[0];
        if (!targetUser) {
          // Reaction target was not for us, ignoring
          return;
        }
        removeRaisedHand(targetUser);
      }
    };

    room.on(MatrixRoomEvent.Timeline, handleReactionEvent);
    room.on(MatrixRoomEvent.Redaction, handleReactionEvent);

    return (): void => {
      room.off(MatrixRoomEvent.Timeline, handleReactionEvent);
      room.off(MatrixRoomEvent.Redaction, handleReactionEvent);
    };
  }, [room, addRaisedHand, removeRaisedHand, memberships, raisedHands]);

  return (
    <ReactionsContext.Provider
      value={{
        raisedHands: resultRaisedHands,
        addRaisedHand,
        removeRaisedHand,
        supportsReactions,
        myReactionId,
      }}
    >
      {children}
    </ReactionsContext.Provider>
  );
};
