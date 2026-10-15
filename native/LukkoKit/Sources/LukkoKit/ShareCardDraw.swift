import Foundation

/// 字の大きさと太さ（Web 版の ctx.font = `${weight} ${size}px …`）
public struct ShareFont: Equatable {
    public var size: Double
    public var weight: Int
    public init(size: Double, weight: Int) { self.size = size; self.weight = weight }
}

/// キャンバス 2D の、カードを描くのに使うところだけ（Web 版 CanvasRenderingContext2D と同じ名前・同じ意味）。
/// 色は CSS の形のまま（#RRGGBB・rgb(…)）。グラデーションは "linear(x0,y0,x1,y1|0 #…|1 #…)" という字で渡す。
/// アプリは CoreGraphics で、試験は描いた手順を記録するだけのもので受ける
public protocol ShareCanvas: AnyObject {
    var fillStyle: String { get set }
    var strokeStyle: String { get set }
    var lineWidth: Double { get set }
    var font: ShareFont { get set }
    /// left / center / right
    var textAlign: String { get set }
    /// alphabetic / middle
    var textBaseline: String { get set }
    func measureText(_ text: String) -> Double
    func fillText(_ text: String, _ x: Double, _ y: Double)
    func fillRect(_ x: Double, _ y: Double, _ w: Double, _ h: Double)
    func beginPath()
    func moveTo(_ x: Double, _ y: Double)
    func arcTo(_ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double, _ r: Double)
    func arc(_ x: Double, _ y: Double, _ r: Double, _ a0: Double, _ a1: Double)
    func closePath()
    func fill()
    func stroke()
    func setLineDash(_ d: [Double])
}

/// シェア画像をキャンバスに描く（Web 版 sharecard.js の drawMonthCard・drawYearCard・drawFreeCard の写し。
/// 位置も字も 1 つずつ同じ。サポーターカードはここには無い）
public enum ShareCardDraw {
    static let PAPER = "#FBFBFD"
    static let PAPER2 = "#F4F6F8"
    static let INK = "#26251F"
    static let INK_MUT = "#8C887C"
    static let INK_FAINT = "#B7B3A6"
    static let LINE = "#E6E2D6"
    static let TEAL = "#1D9E75"
    static let CORAL = "#D85A30"
    static let CORAL_DARK = "#712B13"
    static let GRAY_FILL = "#EDEEF0"
    static let BAR_ON = "#7FAE85"
    static let BAR_OFF = "#CEE0D1"

    static func f(_ size: Double, _ weight: Int = 400) -> ShareFont { ShareFont(size: size, weight: weight) }

    /// カードの大きさ（canvas.width / height）
    public static func size(_ card: ShareSummaryCard) -> (w: Int, h: Int) {
        switch card {
        case .month(let m): return (1080, 680 + max(0, m.jobs.count - 2) * 88)
        case .year(let y): return (1080, 1440 + (y.note.isEmpty ? 0 : 44) + max(0, y.jobs.count - 2) * 116)
        }
    }
    public static func size(_ card: ShareFreeCard) -> (w: Int, h: Int) {
        let rows = (card.cells.count + 6) / 7
        return (1080, 430 + rows * (96 + 10) + 300)
    }

    public static func draw(_ card: ShareSummaryCard, _ ctx: ShareCanvas) {
        switch card {
        case .month(let m): drawMonthCard(m, ctx)
        case .year(let y): drawYearCard(y, ctx)
        }
    }

    static func rr(_ ctx: ShareCanvas, _ x: Double, _ y: Double, _ w: Double, _ h: Double, _ r: Double) {
        let rad = min(r, w / 2, h / 2)
        ctx.beginPath()
        ctx.moveTo(x + rad, y)
        ctx.arcTo(x + w, y, x + w, y + h, rad)
        ctx.arcTo(x + w, y + h, x, y + h, rad)
        ctx.arcTo(x, y + h, x, y, rad)
        ctx.arcTo(x, y, x + w, y, rad)
        ctx.closePath()
    }

    static func badge(_ ctx: ShareCanvas, _ x: Double, _ y: Double, _ d: Double, _ bg: String, _ glyph: String, _ fg: String, _ fontSize: Double) {
        ctx.fillStyle = bg
        rr(ctx, x, y, d, d, d / 2)
        ctx.fill()
        ctx.fillStyle = fg
        ctx.font = f(fontSize, 700)
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(glyph, x + d / 2, y + d / 2 + 1)
        ctx.textAlign = "left"
        ctx.textBaseline = "alphabetic"
    }

