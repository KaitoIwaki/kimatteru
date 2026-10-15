import SwiftUI
import LukkoKit

/// ベルのお知らせ（Web 版の screen='notices'）
struct NoticesScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let notices = NoticesCore.sortNotices(model.state["notices"]?.array ?? [])
        let now = AppModel.nowMs()
        List {
            if notices.isEmpty {
                Text("お知らせはありません").foregroundStyle(.secondary).frame(maxWidth: .infinity).listRowBackground(Color.clear)
            }
            ForEach(Array(notices.enumerated()), id: \.offset) { _, n in
                let cur = NoticesCore.currentNoteText(n) ?? n
                let shift = n["kind"] == "shift"
                Button { model.act { $0.openNotice(n["id"]) } } label: {
                    HStack(spacing: 10) {
                        Circle().fill(JS.truthy(n["read"]) ? Color.clear : Color(red: 0x1D / 255, green: 0x9E / 255, blue: 0x75 / 255)).frame(width: 7, height: 7)
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 6) {
                                Text(shift ? "シフトの記録" : "アップデート").font(.system(size: 10, weight: .bold))
                                    .padding(.horizontal, 7).padding(.vertical, 2)
                                    .foregroundStyle(shift ? Color(red: 0x0F / 255, green: 0x6E / 255, blue: 0x56 / 255) : ink("ink-mut"))
                                    .background(shift ? Color(red: 0x1D / 255, green: 0x9E / 255, blue: 0x75 / 255).opacity(0.13) : ink("bg2"), in: RoundedRectangle(cornerRadius: 6))
                                Text(NoticesCore.relativeTime(JS.number(n["at"]), now: now, tz: .current)).font(.caption).foregroundStyle(.secondary)
                            }
                            Text(JS.string(cur["title"])).foregroundStyle(.primary).lineLimit(2)
                        }
                    }
                }
            }
        }
        .navigationTitle("お知らせ")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if NoticesCore.unreadCount(notices) > 0 {
                ToolbarItem(placement: .topBarTrailing) { Button("すべて既読") { model.act { $0.markAllRead() } } }
            }
        }
        .sheet(isPresented: Binding(get: { JS.truthy(model.state["noticeOpen"]) }, set: { on in if !on { model.act { $0.set(["noticeOpen": .null]) } } })) {
            NoticeDetail().environment(\.ink, ink)
        }
    }
}

struct NoticeDetail: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        let open = (model.state["notices"]?.array ?? []).first { $0["id"] == model.state["noticeOpen"] }
        if let open {
            let cur = NoticesCore.currentNoteText(open) ?? open
            let p = JSDate.local(JSDate.ms(open["at"]), .current)
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("\(p.y)年\(p.m + 1)月\(p.d)日").font(.caption).foregroundStyle(.secondary)
                        Text(JS.string(cur["title"])).font(.title3.weight(.semibold))
                        ForEach(Array(JS.string(cur["body"]).components(separatedBy: "\n").filter { !$0.isEmpty }.enumerated()), id: \.offset) { _, line in
                            if line.hasPrefix("・") {
                                HStack(alignment: .firstTextBaseline, spacing: 6) { Text("•"); Text(String(line.dropFirst())) }
                            } else { Text(line) }
                        }
                        if open["kind"] == "shift" {
                            Button("実働を記録する") {
                                let ev = (model.state["events"]?.array ?? []).compactMap { $0.object }.first { JS.string($0["id"]) == JS.string(open["eventId"]) }
                                model.act { e in e.set(["noticeOpen": .null]); if let ev { e.openDialog(ev, "worked", "notices") } }
                            }
                            .buttonStyle(.borderedProminent).padding(.top, 8)
                        }
                    }
                    .padding(20).frame(maxWidth: .infinity, alignment: .leading)
                }
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("閉じる") { model.act { $0.set(["noticeOpen": .null]) } } } }
            }
            .presentationDetents([.medium, .large])
        }
    }
}
