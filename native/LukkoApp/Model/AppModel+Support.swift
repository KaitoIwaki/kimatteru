import SwiftUI
import StoreKit
import WidgetKit
import LukkoKit

/// 応援（投げ銭。StoreKit 2 の消耗型）。Web 版 tipjar.js・App.jsx の _loadTips・buyTip・tapVersion・runProbe の写し。
///
/// 見返りに機能を渡さない（何も解放しない）。話す相手は Apple だけ。買った記録は supports（予定と同じ保存）に入れる
@MainActor
final class SupportStore {
    static let shared = SupportStore()
    /// 値段を取りに行ったか（失敗したら次に設定を開いたときにまた取りに行く）
    var tipsTried = false
    var products: [String: Product] = [:]
    private var verTaps = 0
    private var verTimer: Task<Void, Never>?
    private var updates: Task<Void, Never>?
    /// ウィジェットへ渡した結果を、Web 版の診断と同じ形（{ok, days, size} か {ok:false, why}）にする。まだ渡していなければ null
    static func widgetJSON(_ r: WidgetBridge.Result?) -> JSONValue {
        guard let r else { return .null }
        return r.ok ? ["ok": true, "days": .number(Double(r.days)), "size": .number(Double(r.size))] : ["ok": false, "why": .string(r.why)]
    }

    /// 値段を取ってくるのに待つ長さ（返事が無いこと自体を結果として扱う）
    static let limit: UInt64 = 8_000_000_000

    /// 見本の撮影（試験）のときだけ、App Store に聞かずに値段を置く（Web 版の ?demo= と同じ）
    static var demo: Bool { ProcessInfo.processInfo.arguments.contains("-lukkoDemoTips") }

    /// 買ったあとで届くもの（承認待ちのあとで通った・前回の続き）も受け取る
    func listen(_ model: AppModel) {
        guard updates == nil else { return }
        updates = Task { @MainActor [weak model] in
            for await r in Transaction.updates {
                guard case .verified(let t) = r else { continue }
                if SupportCore.tips.contains(where: { $0.id == t.productID }), t.revocationDate == nil {
                    model?.engine.buyTipEnd(t.productID, ok: true, msg: "")
                }
                await t.finish()
            }
        }
        // 前に終わらせられなかった応援（買えたあとで落ちた など）
        Task { @MainActor [weak model] in
            for await r in Transaction.unfinished {
                guard case .verified(let t) = r else { continue }
                if SupportCore.tips.contains(where: { $0.id == t.productID }), t.revocationDate == nil {
                    model?.engine.buyTipEnd(t.productID, ok: true, msg: "")
                }
                await t.finish()
            }
        }
    }

    /// 設定を開いたときに 1 回だけ値段を取りに行く
    func loadTips(_ model: AppModel) async {
        if tipsTried { return }
        tipsTried = true
        if Self.demo {
            model.engine.setTips(SupportCore.tips.map { ["id": .string($0.id), "yen": .number(Double($0.yen)), "label": .string($0.label), "price": .string("¥\($0.yen)")] })
            return
        }
        let r = await probe()
        if let tips = r["tips"]?.array, !tips.isEmpty { model.engine.setTips(tips) } else { tipsTried = false }
    }

    /// 値段を取りに行って、何が起きたかも返す（診断に全部出す）
    func probe() async -> JSONValue {
        var out: [String: JSONValue] = ["native": true, "billing": .null, "asked": .array(SupportCore.tips.map { .string($0.id) }),
                                        "got": .array([]), "error": "", "tips": .null]
        out["billing"] = .bool(AppStore.canMakePayments)
        let ids = SupportCore.tips.map { $0.id }
        let lim = Self.limit
        let found: [Product]
        do {
            found = try await withThrowingTaskGroup(of: [Product].self) { g in
                g.addTask { try await Product.products(for: ids) }
                g.addTask { try await Task.sleep(nanoseconds: lim); throw SupportProbeError.timeout }
                let first = try await g.next() ?? []
                g.cancelAll()
                return first
            }
        } catch {
            let msg = (error as? SupportProbeError) == .timeout ? "getProducts が 8秒たっても返事をしない" : error.localizedDescription
            out["error"] = .string("取得でエラー: " + msg)
            return .object(out)
        }
        out["got"] = .array(found.map { .string($0.id) })
        if found.isEmpty {
            out["error"] = "商品が0件。App Store Connect 側が未完成か、製品IDがちがう。"
            return .object(out)
        }
        var tips: [JSONValue] = []
        for t in SupportCore.tips {
            guard let p = found.first(where: { $0.id == t.id }) else { continue }
            products[t.id] = p
            let price = SupportCore.priceText(raw: p.displayPrice, currencyCode: p.priceFormatStyle.currencyCode, yen: t.yen)
            tips.append(["id": .string(t.id), "yen": .number(Double(t.yen)), "label": .string(t.label), "price": .string(price)])
        }
        out["tips"] = tips.isEmpty ? .null : .array(tips)
        if tips.isEmpty { out["error"] = "取れた商品の識別子が、こちらの製品IDと一致しない。" }
        return .object(out)
    }

