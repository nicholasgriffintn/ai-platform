import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthenticationManager
    
    var body: some View {
        List {
            Section(header: Text("Account")) {
                if authManager.isAuthenticated {
                    Button("Log Out", role: .destructive) {
                        authManager.logout()
                    }
                } else {
                    Button("Log In") {
                        authManager.login()
                    }
                }
            }
            
            Section(header: Text("About")) {
                NavigationLink("Privacy Policy") {
                    Text("Privacy Policy Content")
                }
                NavigationLink("Terms of Service") {
                    Text("Terms of Service Content")
                }
                NavigationLink("Help & Support") {
                    Text("Help Content")
                }
            }
            
            Section {
                Text("Version 1.0.0")
                    .foregroundColor(.gray)
            }
        }
        .navigationTitle("Settings")
    }
}
