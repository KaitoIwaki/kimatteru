import Foundation

/// iPhone 標準の確認（アラート／アクションシート）。Web 版の _nativeAlertSpec の写し。
/// 画面（SwiftUI）は、これが nil でないあいだ本物の確認を出し、押されたボタンの run を Engine に渡す
public struct AlertSpec: Equatable {
    public struct Button: Equatable {
        public var label: String
        /// "default" / "destructive" / "cancel"
        public var style: String
        public var preferred: Bool = false
        /// 押したときの操作（Engine.runAlert に渡す）
        public var run: String
    }
    public var key: String
    public var title: String
    public var message: String?
    public var sheet: Bool = false
    public var buttons: [Button]
}

extension Engine {
    /// いま出す確認（無ければ nil）。順番も Web 版と同じ
    public func alertSpec() -> AlertSpec? {
        let st = state
        if JS.truthy(st["confirmDelete"]) {
            let id = st["confirmDelete"]
            let target = events.first { $0["id"] == id }
            let title = target.map { "「\(JS.string($0["title"]))」を削除しますか？" } ?? "削除しますか？"
            let body = target?["status"] == "jisseki"
                ? "働いた記録も一緒に消えます。30日間は、設定の「最近消した予定」から戻せます。"
                : "30日間は、設定の「最近消した予定」から戻せます。"
            var btns: [AlertSpec.Button] = [.init(label: "削除", style: "destructive", run: "delete")]
            if let target, JS.truthy(target["repId"]) {
                let rest = events.filter { $0["repId"] == target["repId"] && AppCore.evFrom($0) >= AppCore.evFrom(target) }.count
                if rest > 1 {
                    btns = [.init(label: "この予定だけ削除", style: "destructive", run: "deleteOne"),
                            .init(label: "この日から先も削除（\(rest)件）", style: "destructive", run: "deleteRest")]
                }
            }
            return AlertSpec(key: "del:" + JS.string(id), title: title, message: body, buttons: btns + [.init(label: "キャンセル", style: "cancel", run: "cancelDelete")])
        }
        if let r = st["confirmRestore"], JS.truthy(r) {
            let count = JS.string(r["count"])
            var body = JS.truthy(r["merge"])
                ? "控えの\(count)件のうち、いま入っていない予定だけを足します。同じ予定は新しいほうを残します。"
                : "いま入っている\(events.count)件は、控えの\(count)件に置き換わります。"
            if JS.truthy(r["at"]) {
                let p = JSDate.parseISO(JS.string(r["at"])).map { JSDate.local($0, timeZone) }
                body += p.map { "（控えは \($0.y)年\($0.m + 1)月\($0.d)日 のもの）" } ?? "（控えは NaN年NaN月NaN日 のもの）"
            }
            if JS.truthy(r["dropped"]) { body += " 読めない予定が\(JS.string(r["dropped"]))件あり、それは戻せません。" }
            if !events.isEmpty { body += " 戻す前のいまの状態は、控えとして端末に残します。" }
            let btns: [AlertSpec.Button] = events.isEmpty
                ? [.init(label: "戻す", style: "destructive", run: "restore")]
                : [.init(label: "置き換えて戻す", style: "destructive", run: "restoreReplace"), .init(label: "足りない予定だけ足す", style: "default", run: "restoreMerge")]
            return AlertSpec(key: "restore:" + (JS.truthy(r["at"]) ? JS.string(r["at"]) : "") + ":" + count, title: "控えから戻しますか？", message: body,
                             buttons: btns + [.init(label: "キャンセル", style: "cancel", run: "cancelRestore")])
        }
        if let ca = st["candAsk"], JS.truthy(ca) {
            let n = ca["ids"]?.array?.count ?? 0
            return AlertSpec(key: "cand:" + JS.string(ca["title"]), title: "「\(JS.string(ca["title"]))」が決まりました",
                             message: "同じ予定の、ほかの候補が\(n)件あります。片づけると「無くなった」になります（あとから戻せます）。",
                             buttons: [.init(label: "ほかの候補\(n)件を片づける", style: "default", preferred: true, run: "candYes"), .init(label: "残しておく", style: "cancel", run: "candNo")])
        }
        if JS.truthy(st["confirmJob"]) {
            let jid = st["confirmJob"]
            let j = jobsList.first { $0["id"] == jid }
            let n = events.filter { $0["jobId"] == jid && $0["status"] == "jisseki" }.count
            let name = j.map { JS.truthy($0["name"]) ? JS.string($0["name"]) : "この" + wordJob() } ?? ""
            return AlertSpec(key: "job:" + JS.string(jid), title: "\(name)を消しますか？",
                             message: n > 0 ? "・働いた記録\(n)件と金額は残ります\n・やめただけなら「辞めた」にすると、あとで戻せます" : "この勤務先を使っている予定はありません",
                             buttons: [.init(label: "消す", style: "destructive", run: "jobDelete"), .init(label: "キャンセル", style: "cancel", run: "jobCancel")])
        }
        if JS.truthy(st["discardAsk"]) && st["screen"] == "new" {
            return AlertSpec(key: "discard", title: "書きかけの予定を捨てますか？", message: "入れた内容は保存されません。",
                             buttons: [.init(label: "捨てる", style: "destructive", run: "discardYes"), .init(label: "書きつづける", style: "cancel", run: "discardNo")])
        }
        if let ra = st["repEditAsk"], JS.truthy(ra), st["screen"] == "new" {
            return AlertSpec(key: "repedit", title: "くり返しの予定です", message: "どこまで変えますか？",
                             buttons: [.init(label: "この予定だけ", style: "default", run: "repOne"), .init(label: "これ以降すべて（ほか\(JS.string(ra["rest"]))件）", style: "default", run: "repRest"),
                                       .init(label: "キャンセル", style: "cancel", run: "repCancel")])
        }
        return nil
    }

    /// 確認のボタンが押された
    public func runAlert(_ run: String) {
        switch run {
        case "delete": doDelete()
        case "deleteOne": set(["deleteRest": false]); doDelete()
        case "deleteRest": set(["deleteRest": true]); doDelete()
        case "cancelDelete": set(["confirmDelete": .null, "deleteRest": false])
        case "restore": doRestore()
        case "restoreReplace":
            set(["confirmRestore": .object(Self.with(state["confirmRestore"]?.object ?? [:], ["merge": false]))]); doRestore()
        case "restoreMerge":
            set(["confirmRestore": .object(Self.with(state["confirmRestore"]?.object ?? [:], ["merge": true]))]); doRestore()
        case "cancelRestore": set(["confirmRestore": .null])
        case "candYes": settleCandidates(true)
        case "candNo": settleCandidates(false)
        case "jobDelete": removeJob(state["confirmJob"])
        case "jobCancel": set(["confirmJob": .null])
        case "discardYes": set(["discardAsk": false, "screen": state["returnTo"]])
        case "discardNo": set(["discardAsk": false])
        case "repOne": save("one")
        case "repRest": save("rest")
        case "repCancel": set(["repEditAsk": .null])
        default: break
        }
    }
}

extension JSDate {
    /// new Date("2026-01-02T03:04:05.000Z") の時刻（読めなければ nil）
    public static func parseISO(_ s: String) -> Double? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return (d.timeIntervalSince1970 * 1000).rounded() }
        f.formatOptions = [.withInternetDateTime]
        if let d = f.date(from: s) { return (d.timeIntervalSince1970 * 1000).rounded() }
        return nil
    }
}
