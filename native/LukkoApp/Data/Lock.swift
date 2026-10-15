import SwiftUI
import LocalAuthentication
import LukkoKit

/// 開くときのロック（Face ID・Touch ID・パスコード）。Web 版の lockInfo・authenticate・toggleLock の写し
enum Lock {
    static func info() -> (available: Bool, label: String) {
        let ctx = LAContext()
        var err: NSError?
        let ok = ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &err)
        let label = ctx.biometryType == .faceID ? "Face ID" : ctx.biometryType == .touchID ? "Touch ID" : "パスコード"
        return (ok, label)
    }
    static func authenticate(_ reason: String) async -> Bool {
        (try? await LAContext().evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)) == true
    }
}

extension AppModel {
    /// 起動したとき：ロックを入れている人は、確かめ終わるまで中身を隠す
    func initLock() {
        let info = Lock.info()
        lockAvailable = info.available
        lockLabel = info.label
        if JS.truthy(state["settings"]?["lock"]) && info.available {
            engine.set(["locked": true])
            unlock()
        }
    }
    func unlock() {
        guard !unlocking else { return }
        unlocking = true
        Task { @MainActor in
            let ok = await Lock.authenticate("LUKKO を開きます")
            unlocking = false
            if ok { engine.set(["locked": false]) }
        }
    }
    /// 設定の「開くときに Face ID」。入れるときも一度確かめる
    func toggleLock() {
        engine.haptic("light")
        let on = !JS.truthy(state["settings"]?["lock"])
        Task { @MainActor in
            if on, !(await Lock.authenticate("LUKKO のロックを入れます")) {
                engine.toast("確かめられなかったので、入れませんでした", 3000)
                return
            }
            engine.setSetting("lock", .bool(on))
        }
    }
}

/// 確かめるまで中身を隠す幕
struct LockedCover: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        if JS.truthy(model.state["locked"]) {
            ZStack {
                Rectangle().fill(.ultraThinMaterial).ignoresSafeArea()
                VStack(spacing: 16) {
                    Image(systemName: "lock.fill").font(.system(size: 36)).foregroundStyle(.secondary)
                    Button("\(model.lockLabel)で開く") { model.unlock() }.buttonStyle(.borderedProminent)
                }
            }
        }
    }
}
