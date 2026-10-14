import SwiftUI
import UIKit
import LukkoKit
import StoreKit

/// アプリの中身（Engine）と画面をつなぐもの。
///
/// 中身を変えるのはいつも Engine の操作（Web 版と同じ名前・同じ結果）。画面はここの state を見て描く。
/// 保存（Web 版の _persist・_scheduleFileSave）、日付の変わり目（_tick）、戻ってきたとき（_onReturn）もここ
@MainActor @Observable
final class AppModel {
    /// 引っ越しと保存ファイル
    let data: AppData
    /// いまの中身（画面はこれを見る）
    private(set) var state: [String: JSONValue] = [:]
    private(set) var ready = false
    /// iPhone の「暗い表示」
    var sysDark = false

    @ObservationIgnored private(set) var engine: Engine!
    @ObservationIgnored private var lastSaved: [String: JSONValue] = [:]
    @ObservationIgnored private var saveTask: Task<Void, Never>?
    @ObservationIgnored private var tick: Timer?
    @ObservationIgnored private var hiddenAt: Date?
    /// 中の版の番号。Web 版の最後（0.32.x）より上から続ける（ベルのお知らせの「新しい版」の判定に使う）
    static let version = "0.40.0"

    init(data: AppData) { self.data = data }

    static func nowMs() -> Double { (Date().timeIntervalSince1970 * 1000).rounded(.down) }

    func start() async {
        await data.start()
        var st = Engine.defaultState(now: Self.nowMs(), tz: .current)
        for k in StoreFile.persistedKeys { if let v = data.state[k] { st[k] = v } }
        let eng = Engine(state: st, now: Self.nowMs(), timeZone: .current)
        eng.clock = { AppModel.nowMs() }
        eng.didChange = { [weak self] in self?.engineChanged() }
        eng.haptic = { kind in
            if kind == "heavy" { UIImpactFeedbackGenerator(style: .rigid).impactOccurred(intensity: 0.9) }
            else { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
        }
        eng.onRequestReview = {
            if let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
                SKStoreReviewController.requestReview(in: scene)
            }
        }
        engine = eng
        lastSaved = Self.persisted(st)
        state = eng.state
        eng.boot(version: Self.version)
        ready = true
        // 日付が変わったら「今日」と記録の催促を進める（Web 版と同じく 1 分ごと）
        tick = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.engine.checkToday(); self?.engine.refreshNotif() }
        }
    }

    static func persisted(_ st: [String: JSONValue]) -> [String: JSONValue] {
        var o: [String: JSONValue] = [:]
        for k in StoreFile.persistedKeys { if let v = st[k] { o[k] = v } }
        return o
    }

    /// 中身が変わった。画面に知らせ、保存する中身が変わっていたら、手が止まってから書く（1.2 秒）
    private func engineChanged() {
        guard let engine else { return }
        state = engine.state
        if Self.persisted(state) != lastSaved { scheduleSave() }
    }
    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            if Task.isCancelled { return }
            self?.flush()
        }
    }
    /// いま書く（背景に回ったとき、終了されることがあるので待たずに書く）
    func flush() {
        saveTask?.cancel()
        let p = Self.persisted(state)
        guard p != lastSaved, ready else { return }
        do {
            try data.save(p)
            lastSaved = p
        } catch {
            // 書けなかったことを黙って飲み込まない（画面に出す）
            engine.set(["saveFailed": true])
        }
    }

    // MARK: 背景・戻ってきたとき
    func scenePhaseChanged(_ phase: ScenePhase) {
        guard ready else { return }
        switch phase {
        case .background:
            hiddenAt = Date()
            flush()
        case .active:
            let away = hiddenAt.map { Date().timeIntervalSince($0) * 1000 } ?? 0
            hiddenAt = nil
            engine.onReturn(awayMs: away, lockAvailable: false)
        default: break
        }
    }

    // MARK: 画面から使う
    func act(_ f: (Engine) -> Void) { f(engine) }
    var core: AppCore { AppCore(state: state) }
    var dark: Bool { core.isDark(sysDark: sysDark) }
    func s(_ k: String) -> JSONValue? { state[k] }
}
