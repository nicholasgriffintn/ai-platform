import { md } from "@ngriffin_uk/polychat-utility-server/markdown";

export const tasksTagDescription = md`
# Tasks

Background tasks and the project board.

- \`/tasks\` lists, reads and cancels the caller's background tasks with their executions.
- Project tasks move across the board, optionally through a project flow of stages. Starting a task queues it for its runner as the caller, with their connections and installations. Accepting a reviewed task moves it to done or the next stage.
- Pull request reviews can run automatically under a review policy. Governed reviews are prepared, approved by a person and published to their exact commit.
- Preview an issue from a connected tracker, then import it as a task.
`;
