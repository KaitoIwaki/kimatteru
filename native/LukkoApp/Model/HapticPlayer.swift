import CoreHaptics

/// 振動を鳴らす（Core Haptics）。
///
/// .sensoryFeedback や UIFeedbackGenerator は、鳴らすかどうかを iPhone が決める（低電力モードなどで黙る）。
/// 実機の「振動の試験」で、A（.sensoryFeedback）と C（UIKit）は鳴らず、D（Core Haptics）だけ鳴ったので、全部こちらで鳴らす
@MainActor
final class HapticPlayer {
    static let shared = HapticPlayer()

    private let supports = CHHapticEngine.capabilitiesForHardware().supportsHaptics
    private var engine: CHHapticEngine?
    private var patterns: [String: CHHapticPattern] = [:]

    /// 合図の種類 → 振動（強さ・硬さ。Web 版 haptics.js の tapLight・stampHeavy・penTick・settleSuccess に合わせる）
    private static func taps(_ kind: String) -> [(t: Double, i: Float, s: Float)] {
        switch kind {
        case "select": return [(0, 0.4, 0.8)]                    // 流して日・週・月が 1 つ進んだ（目盛り）
        case "heavy": return [(0, 1.0, 0.3)]
        case "pen", "rigid": return [(0, 0.85, 0.95)]
        case "success": return [(0, 0.55, 0.5), (0.11, 1.0, 0.6)] // トトン
        default: return [(0, 0.55, 0.5)]                          // light
        }
    }

    func play(_ kind: String) {
        guard supports, !kind.isEmpty, let pattern = pattern(kind) else { return }
        // 裏に回ると止まる。止まっていたら起こし直し、それでもだめなら作り直す
        for attempt in 0..<2 {
            guard let e = readyEngine() else { return }
            do {
                try e.makePlayer(with: pattern).start(atTime: CHHapticTimeImmediate)
                return
            } catch {
                if attempt == 0, (try? e.start()) == nil { engine = nil }
            }
        }
    }

    private func pattern(_ kind: String) -> CHHapticPattern? {
        if let p = patterns[kind] { return p }
        let events = Self.taps(kind).map { tap in
            CHHapticEvent(eventType: .hapticTransient, parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: tap.i),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: tap.s)], relativeTime: tap.t)
        }
        guard let p = try? CHHapticPattern(events: events, parameters: []) else { return nil }
        patterns[kind] = p
        return p
    }

    private func readyEngine() -> CHHapticEngine? {
        if let engine { return engine }
        guard let e = try? CHHapticEngine() else { return nil }
        e.playsHapticsOnly = true
        // しばらく鳴らさなければ自分で止まり、次に鳴らすときに起きる（電池のため）
        e.isAutoShutdownEnabled = true
        e.resetHandler = { [weak e] in try? e?.start() }
        guard (try? e.start()) != nil else { return nil }
        engine = e
        return e
    }
}
