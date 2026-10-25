import SwiftUI

private struct SceneParticle {
    let x: Double
    let y: Double
    let size: Double
    let delay: Double
    let duration: Double
}

private struct WindDownScenePalette {
    let top: Color
    let bottom: Color
    let glow: Color
    let moon: Bool

    static func forBed(_ bed: String) -> WindDownScenePalette {
        switch bed {
        case "rain":
            return WindDownScenePalette(top: Color(red: 0.04, green: 0.07, blue: 0.13), bottom: Color(red: 0.12, green: 0.16, blue: 0.23), glow: Color(red: 0.39, green: 0.45, blue: 0.55).opacity(0.25), moon: false)
        case "sea":
            return WindDownScenePalette(top: Color(red: 0.03, green: 0.07, blue: 0.19), bottom: Color(red: 0.05, green: 0.29, blue: 0.36), glow: Color(red: 0.13, green: 0.83, blue: 0.93).opacity(0.19), moon: true)
        case "embers":
            return WindDownScenePalette(top: Color(red: 0.08, green: 0.04, blue: 0.03), bottom: Color(red: 0.23, green: 0.07, blue: 0.02), glow: Color(red: 0.98, green: 0.45, blue: 0.09).opacity(0.4), moon: false)
        case "aurora":
            return WindDownScenePalette(top: Color(red: 0.01, green: 0.02, blue: 0.09), bottom: Color(red: 0.04, green: 0.11, blue: 0.18), glow: Color(red: 0.2, green: 0.83, blue: 0.6).opacity(0.25), moon: true)
        default:
            return WindDownScenePalette(top: Color(red: 0.04, green: 0.06, blue: 0.15), bottom: Color(red: 0.12, green: 0.11, blue: 0.29), glow: Color(red: 0.39, green: 0.4, blue: 0.95).opacity(0.33), moon: true)
        }
    }
}

struct WindDownSceneView: View {
    let bed: String
    var moving = true
    var date = Date()

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let palette: WindDownScenePalette
    private let stars: [SceneParticle]
    private let drops: [SceneParticle]
    private let embers: [SceneParticle]

    init(bed: String, seed: String, moving: Bool = true, date: Date = Date()) {
        self.bed = bed
        self.moving = moving
        self.date = date
        palette = .forBed(bed)
        let hasStars = bed == "night" || bed == "aurora" || bed == "sea"
        stars = hasStars
            ? Self.scatter("\(seed):stars", count: bed == "night" ? 46 : 26, y: 0.02...(bed == "sea" ? 0.6 : 0.78), size: 0.6...1.8, duration: 3...9)
            : []
        drops = bed == "rain" ? Self.scatter("\(seed):rain", count: 70, y: 0...1, size: 1.2...2.6, duration: 0.8...1.6) : []
        embers = bed == "embers" ? Self.scatter("\(seed):embers", count: 28, y: 0...1, size: 1...3, duration: 6...12) : []
    }

