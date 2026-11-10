import SwiftUI
import WidgetKit

@main
struct PolychatWidgetsBundle: WidgetBundle {
    var body: some Widget {
        DiscoverTodayWidget()
        TubeStatusWidget()
        HealthTodayWidget()
        AttentionWidget()
        AskPolyWidget()
        PolyLiveActivity()
    }
}
