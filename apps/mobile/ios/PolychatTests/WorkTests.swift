import Foundation
import Testing
@testable import Polychat

struct WorkTests {
    @Test func projectTaskDecodesTheOwnerActorAndListEnvelope() throws {
        let response = try JSONDecoder().decode(ProjectTaskListResponse.self, from: Data("""
        {
            "object": "list",
            "data": [
                {
                    "id": "task-1", "projectId": "project-1", "workspaceId": "workspace-1", "key": "ENG-1",
                    "kind": "task", "objective": "Ship it", "description": null, "priority": "high",
                    "owner": {"type": "teammate", "id": "teammate-1"}, "status": "blocked",
                    "blockedReason": "awaiting_approval", "blockedDetail": "Needs a yes", "conversationId": null,
                    "runId": null, "dueAt": null, "createdAt": "2026-10-29T08:00:00.000Z",
                    "updatedAt": "2026-10-29T09:00:00.000Z", "completedAt": null
                },
                {
                    "id": "task-2", "projectId": "project-1", "workspaceId": "workspace-1", "key": null,
                    "kind": "task", "objective": "Write notes", "description": null, "priority": "none",
                    "owner": {"type": "person", "userId": 7}, "status": "backlog",
                    "blockedReason": null, "blockedDetail": null, "conversationId": null,
                    "runId": null, "dueAt": null, "createdAt": "2026-10-29T08:00:00.000Z",
                    "updatedAt": null, "completedAt": null
                }
            ],
            "has_more": false,
            "flow": null
        }
        """.utf8))

        #expect(response.tasks.map(\.owner) == [.teammate("teammate-1"), .person(7)])
        #expect(WorkTaskPresentation.statusLabel(response.tasks[0]) == "Needs approval")
        #expect(WorkTaskPresentation.canStart(response.tasks[1]))
    }

    @Test func boardSectionsGroupByWhatThePersonShouldDoNextAndHideFinishedStandups() {
        let tasks = [
            task("review", status: "review"),
            task("running", status: "running"),
            task("backlog", status: "backlog"),
            task("done", status: "done"),
            task("standup", status: "done", kind: "standup"),
            task("blocked", status: "blocked")
        ]

        let sections = WorkTaskPresentation.sections(for: tasks)

        #expect(sections.map(\.group) == [.needsYou, .working, .upNext, .finished])
        #expect(sections[0].tasks.map(\.id).sorted() == ["blocked", "review"])
        #expect(sections[3].tasks.map(\.id) == ["done"])
    }

    @Test func inboxSplitsNeedsYouFromUpdatesLikeTheWeb() {
        let hire = decision(id: "hire", kind: "hire", projectId: nil, taskId: nil, conversationId: nil)
        let approval = notification(id: "approval", requiresAction: true, isRead: false)
        let completion = notification(id: "completion", requiresAction: false, isRead: true)
        let runApproval = attention(id: "run-approval", type: "run", kind: "approval")
        let taskApproval = attention(id: "task-approval", type: "task", kind: "approval")

        let needsYou = AttentionPlaces.entries(
            for: .needsYou,
            decisions: [hire],
            runs: [runApproval, taskApproval],
            notifications: [approval, completion]
        )
        let updates = AttentionPlaces.entries(
            for: .updates,
            decisions: [hire],
            runs: [runApproval, taskApproval],
            notifications: [approval, completion]
        )

        #expect(needsYou.map(\.id).sorted() == ["attention:run-approval", "decision:hire", "notification:approval"])
        #expect(updates.map(\.id) == ["notification:completion"])
    }

    @Test func everyInboxDecisionOpensSomewhere() {
        #expect(
            InboxDestination.of(decision(id: "standup", kind: "standup", projectId: "p", taskId: "t", conversationId: nil))
                == .task(projectId: "p", taskId: "t")
        )
        #expect(
            InboxDestination.of(decision(id: "waiting", kind: "waiting", projectId: "p", taskId: nil, conversationId: "c"))
                == .conversation("c")
        )
        #expect(
            InboxDestination.of(decision(id: "budget", kind: "budget", projectId: "p", taskId: nil, conversationId: nil))
                == .project("p")
        )
        #expect(
            InboxDestination.of(decision(id: "setup", kind: "setup", projectId: nil, taskId: nil, conversationId: nil))
                == .web("/work/w/setup")
        )
    }

    private func task(_ id: String, status: String, kind: String = "task") -> ProjectTask {
        ProjectTask(
            id: id, projectId: "project-1", workspaceId: "workspace-1", key: nil, kind: kind,
            objective: id, description: nil, priority: "none", owner: nil, status: status,
            blockedReason: nil, blockedDetail: nil, conversationId: nil, runId: nil, dueAt: nil,
            createdAt: "2026-10-29T08:00:00.000Z", updatedAt: nil, completedAt: nil
        )
    }

    private func decision(id: String, kind: String, projectId: String?, taskId: String?, conversationId: String?) -> WorkInboxItem {
        WorkInboxItem(
            id: id, kind: kind, workspaceId: "w", projectId: projectId, taskId: taskId, teammateId: nil,
            title: id, detail: nil, dueAt: nil, conversationId: conversationId,
            since: "2026-10-29T08:00:00.000Z", deepLink: "/work/w/setup"
        )
    }

    private func notification(id: String, requiresAction: Bool, isRead: Bool) -> TaskInboxItem {
        TaskInboxItem(
            id: id, kind: requiresAction ? "approval" : "completion", taskId: id, projectId: "p", workspaceId: "w",
            projectName: "Project", objective: id, detail: nil, conversationId: nil,
            since: "2026-10-29T08:00:00.000Z", requiresAction: requiresAction, isRead: isRead, readAt: nil,
            deepLink: "/work/w/projects/p/tasks/\(id)"
        )
    }

    private func attention(id: String, type: String, kind: String) -> WorkAttentionItem {
        WorkAttentionItem(
            id: id, kind: kind, type: type, resourceId: id, workspaceId: "w", workspaceName: "Workspace",
            projectId: "p", projectName: "Project", conversationId: nil, isUnread: true, title: id, detail: nil,
            occurredAt: "2026-10-29T08:00:00.000Z"
        )
    }
}
