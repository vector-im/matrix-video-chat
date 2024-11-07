/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { expect, test } from "vitest";
import { render } from "@testing-library/react";
import { act, ReactNode, useState } from "react";

import { Modal } from "./Modal";
import { afterEach } from "node:test";
import userEvent from "@testing-library/user-event";

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

test("that nothing is rendered when the modal is closed", () => {
  const { queryByRole } = render(
    <Modal title="My modal" open={false}>
      <p>This is the content.</p>
    </Modal>,
  );
  expect(queryByRole("dialog")).toBeNull();
});

test("the content is rendered when the modal is open", () => {
  const { queryByRole } = render(
    <Modal title="My modal" open={true}>
      <p>This is the content.</p>
    </Modal>,
  );
  expect(queryByRole("dialog")).toMatchSnapshot();
});

test("the modal can be closed by clicking the close button", async () => {
  function ModalFn(): ReactNode {
    const [isOpen, setOpen] = useState(true);
    return (
      <Modal title="My modal" open={isOpen} onDismiss={() => setOpen(false)}>
        <p>This is the content.</p>
      </Modal>
    );
  }
  const user = userEvent.setup();
  const { queryByRole, getByRole } = render(<ModalFn />);
  await act(async () => {
    await user.click(getByRole("button", { name: "action.close" }));
  });
  expect(queryByRole("dialog")).toBeNull();
});

test("the modal renders as a drawer in mobile viewports", () => {
  window.matchMedia = function (query): MediaQueryList {
    return {
      matches: query.includes("hover: none"),
      addEventListener(): MediaQueryList {
        return this as MediaQueryList;
      },
      removeEventListener(): MediaQueryList {
        return this as MediaQueryList;
      },
    } as unknown as MediaQueryList;
  };

  const { queryByRole } = render(
    <Modal title="My modal" open={true}>
      <p>This is the content.</p>
    </Modal>,
  );
  expect(queryByRole("dialog")).toMatchSnapshot();
});
