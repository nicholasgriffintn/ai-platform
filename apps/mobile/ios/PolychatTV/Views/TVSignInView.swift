import SwiftUI

struct TVSignInView: View {
    @EnvironmentObject private var signIn: DeviceSignIn

    var body: some View {
        ZStack {
            TVBackdrop()

            HStack(alignment: .center, spacing: 120) {
                VStack(alignment: .leading, spacing: 40) {
                    HStack(spacing: 24) {
                        PolyMark(size: 96)
                        TVSectionHeader(title: "Polychat for Apple TV")
                    }

                    VStack(alignment: .leading, spacing: 16) {
                        Text("Discover, on the big screen")
                            .font(.polychatDisplay(.largeTitle))
                            .foregroundStyle(Color.polychat.text)
                        Text("Today's edition, the episode and a wind down, from the sofa.")
                            .font(.title3)
                            .foregroundStyle(Color.polychat.textMuted)
                    }

                    VStack(alignment: .leading, spacing: 20) {
                        step(1, "Point your iPhone camera at the code.")
                        step(2, "Approve the Apple TV in Polychat.")
                        step(3, "This Apple TV gets Discover only. Chats, projects and files stay on your other devices.")
                    }

                    status
                }
                .frame(maxWidth: 940, alignment: .leading)

                qrPanel
            }
            .padding(.horizontal, 120)
        }
        .task {
            if signIn.state == .signedOut {
                await start()
            }
        }
        .onChange(of: signIn.state) { _, state in
            if state == .expired {
                Task { await start() }
            }
        }
    }

    @ViewBuilder
    private var status: some View {
        switch signIn.state {
        case .waiting(let code):
            VStack(alignment: .leading, spacing: 18) {
                TVCodeCells(code: code.userCode)
                Text("Or enter the code at \(URLDisplay.hostAndPath(code.verificationUri))")
                    .font(.callout)
                    .foregroundStyle(Color.polychat.textMuted)
            }
        case .failed(let message):
            VStack(alignment: .leading, spacing: 20) {
                Text(message)
                    .font(.title3)
                    .foregroundStyle(Color.polychat.attention)
                Button("Get a new code") {
                    Task { await start() }
                }
            }
        default:
            ProgressView()
        }
    }

    @ViewBuilder
    private var qrPanel: some View {
        VStack(spacing: 24) {
            ZStack {
                RoundedRectangle(cornerRadius: 36, style: .continuous)
                    .fill(.white)
                if let code = signIn.code, let image = QRCodeImage.make(from: code.verificationUriComplete) {
                    Image(uiImage: image)
                        .interpolation(.none)
                        .resizable()
                        .padding(36)
                        .accessibilityLabel("Sign-in code")
                } else {
                    ProgressView().tint(.black)
                }
            }
            .frame(width: 520, height: 520)
            .shadow(color: .black.opacity(0.35), radius: 40, y: 20)

            Label("Scan with your iPhone", systemImage: "camera.viewfinder")
                .font(.callout.weight(.semibold))
                .foregroundStyle(Color.polychat.textMuted)
        }
    }

    private func step(_ number: Int, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 20) {
            Text("\(number)")
                .font(.callout.weight(.bold))
                .foregroundStyle(Color.polychat.primaryForeground)
                .frame(width: 44, height: 44)
                .background(Color.polychat.primary, in: Circle())
            Text(text)
                .font(.title3)
                .foregroundStyle(Color.polychat.text)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func start() async {
        _ = await signIn.start(clientName: "Apple TV", scope: .discover)
    }
}
