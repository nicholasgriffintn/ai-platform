import SwiftUI

private let glyphWidth: CGFloat = 170
private let glyphHeight: CGFloat = 184

private struct PolyPolygon: Shape {
    let points: [CGPoint]

    func path(in rect: CGRect) -> Path {
        let scaleX = rect.width / glyphWidth
        let scaleY = rect.height / glyphHeight
        var path = Path()
        path.addLines(points.map { CGPoint(x: $0.x * scaleX, y: $0.y * scaleY) })
        path.closeSubpath()
        return path
    }
}

private struct PolyLid: Shape {
    func path(in rect: CGRect) -> Path {
        let scaleX = rect.width / glyphWidth
        let scaleY = rect.height / glyphHeight
        var path = Path()
        path.move(to: CGPoint(x: 78 * scaleX, y: 68 * scaleY))
        path.addQuadCurve(
            to: CGPoint(x: 106 * scaleX, y: 68 * scaleY),
            control: CGPoint(x: 92 * scaleX, y: 76 * scaleY)
        )
        return path
    }
}

private struct PolyCircle: Shape {
    let centre: CGPoint
    let radius: CGFloat

    func path(in rect: CGRect) -> Path {
        let scaleX = rect.width / glyphWidth
        let scaleY = rect.height / glyphHeight
        return Path(ellipseIn: CGRect(
            x: (centre.x - radius) * scaleX,
            y: (centre.y - radius) * scaleY,
            width: radius * 2 * scaleX,
            height: radius * 2 * scaleY
        ))
    }
}

private func points(_ pairs: [(CGFloat, CGFloat)]) -> [CGPoint] {
    pairs.map { CGPoint(x: $0.0, y: $0.1) }
}

private let bodyPoints = points([
    (62, 24), (96, 14), (120, 34), (128, 72), (118, 120),
    (96, 150), (62, 154), (44, 128), (40, 84), (46, 48),
])
private let crestPoints = points([(62, 24), (80, 8), (96, 14)])
private let beakPoints = points([(114, 72), (136, 84), (114, 94)])

struct PolyGlyph: View {
    let mood: String
    var size: CGFloat = 36

    private let plumage = Color(red: 0.18, green: 0.54, blue: 0.31)
    private let crest = Color(red: 0.84, green: 0.33, blue: 0.11)
    private let beak = Color(red: 0.91, green: 0.64, blue: 0.23)

    var body: some View {
        let line = max(1, size / 42)

        ZStack(alignment: .topTrailing) {
            ZStack {
                PolyPolygon(points: bodyPoints).fill(plumage)
                PolyPolygon(points: bodyPoints).stroke(.black, lineWidth: line)
                PolyPolygon(points: crestPoints).fill(crest)
                PolyPolygon(points: crestPoints).stroke(.black, lineWidth: line)
                PolyPolygon(points: beakPoints).fill(beak)
                PolyPolygon(points: beakPoints).stroke(.black, lineWidth: line)

                if mood == "doze" {
                    PolyLid().stroke(.black, style: StrokeStyle(lineWidth: line, lineCap: .round))
                } else {
                    PolyCircle(centre: CGPoint(x: 92, y: 66), radius: 15).fill(.white)
                    PolyCircle(centre: CGPoint(x: 92, y: 66), radius: 15).stroke(.black, lineWidth: line)
                    PolyCircle(centre: CGPoint(x: mood == "wait" ? 88 : 94, y: 66), radius: 7).fill(.black)
                }
            }
            .frame(width: size, height: size * glyphHeight / glyphWidth)

            accent
                .font(.system(size: size * 0.28, weight: .bold))
        }
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private var accent: some View {
        switch mood {
        case "wait":
            Image(systemName: "exclamationmark.circle.fill").foregroundStyle(crest)
        case "work":
            Image(systemName: "gearshape.fill").foregroundStyle(.blue)
        case "doze":
            Text("z").foregroundStyle(.secondary)
        default:
            EmptyView()
        }
    }
}
