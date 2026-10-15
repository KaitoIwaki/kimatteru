import SwiftUI
import UIKit
import CoreText
import LukkoKit

/// シェア画像のキャンバス（Web 版の canvas 2D と同じ意味で、CoreGraphics と CoreText で描く）。
/// 描く中身（位置・字・色）は LukkoKit の ShareCardDraw がそのまま決める。ここは「どう塗るか」だけ
final class ShareCGCanvas: ShareCanvas {
    let cg: CGContext
    var fillStyle = "#000000"
    var strokeStyle = "#000000"
    var lineWidth = 1.0
    var font = ShareFont(size: 10, weight: 400)
    var textAlign = "left"
    var textBaseline = "alphabetic"
    private var path = CGMutablePath()
    private var dash: [CGFloat] = []

    /// cg は左上が原点・下向きが +y（SwiftUI の Canvas・UIGraphicsImageRenderer と同じ向き）
    init(_ cg: CGContext) { self.cg = cg }

    // MARK: 字
    /// Web 版の字は "Hiragino Sans"。iPhone にある太さは W3・W6・W7 なので、CSS の太さ合わせと同じ選び方をする
    /// （500 以下 → W3、600 → W6、700 以上 → W7）
    static func ctFont(_ f: ShareFont) -> CTFont {
        let name = f.weight >= 700 ? "HiraginoSans-W7" : f.weight >= 600 ? "HiraginoSans-W6" : "HiraginoSans-W3"
        let size = CGFloat(f.size)
        let ct = CTFontCreateWithName(name as CFString, size, nil)
        if (CTFontCopyPostScriptName(ct) as String) == name { return ct }
        let w: UIFont.Weight = f.weight >= 700 ? .bold : f.weight >= 600 ? .semibold : f.weight <= 300 ? .light : .regular
        return UIFont.systemFont(ofSize: size, weight: w) as CTFont
    }
    private func line(_ text: String, color: CGColor) -> CTLine {
        let attrs: [NSAttributedString.Key: Any] = [
            NSAttributedString.Key(kCTFontAttributeName as String): Self.ctFont(font),
            NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
        ]
        return CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: attrs))
    }
    func measureText(_ text: String) -> Double {
        Double(CTLineGetTypographicBounds(line(text, color: UIColor.black.cgColor), nil, nil, nil))
    }
    func fillText(_ text: String, _ x: Double, _ y: Double) {
        let l = line(text, color: Self.color(fillStyle))
        let w = CTLineGetTypographicBounds(l, nil, nil, nil)
        var px = CGFloat(x)
        if textAlign == "center" { px -= CGFloat(w) / 2 } else if textAlign == "right" || textAlign == "end" { px -= CGFloat(w) }
        var py = CGFloat(y)
        if textBaseline == "middle" {
            // canvas の middle：em の箱の真ん中（WebKit は ascent − (ascent+descent)/2 だけ下げた所が基準線）
            let f = Self.ctFont(font)
            py += (CTFontGetAscent(f) - CTFontGetDescent(f)) / 2
        }
        cg.saveGState()
        cg.textMatrix = .identity
        cg.translateBy(x: px, y: py)
        cg.scaleBy(x: 1, y: -1)
        cg.textPosition = .zero
        CTLineDraw(l, cg)
        cg.restoreGState()
    }

    // MARK: 形
    func fillRect(_ x: Double, _ y: Double, _ w: Double, _ h: Double) {
        let r = CGRect(x: x, y: y, width: w, height: h)
        if let g = Self.gradient(fillStyle) {
            cg.saveGState()
            cg.clip(to: r)
            cg.drawLinearGradient(g.gradient, start: g.start, end: g.end, options: [.drawsBeforeStartLocation, .drawsAfterEndLocation])
            cg.restoreGState()
            return
        }
        cg.setFillColor(Self.color(fillStyle))
        cg.fill(r)
    }
    func beginPath() { path = CGMutablePath() }
    func moveTo(_ x: Double, _ y: Double) { path.move(to: CGPoint(x: x, y: y)) }
    func arcTo(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double, _ r: Double) {
        path.addArc(tangent1End: CGPoint(x: x1, y: y1), tangent2End: CGPoint(x: x2, y: y2), radius: CGFloat(r))
    }
    func arc(_ x: Double, _ y: Double, _ r: Double, _ a0: Double, _ a1: Double) {
        // 下向きが +y の座標では、canvas の時計回り（既定）が CoreGraphics の clockwise: false にあたる
        path.addArc(center: CGPoint(x: x, y: y), radius: CGFloat(r), startAngle: CGFloat(a0), endAngle: CGFloat(a1), clockwise: false)
    }
    func closePath() { path.closeSubpath() }
    func fill() {
        cg.saveGState()
        cg.addPath(path)
        cg.setFillColor(Self.color(fillStyle))
        cg.fillPath()
        cg.restoreGState()
    }
    func stroke() {
        cg.saveGState()
        cg.addPath(path)
        cg.setStrokeColor(Self.color(strokeStyle))
        cg.setLineWidth(CGFloat(lineWidth))
        cg.setLineDash(phase: 0, lengths: dash)
        cg.strokePath()
        cg.restoreGState()
    }
    func setLineDash(_ d: [Double]) { dash = d.map { CGFloat($0) } }

    // MARK: 色
    /// "#RGB"・"#RRGGBB"・"rgb(r,g,b)"・"rgba(r,g,b,a)"
    static func color(_ css: String) -> CGColor {
        let s = css.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") {
            var h = String(s.dropFirst())
            if h.count == 3 { h = h.map { "\($0)\($0)" }.joined() }
            if h.count >= 6, let v = UInt64(h.prefix(6), radix: 16) {
                return CGColor(srgbRed: CGFloat((v >> 16) & 0xFF) / 255, green: CGFloat((v >> 8) & 0xFF) / 255, blue: CGFloat(v & 0xFF) / 255, alpha: 1)
            }
        }
        if s.hasPrefix("rgb"), let open = s.firstIndex(of: "("), let close = s.lastIndex(of: ")") {
            let p = s[s.index(after: open)..<close].split(separator: ",").map { Double($0.trimmingCharacters(in: .whitespaces)) ?? 0 }
            if p.count >= 3 {
                return CGColor(srgbRed: CGFloat(p[0] / 255), green: CGFloat(p[1] / 255), blue: CGFloat(p[2] / 255), alpha: CGFloat(p.count > 3 ? p[3] : 1))
            }
        }
        return CGColor(srgbRed: 0, green: 0, blue: 0, alpha: 1)
    }
    /// "linear(x0,y0,x1,y1|0 #…|1 #…)"
    static func gradient(_ s: String) -> (gradient: CGGradient, start: CGPoint, end: CGPoint)? {
        guard s.hasPrefix("linear("), s.hasSuffix(")") else { return nil }
        let parts = s.dropFirst(7).dropLast().split(separator: "|").map(String.init)
        guard parts.count >= 2 else { return nil }
        let xy = parts[0].split(separator: ",").map { CGFloat(Double($0) ?? 0) }
        guard xy.count == 4 else { return nil }
        var colors: [CGColor] = [], locs: [CGFloat] = []
        for stop in parts.dropFirst() {
            let kv = stop.split(separator: " ", maxSplits: 1).map(String.init)
            guard kv.count == 2 else { continue }
            locs.append(CGFloat(Double(kv[0]) ?? 0)); colors.append(color(kv[1]))
        }
        guard let g = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: colors as CFArray, locations: locs) else { return nil }
        return (g, CGPoint(x: xy[0], y: xy[1]), CGPoint(x: xy[2], y: xy[3]))
    }
}

