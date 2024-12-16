/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { type FC } from "react";
import { Text, Tooltip, TooltipProvider } from "@vector-im/compound-web";
import {
  MicOnSolidIcon,
  VideoCallSolidIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

interface Props {
  audio?: RTCInboundRtpStreamStats | RTCOutboundRtpStreamStats;
  video?: RTCInboundRtpStreamStats | RTCOutboundRtpStreamStats;
}

export const RTCConnectionStats: FC<Props> = ({ audio, video, ...rest }) => {
  return (
    <div>
      <TooltipProvider>
        {audio && (
          <div>
            <Tooltip label={JSON.stringify(audio, null, 2)}>
              <MicOnSolidIcon />
            </Tooltip>
            {"jitter" in audio && typeof audio.jitter === "number" && (
              <Text as="span" size="xs">
                &nbsp;{(audio.jitter * 1000).toFixed(0)}ms
              </Text>
            )}
          </div>
        )}
        {video && (
          <div>
            {video && (
              <Tooltip label={JSON.stringify(video, null, 2)}>
                <VideoCallSolidIcon />
              </Tooltip>
            )}
            {video?.framesPerSecond && (
              <Text as="span" size="xs">
                &nbsp;{video.framesPerSecond.toFixed(0)}fps
              </Text>
            )}
            {"jitter" in video && typeof video.jitter === "number" && (
              <Text as="span" size="xs">
                &nbsp;{(video.jitter * 1000).toFixed(0)}ms
              </Text>
            )}
            {"frameHeight" in video &&
              typeof video.frameHeight === "number" &&
              "frameWidth" in video &&
              typeof video.frameWidth === "number" && (
                <Text as="span" size="xs">
                  &nbsp;{video.frameWidth}x{video.frameHeight}
                </Text>
              )}
            {"qualityLimitationReason" in video &&
              typeof video.qualityLimitationReason === "string" &&
              video.qualityLimitationReason !== "none" && (
                <Text as="span" size="xs">
                  &nbsp;{video.qualityLimitationReason}
                </Text>
              )}
          </div>
        )}
      </TooltipProvider>
    </div>
  );
};