    /// 買う。返事待ちの間の二度押しは Engine が止める。やめたときは何も言わない
    func buy(_ id: String, _ model: AppModel) async {
        guard model.engine.buyTipBegin(id) else { return }
        guard let product = products[id] else {
            model.engine.buyTipEnd(id, ok: false, msg: "購入できませんでした。時間をおいて試してください。")
            return
        }
        do {
            // ここに待ち時間の上限はかけない（確認やパスワードの入力は、人が操作している時間）
            let result = try await product.purchase()
            switch result {
            case .success(let v):
                switch v {
                case .verified(let t):
                    await t.finish()
                    model.engine.buyTipEnd(id, ok: true, msg: "")
                case .unverified(let t, _):
                    await t.finish()
                    model.engine.buyTipEnd(id, ok: false, msg: "購入できませんでした。時間をおいて試してください。")
                }
            case .userCancelled:
                model.engine.buyTipEnd(id, ok: false, msg: "")
            case .pending:
                // 承認待ち（保護者の承認など）。通ったら Transaction.updates で届くので、そのとき記録する
                model.engine.buyTipEnd(id, ok: false, msg: "")
            @unknown default:
                model.engine.buyTipEnd(id, ok: false, msg: "")
            }
        } catch {
            model.engine.buyTipEnd(id, ok: false, msg: "購入できませんでした。時間をおいて試してください。")
        }
    }

    /// 版の字を 5 回叩くと診断（1.5 秒あくと数え直し）
    func tapVersion(_ model: AppModel) {
        verTaps += 1
        verTimer?.cancel()
        verTimer = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            if !Task.isCancelled { self?.verTaps = 0 }
        }
        if verTaps >= 5 { verTaps = 0; Task { await runProbe(model) } }
    }
    func runProbe(_ model: AppModel) async {
        model.engine.haptic("light")
        model.engine.setProbe(["running": true])
        var r = await probe().object ?? [:]
        r["widget"] = ["there": true, "last": Self.widgetJSON(model.widgetLast)]
        model.engine.setProbe(.object(r))
        if let tips = r["tips"]?.array, !tips.isEmpty { model.engine.setTips(tips) }
    }
    /// 診断から手で「ウィジェットに送る」
    func sendWidgetNow(_ model: AppModel) async {
        model.engine.haptic("light")
        model.sendWidgetNow()
        guard var p = model.state["probe"]?.object else { return }
        p["widget"] = ["there": true, "last": Self.widgetJSON(model.widgetLast)]
        model.engine.setProbe(.object(p))
    }
}

enum SupportProbeError: Error { case timeout }

extension AppModel {
    /// 「カードをシェア」：画面のカードと同じ見立てで 1080×681 の画像にして共有シートへ
    func shareSupporterCard() {
        engine.haptic("light")
        let v = engine.supportView()
        guard v.supporterShown else { return }
        let r = ImageRenderer(content: SupporterCardDraw(owner: v.cardOwner, since: v.cardSince, total: v.cardTotal, times: v.cardTimes, tier: v.tier))
        r.scale = 1
        guard let png = r.uiImage?.pngData() else { engine.toast("カードを作れませんでした"); return }
        SettingsFileShare.shareFile(name: "LUKKO-サポーターカード.png", data: png, done: nil)
    }
}
