/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { expect, describe, it } from "vitest";
import { render } from "@testing-library/react";

import { TileAvatar } from "./TileAvatar";

describe("TileAvatar", () => {
  it("should show loading spinner when loading", () => {
    const { container } = render(
      <TileAvatar id="@a:example.org" name="Alice" size={96} loading={true} />,
    );
    expect(container.querySelector(".loading")).toBeInTheDocument();
  });

  it("should not show loading spinner when not loading", () => {
    const { container } = render(
      <TileAvatar id="@a:example.org" name="Alice" size={96} loading={false} />,
    );
    expect(container.querySelector(".loading")).not.toBeInTheDocument();
  });

  it("show have maximum size of 120px", () => {
    const { queryByRole } = render(
      <TileAvatar
        id="@a:example.org"
        name="Alice"
        size={999}
        loading={false}
      />,
    );
    expect(queryByRole("img", { name: "@a:example.org" })).toHaveStyle(
      "--cpd-avatar-size: 120px;",
    );
  });
});
