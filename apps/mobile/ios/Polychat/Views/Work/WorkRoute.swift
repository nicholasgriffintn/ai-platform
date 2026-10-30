import SwiftUI

enum WorkRoute: Hashable {
    case project(String)
    case task(projectId: String, taskId: String, interactionId: String?)
    case run(String)
    case conversation(String)

    static func routes(to target: MobileWorkTarget) -> [WorkRoute] {
        var routes: [WorkRoute] = [.project(target.projectId)]
        if let runId = target.runId {
            routes.append(.run(runId))
        } else if let taskId = target.taskId {
            routes.append(.task(projectId: target.projectId, taskId: taskId, interactionId: target.interactionId))
        } else if let conversationId = target.conversationId {
            routes.append(.conversation(conversationId))
        }
        return routes
    }

    var conversationId: String? {
        if case .conversation(let id) = self { return id }
        return nil
    }
}

private struct WorkDestinations: ViewModifier {
    @Binding var path: [WorkRoute]

    func body(content: Content) -> some View {
        content.navigationDestination(for: WorkRoute.self) { route in
            switch route {
            case .project(let projectId):
                ProjectBoardView(projectId: projectId, path: $path)
            case .task(let projectId, let taskId, let interactionId):
                WorkTaskView(
                    projectId: projectId,
                    taskId: taskId,
                    focusedInteractionId: interactionId,
                    onOpenConversation: { path.append(.conversation($0)) }
                )
            case .run(let runId):
                WorkRunView(runId: runId)
            case .conversation(let conversationId):
                ConversationScreen(conversationId: conversationId) { replacement in
                    if !path.isEmpty {
                        path[path.count - 1] = .conversation(replacement)
                    }
                }
            }
        }
    }
}

extension View {
    func workDestinations(path: Binding<[WorkRoute]>) -> some View {
        modifier(WorkDestinations(path: path))
    }
}

struct ConversationScreen: View {
    @EnvironmentObject private var conversationManager: ConversationManager
    @EnvironmentObject private var workStore: WorkStore
    let conversationId: String
    let onReplace: (String) -> Void

    private var projectName: String? {
        conversationManager.currentConversation?.projectId.flatMap(workStore.projectName)
    }

    var body: some View {
        ChatView(projectName: projectName) { projectId in
            let conversation = conversationManager.startNewConversation(projectId: projectId)
            onReplace(conversation.id)
        }
        .task(id: conversationId) {
            if conversationManager.currentConversation?.id != conversationId {
                await conversationManager.loadConversationMessages(id: conversationId)
            }
        }
    }
}
