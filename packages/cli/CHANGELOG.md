# @ngriffin_uk/polychat-cli

## 0.1.10

### Patch Changes

- Updated dependencies [ce24694]
- Updated dependencies [765754a]
- Updated dependencies [73a3a85]
- Updated dependencies [f6cde2d]
- Updated dependencies [074e50f]
- Updated dependencies [074e50f]
- Updated dependencies [1fcffa3]
- Updated dependencies [301c306]
- Updated dependencies [9d2d8c3]
- Updated dependencies [9d2d8c3]
- Updated dependencies [b52cd0d]
- Updated dependencies [f6cde2d]
- Updated dependencies [57459ac]
  - @ngriffin_uk/polychat-schemas@1.18.0
  - @ngriffin_uk/polychat-utility-core@0.12.0

## 0.1.9

### Patch Changes

- 777a55e: Cancelling a queued sandbox run now stops it, and a run that loses its worker connection, stops responding or is interrupted now fails and returns its held credits instead of staying in progress. Cancelled and finished tasks stay that way when a run finishes at the same moment, and two conflicting status changes now ask you to refresh. Two admins deciding the same hire can no longer both win, and a manual pause on a teammate is no longer replaced by a budget pause. On iOS, Apple Health sharing now belongs to the account that turned it on and ends at sign-out, so turn it on again after updating or signing back in, and opening the app offline keeps you signed in. Notes save your last edits when you leave mid-save, the microphone turns off when you leave the chat, spoken replies no longer get stuck on generating, and a failed dictation session no longer looks live. Generated images and Google Fonts now show in site previews, and the preview no longer comes up blank where a browser blocks its sandboxed frame from loading files. Sites hold refinements and manual edits until image generation finishes. On desktop, reopening a terminal straight after closing it keeps the new one working, and stopping an agent no longer hangs behind a stuck message. Logging in to several servers at once from the CLI keeps all of them.
- Updated dependencies [5edfedc]
- Updated dependencies [e0ffb42]
- Updated dependencies [6d1bb6e]
- Updated dependencies [fd91d91]
- Updated dependencies [8fcabd3]
- Updated dependencies [150be98]
- Updated dependencies [8a4bbaf]
- Updated dependencies [d29cc10]
- Updated dependencies [150be98]
- Updated dependencies [7f6655e]
- Updated dependencies [b571a91]
- Updated dependencies [f824dd2]
- Updated dependencies [777a55e]
- Updated dependencies [5a2391a]
- Updated dependencies [e68f76a]
- Updated dependencies [79859ac]
  - @ngriffin_uk/polychat-schemas@1.17.0
  - @ngriffin_uk/polychat-utility-core@0.11.1

## 0.1.8

### Patch Changes

- Updated dependencies [7be58a1]
- Updated dependencies [18e8453]
- Updated dependencies [7be58a1]
- Updated dependencies [18e8453]
  - @ngriffin_uk/polychat-schemas@1.16.0
  - @ngriffin_uk/polychat-utility-core@0.11.0

## 0.1.7

### Patch Changes

- Updated dependencies [80afaf2]
  - @ngriffin_uk/polychat-schemas@1.14.0
  - @ngriffin_uk/polychat-utility-core@0.10.0

## 0.1.6

### Patch Changes

- Updated dependencies [0af6a2b]
- Updated dependencies [afe0236]
- Updated dependencies [c79e769]
- Updated dependencies [810eff4]
- Updated dependencies [00f22ad]
  - @ngriffin_uk/polychat-schemas@1.10.0
  - @ngriffin_uk/polychat-utility-core@0.9.0

## 0.1.5

### Patch Changes

- Updated dependencies [5d70d5d]
- Updated dependencies [8f480ac]
  - @ngriffin_uk/polychat-schemas@1.9.0
  - @ngriffin_uk/polychat-utility-core@0.8.0

## 0.1.4

### Patch Changes

