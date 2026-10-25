import Foundation

public enum CompactionStatusLabels {
    public static let automaticCompleted = "Context automatically compacted"
    public static let automaticPending = "Automatically compacting context"
    public static let manualCompleted = "Context compacted"
}

public enum CompactionPartStatus {
    public static let pending = "pending"
    public static let completed = "completed"

    public static func isValid(_ status: String?) -> Bool {
        status == pending || status == completed
    }
}

public enum CompactionStatusMarker {
    private static let pendingIdSuffix = "-compaction-pending"

    public static func pendingId(for assistantMessageId: String) -> String {
        "\(assistantMessageId)\(pendingIdSuffix)"
    }

    public static func isPendingId(_ id: String) -> Bool {
        id.hasSuffix(pendingIdSuffix)
    }
}
