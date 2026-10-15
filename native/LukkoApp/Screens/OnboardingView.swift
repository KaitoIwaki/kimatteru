import SwiftUI
import LukkoKit

/// はじめての案内（Web 版の onboarding。view.jsx 2185-2390）。5 枚：使い方を選ぶ → 決まった／まだ → 空き → 送る → 取り込み。
///
/// 見出しは一字ずつ、薄い墨から本来の濃さへ沈み込むように現れる（inkRise）。紙や予定は下から静かに置かれる（obLift）。
/// 遅れはページを開いた時刻からの経過で決める（Web 版の CSS の animation-delay と同じ値）。中身を押すと演出を飛ばして全部出す
struct OnboardingView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @State private var pageStart = Date()
    @State private var fastAt: Date?
    @State private var settled = false
    @State private var settleCount = 0

    var body: some View {
        _ = model.state["onboard"]
        let v = model.engine.onboardView(sysDark: model.sysDark)
        let canImport = model.engine.phone != nil
        return VStack(spacing: 0) {
            HStack {
                Button { model.act { $0.onboardBack() } } label: { Text("←").font(.system(size: 17)).foregroundStyle(ink("ink-mut")).padding(.vertical, 6).padding(.trailing, 12) }
                    .buttonStyle(.plain).opacity(v.step == 0 ? 0 : 1).disabled(v.step == 0)
                    .accessibilityLabel("戻る")
                Spacer()
                Button { model.act { $0.finishOnboard(false) } } label: { Text("スキップ").font(.system(size: 14)).foregroundStyle(ink("ink-faint")).padding(.vertical, 6) }
                    .buttonStyle(.plain)
            }
            .padding(.horizontal, 18).padding(.top, 4)

            ScrollView {
                // 経過で動かす（出そろったら止める。点線が息をしているあいだは動かし続ける）
                TimelineView(.animation(minimumInterval: nil, paused: settled && !(v.step == 1 && !v.filled && !v.asking))) { ctx in
                    let clock = ObClock(t: ctx.date.timeIntervalSince(pageStart), fastT: fastAt.map { ctx.date.timeIntervalSince($0) })
                    VStack(alignment: .leading, spacing: 0) { page(v, clock) }
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 26).padding(.top, 12).padding(.bottom, 20)
                .contentShape(Rectangle())
                .onTapGesture { model.act { $0.onboardFast() } }
            }
            .id(v.step)

            VStack(spacing: 0) {
                HStack(spacing: 6) {
                    ForEach(0..<5, id: \.self) { i in
                        Capsule().fill(i == v.step ? ink("ink") : ink("line")).frame(width: i == v.step ? 18 : 6, height: 6)
                    }
                }
                .animation(.timingCurve(0.2, 0.9, 0.2, 1, duration: 0.3), value: v.step)
                .padding(.top, 20).padding(.bottom, 16)
                .accessibilityHidden(true)
                bottomButtons(v, canImport)
            }
            .padding(.horizontal, 26).padding(.bottom, 12)
        }
        .background(ink("bg").ignoresSafeArea())
        .onChange(of: v.step) { _, _ in restartPage() }
        .onChange(of: v.fast) { _, f in if f && fastAt == nil { fastAt = Date() } }
        .onChange(of: v.done) { _, d in if d { settleCount += 1 } }
        .onAppear { restartPage() }
    }

    private func restartPage() {
        pageStart = Date(); fastAt = nil; settled = false
        let step = model.engine.onboardView().step
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.6) {
            if model.engine.onboardView().step == step { settled = true }
        }
    }

    // MARK: 下のボタン
    @ViewBuilder private func bottomButtons(_ v: OnboardView, _ canImport: Bool) -> some View {
        switch v.step {
        case 1:
            // 押さなくても進める。押してあれば黒、まだなら控えめな地
            ObButton(label: "つぎへ", dark: v.nextDark, bold: false) { model.act { $0.onboardNext() } }
                .animation(.timingCurve(0.2, 0.9, 0.2, 1, duration: 0.3), value: v.nextDark)
        case 2, 3:
            ObButton(label: "つぎへ", dark: true) { model.act { $0.onboardNext() } }
        case 4:
            VStack(spacing: 9) {
                if canImport { ObButton(label: "カレンダーから取り込む", dark: true) { startImport() } }
                ObButton(label: canImport ? "空のまま はじめる" : "はじめる", dark: !canImport, outlined: canImport) { model.act { $0.finishOnboard(false) } }
            }
        default:
            EmptyView()
        }
    }

    /// 取り込みへ。案内（全画面）を閉じきってから取り込みのシートを出す（2 枚を同時には動かせない）
    private func startImport() {
        model.act { e in e.finishOnboard(true); e.set(["screen": "month"]) }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) {
            model.act { $0.set(["screen": "import"]) }
            Task { await model.engine.askImportNow() }
        }
    }

    // MARK: 中身
    @ViewBuilder private func page(_ v: OnboardView, _ k: ObClock) -> some View {
        switch v.step {
        case 0:
            ObTitle(text: "ふだんの予定に", start: 0.15, step: 0.05, clock: k).padding(.top, 24)
            ObTitle(text: "近いのは？", start: 0.55, step: 0.05, clock: k)
            VStack(spacing: 9) {
                ForEach(Array(v.profiles.enumerated()), id: \.offset) { i, p in
                    Button { model.act { $0.onboardPick(.string(p.key)) } } label: {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(p.label).font(.system(size: 16)).foregroundStyle(ink("ink"))
                            Text(p.note).font(.system(size: 12)).foregroundStyle(ink("ink-mut"))
                        }
                        .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 16).padding(.vertical, 15)
                        .background(ink("card"), in: RoundedRectangle(cornerRadius: 15))
                        .overlay(RoundedRectangle(cornerRadius: 15).strokeBorder(p.sel ? ink("ink") : ink("line")))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .modifier(ObLift(p: k.p(1.0 + Double(i) * 0.07, 0.45)))
                }
            }
            .padding(.top, 26)
            Text("予定の種類や呼び方がこれに合わせて決まります。あとから設定の「使い方」で変えられます。")
                .font(.system(size: 12)).lineSpacing(5).foregroundStyle(ink("ink-faint")).padding(.top, 14)
        case 1:
            ObTitle(text: "決まった予定も、", start: 0.15, step: 0.06, clock: k).padding(.top, 24)
            ObTitle(text: "まだの予定も。", start: 0.62, step: 0.05, clock: k)
            demoPaper(v, k)
                .padding(.top, 34)
                .modifier(ObLift(p: k.p(1.7, 0.6)))
            Text("決まっている予定は塗り、まだ分からない予定は点線です。")
                .font(.system(size: 13)).lineSpacing(8).foregroundStyle(ink("ink-soft")).padding(.top, 16)
                .modifier(ObCap(p: k.p(2.4, 0.45)))
        case 2:
            ObTitle(text: "空いてる日が、", start: 0.1, step: 0.06, clock: k).padding(.top, 24)
            ObTitle(text: "ひと目でわかる。", start: 0.55, step: 0.05, clock: k)
            VStack(spacing: 0) {
                ForEach(Array(ObSample.free.enumerated()), id: \.offset) { i, r in
                    HStack(spacing: 13) {
                        VStack(spacing: 0) {
                            Text(r.dow).font(.system(size: 9)).foregroundStyle(ink("ink-faint"))
                            Text(r.day).font(.system(size: 16)).monospacedDigit().foregroundStyle(ink("ink"))
                        }
                        .frame(width: 26)
                        Text(r.note).font(.system(size: 12.5)).foregroundStyle(ink("ink-soft"))
                        Spacer(minLength: 0)
                        Text(r.mark).font(.system(size: 19)).foregroundStyle(Palette.hex(r.color))
                    }
                    .padding(.vertical, 11)
                    .overlay(alignment: .top) { if i > 0 { Rectangle().fill(ink("line")).frame(height: 1) } }
                    .modifier(ObLift(p: k.p(1.75 + Double(i) * 0.15, 0.5)))
                }
            }
            .padding(.horizontal, 16).padding(.top, 6).padding(.bottom, 10)
            .background(ink("card"), in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(ink("line")))
            .padding(.top, 30)
            .modifier(ObLift(p: k.p(1.5, 0.6)))
            Text("予定を入れておくだけで、その日が空いているかどうかが出ます。")
                .font(.system(size: 13)).lineSpacing(8).foregroundStyle(ink("ink-soft")).padding(.top, 16)
                .modifier(ObCap(p: k.p(2.3, 0.45)))
        case 3:
            ObTitle(text: "予定は見せずに、", start: 0.1, step: 0.06, clock: k).padding(.top, 24)
            ObTitle(text: "空きだけ送れる。", start: 0.55, step: 0.05, clock: k)
            shareCard(k)
                .padding(.top, 30)
                .modifier(ObLift(p: k.p(1.5, 0.6)))
            Text("カレンダーごと送ると、見せたくない予定まで写ってしまいます。空いている日だけの画像を作れます。")
                .font(.system(size: 13)).lineSpacing(8).foregroundStyle(ink("ink-soft")).padding(.top, 16)
                .modifier(ObCap(p: k.p(2.5, 0.45)))
        default:
            ObTitle(text: "いまの予定を、", start: 0.1, step: 0.06, clock: k).padding(.top, 24)
            ObTitle(text: "持っていきますか？", start: 0.55, step: 0.05, clock: k)
            Text("iPhone のカレンダーから読み込めます。はじめから作り直さなくて済みます。")
                .font(.system(size: 14)).lineSpacing(9).foregroundStyle(ink("ink-soft")).padding(.top, 14)
                .modifier(ObCap(p: k.p(1.4, 0.5)))
            VStack(alignment: .leading, spacing: 4) {
                ForEach(["読むだけです。書き込みはしません", "入れるものは1件ずつ選べます", "あとから設定でもできます"], id: \.self) { t in
                    HStack(alignment: .firstTextBaseline, spacing: 6) { Text("・"); Text(t).frame(maxWidth: .infinity, alignment: .leading) }
                }
            }
            .font(.system(size: 12.5)).foregroundStyle(ink("ink-soft"))
            .padding(.horizontal, 18).padding(.vertical, 16)
            .background(ink("card"), in: RoundedRectangle(cornerRadius: 18))
            .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(ink("line")))
            .padding(.top, 24)
            .modifier(ObLift(p: k.p(1.65, 0.6)))
            // 会社の予定を入れても外に出ない、を最初に言っておく
            Text("アカウント登録は要りません。予定はこの iPhone の中だけにあり、どこにも送りません。")
                .font(.system(size: 12.5)).lineSpacing(6).foregroundStyle(ink("ink-soft")).padding(.top, 14)
                .modifier(ObCap(p: k.p(1.4, 0.5)))
            // 毎朝、今日の予定をまとめて知らせる。許可は、ここでオンにした人にだけ後で聞く
            Toggle(isOn: Binding(get: { v.morningOn }, set: { _ in model.act { $0.onboardToggleMorning() } })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("毎朝、今日の予定をお知らせ").font(.system(size: 14)).foregroundStyle(ink("ink"))
                    Text("7:30 に「今日3件（うち まだ1件）」のように届きます").font(.system(size: 11)).foregroundStyle(ink("ink-mut"))
                }
            }
            .tint(FormTone.teal)
            .padding(.horizontal, 16).padding(.vertical, 14)
            .background(ink("card"), in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(ink("line")))
            .padding(.top, 18)
        }
    }

    /// 1 枚目の紙：今日の日付・塗りの予定 1 本・点線の予定 1 本（押すと問いが出て、「確定した」で塗りになる）
    @ViewBuilder private func demoPaper(_ v: OnboardView, _ k: ObClock) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(v.dateText).font(.system(size: 11, weight: .semibold)).foregroundStyle(ink("ink-mut")).padding(.bottom, 10)
                .modifier(ObCap(p: k.p(1.85, 0.5)))
            Text(v.solidLabel).font(.system(size: 15)).foregroundStyle(ink.css(v.solidInk)).lineLimit(1)
                .padding(.horizontal, 12).frame(maxWidth: .infinity, minHeight: 34, maxHeight: 34, alignment: .leading)
                .background(ink.css(v.solidBg), in: RoundedRectangle(cornerRadius: 9))
                .overlay(RoundedRectangle(cornerRadius: 9).strokeBorder(ink.css(v.solidLine), lineWidth: 1.6))
                .padding(.bottom, 8)
                .modifier(ObLift(p: k.p(1.95, 0.55)))
            Button { model.act { $0.onboardDemoTap() } } label: {
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 9).fill(ink.css(v.dashBg))
                    // 左から塗りが走る（.3 秒）
                    Rectangle().fill(ink.css(v.fillBg))
                        .scaleEffect(x: v.filled ? 1 : 0, anchor: .leading)
                        .animation(v.filled ? .timingCurve(0.2, 0.9, 0.2, 1, duration: k.fastT != nil ? 0.12 : 0.3) : nil, value: v.filled)
                    Text(v.demoLabel).font(.system(size: 15)).foregroundStyle(ink.css(v.dashInk)).lineLimit(1).padding(.horizontal, 12)
                }
                .frame(maxWidth: .infinity, minHeight: 34, maxHeight: 34)
                .clipShape(RoundedRectangle(cornerRadius: 9))
                .overlay {
                    RoundedRectangle(cornerRadius: 9)
                        .strokeBorder(ink.css(v.dashLine), style: StrokeStyle(lineWidth: 1.6, dash: v.filled ? [] : [4, 3]))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(v.filled)
            .accessibilityIdentifier("onboard.demo")
            // 着地したら少し跳ねる
            .keyframeAnimator(initialValue: 1.0, trigger: settleCount) { c, s in c.scaleEffect(s) } keyframes: { _ in
                KeyframeTrack {
                    CubicKeyframe(1.04, duration: 0.11)
                    CubicKeyframe(1.0, duration: 0.13)
                }
            }
            // 押されるまでは、点線が静かに息をする（出そろってから）
            .scaleEffect(v.step == 1 && !v.filled && !v.asking ? k.breath(after: 2.9) : 1)
            .modifier(ObLift(p: k.p(2.1, 0.55)))
            // 本物と同じ：押すとこの問いが出て、「確定した」で塗りになる
            if v.asking {
                VStack(alignment: .leading, spacing: 0) {
                    Text(v.askHeading).font(.system(size: 13, weight: .bold)).foregroundStyle(ink("ink"))
                    Button { model.act { $0.onboardDemoConfirm() } } label: {
                        Text("確定した").font(.system(size: 14, weight: .bold)).foregroundStyle(.white)
                            .frame(maxWidth: .infinity).padding(.vertical, 11).padding(.horizontal, 14)
                            .background(FormTone.teal, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 11)
                }
                .padding(.horizontal, 13).padding(.top, 12).padding(.bottom, 13)
                .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 13))
                .padding(.top, 12)
                .transition(.opacity.combined(with: .offset(y: 8)))
            }
            Text(v.caption).font(.system(size: 13)).lineSpacing(5).foregroundStyle(v.captionGreen ? FormTone.deep : ink("ink")).padding(.top, 14)
            if v.done {
                Button { model.act { $0.onboardResetDemo() } } label: { Text("もう一度みる").font(.system(size: 12)).foregroundStyle(ink("ink-mut")) }
                    .buttonStyle(.plain).padding(.top, 8)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ink("card"), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(ink("line")))
        .animation(.timingCurve(0.2, 0.9, 0.2, 1, duration: 0.28), value: v.asking)
    }

    /// 3 枚目：送られる画像そっくりの見本（日付は入っている。隠すのは予定の名前だけ）
    @ViewBuilder private func shareCard(_ k: ObClock) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("わたしの空いてる日").font(.system(size: 12, weight: .bold)).foregroundStyle(Palette.hex("#D85A30")).padding(.bottom, 9)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 5), count: 7), spacing: 5) {
                ForEach(Array(["日", "月", "火", "水", "木", "金", "土"].enumerated()), id: \.offset) { i, d in
                    Text(d).font(.system(size: 9, weight: .semibold)).foregroundStyle(Palette.hex(i == 0 || i == 6 ? "#8C887C" : "#B0B4BB"))
                }
                ForEach(Array(ObSample.sharePattern.enumerated()), id: \.offset) { i, f in
                    Text("\(i + 1)").font(.system(size: 12, weight: f ? .bold : .regular)).monospacedDigit()
                        .foregroundStyle(Palette.hex(f ? "#712B13" : "#C1C5CC"))
                        .frame(maxWidth: .infinity).frame(height: 27)
                        .background(Palette.hex(f ? "#FAECE7" : "#EDEEF0"), in: RoundedRectangle(cornerRadius: 6))
                        .overlay { if f { RoundedRectangle(cornerRadius: 6).strokeBorder(Palette.hex("#D85A30"), lineWidth: 1.5) } }
                        .modifier(ObLift(p: k.p(1.7 + Double(i) * 0.022, 0.4)))
                }
            }
            HStack(spacing: 14) {
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 4).fill(Palette.hex("#FAECE7")).frame(width: 13, height: 13)
                        .overlay(RoundedRectangle(cornerRadius: 4).strokeBorder(Palette.hex("#D85A30"), lineWidth: 1.5))
                    Text("空いてる").font(.system(size: 11)).foregroundStyle(Palette.hex("#55524A"))
                }
                HStack(spacing: 6) {
                    RoundedRectangle(cornerRadius: 4).fill(Palette.hex("#EDEEF0")).frame(width: 13, height: 13)
                    Text("予定あり").font(.system(size: 11)).foregroundStyle(Palette.hex("#55524A"))
                }
            }
            .padding(.top, 13)
        }
        .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 18)
        .background(Palette.hex("#FFFDF8"), in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).strokeBorder(ink("line")))
        .environment(\.colorScheme, .light)
    }
}

