import SwiftUI
import UIKit
import LukkoKit

/// アプリの中身（Engine）と画面をつなぐもの。
///
/// 中身を変えるのはいつも Engine の操作（Web 版と同じ名前・同じ結果）。画面はここの state を見て描く。
/// 保存（Web 版の _persist・_scheduleFileSave・_flushFile）、ウィジェットへの受け渡し（_pushWidget）、
/// 日付の変わり目（_tick）、戻ってきたとき（_onReturn）もここ
@MainActor @Observable
final class AppModel {
    /// 引っ越しと保存ファイル
    let data: AppData
    /// いまの中身（画面はこれを見る）
    private(set) var state: [String: JSONValue] = [:]
    private(set) var ready = false
    /// iPhone の「暗い表示」
    var sysDark = false
    /// iPhone の文字の大きさ（本文 17pt を 1 とした倍率。1〜1.35）。予定の字だけに効かせる（evScale）
    var sysZoom: Double = 1
    /// 開くときのロック
    var lockAvailable = false
    var lockLabel = "Face ID"
    var unlocking = false
    /// 重ねて表示している iPhone のカレンダーの予定（保存しない）
    var overlay: [[String: JSONValue]] = []
    /// 下のタブ。タブの画面（月・空き状況・まとめ・設定）でないあいだは、最後にいたタブのまま
    private(set) var tab = "month"
    /// 設定のタブを押した回数（設定の画面が、先頭へ戻すのに使う）
    private(set) var settingsTabTaps = 0
    /// 評価の小窓を出す合図（RootView が iPhone の requestReview を呼ぶ）
    private(set) var reviewAsks = 0
    /// 取り込みの画面から設定アプリへ行った（戻ってきたら、許可を確かめて読み込みを続ける。Web 版の _retryImportOnReturn）
    var retryImportOnReturn = false
    /// ウィジェットへ最後に渡した結果（設定の診断で見る）。まだ渡していなければ nil
    private(set) var widgetLast: WidgetBridge.Result?
    @ObservationIgnored var exporting = false
    @ObservationIgnored private var exportTask: Task<Void, Never>?
    @ObservationIgnored private var lastExportSig: JSONValue = .null

    @ObservationIgnored private var engineRef: Engine!
    /// 中身（Engine）。画面から engine.xxxView() を読んだときも、中身が変わったら描き直されるように、state を読んだことにする
    var engine: Engine! { _ = state; return engineRef }
    @ObservationIgnored private var lastSaved: [String: JSONValue] = [:]
    @ObservationIgnored private var saveTask: Task<Void, Never>?
    @ObservationIgnored private var tick: Timer?
    @ObservationIgnored private var hiddenAt: Date?
    @ObservationIgnored private var remindTask: Task<Void, Never>?
    @ObservationIgnored private var syncTask: Task<Void, Never>?
    @ObservationIgnored private var lastSyncSig: JSONValue = .null
    @ObservationIgnored private var fromSync = false
    @ObservationIgnored private var lastEventsSig: JSONValue = .null
    @ObservationIgnored private var backupTask: Task<Void, Never>?
    @ObservationIgnored private var widgetStamp: JSONValue?
    static let syncKeys = ["events", "types", "jobs", "someday", "trash"]
    @ObservationIgnored private var lastRemindSig: JSONValue = .null
    /// 通知の貼り直しを決める設定（Web 版の componentDidUpdate の NK と同じ）
    static let notifyKeys = ["notifyOff", "remind", "morning", "morningAt", "evening", "weekly", "hideTitles"]
    /// 中の版の番号。Web 版の最後（0.32.x）より上から続ける（ベルのお知らせの「新しい版」の判定に使う）
    static let version = "0.41.0"

    init(data: AppData) { self.data = data }

    static func nowMs() -> Double { (Date().timeIntervalSince1970 * 1000).rounded(.down) }

