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
    @ObservationIgnored private var remindTask: Task<Void, Never>?
    @ObservationIgnored private var syncTask: Task<Void, Never>?
    @ObservationIgnored private var lastSyncSig: JSONValue = .null
    @ObservationIgnored private var fromSync = false
    static let syncKeys = ["events", "types", "jobs", "someday", "trash"]
    @ObservationIgnored private var lastRemindSig: JSONValue = .null
    /// 通知の貼り直しを決める設定（Web 版の componentDidUpdate の NK と同じ）
    static let notifyKeys = ["notifyOff", "remind", "morning", "morningAt", "evening", "weekly", "hideTitles"]
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
        eng.phone = EventKitCalendar()
        engine = eng
        lastSaved = Self.persisted(st)
        state = eng.state
        eng.boot(version: Self.version)
        Notifier.shared.setUp()
        Notifier.shared.onTap = { [weak self] id, kind, action, extra in
            self?.engine.handleNotificationTap(eventId: id, kind: kind, actionId: action, extra: extra)
        }
        ready = true
        scheduleReminders()
        lastSyncSig = syncSig()
        // iCloud で同期している人：開いたら向こうの変更を取り込み、こちらの変更を書く
        NotificationCenter.default.addObserver(forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification, object: NSUbiquitousKeyValueStore.default, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.pullSync(pushAfter: false) }
        }
        if JS.truthy(state["settings"]?["sync"]) {
            Task { @MainActor [weak self] in try? await Task.sleep(nanoseconds: 800_000_000); self?.pullSync(pushAfter: true) }
        }
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
        if remindSig() != lastRemindSig { scheduleReminders() }
        if syncSig() != lastSyncSig {
            lastSyncSig = syncSig()
            // 向こうから来た変更を、そのまま書き戻さない
            if fromSync { fromSync = false } else if JS.truthy(state["settings"]?["sync"]) { schedulePush() }
        }
    }

    private func syncSig() -> JSONValue { .array(Self.syncKeys.map { state[$0] ?? .null }) }
    private func schedulePush() {
        syncTask?.cancel()
        syncTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            guard let self, !Task.isCancelled else { return }
            self.pushSync()
        }
    }
    func pushSync() {
        guard JS.truthy(state["settings"]?["sync"]) else { return }
        SyncStore.writeRemote(SyncCore.packForSync(state), device: JS.string(JS.or(state["settings"]?["deviceId"], "")))
    }
    func pullSync(pushAfter: Bool) {
        guard ready, JS.truthy(state["settings"]?["sync"]) else { return }
        let remote = SyncStore.readRemote()
        fromSync = true
        let changed = engine.applyRemote(remote)
        if !changed { fromSync = false }
        lastSyncSig = syncSig()
        fromSync = false
        if pushAfter { pushSync() }
    }
    /// 設定の「iCloud で同期」
    func toggleSync() {
        let on = !JS.truthy(state["settings"]?["sync"])
        if on {
            let info = SyncStore.info()
            if !info.available {
                engine.toast(info.signedIn ? "この版では、まだ iCloud の同期を使えません" : "iPhone の設定で iCloud にサインインすると使えます", 3600)
                return
            }
        }
        engine.setSync(on)
        if on { pullSync(pushAfter: true) }
    }

    private func remindSig() -> JSONValue {
        var o: [String: JSONValue] = ["events": state["events"] ?? .null]
        for k in Self.notifyKeys { if let v = state["settings"]?[k] { o[k] = v } }
        return .object(o)
    }
    /// 予定か通知の設定が変わったら、少し待って予約を貼り直す（0.4 秒）
    private func scheduleReminders() {
        lastRemindSig = remindSig()
        remindTask?.cancel()
        remindTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard let self, !Task.isCancelled else { return }
            await Notifier.shared.sync(events: self.state["events"]?.array ?? [], settings: self.state["settings"]?.object ?? [:])
        }
        engine?.refreshNotif()
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
            pullSync(pushAfter: true)
        default: break
        }
    }

    // MARK: 画面から使う
    func act(_ f: (Engine) -> Void) { f(engine) }
    var core: AppCore { AppCore(state: state) }
    var dark: Bool { core.isDark(sysDark: sysDark) }
    func s(_ k: String) -> JSONValue? { state[k] }
}
