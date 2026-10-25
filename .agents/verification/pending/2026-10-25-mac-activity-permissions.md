# Mac activity sharing asks macOS for permission and respects it

- **Change:** the desktop app reads browser history, coding-agent transcripts, the front app, window titles and Apple Music or Spotify, and sends summary lines to Discover. Window titles need Accessibility, and music needs Automation.
- **Surfaces:** desktop (macOS), API.
- **Prerequisites:** a signed desktop build, so macOS shows the Automation prompt with the Info.plist usage string.
- **Risk if wrong:** music or window titles silently stay empty, or macOS shows an unexplained prompt.
- **Commits:** uncommitted on main, 25 October 2026.

## Verify

- [ ] In Profile, Mac activity, switch on Share activity and Apple Music with a track playing. macOS asks to let Polychat control Music with the usage string. Allow it, and within a minute the track appears under What was sent after Send now.
- [ ] Deny the same prompt for Spotify. The tab shows the Automation note, and Open Automation settings opens System Settings at Automation.
- [ ] Switch on Include window titles without Accessibility. The Accessibility note appears and window titles are left out of the Apps lines.
- [ ] Choose Pause for an hour from the Poly menu-bar menu. The menu shows the resume time and the tab shows Paused. Resume, press Send now, and nothing visited during the pause appears.
- [ ] Turn Share activity off. The Mac documents disappear from the Discover notebook.

**Stop and report if:** a prompt appears without the usage string, music is read while its app is closed, or anything from a paused period is sent.