    func start() async {
        guard !ready else { return }
        await data.start()
        // 保存ファイルがあるのに読めない：画面に知らせて待つ（何も書かない。「もう一度読み込む」でやり直す）
        if data.unreadable { return }
        var st = Engine.defaultState(now: Self.nowMs(), tz: .current)
        for k in StoreFile.persistedKeys { if let v = data.state[k] { st[k] = v } }
        let eng = Engine(state: st, now: Self.nowMs(), timeZone: .current)
        eng.clock = { AppModel.nowMs() }
        eng.didChange = { [weak self] in self?.engineChanged() }
        eng.haptic = { kind in AppModel.haptic(kind) }
        // 評価の小窓。iPhone の requestReview は画面（RootView）から呼ぶ
        eng.onRequestReview = { [weak self] in self?.reviewAsks += 1 }
        eng.phone = EventKitCalendar()
        eng.onAskImport = { [weak eng] in Task { @MainActor in await eng?.askImportNow() } }
        // 中身がまとめて入れ替わる前（控えから戻す・取り込む）に、いまの状態を控えに残す
        eng.onBackup = { [weak eng] kind in
            guard let eng else { return }
            BackupFiles.write(kind, eng.backupText(appVersion: AppModel.version))
        }
        engineRef = eng
        lastSaved = Self.persisted(st)
        state = eng.state
        tab = SystemCore.rootTab(state["screen"]) ?? "month"
        eng.boot(version: Self.version)
        // 開いたときの知らせ（いまの版の _checkFile と同じ）
        switch data.startNotice {
        case .recovered(let n)?: eng.set(["recovered": .number(Double(n))])
        case .newer?: eng.toast("新しいほうの保存から開きました（古いほうは控えに残しました）", 4200)
        case nil: break
        }
        Notifier.shared.setUp()
        Notifier.shared.onTap = { [weak self] id, kind, action, extra in
            self?.engine.handleNotificationTap(eventId: id, kind: kind, actionId: action, extra: extra)
        }
        ready = true
        scheduleReminders()
        lastSyncSig = syncSig()
        lastEventsSig = state["events"] ?? .null
        autoBackup()
        initLock()
        // iPhone のカレンダーへの書き出しは、起動時には走らせない（Web 版と同じ。予定か「名前を隠す」が変わったときだけ）
        lastExportSig = exportSig()
        if JS.truthy(state["settings"]?["overlayOn"]) {
            Task { @MainActor [weak self] in try? await Task.sleep(nanoseconds: 300_000_000); await self?.loadOverlay() }
        }
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
        // ウィジェットへ（Web 版は起動の確かめのあと、ファイル保存の間合いで渡す）
        pushWidget()
    }

