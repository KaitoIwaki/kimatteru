import Foundation

/// 指で流しているあいだ、日・週・月が 1 つ進むごとに小さく振動する（ダイヤルを回す手ざわり。2.3）。
/// ボタンや「今日」でこちらから動かしたときは鳴らさない（quiet を呼んでから動かす）
struct ScrollTick {
    private var quietUntil = Date.distantPast
    mutating func quiet(_ seconds: Double = 0.6) { quietUntil = Date().addingTimeInterval(seconds) }
    func tick() { if Date() >= quietUntil { AppModel.haptic("select") } }
}
