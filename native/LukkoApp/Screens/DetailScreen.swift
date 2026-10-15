import SwiftUI
import UIKit
import LukkoKit

/// 予定の詳細（Web 版の screen='detail'）。
/// 見出しに題名は出さない（すぐ下のカードに大きく出ている）。右上の「···」は iPhone 標準のメニュー
struct DetailScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @Environment(\.openURL) private var openURL
    @State private var sending: DetailSharePayload?

    var body: some View {
        // state を読んでおく（Engine は見張られていないので、中身が変わったら描き直すため）
        _ = model.state["events"]
        let v = model.engine.detailView(sysDark: model.sysDark)
        return ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                card(v)
                if let label = v.primaryLabel {
                    Button { model.act { $0.runDetailPrimary(v.primaryAction) } } label: {
                        Text(label).font(.system(size: 15)).frame(maxWidth: .infinity).padding(15)
                            .foregroundStyle(ink.css(v.primaryColor))
                            .background(ink.css(v.primaryBg), in: RoundedRectangle(cornerRadius: 14))
                            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(ink.css(String(v.primaryBorder.split(separator: " ").last ?? ""))))
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 16)
                    .accessibilityIdentifier("detail.primary")
                }
                others(v)
                history(v)
            }
            .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 40)
        }
        .background(ink("bg"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    ForEach(v.menuRows, id: \.key) { r in
                        Button(role: r.red ? .destructive : nil) { tapMenu(r.key) } label: { Label(r.label, systemImage: icon(r.key)) }
                    }
                } label: {
                    Image(systemName: "ellipsis").font(.system(size: 17, weight: .semibold)).foregroundStyle(ink("ink-mut"))
                        .frame(width: 34, height: 34).contentShape(Rectangle())
                }
                .accessibilityLabel("この予定の操作")
            }
        }
        .sheet(item: $sending) { p in DetailShareSheet(payload: p).ignoresSafeArea() }
    }

    private func tapMenu(_ key: String) {
        if key == "send" {
            guard let ev = model.engine.detailEvent() else { return }
            let p = model.engine.sendEventPayload(ev)
            sending = DetailSharePayload(text: p.text, fileName: p.fileName, ics: p.ics)
            return
        }
        model.act { $0.runDetailMenu(key) }
    }

    private func icon(_ key: String) -> String {
        ["fix": "clock.arrow.circlepath", "edit": "pencil", "move": "calendar.badge.clock", "send": "square.and.arrow.up",
         "rep": "chart.bar", "copy": "doc.on.doc", "del": "trash"][key] ?? "circle"
    }

    @ViewBuilder private func card(_ v: DetailView) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Text(v.badgeChar).font(.system(size: 14, weight: .bold)).foregroundStyle(ink.css(v.badgeColor))
                    .frame(width: 26, height: 26)
                    .background(ink.css(v.badgeBg), in: Circle())
                    .overlay { if !v.badgeBorder.isEmpty { Circle().strokeBorder(ink.css(String(v.badgeBorder.split(separator: " ").last ?? "")), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])) } }
                    .animation(.snappy(duration: 0.3), value: v.badgeChar)
                Text(v.statusLabel).font(.system(size: 13)).foregroundStyle(ink.css(v.typeDark))
                if !v.candText.isEmpty {
                    Text(v.candText).font(.system(size: 11)).foregroundStyle(ink("ink-mut")).padding(.horizontal, 8).padding(.vertical, 2)
                        .overlay(Capsule().strokeBorder(ink("ink-faint"), style: StrokeStyle(lineWidth: 1, dash: [3, 2])))
                }
            }
            .padding(.bottom, 4)
            Text(v.title).font(.system(size: 21, weight: .light)).tracking(-0.3).foregroundStyle(ink("ink"))
                .padding(.top, 6).padding(.bottom, 2)
                .accessibilityIdentifier("detail.title")
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(v.dateText).font(.system(size: 14)).foregroundStyle(ink("ink-mut"))
                    if !v.holText.isEmpty { Text(v.holText).font(.system(size: 12)).foregroundStyle(ink("sun")) }
                }
                if !v.movedText.isEmpty { Text(v.movedText).font(.system(size: 12)).foregroundStyle(ink("ink-faint")) }
            }
            .padding(.bottom, 20)
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(v.timeText).font(.system(size: 14.5)).monospacedDigit().foregroundStyle(ink("ink"))
                if v.timeChanged { Text("→ 変更あり").font(.system(size: 12)).foregroundStyle(FormTone.changed) }
            }
            if !v.remindText.isEmpty {
                HStack(spacing: 5) {
                    Image(systemName: "bell")
                    Text(v.remindText)
                }
                .font(.system(size: 12)).foregroundStyle(ink("ink-mut")).padding(.top, 4)
            }
            if !v.wantText.isEmpty { Text(v.wantText).font(.system(size: 12)).foregroundStyle(ink("ink-mut")).padding(.top, 3) }
            if !v.place.isEmpty, let url = URL(string: v.placeHref) {
                Button { openURL(url) } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "mappin.and.ellipse").font(.system(size: 14)).foregroundStyle(ink("ink-mut"))
                        Text(v.place).font(.system(size: 14)).foregroundStyle(ink("ink")).lineLimit(1)
                        Spacer(minLength: 4)
                        Text("地図").font(.system(size: 11)).foregroundStyle(ink("ink-mut"))
                    }
                    .padding(.horizontal, 14).padding(.vertical, 13)
                    .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 13))
                }
                .buttonStyle(.plain)
                .padding(.top, 16)
            }
            if !v.link.isEmpty, let url = URL(string: v.link) {
                Button { openURL(url) } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "video")
                        Text(v.linkLabel)
                    }
                    .font(.system(size: 14.5, weight: .bold))
                    .frame(maxWidth: .infinity).padding(.vertical, 13).padding(.horizontal, 14)
                    .foregroundStyle(ink("card")).background(ink("ink"), in: RoundedRectangle(cornerRadius: 13))
                }
                .buttonStyle(.plain)
                .padding(.top, 14)
            }
            if !v.memo.isEmpty {
                Text(memoText(v.memoParts)).font(.system(size: 14)).lineSpacing(6).foregroundStyle(ink("ink-soft"))
                    .tint(Palette.hex("#3D6E9C"))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 14).padding(.vertical, 12)
                    .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 13))
                    .padding(.top, 10)
            }
            if v.wageShown {
                VStack(spacing: 0) {
                    Rectangle().fill(ink("line")).frame(height: 1).padding(.bottom, 18)
                    HStack(alignment: .firstTextBaseline) {
                        Text("実働時間").font(.system(size: 13)).foregroundStyle(ink("ink-mut"))
                        Spacer()
                        Text(v.workHours).font(.system(size: 14.5)).monospacedDigit().foregroundStyle(ink("ink"))
                    }
                    .padding(.bottom, 8)
                    if !v.breakText.isEmpty {
                        Text(v.breakText).font(.system(size: 11)).foregroundStyle(ink("ink-faint"))
                            .frame(maxWidth: .infinity, alignment: .trailing).padding(.top, -4).padding(.bottom, 10)
                    }
                    HStack(alignment: .firstTextBaseline) {
                        Text("給料").font(.system(size: 13)).foregroundStyle(ink("ink-mut"))
                        Spacer()
                        Text(v.wage).font(.system(size: 21, weight: .light)).tracking(-0.3).monospacedDigit().foregroundStyle(ink("ink"))
                    }
                }
                .padding(.top, 22)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .padding(.leading, 22).padding(.trailing, 20).padding(.top, 20).padding(.bottom, 22)
        .frame(maxWidth: .infinity, minHeight: 170, alignment: .topLeading)
        .background(ink("card"), in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(ink("line")))
        .animation(.snappy(duration: 0.32), value: v.wageShown)
    }

    /// メモの中の URL と電話番号を押せるように
    private func memoText(_ parts: [DetailView.Part]) -> AttributedString {
        var out = AttributedString()
        for p in parts {
            var a = AttributedString(p.t)
            if let h = p.href, let u = URL(string: h) { a.link = u; a.underlineStyle = .single; a.foregroundColor = Palette.hex("#3D6E9C") }
            out += a
        }
        return out
    }

    /// その日の、ほかの予定（月表示と同じピル。塗り＝決まった・点線＝まだ）
    @ViewBuilder private func others(_ v: DetailView) -> some View {
        Text(v.othersLabel).font(.system(size: 12)).foregroundStyle(ink("ink-mut")).padding(.horizontal, 2).padding(.top, 30).padding(.bottom, 8)
        VStack(alignment: .leading, spacing: 0) {
            if v.others.isEmpty {
                Text("この日は、これだけです").font(.system(size: 14)).foregroundStyle(ink("ink-mut")).frame(maxWidth: .infinity).padding(18)
            }
            ForEach(Array(v.others.enumerated()), id: \.offset) { i, o in
                Button {
                    if let ev = (model.state["events"]?.array ?? []).compactMap({ $0.object }).first(where: { $0["id"] == o.id }) {
                        model.act { $0.openFor(ev, $0.state["returnTo"]) }
                    }
                } label: {
                    HStack(spacing: 10) {
                        Text(o.when).font(.system(size: 12)).monospacedDigit().foregroundStyle(ink("ink-faint")).frame(width: 38, alignment: .leading)
                        Text(o.title).font(.system(size: 13)).lineLimit(1).padding(.horizontal, 9).frame(maxWidth: .infinity, minHeight: 24, alignment: .leading)
                            .foregroundStyle(ink.css(o.pill["color"]?.string))
                            .background(ink.css(o.pill["background"]?.string), in: RoundedRectangle(cornerRadius: 5))
                            .overlay { if let b = o.pill["border"]?.string { RoundedRectangle(cornerRadius: 5).strokeBorder(ink.css(String(b.split(separator: " ").last ?? "")), style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])) } }
                    }
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .contentShape(Rectangle())
                    .overlay(alignment: .top) { if i > 0 { Rectangle().fill(ink("line-faint")).frame(height: 1) } }
                }
                .buttonStyle(DetailPressStyle())
            }
            if v.othersRest > 0 {
                Text("ほか \(v.othersRest)件").font(.system(size: 12)).foregroundStyle(ink("ink-faint"))
                    .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(alignment: .top) { Rectangle().fill(ink("line-faint")).frame(height: 1) }
            }
        }
        .background(ink("card"), in: RoundedRectangle(cornerRadius: 14))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(ink("line")))
    }

    /// これまでの「◯◯」（同じ種類・同じ題名）
    @ViewBuilder private func history(_ v: DetailView) -> some View {
        Text(v.histLabel).font(.system(size: 12)).foregroundStyle(ink("ink-mut")).padding(.horizontal, 2).padding(.top, 26).padding(.bottom, 8)
        VStack(alignment: .leading, spacing: 0) {
            if let h = v.hist {
                HStack(spacing: 18) {
                    Text(h.year).foregroundStyle(ink("ink"))
                    Text(h.month).foregroundStyle(ink("ink-soft"))
                }
                .font(.system(size: 14.5))
                .padding(.horizontal, 16).padding(.top, 14).padding(.bottom, 12)
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text("前回").font(.system(size: 13)).foregroundStyle(ink("ink-mut"))
                    Text(h.prev).font(.system(size: 13)).foregroundStyle(ink("ink"))
                    Spacer()
                    Text(h.ago).font(.system(size: 12)).foregroundStyle(ink("ink-faint"))
                }
                .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 14)
                .overlay(alignment: .top) { Rectangle().fill(ink("line-faint")).frame(height: 1) }
            } else {
                Text("これが、はじめてです").font(.system(size: 14)).foregroundStyle(ink("ink-mut")).frame(maxWidth: .infinity).padding(18)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(ink("card"), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(ink("line")))
    }
}