/// 見本の中身
enum ObSample {
    static let free: [(day: String, dow: String, mark: String, color: String, note: String)] = [
        ("3", "月", "○", "#1D9E75", "まる1日あいてます"),
        ("4", "火", "△", "#B9770F", "17:00 以降なら空いてます"),
        ("5", "水", "×", "#C1C5CC", "ふさがっています"),
    ]
    static let sharePattern: [Bool] = [1, 0, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1].map { $0 == 1 }
}

/// ページを開いてからの経過（秒）。押して速送りにした時刻からの経過も持つ
struct ObClock {
    let t: Double
    let fastT: Double?
    /// その演出がどこまで進んだか（0〜1）。cubic-bezier(.2,.7,.25,1) に近い減速
    func p(_ delay: Double, _ dur: Double) -> Double {
        let x = min(1, max(0, (t - delay) / dur))
        var e = 1 - pow(1 - x, 3)
        if let f = fastT { e = max(e, min(1, max(0, f / 0.12))) }
        return e
    }
    /// 点線の息（2.6 秒で 1 → 1.022 → 1）
    func breath(after delay: Double) -> Double {
        guard t > delay else { return 1 }
        let ph = (t - delay).truncatingRemainder(dividingBy: 2.6) / 2.6
        return 1 + 0.022 * (1 - cos(2 * .pi * ph)) / 2
    }
}

