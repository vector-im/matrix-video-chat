/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { describe, expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { TooltipProvider } from "@vector-im/compound-web";
import {
  TrackReference,
  TrackReferencePlaceholder,
} from "@livekit/components-core";
import { Track, TrackPublication } from "livekit-client";

import { MediaView } from "./MediaView";
import { EncryptionStatus } from "../state/MediaViewModel";
import { mockLocalParticipant } from "../utils/test";

describe("MediaView", () => {
  const participant = mockLocalParticipant({});
  const trackReferencePlaceholder: TrackReferencePlaceholder = {
    participant,
    source: Track.Source.Camera,
  };
  const trackReference: TrackReference = {
    ...trackReferencePlaceholder,
    publication: new TrackPublication(Track.Kind.Video, "id", "name"),
  };

  test("is accessible", async () => {
    const { container } = render(
      <MediaView
        displayName="Bob"
        videoEnabled
        videoFit="contain"
        targetWidth={300}
        targetHeight={200}
        encryptionStatus={EncryptionStatus.Connecting}
        mirror={false}
        unencryptedWarning={false}
        video={trackReference}
        member={undefined}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  describe("name tag", () => {
    test("is shown", () => {
      render(
        <MediaView
          displayName="Bob"
          videoEnabled
          videoFit="contain"
          targetWidth={300}
          targetHeight={200}
          encryptionStatus={EncryptionStatus.Connecting}
          mirror={false}
          unencryptedWarning={false}
          video={trackReference}
          member={undefined}
        />,
      );
      expect(screen.getByTestId("name_tag")).toHaveTextContent("Bob");
    });
  });

  describe("unencryptedWarning", () => {
    test("is shown and accessible", async () => {
      const { container } = render(
        <TooltipProvider>
          <MediaView
            displayName="Bob"
            videoEnabled
            videoFit="contain"
            targetWidth={300}
            targetHeight={200}
            encryptionStatus={EncryptionStatus.Connecting}
            mirror={false}
            unencryptedWarning={true}
            video={trackReference}
            member={undefined}
          />
        </TooltipProvider>,
      );
      expect(await axe(container)).toHaveNoViolations();
      expect(screen.getByTestId("unencrypted_warning_icon")).toBeTruthy();
    });

    test("is not shown", () => {
      render(
        <TooltipProvider>
          <MediaView
            displayName="Bob"
            videoEnabled
            videoFit="contain"
            targetWidth={300}
            targetHeight={200}
            encryptionStatus={EncryptionStatus.Connecting}
            mirror={false}
            unencryptedWarning={false}
            video={trackReferencePlaceholder}
            member={undefined}
          />
        </TooltipProvider>,
      );
      expect(screen.queryByTestId("unencrypted_warning_icon")).toBeNull();
    });
  });

  describe("videoMuted", () => {
    test("just video is visible", () => {
      render(
        <TooltipProvider>
          <MediaView
            displayName="Bob"
            videoEnabled={true}
            videoFit="contain"
            targetWidth={300}
            targetHeight={200}
            encryptionStatus={EncryptionStatus.Connecting}
            mirror={false}
            unencryptedWarning={true}
            video={trackReference}
            member={undefined}
          />
        </TooltipProvider>,
      );
      expect(screen.getByTestId("video")).toBeVisible();
      expect(screen.getByTestId("avatar")).not.toBeVisible();
    });

    test("just avatar is visible", () => {
      render(
        <TooltipProvider>
          <MediaView
            displayName="Bob"
            videoEnabled={false}
            videoFit="contain"
            targetWidth={300}
            targetHeight={200}
            encryptionStatus={EncryptionStatus.Connecting}
            mirror={false}
            unencryptedWarning={false}
            video={trackReference}
            member={undefined}
          />
        </TooltipProvider>,
      );
      expect(screen.getByTestId("avatar")).toBeVisible();
      expect(screen.getByTestId("video")).not.toBeVisible();
    });
  });
});
