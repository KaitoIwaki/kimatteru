import SwiftUI
import UIKit
import LukkoKit

/// まとめカード（月／年）のプレビュー（Web 版 view.jsx の summary 画面）。
/// プレビューは書き出す PNG そのもの。同じ見た目を組み直すと、寸法がずれる（Web 版で実際に起きた）
struct SummaryCardScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @State private var png: UIImage?

    var body: some View {
        let card = model.engine.summaryCard()
        let sz = ShareCardDraw.size(card)
        let toast = JS.truthy(model.state["shareToast"])
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    Group {
                        if let png {
                            Image(uiImage: png).resizable().interpolation(.high).aspectRatio(contentMode: .fit)
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                                .shadow(color: .black.opacity(0.5), radius: 24, y: 18)
                                .accessibilityLabel(model.engine.summaryCardTitle())
                                .accessibilityIdentifier("summary.card")
                        } else {
                            RoundedRectangle(cornerRadius: 16).fill(.white.opacity(0.06))
                                .aspectRatio(CGFloat(sz.w) / CGFloat(sz.h), contentMode: .fit)
                        }
                    }
                    .frame(maxWidth: 340)
                    Button { share(card) } label: {
                        HStack(spacing: 7) {
                            ShareUpIcon().frame(width: 17, height: 17)
                            Text("画像にしてシェア").font(.system(size: 14.5, weight: .semibold))
                        }
                        .foregroundStyle(ink("ink"))
                        .frame(maxWidth: .infinity).padding(14)
                        .background(ink("card"), in: RoundedRectangle(cornerRadius: 16))
                    }
                    .buttonStyle(.plain)
                    .frame(maxWidth: 340)
                    .padding(.top, 18)
                    .accessibilityIdentifier("summary.share")
                    Text("金額は時給と実働から出した目安です。割増や交通費は入っていません。")
                        .font(.system(size: 11)).lineSpacing(11 * 0.8).foregroundStyle(.white.opacity(0.4))
                        .multilineTextAlignment(.center).frame(maxWidth: 340)
                        .padding(.top, 12)
                    if toast {
                        Text(JS.string(model.state["shareMsg"])).font(.system(size: 12)).foregroundStyle(.white.opacity(0.55))
                            .padding(.top, 10).transition(.opacity)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 20)
                .animation(.easeOut(duration: 0.2), value: toast)
            }
            .background(ShareColors.bg)
            .navigationTitle(model.engine.summaryCardTitle())
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ShareColors.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("閉じる") { model.act { $0.closeSummary() } }.foregroundStyle(.white.opacity(0.65))
                }
            }
        }
        .environment(\.colorScheme, .dark)
        .presentationBackground(ShareColors.bg)
        // 中身が変わったときだけ描き直す
        .task(id: card) { png = ShareImage.summary(card) }
    }

    @MainActor private func share(_ card: ShareSummaryCard) {
        model.act { $0.shareCardTapped() }
        guard let img = ShareImage.summary(card), let url = ShareImage.writePNG(img, name: model.engine.summaryCardFileName()) else {
            model.act { $0.shareCardFailed() }
            return
        }
        ShareSheet.present([url]) { model.act { $0.shareCardDone(free: false) } }
    }
}