/// 紙や予定が、下から静かに置かれる（obLift）
struct ObLift: ViewModifier {
    let p: Double
    func body(content: Content) -> some View {
        content.opacity(p).offset(y: 14 * (1 - p)).scaleEffect(0.988 + 0.012 * p)
    }
}

/// 一行が下から浮かぶ（capRise）
struct ObCap: ViewModifier {
    let p: Double
    func body(content: Content) -> some View { content.opacity(p).offset(y: 8 * (1 - p)) }
}

/// 見出し。一字ずつ、薄い墨から本来の濃さへ（inkRise）。明朝 27、折り返さない
struct ObTitle: View {
    let text: String, start: Double, step: Double
    let clock: ObClock
    @Environment(\.ink) private var ink
    var body: some View {
        let chars = Array(text)
        HStack(spacing: 0) {
            ForEach(Array(chars.enumerated()), id: \.offset) { i, ch in
                let p = clock.p(start + Double(i) * step, 0.5)
                ZStack {
                    Text(String(ch)).foregroundStyle(ink("ink-faint")).opacity(1 - p)
                    Text(String(ch)).foregroundStyle(ink("ink")).opacity(p)
                }
                .opacity(p)
                .offset(y: 9 * (1 - p))
            }
        }
        .font(.custom("HiraMinProN-W3", size: 27))
        .tracking(1.35)
        .lineLimit(1)
        .fixedSize()
        .frame(height: 27 * 1.6)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(text)
        .accessibilityAddTraits(.isHeader)
    }
}

/// 下の大きなボタン（つぎへ・取り込む・はじめる）
struct ObButton: View {
    let label: String
    var dark = true
    var bold = true
    var outlined = false
    let tap: () -> Void
    @Environment(\.ink) private var ink
    var body: some View {
        Button(action: tap) {
            Text(label).font(.system(size: 16, weight: bold ? .bold : .regular))
                .foregroundStyle(dark ? ink("card") : outlined ? ink("ink") : ink("ink-soft"))
                .frame(maxWidth: .infinity).padding(16)
                .background(dark ? ink("ink") : outlined ? ink("card") : ink("bg2"), in: RoundedRectangle(cornerRadius: 17))
                .overlay { if outlined { RoundedRectangle(cornerRadius: 17).strokeBorder(ink("line")) } }
        }
        .buttonStyle(.plain)
    }
}
