import SwiftUI
import LukkoKit

/// ベルのお知らせ（Web 版の screen='notices'）。押したお知らせは、画面の中ほどに開いて全文を見せる
struct NoticesScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let all = model.state["notices"]?.array ?? []
        let notices = NoticesCore.sortNotices(all)
        let now = AppModel.nowMs()
        let unread = NoticesCore.unreadCount(all)
        let open = all.first { $0["id"] == model.state["noticeOpen"] && JS.truthy(model.state["noticeOpen"]) }
        return ScrollView {
            LazyVStack(spacing: 7) {
                if notices.isEmpty {
                    Text("お知らせはまだありません。").font(.system(size: 14)).foregroundStyle(ink("ink-faint"))
                        .frame(maxWidth: .infinity).padding(.horizontal, 24).padding(.vertical, 64)
                }
                ForEach(Array(notices.enumerated()), id: \.offset) { _, n in
                    row(n, now: now)
                }
            }
            .padding(.horizontal, 16).padding(.top, 8).padding(.bottom, 40)
        }
        .background(ink("bg"))
        .navigationTitle("お知らせ")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            // 未読があるときだけ出す
            if unread > 0 {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("すべて既読") { model.act { $0.markAllRead() } }
                        .font(.system(size: 13)).foregroundStyle(ink("ink-mut"))
                }
            }
        }
        .overlay {
            if let open { NoticeCard(n: open, now: now).transition(.opacity) }
        }
        .animation(.easeOut(duration: 0.2), value: JS.string(model.state["noticeOpen"]))
    }

    private func row(_ n: JSONValue, now: Double) -> some View {
        let cur = NoticesCore.currentNoteText(n) ?? n
        let isUnread = !JS.truthy(n["read"])
        return Button { model.act { $0.openNotice(n["id"]) } } label: {
            HStack(spacing: 10) {
                Circle().fill(isUnread ? FormTone.teal : Color.clear).frame(width: 7, height: 7)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        NoticeKindTag(n: n)
                        Text(NoticesCore.relativeTime(JS.number(n["at"]), now: now, tz: .current)).font(.system(size: 10)).foregroundStyle(ink("ink-faint"))
                    }
                    Text(JS.string(cur["title"])).font(.system(size: 14, weight: isUnread ? .bold : .medium)).foregroundStyle(ink("ink")).lineLimit(1)
                }
                Spacer(minLength: 0)
                Text("›").font(.system(size: 15)).foregroundStyle(ink("ink-faint"))
            }
            .padding(.horizontal, 13).padding(.vertical, 11)
            .background(ink("card"), in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(ink("line")))
            .opacity(isUnread ? 1 : 0.7)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// シフトの記録（緑）／アップデート（灰）の札
struct NoticeKindTag: View {
    let n: JSONValue
    @Environment(\.ink) private var ink
    var body: some View {
        let shift = n["kind"] == "shift"
        Text(shift ? "シフトの記録" : "アップデート").font(.system(size: 10, weight: .bold)).tracking(0.2)
            .padding(.horizontal, 7).padding(.vertical, 2)
            .foregroundStyle(shift ? FormTone.deep : ink("ink-mut"))
            .background(shift ? FormTone.teal.opacity(0.13) : ink("bg2"), in: RoundedRectangle(cornerRadius: 6))
    }
}

/// 押したお知らせの全文（中ほどに出す。外側を押しても閉じる）
struct NoticeCard: View {
    let n: JSONValue, now: Double
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @State var shown = false

    var body: some View {
        let cur = NoticesCore.currentNoteText(n) ?? n
        let p = JSDate.local(JSDate.ms(n["at"]), .current)
        let lines = JS.string(cur["body"]).components(separatedBy: "\n").filter { !$0.isEmpty }
        ZStack {
            Color(red: 20 / 255, green: 20 / 255, blue: 22 / 255).opacity(0.42).ignoresSafeArea()
                .onTapGesture { close() }
            // 短ければそのまま、長ければ中で流す
            ViewThatFits(in: .vertical) {
                content(cur, p, lines)
                ScrollView { content(cur, p, lines) }
            }
            .frame(maxWidth: 400)
            .background(ink("card"), in: RoundedRectangle(cornerRadius: 18))
            .shadow(color: .black.opacity(0.35), radius: 30, y: 24)
            .padding(16)
            .scaleEffect(shown ? 1 : 0.92)
            .opacity(shown ? 1 : 0)
        }
        .onAppear { withAnimation(.spring(response: 0.28, dampingFraction: 0.82)) { shown = true } }
        .accessibilityAddTraits(.isModal)
    }

    @ViewBuilder private func content(_ cur: JSONValue, _ p: JSDate.Parts, _ lines: [String]) -> some View {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 8) {
                        NoticeKindTag(n: n)
                        Text(verbatim: "\(p.y)年\(p.m + 1)月\(p.d)日").font(.system(size: 11)).monospacedDigit().foregroundStyle(ink("ink-faint"))
                        Spacer()
                        Text(NoticesCore.relativeTime(JS.number(n["at"]), now: now, tz: .current)).font(.system(size: 11)).foregroundStyle(ink("ink-faint"))
                    }
                    .padding(.bottom, 12)
                    Text(JS.string(cur["title"])).font(.system(size: 16)).lineSpacing(4).foregroundStyle(ink("ink"))
                    VStack(alignment: .leading, spacing: 7) {
                        ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                            // 「・」で始まる行は箇条書き。点の後ろで字がそろうように、点を左に出す
                            if line.hasPrefix("・") {
                                HStack(alignment: .firstTextBaseline, spacing: 8) {
                                    Text("・").foregroundStyle(ink("ink-faint"))
                                    Text(String(line.dropFirst())).foregroundStyle(ink("ink-soft")).fixedSize(horizontal: false, vertical: true)
                                }
                                .font(.system(size: 14)).lineSpacing(3)
                            } else {
                                Text(line).font(.system(size: 14)).lineSpacing(4).foregroundStyle(ink("ink-soft")).fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                    .padding(.top, 12)
                    HStack(spacing: 8) {
                        Button { close() } label: {
                            Text("閉じる").font(.system(size: 14.5)).foregroundStyle(ink("ink-soft")).frame(maxWidth: .infinity).padding(13)
                                .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 14))
                        }
                        .buttonStyle(.plain)
                        if n["kind"] == "shift" {
                            Button { record() } label: {
                                Text("実働を記録する").font(.system(size: 14.5, weight: .bold)).foregroundStyle(.white).frame(maxWidth: .infinity).padding(13)
                                    .background(FormTone.teal, in: RoundedRectangle(cornerRadius: 14))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.top, 20)
                }
                .padding(.horizontal, 18).padding(.vertical, 20)
    }

    private func close() { model.act { $0.set(["noticeOpen": .null]) } }

    /// シフトの知らせから、その場で実働を記録しにいく（戻り先はお知らせ）
    private func record() {
        let ev = (model.state["events"]?.array ?? []).compactMap { $0.object }.first { JS.string($0["id"]) == JS.string(n["eventId"]) }
        model.act { e in
            e.set(["noticeOpen": .null])
            if let ev { e.openDialog(ev, "worked", "notices") }
        }
    }
}
