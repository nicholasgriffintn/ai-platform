interface ComposerMenuRect {
  right: number;
  top: number;
  width: number;
}

export function getComposerActionMenuLayout(
  triggerRect: ComposerMenuRect,
  composerRect: ComposerMenuRect,
) {
  return {
    alignOffset: triggerRect.right - composerRect.right,
    sideOffset: triggerRect.top - composerRect.top + 8,
    width: composerRect.width,
  };
}