    /// 手ごたえ（Web 版 haptics.js：tapLight＝軽い、stampHeavy＝重い、penTick＝硬い、settleSuccess＝成功）
    static func haptic(_ kind: String) {
        switch kind {
        case "heavy": UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
        case "pen", "rigid": UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
        case "success": UINotificationFeedbackGenerator().notificationOccurred(.success)
        default: UIImpactFeedbackGenerator(style: .light).impactOccurred()
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
        if let t = SystemCore.rootTab(state["screen"]), t != tab { tab = t }
        if Self.persisted(state) != lastSaved { scheduleSave() }
        if remindSig() != lastRemindSig { scheduleReminders() }
        // 今日の控えがまだなら、予定が変わって少したったらとる（初めての日にも控えが残るように）
        if (state["events"] ?? .null) != lastEventsSig {
            lastEventsSig = state["events"] ?? .null
            backupTask?.cancel()
            backupTask = Task { [weak self] in
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                guard let self, !Task.isCancelled else { return }
                self.autoBackup()
            }
        }
        // 決まった予定を iPhone のカレンダーにも入れている人：変わったら少し待ってそろえる
        if exportSig() != lastExportSig {
            lastExportSig = exportSig()
            if JS.truthy(state["settings"]?["exportCal"]) {
                exportTask?.cancel()
                exportTask = Task { [weak self] in
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    guard let self, !Task.isCancelled else { return }
                    await self.syncExport()
                }
            }
        }
        if syncSig() != lastSyncSig {
            lastSyncSig = syncSig()
            // 向こうから来た変更を、そのまま書き戻さない
            if fromSync { fromSync = false } else if JS.truthy(state["settings"]?["sync"]) { schedulePush() }
        }
    }

    private func exportSig() -> JSONValue { .array([state["events"] ?? .null, state["settings"]?["hideTitles"] ?? .null]) }
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
                engine.haptic("light")
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
    private func scheduleReminders(delay: UInt64 = 400_000_000) {
        lastRemindSig = remindSig()
        remindTask?.cancel()
        remindTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: delay)
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
    /// いま書く（背景に回ったとき、終了されることがあるので待たずに書く）。続けてウィジェットへ渡す（Web 版の _flushFile）
    func flush() {
        saveTask?.cancel()
        guard ready else { return }
        let p = Self.persisted(state)
        if p != lastSaved {
            do {
                try data.save(p)
                lastSaved = p
                if JS.truthy(state["saveFailed"]) { engine.set(["saveFailed": false]) }
            } catch {
                // 書けなかったことを黙って飲み込まない（画面に出して、控えを促す）
                if !JS.truthy(state["saveFailed"]) { engine.set(["saveFailed": true]) }
            }
        }
        pushWidget()
    }

    /// ウィジェットへ渡す。予定に関わるものが変わったときだけ（画面を切り替えただけでは渡さない）。force は戻ってきたとき・診断の手動送信
    func pushWidget(force: Bool = false) {
        guard ready else { return }
        let stamp = SystemCore.widgetStamp(state)
        if !force && stamp == widgetStamp { return }
        widgetStamp = stamp
        widgetLast = WidgetBridge.push(state)
    }

    // MARK: 背景・戻ってきたとき
    func scenePhaseChanged(_ phase: ScenePhase) {
        guard ready else { return }
        switch phase {
        case .background:
            hiddenAt = Date()
            flush()
        case .active:
            // ほかのアプリから戻ってきたときだけ（通知センターを下ろした・Face ID の確かめ、では動かさない）
            guard let at = hiddenAt else { return }
            hiddenAt = nil
            onReturn(awayMs: Date().timeIntervalSince(at) * 1000)
        default: break
        }
    }

    /// 戻ってきたとき（Web 版の _onResume と _onReturn）
    private func onReturn(awayMs: Double) {
        // 取り込みの画面から設定アプリへ行っていた：許可されていれば、そのまま読み込みを続ける
        if retryImportOnReturn {
            retryImportOnReturn = false
            if state["screen"] == "import" {
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    if await PhoneCal.checkAccess(self.engine.phone) == "granted" { await self.engine.runScan() }
                }
            }
        }
        // 30 秒以上ほかのアプリにいたら、確かめ直す（Web 版は 50ms 待ってから）
        if engine.onReturn(awayMs: awayMs, lockAvailable: lockAvailable) {
            Task { @MainActor [weak self] in try? await Task.sleep(nanoseconds: 50_000_000); self?.unlock() }
        }
        scheduleReminders(delay: 0)
        autoBackup()
        pullSync(pushAfter: true)
        pushWidget(force: true)
        Task { await loadOverlay() }
    }

    // MARK: 画面から使う
    func act(_ f: (Engine) -> Void) { f(engine) }
    var core: AppCore { AppCore(state: state) }
    var dark: Bool { core.isDark(sysDark: sysDark) }
    /// 予定の字の倍率（設定の「予定の文字の大きさ」か、iPhone の文字の大きさ）
    var evScale: Double { core.evScale(sysZoom: sysZoom) }
    func s(_ k: String) -> JSONValue? { state[k] }

    /// 下のタブを押した（同じタブをもう一度押したときも来る）。"add" は右の「＋」
    func tapTab(_ t: String) {
        if t == "settings" { settingsTabTaps += 1 }
        if t != "add" && t != tab { tab = t }
        engine.navTab(t)
    }

    /// 設定の診断の「ウィジェットへ送る」（Web 版の sendWidgetNow）
    func sendWidgetNow() { pushWidget(force: true) }

    /// 1 日に 1 回、端末の中に控えを書く（予定が 1 件も無いうちは書かない）
    func autoBackup() {
        guard ready, !(state["events"]?.array ?? []).isEmpty, !BackupFiles.hasToday() else { return }
        if BackupFiles.write("auto", engine.backupText(appVersion: Self.version)) != nil {
            engine.setSetting("lastAutoBackup", .number(Self.nowMs()))
            BackupFiles.prune()
        }
    }
}
