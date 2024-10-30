/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import {
  AudioSource,
  TrackReferenceOrPlaceholder,
  VideoSource,
  observeParticipantEvents,
  observeParticipantMedia,
  roomEventSelector,
} from "@livekit/components-core";
import {
  LocalParticipant,
  LocalTrack,
  Participant,
  ParticipantEvent,
  RemoteParticipant,
  Track,
  TrackEvent,
  facingModeFromLocalTrack,
  Room as LivekitRoom,
  RoomEvent as LivekitRoomEvent,
} from "livekit-client";
import { RoomMember, RoomMemberEvent } from "matrix-js-sdk/src/matrix";
import {
  BehaviorSubject,
  Observable,
  Subject,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  distinctUntilKeyChanged,
  fromEvent,
  map,
  merge,
  of,
  shareReplay,
  startWith,
  switchMap,
  throttleTime,
} from "rxjs";
import { useEffect } from "react";

import { ViewModel } from "./ViewModel";
import { useReactiveState } from "../useReactiveState";
import { alwaysShowSelf } from "../settings/settings";
import { accumulate } from "../utils/observable";
import { EncryptionSystem } from "../e2ee/sharedKeyManagement";
import { E2eeType } from "../e2ee/e2eeType";

// TODO: Move this naming logic into the view model
export function useDisplayName(vm: MediaViewModel): string {
  const [displayName, setDisplayName] = useReactiveState(
    () => vm.member?.rawDisplayName ?? "[👻]",
    [vm.member],
  );
  useEffect(() => {
    if (vm.member) {
      const updateName = (): void => {
        setDisplayName(vm.member!.rawDisplayName);
      };

      vm.member!.on(RoomMemberEvent.Name, updateName);
      return (): void => {
        vm.member!.removeListener(RoomMemberEvent.Name, updateName);
      };
    }
  }, [vm.member, setDisplayName]);

  return displayName;
}

function observeTrackReference(
  participant: Participant,
  source: Track.Source,
): Observable<TrackReferenceOrPlaceholder> {
  return observeParticipantMedia(participant).pipe(
    map(() => ({
      participant,
      publication: participant.getTrackPublication(source),
      source,
    })),
    distinctUntilKeyChanged("publication"),
  );
}

function encryptionErrorObservable(
  room: LivekitRoom,
  participant: Participant,
  criteria: string,
): Observable<boolean> {
  const roomEvents = roomEventSelector(
    room,
    LivekitRoomEvent.EncryptionError,
  ).pipe(
    map((e) => {
      const [err] = e;
      return (
        // Ideally we would pull the participant identity from the field on the error.
        // However, it gets lost in the serialization process between workers.
        // So, instead we do a string match
        (err?.message.includes(participant.identity) &&
          err?.message.includes(criteria)) ??
        false
      );
    }),
    throttleTime(1000), // Throttle to avoid spamming the UI
  );

  return merge(
    roomEvents,
    roomEvents.pipe(
      debounceTime(3000), // Wait 3 seconds before clearing the error, toast style
      map(() => false),
    ),
  );
}
abstract class BaseMediaViewModel extends ViewModel {
  /**
   * Whether the media belongs to the local user.
   */
  public readonly local = this.participant.isLocal;
  /**
   * The LiveKit video track for this media.
   */
  public readonly video: Observable<TrackReferenceOrPlaceholder>;
  /**
   * Whether there should be a warning that this media is unencrypted.
   */
  public readonly unencryptedWarning: Observable<boolean>;

  public readonly encryptionKeyMissing: Observable<boolean>;

  public readonly encryptionKeyInvalid: Observable<boolean>;

  public constructor(
    /**
     * An opaque identifier for this media.
     */
    public readonly id: string,
    /**
     * The Matrix room member to which this media belongs.
     */
    // TODO: Fully separate the data layer from the UI layer by keeping the
    // member object internal
    public readonly member: RoomMember | undefined,
    protected readonly participant: LocalParticipant | RemoteParticipant,
    encryptionSystem: EncryptionSystem,
    audioSource: AudioSource,
    videoSource: VideoSource,
    livekitRoom: LivekitRoom,
  ) {
    super();
    const audio = observeTrackReference(participant, audioSource).pipe(
      this.scope.state(),
    );
    this.video = observeTrackReference(participant, videoSource).pipe(
      this.scope.state(),
    );
    this.unencryptedWarning = combineLatest(
      [audio, this.video],
      (a, v) =>
        encryptionSystem.kind !== E2eeType.NONE &&
        (a.publication?.isEncrypted === false ||
          v.publication?.isEncrypted === false),
    ).pipe(distinctUntilChanged(), shareReplay(1));
    this.encryptionKeyMissing = encryptionErrorObservable(
      livekitRoom,
      participant,
      "MissingKey",
    ).pipe(startWith(false));
    this.encryptionKeyInvalid = encryptionErrorObservable(
      livekitRoom,
      participant,
      "InvalidKey",
    ).pipe(startWith(false));
  }
}

/**
 * Some participant's media.
 */
export type MediaViewModel = UserMediaViewModel | ScreenShareViewModel;
export type UserMediaViewModel =
  | LocalUserMediaViewModel
  | RemoteUserMediaViewModel;

/**
 * Some participant's user media.
 */