    /// 末尾の合印「✓？」— アプリの署名。sub を渡すと 2 段になる
    static func signature(_ ctx: ShareCanvas, _ x: Double, _ y: Double, _ size: Double, _ label: String, _ sub: String = "") {
        ctx.font = f(size, 700)
        ctx.textBaseline = "middle"
        ctx.fillStyle = TEAL
        ctx.fillText("✓", x, y)
        let w = ctx.measureText("✓")
        ctx.fillStyle = "#C1C5CC"
        ctx.fillText("？", x + w - size * 0.1, y)
        let w2 = ctx.measureText("？")
        let tx = x + w + w2 + size * 0.25
        ctx.font = f(size * 0.62, 600)
        ctx.fillStyle = "#55524A"
        ctx.fillText(label, tx, !sub.isEmpty ? y - size * 0.34 : y)
        if !sub.isEmpty {
            ctx.font = f(size * 0.52, 500)
            ctx.fillStyle = INK_MUT
            ctx.fillText(sub, tx, y + size * 0.38)
        }
        ctx.textBaseline = "alphabetic"
    }

    /// 今月のまとめ（横長 1080×680。バイト先が 3 つ以上なら 1 つごとに 88 伸ばす）
    public static func drawMonthCard(_ d: ShareMonthCard, _ ctx: ShareCanvas) {
        let list = d.jobs
        let W = 1080.0, H = 680.0 + Double(max(0, list.count - 2) * 88), PAD = 84.0
        cardBase(ctx, W, H)

        ctx.fillStyle = INK_MUT
        ctx.font = f(27, 400)
        fillTracked(ctx, d.yearMonth, PAD, 118, 3)

        bigNumber(ctx, PAD, 252, d.wageUnit, d.wageNum, 128)

        ctx.fillStyle = INK_MUT
        ctx.font = f(25, 400)
        ctx.fillText("およそ　\(d.hours)・\(d.days)日", PAD, 302)

        ctx.fillStyle = LINE
        ctx.fillRect(PAD, 356, W - PAD * 2, 2)

        if !list.isEmpty { jobRows(ctx, PAD, 424, W - PAD * 2, list, 30, 88) }
        else { emptyNote(ctx, PAD, 424, 26) }

        signature(ctx, PAD, H - 46, 30, "LUKKO")
    }

    /// 今年のまとめ（縦 1080×1440。月ごとの棒、いちばん多い月だけ濃くして時間を添える）
    public static func drawYearCard(_ d: ShareYearCard, _ ctx: ShareCanvas) {
        let list = d.jobs
        let W = 1080.0, H = 1440.0 + (d.note.isEmpty ? 0 : 44) + Double(max(0, list.count - 2) * 116), PAD = 96.0
        cardBase(ctx, W, H)

        var y = 176.0
        ctx.fillStyle = INK_MUT
        ctx.font = f(30, 400)
        fillTracked(ctx, d.year, PAD, y, 3)

        y += 142
        bigNumber(ctx, PAD, y, d.wageUnit, d.wageNum, 132)

        y += 56
        ctx.fillStyle = INK_MUT
        ctx.font = f(27, 400)
        ctx.fillText("およそ　\(d.hours)", PAD, y)

        if !d.note.isEmpty {
            y += 44
            ctx.fillStyle = INK_FAINT
            ctx.font = f(23, 400)
            ctx.fillText(d.note, PAD, y)
        }

        y += 78
        ctx.fillStyle = LINE
        ctx.fillRect(PAD, y, W - PAD * 2, 2)

        y += 74
        if !list.isEmpty { y = jobRows(ctx, PAD, y, W - PAD * 2, list, 34, 116) }
        else { y = emptyNote(ctx, PAD, y, 28) + 60 }

        y += 60
        ctx.fillStyle = INK_MUT
        ctx.font = f(24, 400)
        fillTracked(ctx, "月ごとの働いた時間", PAD, y, 2)

        y += 40
        monthBars(ctx, PAD, y, W - PAD * 2, 240, d.months)

        signature(ctx, PAD, H - 84, 38, "LUKKO")
    }

    static func cardBase(_ ctx: ShareCanvas, _ W: Double, _ H: Double) {
        ctx.fillStyle = "linear(0,0,0,\(JS.numberToString(H))|0 \(PAPER)|1 \(PAPER2))"
        ctx.fillRect(0, 0, W, H)
    }

    /// 字間を開けて書く（1 文字ずつ置く）
    @discardableResult
    static func fillTracked(_ ctx: ShareCanvas, _ text: String, _ x: Double, _ y: Double, _ sp: Double) -> Double {
        var cx = x
        for ch in text.unicodeScalars {
            let s = String(ch)
            ctx.fillText(s, cx, y)
            cx += ctx.measureText(s) + sp
        }
        return cx
    }

