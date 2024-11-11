/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import {
  MouseEventHandler,
  ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { DurationFormat } from "@formatjs/intl-durationformat";
import { useTranslation } from "react-i18next";

import { ReactionIndicator } from "./ReactionIndicator";

const durationFormatter = new DurationFormat(undefined, {
  minutesDisplay: "always",
  secondsDisplay: "always",
  hoursDisplay: "auto",
  style: "digital",
});

export function RaisedHandIndicator({
  raisedHandTime,
  miniature,
  showTimer,
  onClick,
}: {
  raisedHandTime?: Date;
  miniature?: boolean;
  showTimer?: boolean;
  onClick?: () => void;
}): ReactNode {
  const { t } = useTranslation();
  const [raisedHandDuration, setRaisedHandDuration] = useState("");

  const clickCallback = useCallback<MouseEventHandler<HTMLButtonElement>>(
    (event) => {
      if (!onClick) {
        return;
      }
      event.preventDefault();
      onClick();
    },
    [onClick],
  );

  // This effect creates a simple timer effect.
  useEffect(() => {
    if (!raisedHandTime || !showTimer) {
      return;
    }

    const calculateTime = (): void => {
      const totalSeconds = Math.ceil(
        (new Date().getTime() - raisedHandTime.getTime()) / 1000,
      );
      setRaisedHandDuration(
        durationFormatter.format({
          seconds: totalSeconds % 60,
          minutes: Math.floor(totalSeconds / 60),
        }),
      );
    };
    calculateTime();
    const to = setInterval(calculateTime, 1000);
    return (): void => clearInterval(to);
  }, [setRaisedHandDuration, raisedHandTime, showTimer]);

  if (!raisedHandTime) {
    return;
  }

  const content = (
    <ReactionIndicator emoji="✋" miniature={miniature}>
      {showTimer && <p>{raisedHandDuration}</p>}
    </ReactionIndicator>
  );

  if (onClick) {
    return (
      <button
        aria-label={t("action.lower_hand")}
        style={{
          display: "contents",
          background: "none",
        }}
        onClick={clickCallback}
      >
        {content}
      </button>
    );
  }

  return content;
}