/// 押している間だけ沈ませる（Web 版の var(--press)）
struct DetailPressStyle: ButtonStyle {
    @Environment(\.ink) private var ink
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.background(configuration.isPressed ? ink("press") : Color.clear)
    }
}

/// 「この予定を送る」の中身（文と、その 1 件の .ics）
struct DetailSharePayload: Identifiable {
    let id = UUID()
    let text: String, fileName: String, ics: String
}

/// iPhone の共有シート（文と .ics のファイルを一緒に渡す）
struct DetailShareSheet: UIViewControllerRepresentable {
    let payload: DetailSharePayload
    func makeUIViewController(context: Context) -> UIActivityViewController {
        var items: [Any] = [payload.text]
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("send", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(payload.fileName)
        if let data = payload.ics.data(using: .utf8), (try? data.write(to: url, options: .atomic)) != nil { items.append(url) }
        return UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}

/// 「どうなった？」の小窓（Web 版の中央の小窓 confirm／worked／move）。iPhone ではシートで出す（高さは中身に合わせる）
struct DialogSheet: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @State private var height: CGFloat = 480

    var body: some View {
        let alive = model.state["dialog"] != nil && model.state["dialog"] != .null
        let v = model.engine.dialogView()
        return ScrollView {
            VStack(spacing: 0) {
                if alive {
                    if v.moving { moveBody(v) } else { mainBody(v) }
                }
            }
            .padding(.horizontal, 20).padding(.top, 26).padding(.bottom, 18)
            .background(GeometryReader { g in Color.clear.preference(key: DialogHeightKey.self, value: g.size.height) })
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(ink("card"))
        .onPreferenceChange(DialogHeightKey.self) { h in if h > 0 { height = h } }
        .presentationDetents([.height(min(height + 8, 760)), .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(22)
    }

    /// 確定した・記録する・無くなった・別の日になった・まだ分からない
    @ViewBuilder func mainBody(_ v: DialogView) -> some View {
        Text(v.heading).font(.system(size: 17)).tracking(-0.3).multilineTextAlignment(.center).foregroundStyle(ink("ink"))
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier("dialog.heading")
        Text(v.sub).font(.system(size: 13)).foregroundStyle(ink("ink-mut")).padding(.top, 6).padding(.bottom, 18)
        VStack(spacing: 0) {
            DlgTimeRow(label: "開始", field: "start", value: v.start, open: v.startOpen, color: ink.css(v.openColor))
            DlgTimeRow(label: "終了", field: "end", value: v.end, open: v.endOpen, color: ink.css(v.openColor))
                .overlay(alignment: .top) { Rectangle().fill(ink("line")).frame(height: 1) }
        }
        .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 15))
        .clipShape(RoundedRectangle(cornerRadius: 15))
        .padding(.bottom, 6)
        // 休憩を引かないと、休憩が時給に入らない勤務先では金額が多めに出る。引いた結果の実働時間をその場に出す
        if v.breakShown {
            VStack(alignment: .leading, spacing: 9) {
                Text("休憩").font(.system(size: 13)).foregroundStyle(ink("ink"))
                FlowLayout(spacing: 6) {
                    ForEach(Array(v.breakChips.enumerated()), id: \.offset) { _, c in
                        FormChip(label: c.label, sel: c.sel, on: ink.css(v.typeColor), size: 13, padH: 12, padV: 7) { model.act { $0.dlgSetBreak(c.val) } }
                    }
                }
                Text(v.paidText).font(.system(size: 11)).monospacedDigit().foregroundStyle(ink("ink-mut")).padding(.top, 1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 14).padding(.top, 11).padding(.bottom, 13)
            .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 15))
            .padding(.top, 6)
        }
        Group {
            if v.changed {
                (Text(v.origText + " ").foregroundStyle(ink("ink-mut")) + Text("→ 変更あり").foregroundStyle(FormTone.changed)).font(.system(size: 12))
            } else { Text(" ").font(.system(size: 12)) }
        }
        .frame(height: 16).padding(.top, 6).padding(.bottom, 18)
        VStack(spacing: 9) {
            Button { model.act { $0.dlgPrimary() } } label: {
                Text(v.primaryLabel).font(.system(size: 15, weight: .bold)).foregroundStyle(.white).frame(maxWidth: .infinity).padding(15)
                    .background(ink.css(v.primaryBg), in: RoundedRectangle(cornerRadius: 15))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("dialog.primary")
            Button { model.act { $0.dlgNakunatta() } } label: {
                Text(v.goneLabel).font(.system(size: 15, weight: .semibold)).foregroundStyle(FormTone.red).frame(maxWidth: .infinity).padding(14)
                    .background(ink("card"), in: RoundedRectangle(cornerRadius: 15))
                    .overlay(RoundedRectangle(cornerRadius: 15).strokeBorder(Palette.hex("#EAD9D2")))
            }
            .buttonStyle(.plain)
            if v.moveShown {
                Button { model.act { $0.dlgStartMove() } } label: {
                    Text("別の日になった").font(.system(size: 14.5, weight: .semibold)).foregroundStyle(ink("ink")).frame(maxWidth: .infinity).padding(13)
                        .background(ink("card"), in: RoundedRectangle(cornerRadius: 15))
                        .overlay(RoundedRectangle(cornerRadius: 15).strokeBorder(ink("line")))
                }
                .buttonStyle(.plain)
            }
            Button { model.act { $0.dlgDismiss() } } label: {
                Text(v.maybeLabel).font(.system(size: 14.5)).foregroundStyle(ink("ink-mut")).frame(maxWidth: .infinity).padding(12)
            }
            .buttonStyle(.plain)
        }
        Rectangle().fill(ink("line")).frame(height: 1).padding(.top, 6)
        Button { edit() } label: {
            Text(v.editLabel).font(.system(size: 13)).foregroundStyle(ink("ink-faint")).padding(.vertical, 6).frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
        .padding(.top, 6)
    }

    /// 日えらび（別の日になった／日にちを変える）
    @ViewBuilder func moveBody(_ v: DialogView) -> some View {
        Text(v.moveTitle).font(.system(size: 17)).tracking(-0.3).foregroundStyle(ink("ink")).frame(maxWidth: .infinity)
        Text(v.sub).font(.system(size: 13)).foregroundStyle(ink("ink-mut")).padding(.top, 6).padding(.bottom, 12)
        HStack {
            Button { model.act { $0.dlgShiftMove(-1) } } label: { Text("‹").font(.system(size: 22)).frame(width: 34, height: 34) }
                .buttonStyle(.plain).foregroundStyle(ink("ink-mut")).accessibilityLabel("前の月")
            Spacer()
            Text(v.moveLabel).font(.system(size: 14, weight: .bold)).monospacedDigit()
            Spacer()
            Button { model.act { $0.dlgShiftMove(1) } } label: { Text("›").font(.system(size: 22)).frame(width: 34, height: 34) }
                .buttonStyle(.plain).foregroundStyle(ink("ink-mut")).accessibilityLabel("次の月")
        }
        .padding(.bottom, 6)
        FormGrid(count: v.moveWeekdays.count, columns: 7, hSpacing: 0, vSpacing: 0) { i in
            Text(v.moveWeekdays[i].label).font(.system(size: 10, weight: .semibold)).foregroundStyle(ink.css(v.moveWeekdays[i].color)).padding(.bottom, 2)
        }
        FormGrid(count: v.moveCells.count, columns: 7, hSpacing: 0, vSpacing: 2) { i in
            let c = v.moveCells[i]
            Group {
                if let d = c.day {
                    Text("\(d)").font(.system(size: 14, weight: c.weight >= 700 ? .bold : .medium)).monospacedDigit()
                        .strikethrough(c.orig)
                        .foregroundStyle(ink.css(c.color))
                        .frame(maxWidth: .infinity).frame(height: 34)
                        .background(ink.css(c.bg), in: RoundedRectangle(cornerRadius: 11))
                        .contentShape(Rectangle())
                        // 元の日は押せない
                        .onTapGesture { if !c.orig { model.act { $0.dlgPickMoveDay(d) } } }
                        .accessibilityAddTraits(.isButton)
                        .accessibilityIdentifier("dialog.day.\(d)")
                } else { Color.clear.frame(height: 34) }
            }
        }
        Text(v.moveChosenText).font(.system(size: 12)).foregroundStyle(ink("ink-mut")).padding(.top, 10).padding(.bottom, 12)
        VStack(spacing: 8) {
            Button { model.act { $0.dlgMoveTo("kakutei") } } label: {
                Text("この日で決まった").font(.system(size: 14.5, weight: .bold)).frame(maxWidth: .infinity).padding(13)
                    .foregroundStyle(v.moveChosen ? ink("card") : ink("ink-faint"))
                    .background(v.moveChosen ? ink("ink") : ink("bg2"), in: RoundedRectangle(cornerRadius: 13))
            }
            .buttonStyle(.plain).disabled(!v.moveChosen)
            Button { model.act { $0.dlgMoveTo("mikakutei") } } label: {
                Text("この日に、まだ仮で置く").font(.system(size: 14)).frame(maxWidth: .infinity).padding(12)
                    .foregroundStyle(v.moveChosen ? ink("ink") : ink("ink-faint"))
                    .overlay(RoundedRectangle(cornerRadius: 13).strokeBorder(ink("line")))
            }
            .buttonStyle(.plain).disabled(!v.moveChosen)
            Button { model.act { $0.dlgMoveSomeday() } } label: {
                Text("日にちはまだ決めない（今月のどこか）").font(.system(size: 13)).foregroundStyle(ink("ink-mut")).frame(maxWidth: .infinity).padding(10)
            }
            .buttonStyle(.plain)
            Button { model.act { $0.dlgMoveBack() } } label: {
                Text("もどる").font(.system(size: 13)).foregroundStyle(ink("ink-faint")).frame(maxWidth: .infinity).padding(6)
            }
            .buttonStyle(.plain)
        }
    }

    /// 「予定の内容を直す」：小窓を閉じてから、編集のシートを開く（シートを 2 枚同時には動かせない）
    private func edit() {
        guard let id = model.state["dialog"]?["id"] else { return }
        let ret = model.state["returnTo"]
        model.act { $0.dlgDismiss() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
            guard let ev = (model.state["events"]?.array ?? []).compactMap({ $0.object }).first(where: { $0["id"] == id }) else { return }
            model.act { $0.openEdit(ev, ret) }
        }
    }
}

private struct DialogHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

/// 小窓の時刻の行（押すとドラム。高さ 150）
struct DlgTimeRow: View {
    let label: String, field: String, value: String, open: Bool, color: Color
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        VStack(spacing: 0) {
            Button { model.act { $0.dlgTapRow(field) } } label: {
                HStack {
                    Text(label).font(.system(size: 14)).foregroundStyle(ink("ink"))
                    Spacer()
                    Text(value).font(.system(size: 15, weight: open ? .bold : .semibold)).monospacedDigit().foregroundStyle(open ? color : ink("ink"))
                }
                .padding(.horizontal, 14).padding(.vertical, 13)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("dialog.time.\(field)")
            if open {
                TimeWheels(value: value, height: 150) { unit, idx in model.act { $0.dlgSetWheel(field, unit: unit, index: idx) } }
            }
        }
    }
}
