# Navigate related conversation branches

- **Change:** Add a Branches browser to remote Chat and Work conversations, including archived branches and bounded large families.
- **Surfaces:** web and API. Local-only and native iOS navigation are unchanged. Sandbox and training do not own conversation navigation.
- **Prerequisites:** none; create a saved conversation and two branches using the existing message branch action.
- **Risk if wrong:** inaccessible branch titles leak, related conversations disappear, or selecting a branch opens the wrong scope.
- **Commits:** See the PR containing this item.

## Verify

- [ ] Open the parent, choose Branches, and select a child. The selected child opens and is marked Current when Branches is reopened. Return to the parent and a sibling the same way.
- [ ] Repeat in a Work project where different members created branches. All current members can navigate the family, with project context preserved.
- [ ] Archive a branch. It stays visible and labelled Archived. Close the browser without selecting anything and confirm the current conversation stays selected.
- [ ] Request `GET /chat/completions/<id>/branches` as another personal user or someone removed from the project's workspace. Expect 404 without branch titles or IDs.
- [ ] Simulate a failed branches request. Expect an error with Retry, rather than a stale branch list.

**Stop and report if:** a personal family includes someone else's conversation or a Work family leaves its project.
