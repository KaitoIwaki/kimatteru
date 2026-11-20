import SwiftUI
import UIKit
import CoreHaptics

/// 振動の試験（隠し。設定のいちばん下の版の表示を長押しで開く）。
/// 振動が鳴らないときに、どの鳴らし方なら鳴るかを、実機で押し比べるためのもの
struct HapticTestView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var direct = 0
    @State private var engine: CHHapticEngine?
    @State private var note = ""
    private let notifier = UINotificationFeedbackGenerator()

    private var supports: Bool { CHHapticEngine.capabilitiesForHardware().supportsHaptics }
    private var build: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "?" }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledContent("この iPhone は振動できる", value: supports ? "はい" : "いいえ")
                    LabeledContent("ビルド", value: build)
                    LabeledContent("合図の回数", value: "\(model.hapticPulse.n)")
                }
                Section {
                    Button("A：ボタンで直接（SwiftUI）") { direct += 1 }
                        .sensoryFeedback(.success, trigger: direct)
                    Button("B：アプリの今の仕組み（Core Haptics）") { AppModel.haptic("success") }
                    Button("C：UIKit（用意してから鳴らす）") { notifier.prepare(); notifier.notificationOccurred(.success) }
                    Button("D：Core Haptics") { playCore() }
                } footer: {
                    Text("押して、振動したものを教えてください。\(note)")
                }
                Section {
                    Button("大きいお祝いを見る") {
                        let t = Calendar.current.dateComponents([.year, .month], from: Date())
                        dismiss()
                        model.showMilestone(y: t.year ?? 2026, m: (t.month ?? 1) - 1, decided: 12, forced: true, delay: 0.7)
                    }
                } footer: {
                    Text("今月の点線が全部片づいたときに出るお祝いを、試しに出します。")
                }
            }
            .navigationTitle("振動の試験")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("閉じる") { dismiss() } } }
        }
    }

    private func playCore() {
        do {
            if engine == nil { engine = try CHHapticEngine(); try engine?.start() }
            let ev = CHHapticEvent(eventType: .hapticTransient, parameters: [
                CHHapticEventParameter(parameterID: .hapticIntensity, value: 1),
                CHHapticEventParameter(parameterID: .hapticSharpness, value: 0.6)], relativeTime: 0)
            let player = try engine?.makePlayer(with: CHHapticPattern(events: [ev], parameters: []))
            try player?.start(atTime: 0)
            note = ""
        } catch {
            note = "（D は失敗：\(error.localizedDescription)）"
        }
    }
}