    /// 記号は数字より一段小さく薄く
    static func bigNumber(_ ctx: ShareCanvas, _ x: Double, _ y: Double, _ unit: String, _ num: String, _ size: Double) {
        ctx.fillStyle = INK_MUT
        ctx.font = f(JS.round(size * 0.31), 400)
        ctx.fillText(unit, x, y)
        let uw = ctx.measureText(unit)
        ctx.fillStyle = INK
        ctx.font = f(size, 300)
        ctx.fillText(num, x + uw + size * 0.06, y)
    }

    /// バイト先ごとの行。金額の幅を先に測り、残った幅に名前を収める
    @discardableResult
    static func jobRows(_ ctx: ShareCanvas, _ x: Double, _ y: Double, _ w: Double, _ jobs: [ShareCardJob], _ fs: Double, _ gap: Double) -> Double {
        var cy = y
        for j in jobs {
            ctx.fillStyle = j.color
            ctx.beginPath()
            ctx.arc(x + fs * 0.3, cy - fs * 0.32, fs * 0.3, 0, Double.pi * 2)
            ctx.fill()

            ctx.font = f(JS.round(fs * 1.36), 300)
            let wageW = ctx.measureText(j.wage)
            let room = w - fs - wageW - fs * 0.8
            ctx.fillStyle = INK
            ctx.font = f(fs, 400)
            ctx.fillText(ellipsis(ctx, j.name, room), x + fs, cy)

            ctx.fillStyle = INK_MUT
            ctx.font = f(JS.round(fs * 0.68), 400)
            let sub = ((j.hourly ?? 0) != 0 ? "時給 ¥\(j.hourly ?? 0)　" : "") + "\(j.times)回　\(j.hours)"
            ctx.fillText(sub, x + fs, cy + fs * 1.1)

            ctx.fillStyle = INK
            ctx.font = f(JS.round(fs * 1.36), 300)
            ctx.textAlign = "right"
            ctx.fillText(j.wage, x + w, cy)
            ctx.textAlign = "left"

            cy += gap
        }
        return cy
    }

    /// 月ごとの棒。まだ来ていない月は下に細い線だけ置く
    static func monthBars(_ ctx: ShareCanvas, _ x: Double, _ y: Double, _ w: Double, _ h: Double, _ months: [Double]) {
        let n = 12.0, gap = 10.0, bw = (w - gap * (n - 1)) / n
        let vals = months.filter { $0 > 0 }
        let mx = vals.isEmpty ? 1 : vals.max()!
        for (i, v) in months.enumerated() {
            let bx = x + Double(i) * (bw + gap)
            if !(v != 0 && !v.isNaN) {
                ctx.fillStyle = "#EDEFF3"
                rr(ctx, bx, y + h - 4, bw, 4, 2)
                ctx.fill()
            } else {
                let bh = max(6, (v / mx) * h)
                let top = y + h - bh
                ctx.fillStyle = v == mx ? BAR_ON : BAR_OFF
                rr(ctx, bx, top, bw, bh, min(bw / 2, 10))
                ctx.fill()
                if v == mx {
                    ctx.fillStyle = INK_MUT
                    ctx.font = f(21, 400)
                    ctx.textAlign = "center"
                    ctx.fillText(fmtBarHours(v), bx + bw / 2, top - 14)
                    ctx.textAlign = "left"
                }
            }
            ctx.fillStyle = INK_FAINT
            ctx.font = f(21, 400)
            ctx.textAlign = "center"
            ctx.fillText(String(i + 1), bx + bw / 2, y + h + 38)
            ctx.textAlign = "left"
        }
    }

    /// 入る幅まで切って「…」を付ける（JS と同じく UTF-16 で 1 つずつ削る）
    static func ellipsis(_ ctx: ShareCanvas, _ text: String, _ room: Double) -> String {
        if room <= 0 || ctx.measureText(text) <= room { return text }
        var out = Array(text.utf16)
        func s(_ u: [UInt16]) -> String { String(decoding: u, as: UTF16.self) }
        while out.count > 1 && ctx.measureText(s(out) + "…") > room { out.removeLast() }
        return s(out) + "…"
    }

    /// 働いた記録が無い月／年のとき。0 円のカードを黙って出さない
    @discardableResult
    static func emptyNote(_ ctx: ShareCanvas, _ x: Double, _ y: Double, _ fs: Double) -> Double {
        ctx.fillStyle = INK_FAINT
        ctx.font = f(fs, 400)
        ctx.fillText("働いた記録がありません", x, y)
        return y + fs * 1.6
    }

    public static func fmtBarHours(_ h: Double) -> String {
        JS.numberToString(h >= 10 ? JS.round(h) : JS.round(h * 10) / 10) + "h"
    }

