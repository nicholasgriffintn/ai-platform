//
//  ContentView.swift
//  Polychat
//
//  Created by Nicholas Griffin on 10/07/2025.
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    @EnvironmentObject var conversationManager: ConversationManager
    
    var body: some View {
        NavigationView {
            if authManager.isAuthenticated {
                ChatView()
            } else {
                // This won't be reached in beta since we're always authenticated
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
