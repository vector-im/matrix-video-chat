/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/
import {
  Observable,
  audit,
  merge,
  timer,
  filter,
  startWith,
  distinctUntilChanged,
} from "rxjs";

/**
 * Require 1 second of continuous speaking to become a speaker, and 60 second of
 * continuous silence to stop being considered a speaker
 */
export function observeSpeaker(
  isSpeakingObservable: Observable<boolean>,
): Observable<boolean> {
  return isSpeakingObservable.pipe(
    audit((s) =>
      merge(
        timer(s ? 1000 : 60000),
        // If the speaking flag resets to its original value during this time,
        // end the silencing window to stick with that original value
        isSpeakingObservable.pipe(filter((s1) => s1 !== s)),
      ),
    ),
    startWith(false),
    distinctUntilChanged(),
  );
}
