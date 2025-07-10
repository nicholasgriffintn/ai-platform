import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var conversationManager: ConversationManager
    @State private var selectedTab = 0
    
    var body: some View {
        if authManager.isAuthenticated {
            TabView(selection: $selectedTab) {
                NavigationView {
                    ConversationListView()
                        .onChange(of: conversationManager.currentConversation) { conversation in
                            if conversation != nil {
                                selectedTab = 1
                            }
                        }
                }
                .tabItem {
                    Image(systemName: "message")
                    Text("Conversations")
                }
                .tag(0)
                
                NavigationView {
                    if let currentConversation = conversationManager.currentConversation {
                        ChatView()
                    } else {
                        VStack {
                            Image(systemName: "message.circle")
                                .font(.system(size: 60))
                                .foregroundColor(.gray)
                            Text("Select a conversation to start chatting")
                                .font(.headline)
                                .foregroundColor(.gray)
                        }
                    }
                }
                .tabItem {
                    Image(systemName: "bubble.left.and.bubble.right")
                    Text("Chat")
                }
                .tag(1)
                
                NavigationView {
                    SettingsView()
                }
                .tabItem {
                    Image(systemName: "gear")
                    Text("Settings")
                }
                .tag(2)
            }
        } else {
            // This won't be reached in beta since we're always authenticated
            NavigationView {
                VStack {
                    Image(systemName: "globe")
                        .imageScale(.large)
                        .foregroundStyle(.tint)
                    Text("TODO: Login")
                }
                .padding()
            }
        }
    }
}

#Preview {
    ContentView()
}