    /// 空いてる日（予定の中身は出さない）。マスは free（塗り）／part（点線＋時刻）／busy（灰）／past（薄い）
    public static func drawFreeCard(_ d: ShareFreeCard, _ ctx: ShareCanvas) {
        let W = 1080.0
        let cellH = 96.0
        let rowGap = 10.0
        let rows = Double((d.cells.count + 6) / 7)
        let H = 430 + rows * (cellH + rowGap) + 300

        ctx.fillStyle = "#FFFDF8"
        ctx.fillRect(0, 0, W, H)

        let PAD = 92.0
        var y = 176.0

        badge(ctx, PAD, y - 40, 54, CORAL, "○", "#fff", 28)
        ctx.font = f(34, 600)
        ctx.fillStyle = CORAL
        ctx.fillText(d.lead.isEmpty ? "わたしの空いてる日" : d.lead, PAD + 74, y)

        y += 92
        ctx.font = f(64, 800)
        ctx.fillStyle = INK
        ctx.fillText(d.title.isEmpty ? "\(d.monthLabel)月のあいてる日" : d.title, PAD, y)

        // 曜日
        y += 92
        let gw = W - PAD * 2
        let cw = gw / 7
        ctx.font = f(26, 600)
        ctx.textAlign = "center"
        for (i, w) in d.weekdays.enumerated() {
            ctx.fillStyle = "#B0B4BB"
            ctx.fillText(w, PAD + cw * Double(i) + cw / 2, y)
        }

        // 日付マス
        y += 34
        let inset = 7.0
        for (i, cell) in d.cells.enumerated() {
            guard let label = cell.label, label != 0 else { continue }
            let col = Double(i % 7)
            let row = Double(i / 7)
            let x = PAD + cw * col + inset
            let yy = y + row * (cellH + rowGap)
            let w = cw - inset * 2
            let lv = cell.level.isEmpty ? "free" : cell.level
            rr(ctx, x, yy, w, cellH, 18)
            var numY = yy + cellH / 2 + 11
            if lv == "busy" || lv == "past" {
                ctx.fillStyle = lv == "past" ? "#F6F6F4" : GRAY_FILL
                ctx.fill()
                ctx.fillStyle = lv == "past" ? "#D9DBDF" : "#C1C5CC"
                ctx.font = f(30, 600)
            } else if lv == "part" {
                ctx.fillStyle = "#FFFDF8"
                ctx.fill()
                ctx.setLineDash([10, 7])
                ctx.strokeStyle = CORAL
                ctx.lineWidth = 3.5
                ctx.stroke()
                ctx.setLineDash([])
                ctx.fillStyle = CORAL_DARK
                ctx.font = f(30, 700)
                numY = yy + cellH / 2 - 4
            } else {
                ctx.fillStyle = "#FAECE7"
                ctx.fill()
                ctx.strokeStyle = CORAL
                ctx.lineWidth = 4
                ctx.stroke()
                ctx.fillStyle = CORAL_DARK
                ctx.font = f(32, 700)
            }
            ctx.fillText(String(label), x + w / 2, numY)
            if lv == "part" && !cell.note.isEmpty {
                ctx.font = f(19, 600)
                ctx.fillStyle = CORAL
                ctx.fillText(cell.note, x + w / 2, yy + cellH - 16)
            }
        }
        ctx.textAlign = "left"

        y += rows * (cellH + rowGap) + 46

        ctx.fillStyle = LINE
        ctx.fillRect(PAD, y, W - PAD * 2, 2)
        y += 62

        // 凡例（3つ）
        let L = d.legend.count >= 3 ? d.legend : ["空いてる", "時間による", "予定あり"]
        rr(ctx, PAD, y - 30, 40, 40, 12)
        ctx.fillStyle = "#FAECE7"
        ctx.fill()
        ctx.strokeStyle = CORAL
        ctx.lineWidth = 4
        ctx.stroke()
        ctx.font = f(28, 400)
        ctx.fillStyle = "#55524A"
        ctx.fillText(L[0], PAD + 56, y)

        let x2 = PAD + 250
        rr(ctx, x2, y - 30, 40, 40, 12)
        ctx.fillStyle = "#FFFDF8"
        ctx.fill()
        ctx.setLineDash([8, 6])
        ctx.strokeStyle = CORAL
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = "#55524A"
        ctx.fillText(L[1], x2 + 56, y)

        let x3 = PAD + 530
        rr(ctx, x3, y - 30, 40, 40, 12)
        ctx.fillStyle = GRAY_FILL
        ctx.fill()
        ctx.fillStyle = "#55524A"
        ctx.fillText(L[2], x3 + 56, y)

        signature(ctx, PAD, H - 96, 40, "LUKKO", d.signSub)
    }
}
