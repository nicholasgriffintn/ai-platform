import SwiftUI
import WidgetKit

@main
struct PolychatWidgetsBundle: WidgetBundle {
    var body: some Widget {
        AskPolyWidget()
        DiscoverTodayWidget()
        PolyLiveActivity()
    }
}
