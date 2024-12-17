/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { type FC } from "react";
import { IconButton, Text } from "@vector-im/compound-web";
import {
  MicOnSolidIcon,
  VideoCallSolidIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

interface Props {
  audio?: RTCInboundRtpStreamStats | RTCOutboundRtpStreamStats;
  video?: RTCInboundRtpStreamStats | RTCOutboundRtpStreamStats;
}

// This is only used in developer mode for debugging purposes, so we don't need full localization
export const RTCConnectionStats: FC<Props> = ({ audio, video, ...rest }) => {
  return (
    <div>
      {audio && (
        <div>
          <IconButton
            onClick={() => alert(JSON.stringify(audio, null, 2))}
            size="sm"
          >
            <MicOnSolidIcon />
          </IconButton>
          {"jitter" in audio && typeof audio.jitter === "number" && (
            <Text as="span" size="xs" title="jitter">
              &nbsp;{(audio.jitter * 1000).toFixed(0)}ms
            </Text>
          )}
        </div>
      )}
      {video && (
        <div>
          <IconButton
            onClick={() => alert(JSON.stringify(video, null, 2))}
            size="sm"
          >
            <VideoCallSolidIcon />
          </IconButton>
          {video?.framesPerSecond && (
            <Text as="span" size="xs" title="frame rate">
              &nbsp;{video.framesPerSecond.toFixed(0)}fps
            </Text>
          )}
          {"jitter" in video && typeof video.jitter === "number" && (
            <Text as="span" size="xs" title="jitter">
              &nbsp;{(video.jitter * 1000).toFixed(0)}ms
            </Text>
          )}
          {"frameHeight" in video &&
            typeof video.frameHeight === "number" &&
            "frameWidth" in video &&
            typeof video.frameWidth === "number" && (
              <Text as="span" size="xs" title="frame size">
                &nbsp;{video.frameWidth}x{video.frameHeight}
              </Text>
            )}
          {"qualityLimitationReason" in video &&
            typeof video.qualityLimitationReason === "string" &&
            video.qualityLimitationReason !== "none" && (
              <Text as="span" size="xs" title="quality limitation reason">
                &nbsp;{video.qualityLimitationReason}
              </Text>
            )}
        </div>
      )}
    </div>
  );
};