    private static func scatter(
        _ seed: String,
        count: Int,
        y: ClosedRange<Double>,
        size: ClosedRange<Double>,
        duration: ClosedRange<Double>
    ) -> [SceneParticle] {
        var random = SeededRandom(seed: seed)
        return (0..<count).map { _ in
            SceneParticle(
                x: random.next(),
                y: random.next(in: y),
                size: random.next(in: size),
                delay: random.next(in: 0...duration.upperBound),
                duration: random.next(in: duration)
            )
        }
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30, paused: !moving || reduceMotion)) { timeline in
            Canvas { context, size in
                draw(in: &context, size: size, time: timeline.date.timeIntervalSinceReferenceDate)
            }
        }
        .accessibilityHidden(true)
    }

    private func draw(in context: inout GraphicsContext, size: CGSize, time: Double) {
        let rect = CGRect(origin: .zero, size: size)
        context.fill(Path(rect), with: .linearGradient(
            Gradient(colors: [palette.top, palette.bottom]),
            startPoint: .zero,
            endPoint: CGPoint(x: 0, y: size.height)
        ))
        context.fill(Path(rect), with: .radialGradient(
            Gradient(colors: [palette.glow, .clear]),
            center: CGPoint(x: size.width / 2, y: size.height),
            startRadius: 0,
            endRadius: size.width * 0.7
        ))

        for star in stars {
            let twinkle = 0.2 + 0.75 * (0.5 + 0.5 * sin((time + star.delay) * 2 * .pi / star.duration))
            let point = CGPoint(x: star.x * size.width, y: star.y * size.height)
            context.fill(
                Path(ellipseIn: CGRect(x: point.x, y: point.y, width: star.size, height: star.size)),
                with: .color(.white.opacity(twinkle))
            )
        }

        if bed == "aurora" { drawAurora(in: &context, size: size, time: time) }
        if palette.moon { drawMoon(in: &context, size: size, time: time) }
        if bed == "sea" { drawSea(in: &context, size: size, time: time) }

        for drop in drops {
            let progress = (time / drop.duration + drop.delay).truncatingRemainder(dividingBy: 1)
            let x = drop.x * size.width
            let y = progress * size.height * 1.2 - size.height * 0.1
            var line = Path()
            line.move(to: CGPoint(x: x, y: y))
            line.addLine(to: CGPoint(x: x - drop.size * 1.5, y: y + drop.size * 7))
            context.stroke(line, with: .color(Color(white: 0.8).opacity(0.35)), lineWidth: 0.8)
        }

        for ember in embers {
            let progress = ((time + ember.delay) / ember.duration).truncatingRemainder(dividingBy: 1)
            let opacity = progress < 0.15 ? progress / 0.15 : 1 - progress
            let point = CGPoint(x: ember.x * size.width, y: size.height * (0.95 - 0.7 * progress))
            context.fill(
                Path(ellipseIn: CGRect(x: point.x, y: point.y, width: ember.size, height: ember.size)),
                with: .color(Color(red: 0.99, green: 0.73, blue: 0.45).opacity(opacity))
            )
        }
    }

    private func drawMoon(in context: inout GraphicsContext, size: CGSize, time: Double) {
        let phase = MoonPhase.fraction(at: date)
        let radius = min(size.width, size.height) * 0.07
        let center = CGPoint(x: size.width * 0.8, y: size.height * 0.22)
        let lit = Color(red: 0.93, green: 0.95, blue: 1)
        let dim = Color(red: 0.16, green: 0.18, blue: 0.29)
        let disc = CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)
        let waxing = phase < 0.5
        let terminator = abs(cos(2 * .pi * phase)) * radius
        let gibbous = abs(phase - 0.5) < 0.25

        context.fill(Path(ellipseIn: disc.insetBy(dx: -radius, dy: -radius)), with: .color(lit.opacity(0.06)))
        context.fill(Path(ellipseIn: disc), with: .color(dim))
        var half = Path()
        half.move(to: CGPoint(x: center.x, y: center.y - radius))
        half.addArc(center: center, radius: radius, startAngle: .degrees(-90), endAngle: .degrees(90), clockwise: !waxing)
        half.closeSubpath()
        context.fill(half, with: .color(lit))
        context.fill(
            Path(ellipseIn: CGRect(x: center.x - terminator, y: center.y - radius, width: terminator * 2, height: radius * 2)),
            with: .color(gibbous ? lit : dim)
        )

        if bed == "sea" {
            let shimmer = 0.25 + 0.45 * (0.5 + 0.5 * sin(time * 2 * .pi / 7))
            context.fill(
                Path(ellipseIn: CGRect(x: center.x - radius * 0.7, y: size.height * 0.6, width: radius * 1.4, height: size.height * 0.3)),
                with: .color(lit.opacity(shimmer * 0.5))
            )
        }
    }

    private func drawSea(in context: inout GraphicsContext, size: CGSize, time: Double) {
        let layers: [(baseline: Double, amplitude: Double, wavelength: Double, period: Double, colour: Color)] = [
            (0.69, 0.018, 0.25, 34, Color(red: 0.05, green: 0.23, blue: 0.32)),
            (0.78, 0.022, 0.2, 26, Color(red: 0.04, green: 0.18, blue: 0.27)),
            (0.88, 0.027, 0.5, 18, Color(red: 0.03, green: 0.13, blue: 0.21))
        ]

        for layer in layers {
            var wave = Path()
            wave.move(to: CGPoint(x: 0, y: size.height))
            for step in stride(from: 0.0, through: 1.0, by: 0.01) {
                let phase = (step / layer.wavelength + time / layer.period) * 2 * .pi
                wave.addLine(to: CGPoint(
                    x: step * size.width,
                    y: (layer.baseline + layer.amplitude * sin(phase)) * size.height
                ))
            }
            wave.addLine(to: CGPoint(x: size.width, y: size.height))
            wave.closeSubpath()
            context.fill(wave, with: .color(layer.colour.opacity(0.92)))
        }
    }

    private func drawAurora(in context: inout GraphicsContext, size: CGSize, time: Double) {
        let ribbons: [(base: Double, colour: Color, period: Double)] = [
            (0.34, Color(red: 0.2, green: 0.83, blue: 0.6), 16),
            (0.44, Color(red: 0.13, green: 0.83, blue: 0.93), 22),
            (0.26, Color(red: 0.65, green: 0.55, blue: 0.98), 28)
        ]
        var layer = context
        layer.addFilter(.blur(radius: size.height * 0.05))

        for ribbon in ribbons {
            let sway = sin(time * 2 * .pi / ribbon.period)
            var path = Path()
            for step in stride(from: -0.1, through: 1.1, by: 0.02) {
                let point = CGPoint(
                    x: step * size.width + sway * size.width * 0.05,
                    y: (ribbon.base + 0.08 * sin(step * 2 * .pi * 1.3 + time / ribbon.period)) * size.height
                )
                step == -0.1 ? path.move(to: point) : path.addLine(to: point)
            }
            layer.stroke(
                path,
                with: .color(ribbon.colour.opacity(0.6 + 0.25 * sway)),
                style: StrokeStyle(lineWidth: size.height * 0.1, lineCap: .round)
            )
        }
    }
}