abstract class BaseUserMediaViewModel extends BaseMediaViewModel {
  /**
   * Whether the participant is speaking.
   */
  public readonly speaking = observeParticipantEvents(
    this.participant,
    ParticipantEvent.IsSpeakingChanged,
  ).pipe(
    map((p) => p.isSpeaking),
    this.scope.state(),
  );

  /**
   * Whether this participant is sending audio (i.e. is unmuted on their side).
   */
  public readonly audioEnabled: Observable<boolean>;
  /**
   * Whether this participant is sending video.
   */
  public readonly videoEnabled: Observable<boolean>;

  private readonly _cropVideo = new BehaviorSubject(true);
  /**
   * Whether the tile video should be contained inside the tile or be cropped to fit.
   */
  public readonly cropVideo: Observable<boolean> = this._cropVideo;

  public constructor(
    id: string,
    member: RoomMember | undefined,
    participant: LocalParticipant | RemoteParticipant,
    encryptionSystem: EncryptionSystem,
    livekitRoom: LivekitRoom,
  ) {
    super(
      id,
      member,
      participant,
      encryptionSystem,
      Track.Source.Microphone,
      Track.Source.Camera,
      livekitRoom,
    );

    const media = observeParticipantMedia(participant).pipe(this.scope.state());
    this.audioEnabled = media.pipe(
      map((m) => m.microphoneTrack?.isMuted === false),
    );
    this.videoEnabled = media.pipe(
      map((m) => m.cameraTrack?.isMuted === false),
    );
  }

  public toggleFitContain(): void {
    this._cropVideo.next(!this._cropVideo.value);
  }
}

/**
 * The local participant's user media.
 */
export class LocalUserMediaViewModel extends BaseUserMediaViewModel {
  /**
   * Whether the video should be mirrored.
   */
  public readonly mirror = this.video.pipe(
    switchMap((v) => {
      const track = v.publication?.track;
      if (!(track instanceof LocalTrack)) return of(false);
      // Watch for track restarts, because they indicate a camera switch
      return fromEvent(track, TrackEvent.Restarted).pipe(
        startWith(null),
        // Mirror only front-facing cameras (those that face the user)
        map(() => facingModeFromLocalTrack(track).facingMode === "user"),
      );
    }),
    this.scope.state(),
  );

  /**
   * Whether to show this tile in a highly visible location near the start of
   * the grid.
   */
  public readonly alwaysShow = alwaysShowSelf.value;
  public readonly setAlwaysShow = alwaysShowSelf.setValue;

  public constructor(
    id: string,
    member: RoomMember | undefined,
    participant: LocalParticipant,
    encryptionSystem: EncryptionSystem,
    livekitRoom: LivekitRoom,
  ) {
    super(id, member, participant, encryptionSystem, livekitRoom);
  }
}

/**
 * A remote participant's user media.
 */
export class RemoteUserMediaViewModel extends BaseUserMediaViewModel {
  private readonly locallyMutedToggle = new Subject<void>();
  private readonly localVolumeAdjustment = new Subject<number>();
  private readonly localVolumeCommit = new Subject<void>();

  /**
   * The volume to which this participant's audio is set, as a scalar
   * multiplier.
   */
  public readonly localVolume: Observable<number> = merge(
    this.locallyMutedToggle.pipe(map(() => "toggle mute" as const)),
    this.localVolumeAdjustment,
    this.localVolumeCommit.pipe(map(() => "commit" as const)),
  ).pipe(
    accumulate({ volume: 1, committedVolume: 1 }, (state, event) => {
      switch (event) {
        case "toggle mute":
          return {
            ...state,
            volume: state.volume === 0 ? state.committedVolume : 0,
          };
        case "commit":
          // Dragging the slider to zero should have the same effect as
          // muting: keep the original committed volume, as if it were never
          // dragged
          return {
            ...state,
            committedVolume:
              state.volume === 0 ? state.committedVolume : state.volume,
          };
        default:
          // Volume adjustment
          return { ...state, volume: event };
      }
    }),
    map(({ volume }) => volume),
    this.scope.state(),
  );

  /**
   * Whether this participant's audio is disabled.
   */
  public readonly locallyMuted: Observable<boolean> = this.localVolume.pipe(
    map((volume) => volume === 0),
    this.scope.state(),
  );

  public constructor(
    id: string,
    member: RoomMember | undefined,
    participant: RemoteParticipant,
    encryptionSystem: EncryptionSystem,
    livekitRoom: LivekitRoom,
  ) {
    super(id, member, participant, encryptionSystem, livekitRoom);

    // Sync the local volume with LiveKit
    this.localVolume
      .pipe(this.scope.bind())
      .subscribe((volume) =>
        (this.participant as RemoteParticipant).setVolume(volume),
      );
  }

  public toggleLocallyMuted(): void {
    this.locallyMutedToggle.next();
  }

  public setLocalVolume(value: number): void {
    this.localVolumeAdjustment.next(value);
  }

  public commitLocalVolume(): void {
    this.localVolumeCommit.next();
  }
}

/**
 * Some participant's screen share media.
 */
export class ScreenShareViewModel extends BaseMediaViewModel {
  public constructor(
    id: string,
    member: RoomMember | undefined,
    participant: LocalParticipant | RemoteParticipant,
    encryptionSystem: EncryptionSystem,
    livekitRoom: LivekitRoom,
  ) {
    super(
      id,
      member,
      participant,
      encryptionSystem,
      Track.Source.ScreenShareAudio,
      Track.Source.ScreenShare,
      livekitRoom,
    );
  }
}
