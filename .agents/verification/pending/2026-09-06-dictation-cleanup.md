# Dictation arrives tidied rather than verbatim

- **Change:** Spoken input is cleaned before it reaches the composer. Four modes sit behind a Dictation entry in the composer's command menu: Verbatim leaves it alone, Tidy up drops fillers and fixes spacing and capitals, Professional also writes spoken contractions out in full, and Terminal lower-cases and drops the trailing full stop. Tidy up is the default. The choice is per person and persists. Cleanup is deterministic and local; no model call and no request change.
- **Surfaces:** Web app and contracts. No API, database or migration change.
- **Prerequisites:** A working microphone and transcription.
- **Risk if wrong:** Cleanup changing what somebody actually said, particularly by stripping a word that was doing real work in the sentence.

## Verify

- [ ] Dictate a sentence with ums and ers in it. Confirm the composer holds the tidied version, capitalised, with the fillers gone.
- [ ] Dictate a sentence containing "like" used properly, such as "make it look like the old one". Confirm the word survives.
- [ ] Dictate a sentence that starts "so basically". Confirm the run-up is dropped and the sentence still reads correctly.
- [ ] Switch to Verbatim and dictate the same thing. Confirm nothing is changed at all.
- [ ] Switch to Professional and dictate something with "can't" and "gonna" in it. Confirm both are written out in full.
- [ ] Switch to Terminal and dictate a command. Confirm it comes back lower case with no trailing full stop.
- [ ] Reload and confirm the mode you chose is still selected.
- [ ] Dictate in a language other than English and confirm the text is not mangled.

**Stop and report if:** cleanup removes a word that changes the meaning, or a non-English dictation is damaged.
