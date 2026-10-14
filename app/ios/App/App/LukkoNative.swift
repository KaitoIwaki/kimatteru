//
//  LukkoNative.swift
//  LUKKO
//
//  アプリ（WebView）から呼ぶ、小さな窓口。やることは3つだけ。
//
//    1. Face ID / Touch ID / パスコードで本人かを確かめる（開くときのロック）
//    2. アプリを切り替える画面（マルチタスク）で、中身をぼかす
//       —— 転職活動や通院の予定を、横からのぞかれないように
//    3. App Store の星の小窓を出す（出すかどうか・回数は iOS が決める。1年に3回まで）
//
//  どれも端末の中だけで終わる。外には何も送らない。
//  ぼかすかどうかは UserDefaults に持つ。アプリが背景に回る瞬間は JS が動いていない
//  ことがあるので、Swift の側だけで決められるようにしておく。
//
//  登録は ViewController.swift（npm のプラグインではないので、自分で登録しないと見えない）。
//

import Foundation
import UIKit
import Capacitor
import LocalAuthentication
import StoreKit

@objc(LukkoNativePlugin)
public class LukkoNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LukkoNativePlugin"
    public let jsName = "LukkoNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "lockInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setShield", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "alert", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "kvsInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "kvsGet", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "kvsSet", returnType: CAPPluginReturnPromise)
    ]

    private static let shieldKey = "lukko.shield"
    private var shieldView: UIView?

    override public func load() {
        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(willResign), name: UIApplication.willResignActiveNotification, object: nil)
        nc.addObserver(self, selector: #selector(didBecome), name: UIApplication.didBecomeActiveNotification, object: nil)
        nc.addObserver(self, selector: #selector(kvsChanged(_:)),
                       name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
                       object: NSUbiquitousKeyValueStore.default)
    }

    // MARK: - iCloud の小さな置き場（2台の iPhone で同じ予定にする）
    //
    //  本人の iCloud の中の、このアプリ専用の置き場（キーと値）。開発者は中身を見られない。
    //  アカウント登録も、こちらのサーバーも要らない。全部で 1MB まで。
    //  アプリに iCloud の許可（entitlement）が無いビルドでは、synchronize() が false を返すだけで何も起きない。

    @objc private func kvsChanged(_ note: Notification) {
        var keys: [String] = []
        if let info = note.userInfo, let changed = info[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] {
            keys = changed
        }
        notifyListeners("kvsChanged", data: ["keys": keys])
    }

    @objc func kvsInfo(_ call: CAPPluginCall) {
        let store = NSUbiquitousKeyValueStore.default
        let synced = store.synchronize()
        let signedIn = FileManager.default.ubiquityIdentityToken != nil
        call.resolve(["available": synced && signedIn, "signedIn": signedIn, "entitled": synced])
    }

    @objc func kvsGet(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key が要ります")
            return
        }
        let store = NSUbiquitousKeyValueStore.default
        _ = store.synchronize()
        if let value = store.string(forKey: key) {
            call.resolve(["value": value])
        } else {
            call.resolve([:])
        }
    }

    @objc func kvsSet(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key が要ります")
            return
        }
        let store = NSUbiquitousKeyValueStore.default
        if let value = call.getString("value") {
            store.set(value, forKey: key)
        } else {
            store.removeObject(forKey: key)
        }
        let ok = store.synchronize()
        call.resolve(["ok": ok])
    }

    // MARK: - ぼかし

    @objc private func willResign() {
        guard UserDefaults.standard.bool(forKey: LukkoNativePlugin.shieldKey) else { return }
        DispatchQueue.main.async { self.showShield() }
    }

    @objc private func didBecome() {
        DispatchQueue.main.async { self.hideShield() }
    }

    private func currentWindow() -> UIWindow? {
        if let w = self.bridge?.viewController?.view.window { return w }
        for scene in UIApplication.shared.connectedScenes {
            guard let ws = scene as? UIWindowScene else { continue }
            for w in ws.windows where w.isKeyWindow { return w }
        }
        return nil
    }

    private func showShield() {
        if shieldView != nil { return }
        guard let win = currentWindow() else { return }
        let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
        blur.frame = win.bounds
        blur.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        win.addSubview(blur)
        shieldView = blur
    }

    private func hideShield() {
        shieldView?.removeFromSuperview()
        shieldView = nil
    }

    @objc func setShield(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        UserDefaults.standard.set(on, forKey: LukkoNativePlugin.shieldKey)
        call.resolve()
    }

    // MARK: - 本人の確かめ

    @objc func lockInfo(_ call: CAPPluginCall) {
        let bioCtx = LAContext()
        var bioErr: NSError?
        let bio = bioCtx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &bioErr)
        var kind = "none"
        if bio {
            switch bioCtx.biometryType {
            case .faceID:
                kind = "faceID"
            case .touchID:
                kind = "touchID"
            default:
                kind = "passcode"
            }
        }
        var anyErr: NSError?
        let any = LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: &anyErr)
        if !bio && any { kind = "passcode" }
        call.resolve(["available": any, "kind": kind])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "LUKKO を開きます"
        let ctx = LAContext()
        ctx.localizedCancelTitle = "やめる"
        var err: NSError?
        // パスコードも設定していない端末では、確かめようがない。締め出さないように通す
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: &err) else {
            call.resolve(["ok": true, "why": "unavailable"])
            return
        }
        ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, _ in
            DispatchQueue.main.async {
                call.resolve(["ok": success])
            }
        }
    }

    // MARK: - 評価の小窓

    // MARK: - iPhone 標準の確認画面（アラート）と、下から出る選択肢（アクションシート）
    //
    //  画面は Web で描いているが、確認の小窓と選択肢だけは iPhone の本物（UIAlertController）を出す。
    //  buttons は [{ label, style: "default" | "cancel" | "destructive" }]。押されたボタンの番号を返す。
    //  外を触って閉じた（アクションシートのとき）・出せなかったときは index = -1
    @objc func alert(_ call: CAPPluginCall) {
        let title = call.getString("title")
        let message = call.getString("message")
        let sheet = call.getBool("sheet") ?? false
        let buttons = call.getArray("buttons", JSObject.self) ?? []
        DispatchQueue.main.async {
            guard let vc = self.bridge?.viewController else { call.resolve(["index": -1]); return }
            var top: UIViewController = vc
            while let p = top.presentedViewController { top = p }
            let ac = UIAlertController(title: title, message: (message?.isEmpty ?? true) ? nil : message,
                                       preferredStyle: sheet ? .actionSheet : .alert)
            var hasCancel = false
            for (i, b) in buttons.enumerated() {
                let label = b["label"] as? String ?? ""
                let st: UIAlertAction.Style
                switch b["style"] as? String {
                case "cancel": st = .cancel; hasCancel = true
                case "destructive": st = .destructive
                default: st = .default
                }
                let action = UIAlertAction(title: label, style: st) { _ in call.resolve(["index": i]) }
                ac.addAction(action)
                if (b["preferred"] as? Bool) == true { ac.preferredAction = action }
            }
            if sheet && !hasCancel {
                ac.addAction(UIAlertAction(title: "キャンセル", style: .cancel) { _ in call.resolve(["index": -1]) })
            }
            // iPad ではアクションシートを吹き出しで出す。出どころは画面の下の真ん中
            if let pop = ac.popoverPresentationController, let v = vc.view {
                pop.sourceView = v
                pop.sourceRect = CGRect(x: v.bounds.midX, y: v.bounds.maxY - 80, width: 1, height: 1)
                pop.permittedArrowDirections = []
            }
            top.present(ac, animated: true)
        }
    }

    @objc func requestReview(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            var target: UIWindowScene?
            for scene in UIApplication.shared.connectedScenes {
                if let ws = scene as? UIWindowScene, ws.activationState == .foregroundActive {
                    target = ws
                    break
                }
            }
            if let ws = target {
                SKStoreReviewController.requestReview(in: ws)
            }
            call.resolve()
        }
    }
}