/// シェア画像を作る。Web 版の canvas と同じ画素の大きさ（1 倍）で、ImageRenderer に SwiftUI の Canvas を描かせる
@MainActor
enum ShareImage {
    static func render(width: Int, height: Int, _ draw: @escaping (ShareCanvas) -> Void) -> UIImage? {
        let w = CGFloat(width), h = CGFloat(height)
        let view = Canvas { ctx, _ in
            ctx.withCGContext { cg in draw(ShareCGCanvas(cg)) }
        }
        .frame(width: w, height: h)
        .environment(\.colorScheme, .light)
        let r = ImageRenderer(content: view)
        r.scale = 1
        r.proposedSize = ProposedViewSize(width: w, height: h)
        if let img = r.uiImage, img.size.width >= w - 0.5 { return img }
        // ImageRenderer が描けなかったときは、同じ描き方で UIKit に描かせる
        let fmt = UIGraphicsImageRendererFormat()
        fmt.scale = 1
        fmt.opaque = false
        return UIGraphicsImageRenderer(size: CGSize(width: w, height: h), format: fmt).image { c in draw(ShareCGCanvas(c.cgContext)) }
    }

    static func summary(_ card: ShareSummaryCard) -> UIImage? {
        let s = ShareCardDraw.size(card)
        return render(width: s.w, height: s.h) { ShareCardDraw.draw(card, $0) }
    }
    static func free(_ card: ShareFreeCard) -> UIImage? {
        let s = ShareCardDraw.size(card)
        return render(width: s.w, height: s.h) { ShareCardDraw.drawFreeCard(card, $0) }
    }

    /// PNG を一時置き場に書く（Web 版は Cache に書いて渡す。共有先に名前が残るように同じ名前にする）
    static func writePNG(_ img: UIImage, name: String) -> URL? {
        guard let data = img.pngData() else { return nil }
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("share", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(name)
        do { try data.write(to: url, options: .atomic); return url } catch { return nil }
    }
}

/// iPhone 標準の共有シート。閉じたら done を呼ぶ（送った・やめた、どちらでも）
@MainActor
enum ShareSheet {
    static func present(_ items: [Any], done: @escaping () -> Void = {}) {
        guard let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first(where: { $0.activationState == .foregroundActive })
                ?? UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first,
              var top = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController ?? scene.windows.first?.rootViewController else { done(); return }
        while let p = top.presentedViewController, !p.isBeingDismissed { top = p }
        let vc = UIActivityViewController(activityItems: items, applicationActivities: nil)
        vc.completionWithItemsHandler = { _, _, _, _ in done() }
        vc.popoverPresentationController?.sourceView = top.view
        top.present(vc, animated: true)
    }
}
