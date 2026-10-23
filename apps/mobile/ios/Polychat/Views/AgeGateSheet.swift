import SwiftUI

struct AgeGateSheet: View {
    private static let infoURL = URL(string: "https://polychat.app/age-check")!

    @EnvironmentObject private var ageGateStore: AgeGateStore
    @State private var birthDate = Date()
    @State private var hasChosenDate = false
    @State private var showingSkipExplanation = false

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                if ageGateStore.status == .underAge {
                    refusal
                } else {
                    form
                }
            }
            .padding(20)
            .frame(maxHeight: .infinity, alignment: .top)
            .background(Color.polychat.background)
            .navigationTitle(ageGateStore.status == .underAge ? "Not this time" : "Your date of birth")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
        .interactiveDismissDisabled()
        .alert("Skip for now?", isPresented: $showingSkipExplanation) {
            Button("Add date of birth", role: .cancel) {}
            Button("Skip") {
                ageGateStore.skip()
            }
        } message: {
            Text("Without a date of birth you can’t send messages. You can still look around, and we’ll ask again the next time you try to send one.")
        }
    }

    private var form: some View {
        Group {
            Text("One quick check before your first message. We keep only whether you meet the minimum age, never the date itself, and you can’t change it afterwards.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Link("Why we ask", destination: Self.infoURL)
                .font(.subheadline)

            DatePicker("Date of birth", selection: $birthDate, in: ...Date(), displayedComponents: .date)
                .datePickerStyle(.wheel)
                .labelsHidden()
                .frame(maxWidth: .infinity)
                .onChange(of: birthDate) {
                    hasChosenDate = true
                }

            if let error = ageGateStore.error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Button {
                Task {
                    await ageGateStore.confirm(birthDate: birthDate)
                }
            } label: {
                Group {
                    if ageGateStore.isConfirming {
                        ProgressView()
                    } else {
                        Text("Continue")
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!hasChosenDate || ageGateStore.isConfirming)

            Button("Skip") {
                showingSkipExplanation = true
            }
            .frame(maxWidth: .infinity)
            .disabled(ageGateStore.isConfirming)
        }
    }

    private var refusal: some View {
        Group {
            Text("Polychat is only for people aged 18 or over, so sending messages stays switched off for this account.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Button {
                ageGateStore.skip()
            } label: {
                Text("Close")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
        }
    }
}
