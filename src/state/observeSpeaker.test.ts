/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import { describe, test } from "vitest";
import { distinctUntilChanged } from "rxjs";

import { withTestScheduler } from "../utils/test";
import { observeSpeaker } from "./observeSpeaker";

const yesNo = {
  y: true,
  n: false,
};

describe("observeSpeaker", () => {
  describe("does not activate", () => {
    const expectedOutputMarbles = "n";
    test("no speaking", () => {
      const speakingInputMarbles = " n";
      withTestScheduler(({ hot, expectObservable }) => {
        expectObservable(
          observeSpeaker(hot(speakingInputMarbles, yesNo)).pipe(
            distinctUntilChanged(),
          ),
        ).toBe(expectedOutputMarbles, yesNo);
      });
    });

    test("speaking for 1ms", () => {
      const speakingInputMarbles = " y n";
      withTestScheduler(({ hot, expectObservable }) => {
        expectObservable(
          observeSpeaker(hot(speakingInputMarbles, yesNo)).pipe(
            distinctUntilChanged(),
          ),
        ).toBe(expectedOutputMarbles, yesNo);
      });
    });

    test("speaking for 999ms", () => {
      const speakingInputMarbles = " y 999ms n";
      withTestScheduler(({ hot, expectObservable }) => {
        expectObservable(
          observeSpeaker(hot(speakingInputMarbles, yesNo)).pipe(
            distinctUntilChanged(),
          ),
        ).toBe(expectedOutputMarbles, yesNo);
      });
    });

    test("speaking intermittently", () => {
      const speakingInputMarbles =
        " y 199ms n 199ms y 199ms n 199ms y 199ms n 199ms y 199ms n 199ms y 199ms n 199ms y 199ms n 199ms y 199ms n 199ms y 199ms n";
      withTestScheduler(({ hot, expectObservable }) => {
        expectObservable(
          observeSpeaker(hot(speakingInputMarbles, yesNo)).pipe(
            distinctUntilChanged(),
          ),
        ).toBe(expectedOutputMarbles, yesNo);
      });
    });
  });

  describe("activates", () => {
    test("speaking for 1001ms activates for 60s", () => {
      const speakingInputMarbles = " y 1s    n      ";
      const expectedOutputMarbles = "n 999ms y 60s n";
      withTestScheduler(({ hot, expectObservable }) => {
        expectObservable(
          observeSpeaker(hot(speakingInputMarbles, yesNo)).pipe(
            distinctUntilChanged(),
          ),
        ).toBe(expectedOutputMarbles, yesNo);
      });
    });

    test("speaking for 5s activates for 64s", () => {
      const speakingInputMarbles = " y 5s    n      ";
      const expectedOutputMarbles = "n 999ms y 64s n";
      withTestScheduler(({ hot, expectObservable }) => {
        expectObservable(
          observeSpeaker(hot(speakingInputMarbles, yesNo)).pipe(
            distinctUntilChanged(),
          ),
        ).toBe(expectedOutputMarbles, yesNo);
      });
    });
  });
});
