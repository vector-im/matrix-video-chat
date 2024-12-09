/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { ReactNode } from "react";
import {
  showReactions as showReactionsSetting,
  useSetting,
} from "../settings/settings";
import styles from "./ReactionsOverlay.module.css";
import { CallViewModel } from "../state/CallViewModel";
import { useObservableState } from "observable-hooks";

export function ReactionsOverlay({ vm }: { vm: CallViewModel }): ReactNode {
  const [showReactions] = useSetting(showReactionsSetting);
  const reactionsIcons = useObservableState(vm.visibleReactions);

  if (!showReactions) {
    return;
  }

  return (
    <div className={styles.container}>
      {reactionsIcons?.map(({ sender, emoji, startX }) => (
        <span
          // Reactions effects are considered presentation elements. The reaction
          // is also present on the sender's tile, which assistive technology can
          // read from instead.
          role="presentation"
          style={{ left: `${startX}vw` }}
          className={styles.reaction}
          // A sender can only send one emoji at a time.
          key={sender}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}
