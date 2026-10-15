import SwiftUI
import UIKit
import LukkoKit

/// iPhone のカレンダー・.ics から取り込む（Web 版の screen='import'。view.jsx 2392-2571）。
/// 1 歩ずつ：選ぶ → 確かめる → 入れた。最初の画面は絵 1 枚と 2 行だけ（説明は要る人だけが開くたたみに）。
/// 入れたあとは、入れた数を大きく出す
struct ImportScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @Environment(\.openURL) private var openURL

    var body: some View {
        _ = model.state["imp"]
        let v = model.engine.importView(sysDark: model.sysDark)
        return ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if !v.tidy, let step = stepIndex(v) { ImportSteps(current: step).padding(.bottom, 18) }
                switch v.phase {
                case "done": doneBody(v)
                case "cals": calsBody(v)
                case "found": foundBody(v)
                default: startBody(v)
                }
            }
            .padding(.horizontal, 20).padding(.top, 14).padding(.bottom, 60)
            .animation(.timingCurve(0.2, 0.9, 0.2, 1, duration: 0.22), value: v.otherOpen)
            .animation(.timingCurve(0.2, 0.9, 0.2, 1, duration: 0.22), value: v.askOpen)
            .animation(.timingCurve(0.2, 0.9, 0.2, 1, duration: 0.22), value: v.bulkOpen)
        }
        .background(ink("bg"))
        .navigationTitle("予定の取り込み")
        .navigationBarTitleDisplayMode(.inline)
    }

    /// いまどの段か（選ぶ＝0・確かめる＝1・入れた＝2）。最初の画面では出さない
    private func stepIndex(_ v: ImportView) -> Int? {
        switch v.phase {
        case "cals": return 0
        case "found": return 1
        case "done": return 2
        default: return nil
        }
    }

    // MARK: 最初の画面（idle・scanning）
    @ViewBuilder private func startBody(_ v: ImportView) -> some View {
        Text("いま使っているカレンダーの予定を持ってくる").font(.system(size: 18, weight: .light)).tracking(-0.3).lineSpacing(6).foregroundStyle(ink("ink"))
            .padding(.bottom, 4)
        ImportPic().padding(.top, 18).padding(.bottom, 14)
        Text("iPhone のカレンダーから読んで、ここに並べます。").font(.system(size: 14)).lineSpacing(8).foregroundStyle(ink("ink"))
        if !v.error.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                Text(v.error).font(.system(size: 13)).lineSpacing(6).foregroundStyle(FormTone.red)
                if v.denied {
                    Button {
                        model.act { $0.haptic("light") }
                        model.retryImportOnReturn = true  // 戻ってきたら、許可を確かめて読み込みを続ける（AppModel.onReturn）
                        if let u = URL(string: UIApplication.openSettingsURLString) { openURL(u) }
                    } label: {
                        Text("設定アプリを開く").font(.system(size: 14.5, weight: .bold)).foregroundStyle(ink("ink")).frame(maxWidth: .infinity).padding(14)
                            .background(ink("card"), in: RoundedRectangle(cornerRadius: 17))
                            .overlay(RoundedRectangle(cornerRadius: 17).strokeBorder(ink("line")))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 18)
        }
        // この画面は、もう許可を聞かれた人にだけ出る。まだの人は、開いた時点で iPhone の許可の画面を出す（5.1.1(iv)）
        let scanning = v.phase == "scanning"
        ImportBigButton(label: scanning ? "読み込んでいます…" : "続ける", enabled: !scanning) { Task { await model.engine.runScan() } }
            .padding(.top, 22)
            .accessibilityIdentifier("import.scan")
        ImportQuietButton(label: "やめる") { model.act { $0.importBack() } }
        VStack(spacing: 10) {
            ImportFold(title: "次に iPhone が聞くこと", open: v.askOpen, toggle: { model.act { $0.toggleImportFold("ask") } }) {
                // 事実だけ。どちらを選べとは書かない（5.1.1(iv)）
                Text("「追加のみ」と「フルアクセス」の2つを聞かれます。このアプリが予定を読めるのは「フルアクセス」のときです。")
            }
            ImportOtherCal(v: v)
        }
        .padding(.top, 10)
    }

    // MARK: どのカレンダーを読むか（cals）
    @ViewBuilder private func calsBody(_ v: ImportView) -> some View {
        Text("どのカレンダーを読みますか？").font(.system(size: 18, weight: .light)).tracking(-0.3).foregroundStyle(ink("ink")).padding(.bottom, 6)
        Text("右の札を押すと、そのカレンダーの予定を入れる種類を決められます。選んだ内容は次も使います。")
            .font(.system(size: 13)).lineSpacing(7).foregroundStyle(ink("ink-mut")).padding(.bottom, 14)
        VStack(spacing: 0) {
            ForEach(Array(v.cals.enumerated()), id: \.offset) { i, c in
                HStack(spacing: 10) {
                    ImportCheck(on: c.on)
                    Circle().fill(ink.css(c.color)).frame(width: 9, height: 9)
                    Text(c.label).font(.system(size: 14)).foregroundStyle(ink("ink")).lineLimit(1)
                    Spacer(minLength: 4)
                    Button { model.act { $0.cycleImportCalType(c.id) } } label: {
                        Text(c.typeName).font(.system(size: 12)).lineLimit(1)
                            .foregroundStyle(ink.css(c.typeInk))
                            .padding(.horizontal, 10).padding(.vertical, 5)
                            .background(ink.css(c.typeBg), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
                .padding(.horizontal, 13).padding(.vertical, 12)
                .opacity(c.on ? 1 : 0.5)
                .contentShape(Rectangle())
                .onTapGesture { model.act { $0.toggleImportCal(c.id) } }
                .overlay(alignment: .top) { if i > 0 { Rectangle().fill(ink("line")).frame(height: 1) } }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(c.on ? [.isButton, .isSelected] : .isButton)
            }
        }
        .background(ink("card"), in: RoundedRectangle(cornerRadius: 17))
        .overlay(RoundedRectangle(cornerRadius: 17).strokeBorder(ink("line")))
        .padding(.bottom, 14)
        Text("いつからの予定を読むか").font(.system(size: 12)).foregroundStyle(ink("ink-mut")).padding(.horizontal, 4).padding(.bottom, 8)
        FlowLayout(spacing: 6) {
            ForEach(Array(v.rangeChips.enumerated()), id: \.offset) { _, c in
                FormChip(label: c.label, sel: c.sel, on: ink("ink"), onText: ink("card"), size: 12.5, padH: 12, padV: 7) { model.act { $0.setImportRange(c.key) } }
            }
        }
        .padding(.bottom, 18)
        ImportBigButton(label: "読み込む", enabled: v.calsOnCount > 0) { Task { await model.engine.runRead(nil) } }
            .accessibilityIdentifier("import.read")
        ImportQuietButton(label: "やめる") { model.act { $0.importBack() } }
    }

    // MARK: 見つかった予定（found）
    @ViewBuilder private func foundBody(_ v: ImportView) -> some View {
        Text(v.none ? "予定が見つかりませんでした" : "\(v.count)件の予定が見つかりました")
            .font(.system(size: 18, weight: .light)).tracking(-0.3).foregroundStyle(ink("ink")).padding(.bottom, 6)
            .accessibilityIdentifier("import.foundTitle")
        Text(foundNote(v)).font(.system(size: 13)).lineSpacing(7).foregroundStyle(ink("ink-mut")).padding(.bottom, 16)
        // 1 件も無かったときは、ここで手が止まる。ほかのカレンダーの案内を出す
        if v.none && !v.fromIcs { ImportOtherCal(v: v) }
        if !v.none {
            HStack {
                Text(v.tidy ? "押すと選べます" : "右の札を押すと、種類が変わります").font(.system(size: 12)).foregroundStyle(ink("ink-mut"))
                Spacer()
                Button(v.allOn ? "すべて外す" : "すべて選ぶ") { model.act { $0.setAllImport(!v.allOn) } }
                    .font(.system(size: 13)).foregroundStyle(ink("ink-mut")).buttonStyle(.plain)
            }
            .padding(.horizontal, 4).padding(.bottom, 8)
            LazyVStack(spacing: 0) {
                ForEach(Array(v.rows.enumerated()), id: \.offset) { _, r in
                    HStack(spacing: 10) {
                        ImportCheck(on: r.on)
                        VStack(alignment: .leading, spacing: 0) {
                            if !r.kindTag.isEmpty { Text(r.kindTag).font(.system(size: 10.5, weight: .bold)).foregroundStyle(FormTone.amber).padding(.bottom, 2) }
                            Text(r.when).font(.system(size: 11)).monospacedDigit().foregroundStyle(ink("ink-mut")).lineLimit(1)
                            Text(r.title).font(.system(size: 14)).foregroundStyle(ink("ink")).lineLimit(1).padding(.top, 2)
                            if !r.place.isEmpty { Text(r.place).font(.system(size: 11)).foregroundStyle(ink("ink-mut")).lineLimit(1) }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        if !v.tidy {
                            Button { model.act { $0.cycleImportRowType(r.key) } } label: {
                                Text(r.typeName).font(.system(size: 12, weight: .bold)).lineLimit(1)
                                    .foregroundStyle(ink.css(r.typeInk))
                                    .padding(.horizontal, 11).padding(.vertical, 5)
                                    .background(ink.css(r.typeBg), in: Capsule())
                                    .overlay(Capsule().strokeBorder(ink.css(r.typeLine)))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 13).padding(.vertical, 11)
                    .opacity(r.on ? 1 : 0.45)
                    .contentShape(Rectangle())
                    .onTapGesture { model.act { $0.toggleImportRow(r.key) } }
                    .overlay(alignment: .bottom) { Rectangle().fill(ink("line")).frame(height: 1) }
                }
            }
            .background(ink("card"), in: RoundedRectangle(cornerRadius: 17))
            .clipShape(RoundedRectangle(cornerRadius: 17))
            .overlay(RoundedRectangle(cornerRadius: 17).strokeBorder(ink("line")))
            .padding(.bottom, 14)
            if !v.tidy {
                ImportBigButton(label: "\(v.onCount)件を取り込む", enabled: v.onCount != "0") { model.act { $0.doImport() } }
                    .padding(.top, 8)
                    .accessibilityIdentifier("import.do")
            } else {
                // 整理：外すのが本筋（予定は残る）。消すのは下に小さく、赤で
                ImportBigButton(label: "\(v.onCount)件をまとめから外す", enabled: v.onCount != "0") { model.act { $0.tidySkip() } }
                    .padding(.top, 8)
                Text("予定はカレンダーに残ります").font(.system(size: 11)).foregroundStyle(ink("ink-faint")).frame(maxWidth: .infinity).padding(.top, 8)
                Button { model.act { $0.tidyDelete() } } label: {
                    Text("\(v.onCount)件をカレンダーから消す").font(.system(size: 14)).foregroundStyle(v.onCount == "0" ? ink("ink-faint") : FormTone.red)
                        .frame(maxWidth: .infinity).padding(12)
                }
                .buttonStyle(.plain).disabled(v.onCount == "0").padding(.top, 14)
            }
        }
        ImportQuietButton(label: "やめる") { model.act { $0.importBack() } }
        if !v.none && !v.tidy {
            ImportFold(title: "まとめて種類を変える", open: v.bulkOpen, toggle: { model.act { $0.toggleImportFold("bulk") } }) {
                VStack(alignment: .leading, spacing: 10) {
                    FlowLayout(spacing: 6) {
                        ForEach(Array(v.bulkChips.enumerated()), id: \.offset) { _, c in
                            FormChip(label: c.label, sel: false, on: ink("ink"), size: 12, padH: 12, padV: 6) { model.act { $0.setAllImportType(.string(c.key)) } }
                        }
                    }
                    Text("選んでいるものが、まとめてその種類になります。").font(.system(size: 12)).foregroundStyle(ink("ink-mut"))
                }
            }
            .padding(.top, 10)
        }
    }

    private func foundNote(_ v: ImportView) -> String {
        if v.tidy { return "取り込みで入った、終日の予定です。誕生日や祝日らしいものに印を付けてあります。" }
        if v.fromIcs { return v.none ? "このファイルに読める予定がありませんでした。" : "ファイルの中の予定です。もう入っているものは除いてあります。" }
        if v.none { return "iPhone のカレンダーに読める予定がありませんでした。" }
        return "1年先までの予定です。もう入っているものは除いてあります。前に取り込んだ予定が元で変わっていたら、「変わった」と出ます。"
    }

    // MARK: 入れた（done）
    @ViewBuilder private func doneBody(_ v: ImportView) -> some View {
        VStack(spacing: 0) {
            ImportDoneCheck()
            Text(v.tidied == "skip" ? "\(v.added)件をまとめから外しました" : v.tidied == "delete" ? "\(v.added)件を消しました" : "\(v.added)件を取り込みました")
                .font(.system(size: 17)).foregroundStyle(ink("ink")).padding(.top, 18)
                .accessibilityIdentifier("import.doneTitle")
            Text(v.tidied == "skip" ? "予定はカレンダーに残っています。時間には数えません。"
                 : v.tidied == "delete" ? "カレンダーから消えました。"
                 : (v.doneDashed.isEmpty ? "決まっている予定は塗りで置きました。まだ分からない予定は、タップして点線に変えられます。" : v.doneDashed))
                .font(.system(size: 13)).lineSpacing(8).multilineTextAlignment(.center).foregroundStyle(ink("ink-soft")).padding(.top, 8)
            if !v.doneDetail.isEmpty && v.tidied.isEmpty {
                Text(v.doneDetail).font(.system(size: 12)).lineSpacing(6).multilineTextAlignment(.center).foregroundStyle(ink("ink-mut")).padding(.top, 6)
            }
            // 取り込んだ瞬間に案内が消えるので、ここで新しい予定の入れ方を伝える
            if v.tidied.isEmpty {
                Text("新しい予定は、下の ＋ から入れられます。").font(.system(size: 13)).lineSpacing(8).foregroundStyle(ink("ink-soft"))
                    .frame(maxWidth: .infinity).padding(.horizontal, 16).padding(.vertical, 14)
                    .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 15))
                    .padding(.top, 20)
            }
            ImportBigButton(label: "カレンダーを見る", enabled: true, bold: true) { model.act { $0.importDone() } }
                .padding(.top, 28)
            if v.undoShown {
                ImportQuietButton(label: "取り込む前に戻す", size: 13) { model.act { $0.undoImport() } }.padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 10).padding(.vertical, 56)
    }
}

/// いまの段（選ぶ → 確かめる → 入れた）。言葉は 3 つだけ、あとは形で見せる
struct ImportSteps: View {
    let current: Int
    @Environment(\.ink) private var ink
    var body: some View {
        HStack(spacing: 6) {
            ForEach(Array(["選ぶ", "確かめる", "入れた"].enumerated()), id: \.offset) { i, t in
                if i > 0 { Rectangle().fill(i <= current ? FormTone.teal : ink("line")).frame(height: 1.5).frame(maxWidth: 28) }
                HStack(spacing: 5) {
                    ZStack {
                        Circle().fill(i < current ? FormTone.teal : i == current ? ink("ink") : ink("line")).frame(width: 16, height: 16)
                        if i < current { Image(systemName: "checkmark").font(.system(size: 8, weight: .heavy)).foregroundStyle(.white) }
                        else { Text("\(i + 1)").font(.system(size: 9, weight: .bold)).foregroundStyle(i == current ? ink("card") : ink("ink-mut")) }
                    }
                    Text(t).font(.system(size: 11, weight: i == current ? .bold : .regular)).foregroundStyle(i == current ? ink("ink") : ink("ink-mut"))
                }
            }
        }
        .frame(maxWidth: .infinity)
        .animation(.snappy(duration: 0.3), value: current)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(current + 1) / 3")
    }
}

/// 「iPhone のカレンダー → LUKKO、読むだけ」を 1 枚で言う絵（Web 版の ImportPic）
struct ImportPic: View {
    @Environment(\.ink) private var ink
    var body: some View {
        GeometryReader { g in
            let s = g.size.width / 300
            ZStack(alignment: .topLeading) {
                // iPhone のカレンダー
                ZStack(alignment: .top) {
                    RoundedRectangle(cornerRadius: 16 * s).fill(.white)
                    UnevenRoundedRectangle(topLeadingRadius: 16 * s, topTrailingRadius: 16 * s).fill(Palette.hex("#E5463C")).frame(height: 22 * s)
                    Text("16").font(.system(size: 30 * s, weight: .light)).foregroundStyle(Palette.hex("#1E2024")).padding(.top, 30 * s)
                }
                .frame(width: 76 * s, height: 76 * s)
                .overlay(RoundedRectangle(cornerRadius: 16 * s).strokeBorder(ink("line")))
                .offset(x: 20 * s, y: 20 * s)
                // 読むだけ →
                Text("読むだけ").font(.system(size: 11 * s)).foregroundStyle(ink("ink-mut"))
                    .frame(width: 80 * s).offset(x: 108 * s, y: 36 * s)
                Path { p in
                    p.move(to: CGPoint(x: 108 * s, y: 58 * s)); p.addLine(to: CGPoint(x: 186 * s, y: 58 * s))
                    p.move(to: CGPoint(x: 180 * s, y: 52 * s)); p.addLine(to: CGPoint(x: 188 * s, y: 58 * s)); p.addLine(to: CGPoint(x: 180 * s, y: 64 * s))
                }
                .stroke(ink("ink-mut"), style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
                // LUKKO（詰まった点と点線の輪）
                ZStack(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: 16 * s).fill(Palette.hex("#F2EEE6"))
                    RoundedRectangle(cornerRadius: 2.5 * s).fill(Palette.hex("#8CA3B8")).frame(width: 40 * s, height: 5 * s).offset(x: 18 * s, y: 14 * s)
                    ForEach(Array(ImportPic.marks.enumerated()), id: \.offset) { _, mk in
                        Group {
                            if mk.open { Circle().stroke(Palette.hex("#3A3D40"), style: StrokeStyle(lineWidth: 1.3, dash: [2, 1.8])) }
                            else { Circle().fill(Palette.hex("#3A3D40")) }
                        }
                        .frame(width: 9 * s, height: 9 * s)
                        .offset(x: (mk.x - 204 - 4.5) * s, y: (mk.y - 20 - 4.5) * s)
                    }
                }
                .frame(width: 76 * s, height: 76 * s)
                .overlay(RoundedRectangle(cornerRadius: 16 * s).strokeBorder(ink("line")))
                .offset(x: 204 * s, y: 20 * s)
            }
        }
        .aspectRatio(300 / 110, contentMode: .fit)
        .accessibilityHidden(true)
    }
    static let marks: [(x: CGFloat, y: CGFloat, open: Bool)] = [(228, 56, false), (242, 56, true), (256, 56, false), (228, 72, true), (242, 72, false), (256, 72, false)]
}

/// 開いたり閉じたりする小さな説明。要る人だけが開く（▶ が 90° 回り、中身が下から出る）
struct ImportFold<Content: View>: View {
    let title: String, open: Bool
    let toggle: () -> Void
    @ViewBuilder let content: Content
    @Environment(\.ink) private var ink
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: toggle) {
                HStack(spacing: 10) {
                    Text(title).font(.system(size: 13, weight: .bold)).foregroundStyle(ink("ink")).frame(maxWidth: .infinity, alignment: .leading)
                    Text("▶").font(.system(size: 12)).foregroundStyle(ink("ink-mut")).rotationEffect(.degrees(open ? 90 : 0))
                }
                .padding(.horizontal, 16).padding(.vertical, 13)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            if open {
                content
                    .font(.system(size: 12.5)).lineSpacing(7).foregroundStyle(ink("ink-soft"))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16).padding(.bottom, 16)
                    .transition(.opacity.combined(with: .offset(y: 14)))
            }
        }
        .background(ink("card"), in: RoundedRectangle(cornerRadius: 17))
        .clipShape(RoundedRectangle(cornerRadius: 17))
        .overlay(RoundedRectangle(cornerRadius: 17).strokeBorder(ink("line")))
    }
}

/// 「Outlook や Yahoo! の予定が出てこないときは」：iPhone の設定にアカウントを足す道（設定の中を直接は開けないので手順を書く）
struct ImportOtherCal: View {
    let v: ImportView
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        ImportFold(title: "Outlook や Yahoo! の予定が出てこないときは", open: v.otherOpen, toggle: { model.act { $0.toggleImportFold("other") } }) {
            VStack(alignment: .leading, spacing: 12) {
                Text("このアプリは、iPhone のカレンダーに入っている予定を読みます。Outlook、Microsoft 365、Yahoo!、会社や学校のカレンダーは、iPhone の設定にアカウントを足すと、ここに出てくるようになります。")
                VStack(alignment: .leading, spacing: 9) {
                    ForEach(Array(v.otherSteps.enumerated()), id: \.offset) { i, t in
                        HStack(alignment: .top, spacing: 9) {
                            Text("\(i + 1)").font(.system(size: 10.5, weight: .heavy)).foregroundStyle(ink("card"))
                                .frame(width: 17, height: 17).background(ink("ink-faint"), in: Circle()).padding(.top, 2)
                            Text(t).font(.system(size: 12)).lineSpacing(6).foregroundStyle(ink("ink-soft")).frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .padding(.horizontal, 14).padding(.vertical, 12)
                .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 13))
                Text("TimeTree や ジョルテ のように、アプリの中だけに予定を持っているものは、このやり方では出てきません。そのアプリから .ics で書き出したファイルなら、設定の「ファイルから取り込む」で入れられます。")
                    .font(.system(size: 11.5)).lineSpacing(6).foregroundStyle(ink("ink-faint"))
            }
        }
    }
}

/// 選んだ・外したのしるし（緑の ✓）
struct ImportCheck: View {
    let on: Bool
    @Environment(\.ink) private var ink
    var body: some View {
        Text(on ? "✓" : "").font(.system(size: 12, weight: .heavy)).foregroundStyle(.white)
            .frame(width: 20, height: 20)
            .background(on ? FormTone.teal : Color.clear, in: RoundedRectangle(cornerRadius: 7))
            .overlay(RoundedRectangle(cornerRadius: 7).strokeBorder(on ? FormTone.teal : ink("line"), lineWidth: 1.5))
    }
}

/// 入れたときの緑の ✓（弾んで出る）
struct ImportDoneCheck: View {
    @State private var shown = false
    var body: some View {
        Text("✓").font(.system(size: 28, weight: .heavy)).foregroundStyle(.white)
            .frame(width: 56, height: 56).background(FormTone.teal, in: Circle())
            .scaleEffect(shown ? 1 : 0.3).opacity(shown ? 1 : 0)
            .onAppear { withAnimation(.spring(response: 0.42, dampingFraction: 0.55)) { shown = true } }
    }
}

/// 黒い大きなボタン（押せないときは控えめな地）
struct ImportBigButton: View {
    let label: String, enabled: Bool
    var bold = false
    let tap: () -> Void
    @Environment(\.ink) private var ink
    var body: some View {
        Button(action: tap) {
            Text(label).font(.system(size: bold ? 14.5 : 15, weight: bold ? .bold : .regular))
                .foregroundStyle(enabled ? ink("card") : ink("ink-mut"))
                .frame(maxWidth: .infinity).padding(16)
                .background(enabled ? ink("ink") : ink("bg2"), in: RoundedRectangle(cornerRadius: 17))
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

/// 灰色の字だけのボタン（やめる・取り込む前に戻す）
struct ImportQuietButton: View {
    let label: String
    var size: CGFloat = 14
    let tap: () -> Void
    @Environment(\.ink) private var ink
    var body: some View {
        Button(action: tap) {
            Text(label).font(.system(size: size)).foregroundStyle(ink("ink-mut")).frame(maxWidth: .infinity).padding(14)
        }
        .buttonStyle(.plain)
    }
}
