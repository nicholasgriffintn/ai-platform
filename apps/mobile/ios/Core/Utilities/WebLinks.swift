import Foundation

enum WebLinks {
    static let base = URL(string: "https://polychat.app")!

    static func url(path: String) -> URL {
        guard let url = URL(string: path, relativeTo: base)?.absoluteURL else {
            return base
        }
        return url
    }

    static func project(workspaceId: String, projectId: String) -> URL {
        url(path: "/work/\(workspaceId)/projects/\(projectId)")
    }

    static func task(workspaceId: String, projectId: String, taskId: String) -> URL {
        url(path: "/work/\(workspaceId)/projects/\(projectId)/tasks/\(taskId)")
    }
}
