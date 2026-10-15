import SwiftUI
import LocalAuthentication
import LukkoKit

/// 開くときのロック（Face ID・Touch ID・パスコード）。いまの版の LukkoNative.swift の lockInfo・authenticate・setShield と、
/// App.jsx の _initLock・unlock・toggleLock の写し
enum Lock {
    /// 切り替え画面でぼかすか（いまの版と同じ UserDefaults の名前。ロックと同じ値を持つ）
    static let shieldKey = "lukko.shield"

    /// 使えるか（.deviceOwnerAuthentication）と、呼び名。生体が使えなくてパスコードだけなら「パスコード」
    static func info() -> (available: Bool, label: String) {
        let bioCtx = LAContext()
        var bioErr: NSError?
        let bio = bioCtx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &bioErr)
        var label = "パスコード"
        if bio {
            switch bioCtx.biometryType {
            case .faceID: label = "Face ID"
            case .touchID: label = "Touch ID"
            default: label = "パスコード"
            }
        }
        var anyErr: NSError?
        let any = LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: &anyErr)
        return (any, label)
    }

    /// 本人かを確かめる（生体 → だめならパスコード）。確かめる手段の無い端末は通す（締め出さない）
    static func authenticate(_ reason: String) async -> Bool {
        let ctx = LAContext()
        ctx.localizedCancelTitle = "やめる"
        var err: NSError?
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &err) else { return true }
        return (try? await ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)) == true
    }

    static func setShield(_ on: Bool) { UserDefaults.standard.set(on, forKey: shieldKey) }
}

extension AppModel {
    /// 起動したとき：ロックを入れている人は、確かめ終わるまで中身を隠す
    func initLock() {
        let info = Lock.info()
        lockAvailable = info.available
        lockLabel = info.label
        if JS.truthy(state["settings"]?["lock"]) && info.available {
            Lock.setShield(true)
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
    /// 設定の「{Face ID} でロック」。入れるときも一度確かめる（自分の顔で開けることを確かめてから）
    func toggleLock() {
        engine.haptic("light")
        let on = !JS.truthy(state["settings"]?["lock"])
        Task { @MainActor in
            if on, !(await Lock.authenticate("LUKKO のロックを入れます")) {
                engine.toast("確かめられなかったので、入れませんでした", 3000)
                return
            }
            engine.setSetting("lock", .bool(on))
            Lock.setShield(on)
        }
    }
}

/// 確かめ終わるまで、中身の上に紙を 1 枚かぶせておく（いまの版と同じ：✓？・LUKKO・「Face IDで開く」）
struct LockedCover: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        if JS.truthy(model.state["locked"]) {
            ZStack {
                ink("bg").ignoresSafeArea()
                VStack(spacing: 18) {
                    HStack(spacing: -3) {
                        Text("✓").foregroundStyle(Color(red: 0x1D / 255, green: 0x9E / 255, blue: 0x75 / 255))
                        Text("？").foregroundStyle(ink("ink-faint"))
                    }
                    .font(.system(size: 30))
                    Text("LUKKO").font(.system(size: 20, weight: .light)).tracking(2).foregroundStyle(ink("ink"))
                    Button { model.unlock() } label: {
                        Text("\(model.lockLabel)で開く")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(ink("card"))
                            .padding(.vertical, 13).padding(.horizontal, 26)
                            .background(ink("ink"), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 10)
                    .accessibilityIdentifier("lock.open")
                }
            }
            .transition(.opacity)
        }
    }
}
