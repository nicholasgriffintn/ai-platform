import SwiftUI

struct WatchHomeView: View {
    @EnvironmentObject private var signIn: DeviceSignIn
    @EnvironmentObject private var store: WatchStore
    @EnvironmentObject private var perch: PerchStore
    @State private var showingPerch = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    NavigationLink {
                        WatchPerchView()
                    } label: {
                        HStack(spacing: 8) {
                            PetPoseImage(pose: store.snapshot.pose(), size: 40)
                                .id(perch.pet?.selection)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(store.snapshot.poly?.status ?? PolyPresence.derive(from: store.agenda).status)
                                    .font(.headline)
                                Text("Play with \(perch.pet?.name ?? "your pet")")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                if !store.actionable.isEmpty {
                    Section("Needs you") {
                        ForEach(store.actionable) { item in
                            NavigationLink(value: item.id) {
                                WatchItemRow(title: item.title, detail: item.projectName, systemImage: "exclamationmark.circle")
                            }
                        }
                    }
                } else if store.isLoading {
                    ProgressView()
                        .listRowBackground(Color.clear)
                }

                if !store.running.isEmpty {
                    Section("Working on") {
                        ForEach(store.running) { item in
                            WatchItemRow(title: item.title, detail: item.projectName, systemImage: "bolt.horizontal")
                        }
                    }
                }

                Section {
                    NavigationLink {
                        WatchAskView()
                    } label: {
                        Label("Ask Poly", systemImage: "bubble.left")
                    }
                    NavigationLink {
                        WatchWindDownView()
                    } label: {
                        Label("Wind down", systemImage: "wind")
                    }
                }

                if let error = store.error {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section {
                    Button("Sign out", role: .destructive) {
                        signIn.signOut()
                    }
                }
            }
            .navigationTitle("Poly")
            .navigationDestination(for: String.self) { id in
                if let item = store.actionable.first(where: { $0.id == id }) {
                    WatchItemView(item: item)
                }
            }
            .navigationDestination(isPresented: $showingPerch) {
                WatchPerchView()
            }
            .onOpenURL { url in
                showingPerch = url.host == "perch"
            }
            .task {
                await store.refresh()
                await perch.refresh()
            }
            .refreshable { await store.refresh() }
        }
    }
}

struct WatchItemRow: View {
    let title: String
    let detail: String?
    let systemImage: String

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            Image(systemName: systemImage)
                .foregroundStyle(.tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.footnote.weight(.medium))
                    .lineLimit(3)
                if let detail {
                    Text(detail)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
        }
    }
}
