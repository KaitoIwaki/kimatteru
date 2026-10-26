import SwiftUI
import LukkoKit

/// 一覧で予定を選んでいるあいだ、下に出す帯：全部選ぶ・何件・時間・消す
struct ListSelectBar: View {
    let count: Int, allPicked: Bool
    let toggleAll: () -> Void, time: () -> Void, delete: () -> Void
    @Environment(\.ink) private var ink

    var body: some View {
        HStack(spacing: 14) {
            Button(allPicked ? "全部はずす" : "全部選ぶ", action: toggleAll)
                .font(.system(size: 14))
                .accessibilityIdentifier("list.selectAll")
            Spacer(minLength: 0)
            Text(count > 0 ? "\(count)件" : "選んでください").font(.system(size: 13)).monospacedDigit().foregroundStyle(ink("ink-mut"))
            Spacer(minLength: 0)
            Button(action: time) { Label("時間", systemImage: "clock") }
                .font(.system(size: 14, weight: .semibold))
                .disabled(count == 0)
                .accessibilityIdentifier("list.bulkTime")
            Button(role: .destructive, action: delete) { Label("消す", systemImage: "trash") }
                .font(.system(size: 14, weight: .semibold))
                .disabled(count == 0)
                .accessibilityIdentifier("list.bulkDelete")
        }
        .labelStyle(.titleAndIcon)
        .padding(.horizontal, 18).padding(.vertical, 12)
        .background(.bar)
        .overlay(alignment: .top) { Rectangle().fill(ink("line")).frame(height: 1) }
    }
}

/// 選んだ予定を、全部同じ時間にする（時・分のドラム。分は 5 分刻み）
struct ListTimeSheet: View {
    let count: Int
    let done: (_ start: String, _ end: String) -> Void
    @State var start: String
    @State var end: String
    @State private var open = "start"
    @Environment(\.dismiss) private var dismiss
    @Environment(\.ink) private var ink

    var body: some View {
        VStack(spacing: 12) {
            Text("\(count)件の時間を、そろえます").font(.system(size: 15, weight: .semibold)).foregroundStyle(ink("ink"))
            HStack(spacing: 10) {
                chip("開始", start, "start")
                Text("〜").foregroundStyle(ink("ink-mut"))
                chip("終了", end, "end")
            }
            TimeWheels(value: open == "start" ? start : end, height: 160) { unit, idx in
                let cur = open == "start" ? start : end
                let p = cur.split(separator: ":").map { Int($0) ?? 0 }
                var h = p.first ?? 0, m = p.count > 1 ? p[1] : 0
                if unit == "h" { h = idx } else { m = idx * 5 }
                let v = String(format: "%02d:%02d", h, m)
                if open == "start" { start = v } else { end = v }
            }
            Text(note).font(.system(size: 11.5)).foregroundStyle(ink("ink-faint")).multilineTextAlignment(.center)
            Button {
                done(start, end)
                dismiss()
            } label: {
                Text("\(count)件を \(start)〜\(end) にする").font(.system(size: 15, weight: .bold)).foregroundStyle(ink("card"))
                    .frame(maxWidth: .infinity).padding(.vertical, 13)
                    .background(ink("ink"), in: RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(.plain)
            .disabled(start == end)
            .opacity(start == end ? 0.4 : 1)
            .accessibilityIdentifier("list.bulkTime.done")
            Button("やめる") { dismiss() }.font(.system(size: 14)).foregroundStyle(ink("ink-mut"))
        }
        .padding(.horizontal, 18).padding(.top, 20).padding(.bottom, 8)
        .presentationDetents([.height(470)])
        .presentationDragIndicator(.visible)
        .presentationBackground(ink("card"))
    }

    private var note: String { start == end ? "開始と終了が同じです" : end < start ? "終わりは次の日です" : " " }

    private func chip(_ label: String, _ value: String, _ key: String) -> some View {
        Button { open = key } label: {
            VStack(spacing: 2) {
                Text(label).font(.system(size: 11)).foregroundStyle(ink("ink-mut"))
                Text(value).font(.system(size: 20, weight: open == key ? .bold : .regular)).monospacedDigit()
                    .foregroundStyle(open == key ? FormTone.teal : ink("ink"))
            }
            .frame(width: 110).padding(.vertical, 8)
            .background(ink("bg2"), in: RoundedRectangle(cornerRadius: 12))
            .overlay { if open == key { RoundedRectangle(cornerRadius: 12).strokeBorder(FormTone.teal, lineWidth: 1.5) } }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label) \(value)")
        .accessibilityIdentifier("list.bulkTime.\(key)")
    }
}
