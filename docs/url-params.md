# Url Format and parameters

There are two formats for Element Call urls.

- **Current Format**

  ```text
  https://element_call.domain/room/#
  /<room_name_alias>?roomId=!id:domain&password=1234&<other params see below>
  ```

  The url is split into two sections. The `https://element_call.domain/room/#`
  contains the app and the intend that the link brings you into a specific room
  (`https://call.element.io/#` would be the homepage). The fragment is used for
  query parameters to make sure they never get sent to the element_call.domain
  server. Here we have the actual matrix roomId and the password which are used
  to connect all participants with e2ee. This allows that `<room_name_alias>` does
  not need to be unique. Multiple meetings with the label weekly-sync can be created
  without collisions.

- **deprecated**

  ```text
  https://element_call.domain/<room_name>
  ```

  With this format the livekit alias that will be used is the `<room_name>`.
  All ppl connecting to this url will end up in the same unencrypted room.
  This does not scale, is super unsecure
  (ppl could end up in the same room by accident) and it also is not really
  possible to support encryption.
  The url parameters are spit into two categories: **general** and **widget related**.

## Widget related params

**widgetId**
The id used by the widget. The presence of this parameter implies that element
call will not connect to a homeserver directly and instead tries to establish
postMessage communication via the `parentUrl`.

```ts
widgetId: string | null;
```

**parentUrl**
The url used to send widget action postMessages. This should be the domain of
the client or the webview the widget is hosted in. (in case the widget is not
in an Iframe but in a dedicated webview we send the postMessages same webview
the widget lives in. Filtering is done in the widget so it ignores the messages
it receives from itself)

```ts
parentUrl: string | null;
```

**userId**
The user's ID (only used in matryoshka mode).

```ts
userId: string | null;
```

**deviceId**
The device's ID (only used in matryoshka mode).

```ts
deviceId: string | null;
```

**baseUrl**
The base URL of the homeserver to use for media lookups in matryoshka mode.

```ts
baseUrl: string | null;
```

### General url parameters

**roomId**
Anything about what room we're pointed to should be from useRoomIdentifier which
parses the path and resolves alias with respect to the default server name, however
roomId is an exception as we need the room ID in embedded (matroyska) mode, and not
the room alias (or even the via params because we are not trying to join it). This
is also not validated, where it is in useRoomIdentifier().

```ts
roomId: string | null;
```

**confineToRoom**
Whether the app should keep the user confined to the current call/room.

```ts
confineToRoom: boolean; (default: false)
```

**appPrompt**
Whether upon entering a room, the user should be prompted to launch the
native mobile app. (Affects only Android and iOS.)

The app prompt must also be enabled in the config for this to take effect.

```ts
appPrompt: boolean; (default: true)
```

**preload**
Whether the app should pause before joining the call until it sees an
io.element.join widget action, allowing it to be preloaded.

```ts
preload: boolean; (default: false)
```

**hideHeader**
Whether to hide the room header when in a call.

```ts
hideHeader: boolean; (default: false)
```

**showControls**
Whether to show the buttons to mute, screen-share, invite, hangup are shown
when in a call.

```ts
showControls: boolean; (default: true)
```

**hideScreensharing**
Whether to hide the screen-sharing button.

```ts
hideScreensharing: boolean; (default: false)
```

**enableE2EE** (Deprecated)
Whether to use end-to-end encryption. This is a legacy flag for the full mesh branch.
It is not used on the livekit branch and has no impact there!

```ts
enableE2EE: boolean; (default: true)
```

**perParticipantE2EE**
Whether to use per participant encryption.
Keys will be exchanged over encrypted matrix room messages.

```ts
perParticipantE2EE: boolean; (default: false)
```

**password**
E2EE password when using a shared secret.
(For individual sender keys in embedded mode this is not required.)

```ts
password: string | null;
```

**displayName**
The display name to use for auto-registration.

```ts
displayName: string | null;
```

**lang**
The BCP 47 code of the language the app should use.

```ts
lang: string | null;
```

**fonts**
The font/fonts which the interface should use.
There can be multiple font url parameters: `?font=font-one&font=font-two...`

```ts
font: string;
font: string;
...
```

**fontScale**
The factor by which to scale the interface's font size.

```ts
fontScale: number | null;
```

**analyticsID**
The Posthog analytics ID. It is only available if the user has given consent for
sharing telemetry in element web.

```ts
analyticsID: string | null;
```

**allowIceFallback**
Whether the app is allowed to use fallback STUN servers for ICE in case the
user's homeserver doesn't provide any.

```ts
allowIceFallback: boolean; (default: false)
```

**skipLobby**
Setting this flag skips the lobby and brings you in the call directly.
In the widget this can be combined with preload to pass the device settings
with the join widget action.

```ts
skipLobby: boolean; (default: false)
```

**returnToLobby**
Setting this flag makes element call show the lobby in widget mode after leaving
a call.
This is useful for video rooms.
If set to false, the widget will show a blank page after leaving the call.

```ts
returnToLobby: boolean; (default: false)
```

**theme**
The theme to use for element call.
can be "light", "dark", "light-high-contrast" or "dark-high-contrast".
If not set element call will use the dark theme.

```ts
theme: string | null;
```

**viaServers**
This defines the homeserver that is going to be used when joining a room.
It has to be set to a non default value for links to rooms
that are not on the default homeserver,
that is in use for the current user.

```ts
viaServers: string; (default: undefined)
```

**homeserver**
This defines the homeserver that is going to be used when registering
a new (guest) user.
This can be user to configure a non default guest user server when
creating a spa link.

```ts
homeserver: string; (default: undefined)
```