- Updated dependencies [ce66ee9]
- Updated dependencies [11dabe3]
- Updated dependencies [ed38a63]
- Updated dependencies [48eb3dc]
- Updated dependencies [ed38a63]
  - @ngriffin_uk/polychat-schemas@1.8.0
  - @ngriffin_uk/polychat-utility-core@0.7.0

## 0.1.3

### Patch Changes

- Updated dependencies [187afde]
- Updated dependencies [d2905a6]
- Updated dependencies [0fe409a]
- Updated dependencies [0fe409a]
- Updated dependencies [e0ca7c6]
- Updated dependencies [e0ca7c6]
  - @ngriffin_uk/polychat-schemas@1.6.0
  - @ngriffin_uk/polychat-utility-core@0.6.0

## 0.1.2

### Patch Changes

- Updated dependencies [8b2929f]
- Updated dependencies [8b965f6]
- Updated dependencies [91c7d3d]
- Updated dependencies [7accf45]
- Updated dependencies [911642e]
- Updated dependencies [bf39c94]
- Updated dependencies [b3e3ea2]
- Updated dependencies [1fe4222]
- Updated dependencies [06c02dd]
- Updated dependencies [f4841cd]
- Updated dependencies [abf8eb7]
- Updated dependencies [7b5038c]
- Updated dependencies [80fee8e]
- Updated dependencies [8b965f6]
- Updated dependencies [0a57f73]
- Updated dependencies [11381a9]
- Updated dependencies [91c7d3d]
- Updated dependencies [7b36da1]
- Updated dependencies [80fee8e]
- Updated dependencies [7a9f872]
- Updated dependencies [7accf45]
- Updated dependencies [d7716ff]
  - @ngriffin_uk/polychat-schemas@1.5.0
  - @ngriffin_uk/polychat-utility-core@0.5.0

## 0.1.1

### Patch Changes

- Updated dependencies [82c133e]
- Updated dependencies [005b9f3]
- Updated dependencies [393652d]
- Updated dependencies [e820856]
- Updated dependencies [7bec25b]
- Updated dependencies [65fbf81]
- Updated dependencies [65fbf81]
- Updated dependencies [b97c227]
- Updated dependencies [c965c69]
- Updated dependencies [06e4619]
- Updated dependencies [e41549c]
  - @ngriffin_uk/polychat-utility-core@0.4.0
  - @ngriffin_uk/polychat-schemas@1.4.0

## 0.1.0

### Minor Changes

- 169e2f5: Add the Polychat CLI, which pairs a terminal, server or gateway through a device code instead of a pasted API key, and show it on the downloads page. The device approval page now shows the code as cells, the requesting client, its expiry and what approval grants. Device sign-in clients no longer trip bot detection when they start and poll.

### Patch Changes

- Updated dependencies [6db7a00]
- Updated dependencies [ece96c4]
- Updated dependencies [33133cc]
- Updated dependencies [4968623]
- Updated dependencies [b4c0c65]
- Updated dependencies [d3f1df3]
- Updated dependencies [297b848]
- Updated dependencies [3c23660]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [d25fd94]
- Updated dependencies [5ead2cc]
- Updated dependencies [dd4389b]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [c126d04]
- Updated dependencies [b105d00]
- Updated dependencies [90f7110]
- Updated dependencies [b105d00]
- Updated dependencies [251ac59]
- Updated dependencies [41bb6a8]
- Updated dependencies [67b52ed]
- Updated dependencies [67b52ed]
- Updated dependencies [ee31a6d]
- Updated dependencies [ee31a6d]
- Updated dependencies [67b52ed]
- Updated dependencies [ee31a6d]
- Updated dependencies [169e2f5]
- Updated dependencies [6966643]
- Updated dependencies [1e5cafb]
- Updated dependencies [462cbe7]
- Updated dependencies [e4ba666]
- Updated dependencies [1df361b]
- Updated dependencies [6e76041]
- Updated dependencies [d3f1df3]
- Updated dependencies [57f8a16]
- Updated dependencies [07290f2]
- Updated dependencies [cb9ddcc]
  - @ngriffin_uk/polychat-schemas@1.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
