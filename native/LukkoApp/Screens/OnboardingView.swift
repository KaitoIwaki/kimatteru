import SwiftUI
import LukkoKit

/// はじめての案内（Web 版の onboarding）。5 枚：使い方を選ぶ → 決まった／まだ → 空き → 送る → 取り込み
struct OnboardingView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    static let demo = ["student": ["カフェバイト", "映画", "このシフト、どうなりました？"], "work": ["打ち合わせ", "定例", "この仮押さえ、どうなった？"],
                       "shift": ["希望休", "日勤", "この休み、通りましたか？"], "free": ["〇〇社 打ち合わせ", "納品", "この仮押さえ、どうなった？"],
                       "family": ["保育園の面談", "歯医者", "この予定、どうなりました？"]]
    static let notes = ["student": "授業・サークル・バイト", "work": "会議・打ち合わせ・出張", "shift": "看護・介護・販売・飲食など", "free": "案件・打ち合わせ・納期", "family": "保育園・学校行事・通院"]

    var body: some View {
        let ob = model.state["onboard"] ?? .null
        let step = JS.int(ob["step"])
        VStack(spacing: 0) {
            HStack {
                Button { model.act { $0.onboardBack() } } label: { Image(systemName: "chevron.left") }.opacity(step == 0 ? 0 : 1).disabled(step == 0)
                Spacer()
                Button("スキップ") { model.act { $0.finishOnboard(false) } }.foregroundStyle(.secondary)
            }
            .padding(.horizontal, 20).padding(.top, 8)
            ScrollView {
                VStack(alignment: .leading, spacing: 18) { page(step, ob) }
                    .padding(24).frame(maxWidth: .infinity, alignment: .leading)
                    .id(step)
                    .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .opacity))
            }
            HStack(spacing: 6) {
                ForEach(0..<5, id: \.self) { i in
                    Capsule().fill(i == step ? ink("ink") : ink("line")).frame(width: i == step ? 18 : 6, height: 6)
                }
            }
            .animation(.snappy, value: step)
            .padding(.bottom, 16)
        }
        .background(ink("bg").ignoresSafeArea())
        .animation(.snappy(duration: 0.3), value: step)
    }

    func title(_ s: String) -> some View { Text(s).font(.system(size: 27, weight: .regular, design: .serif)).fixedSize(horizontal: false, vertical: true) }
    func next(_ dark: Bool = true) -> some View {
        Button { model.act { $0.onboardNext() } } label: {
            Text("つぎへ").frame(maxWidth: .infinity).padding(16)
                .foregroundStyle(dark ? ink("card") : ink("ink"))
                .background(dark ? ink("ink") : ink("bg2"), in: RoundedRectangle(cornerRadius: 17))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder func page(_ step: Int, _ ob: JSONValue) -> some View {
        let picked = JS.truthy(ob["picked"]) ? JS.string(ob["picked"]) : model.core.profile()
        let demo = Self.demo[picked] ?? Self.demo["student"]!
        switch step {
        case 0:
            title("ふだんの予定に\n近いのは？")
            ForEach(Profile.keys, id: \.self) { k in
                Button { model.act { $0.onboardPick(.string(k)) } } label: {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(Profile.all[k]!.label).foregroundStyle(ink("ink"))
                        Text(Self.notes[k] ?? "").font(.footnote).foregroundStyle(ink("ink-mut"))
                    }
                    .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 16).padding(.vertical, 15)
                    .background(ink("card"), in: RoundedRectangle(cornerRadius: 15))
                    .overlay(RoundedRectangle(cornerRadius: 15).strokeBorder(ob["picked"] == .string(k) ? ink("ink") : ink("line")))
                }
                .buttonStyle(.plain)
            }
            Text("予定の種類や呼び方がこれに合わせて決まります。あとから設定の「使い方」で変えられます。").font(.footnote).foregroundStyle(.secondary)
        case 1:
            let d = JS.string(ob["demo"])
            let filled = d == "fill" || d == "done"
            let t = JSDate.local(AppModel.nowMs(), .current)
            title("決まった予定も、\nまだの予定も。")
            VStack(alignment: .leading, spacing: 10) {
                Text("\(t.m + 1)月\(t.d)日（\(["日", "月", "火", "水", "木", "金", "土"][Civil.weekday(t.y, t.m, t.d)])）").font(.footnote).foregroundStyle(.secondary)
                Text(demo[1]).padding(.horizontal, 12).padding(.vertical, 8).frame(maxWidth: .infinity, alignment: .leading)
                    .foregroundStyle(ink.css(model.core.inkOn("#D2916A", dark: model.dark)))
                    .background(ink.css(model.core.softFill("#D2916A", dark: model.dark)), in: RoundedRectangle(cornerRadius: 8))
                Button { model.act { $0.onboardDemoTap() } } label: {
                    Text(filled ? demo[0] : "？" + demo[0]).padding(.horizontal, 12).padding(.vertical, 8).frame(maxWidth: .infinity, alignment: .leading)
                        .foregroundStyle(ink.css(filled ? model.core.inkOn("#7FAE85", dark: model.dark) : model.core.inkDash("#7FAE85", dark: model.dark)))
                        .background(filled ? ink.css(model.core.softFill("#7FAE85", dark: model.dark)) : Color.clear, in: RoundedRectangle(cornerRadius: 8))
                        .overlay { if !filled { RoundedRectangle(cornerRadius: 8).strokeBorder(ink.css(model.core.softLine("#7FAE85", dark: model.dark)), style: StrokeStyle(lineWidth: 1.5, dash: [4, 3])) } }
                        .scaleEffect(d == "done" ? 1.04 : 1)
                        .animation(.spring(response: 0.3, dampingFraction: 0.5), value: d)
                }
                .buttonStyle(.plain)
                if d == "asking" {
                    Text(demo[2]).font(.subheadline)
                    Button("確定した") { model.act { $0.onboardDemoConfirm() } }.buttonStyle(.borderedProminent).tint(Color(red: 0x1D / 255, green: 0x9E / 255, blue: 0x75 / 255))
                }
            }
            .padding(16).background(ink("card"), in: RoundedRectangle(cornerRadius: 16))
            Text(filled ? "決まった、が形になりました。" : d == "asking" ? "押すと、この予定が塗りに変わります。" : "↑ 点線の予定をタップしてみてください")
                .font(.subheadline).foregroundStyle(filled ? Color(red: 0x0F / 255, green: 0x6E / 255, blue: 0x56 / 255) : ink("ink"))
            if d == "done" { Button("もう一度みる") { model.act { $0.onboardResetDemo() } }.font(.footnote) }
            Text("決まっている予定は塗り、まだ分からない予定は点線です。").font(.footnote).foregroundStyle(.secondary)
            next(d == "done")
        case 2:
            title("空いてる日が、\nひと目でわかる。")
            VStack(spacing: 0) {
                ForEach([("3", "月", "○", "まる1日あいてます"), ("4", "火", "△", "17:00 以降なら空いてます"), ("5", "水", "×", "ふさがっています")], id: \.0) { r in
                    HStack { Text(r.0).font(.title3).monospacedDigit(); Text(r.1).font(.caption).foregroundStyle(.secondary); Text(r.3).font(.subheadline); Spacer(); Text(r.2).font(.title3) }
                        .padding(12)
                }
            }
            .background(ink("card"), in: RoundedRectangle(cornerRadius: 16))
            next()
        case 3:
            title("予定は見せずに、\n空きだけ送れる。")
            Text("空いている日だけを、画像や文字で送れます。何の予定かは相手に伝わりません。").font(.subheadline).foregroundStyle(.secondary)
            next()
        default:
            title("いまの予定を、\n持っていきますか？")
            VStack(alignment: .leading, spacing: 6) {
                Text("・読むだけです。書き込みはしません"); Text("・入れるものは1件ずつ選べます"); Text("・あとから設定でもできます")
            }
            .font(.subheadline)
            Text("アカウント登録は要りません。予定はこの iPhone の中だけにあり、どこにも送りません。").font(.footnote).foregroundStyle(.secondary)
            Toggle(isOn: Binding(get: { JS.truthy(ob["morning"]) }, set: { _ in model.act { $0.onboardToggleMorning() } })) {
                VStack(alignment: .leading) { Text("毎朝、今日の予定をお知らせ"); Text("7:30 に「今日3件（うち まだ1件）」のように届きます").font(.caption).foregroundStyle(.secondary) }
            }
            Button { model.act { $0.finishOnboard(true) } } label: {
                Text("カレンダーから取り込む").frame(maxWidth: .infinity).padding(16).foregroundStyle(ink("card")).background(ink("ink"), in: RoundedRectangle(cornerRadius: 17))
            }
            .buttonStyle(.plain)
            Button { model.act { $0.finishOnboard(false) } } label: {
                Text("空のまま はじめる").frame(maxWidth: .infinity).padding(16).foregroundStyle(ink("ink")).background(ink("card"), in: RoundedRectangle(cornerRadius: 17))
                    .overlay(RoundedRectangle(cornerRadius: 17).strokeBorder(ink("line")))
            }
            .buttonStyle(.plain)
        }
    }
}
