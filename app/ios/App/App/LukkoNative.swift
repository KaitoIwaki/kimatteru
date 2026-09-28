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
        CAPPluginMethod(name: "requestReview", returnType: CAPPluginReturnPromise)
    ]

    private static let shieldKey = "lukko.shield"
    private var shieldView: UIView?

    override public func load() {
        let nc = NotificationCenter.default
        nc.addObserver(self, selector: #selector(willResign), name: UIApplication.willResignActiveNotification, object: nil)
        nc.addObserver(self, selector: #selector(didBecome), name: UIApplication.didBecomeActiveNotification, object: nil)
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
