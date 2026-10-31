import Foundation
import Sentry

enum CrashReporting {
    @MainActor
    static func start(bundle: Bundle = .main) {
        guard let dsn = bundle.object(forInfoDictionaryKey: "SentryDSN") as? String, !dsn.isEmpty else {
            return
        }

        let version = bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "unknown"
        let build = bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "unknown"
        let apiHost = (bundle.object(forInfoDictionaryKey: "APIBaseURL") as? String)
            .flatMap(URL.init(string:))?.host

        SentrySDK.start { options in
            options.dsn = dsn
            options.environment = bundle.object(forInfoDictionaryKey: "AppEnvironment") as? String ?? "unknown"
            options.releaseName = "polychat-ios@\(version)+\(build)"
            options.tracesSampleRate = 0.1
            if let apiHost {
                options.tracePropagationTargets = [apiHost]
            }
        }

        SentrySDK.configureScope { scope in
            scope.setTag(value: "ios", key: "app")
            scope.setTag(value: ProductAnalytics.shared.sessionId, key: "session_id")
        }
    }
}
