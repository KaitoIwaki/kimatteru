import SwiftUI
import UIKit
import CoreText
import LukkoKit

/// 応援の画面の色（字は iPhone 標準。前は手書き風の Yomogi を使っていたが、ほかの画面と字がそろわず読みにくかった）
enum SupportFont {
    static let sage = Palette.hex("#7FAE85")
    static let sageDark = Palette.hex("#5E8A66")
    static let teal = Palette.hex("#1D9E75")
}

// MARK: - サポーターカード（1 枚の画面）
/// 金ぴかにはしない。生成りの紙に真鍮の箔を押したもの、という見立て。
/// 角度ひとつだけを持ち、表と裏・影・光はすべてそこから出す（cardflip.js）
struct SupporterCardScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    @State private var angle: Double = 0
    @State private var tilt: Double = 0
    /// 指を離したあと、落ち着く先まで回している途中
    @State private var settling: Settle? = nil
    @State private var drag: Drag? = nil
    @State private var tapOff = Date.distantPast
    @State private var appeared = false
    @State private var name = ""
    @FocusState private var nameFocus: Bool

    struct Settle: Equatable { var from: Double, to: Double, tilt0: Double, start: Date, dur: Double, token: Int }
    struct Drag { var axis: Character?; var base: Double; var lastDeg: Double; var lastAt: Date; var vel: Double; var moved: Bool; var width: Double }

    var body: some View {
        let _ = model.state  // 中身が変わったら描き直す（engine は見張られていない）
        let v = model.engine.supportView()
        ScrollView {
            VStack(spacing: 0) {
                GeometryReader { geo in
                    TimelineView(.animation) { ctx in
                        let (a, t) = current(ctx.date)
                        SupporterCardView(v: v, angle: a, tilt: t, time: ctx.date.timeIntervalSinceReferenceDate)
                            .contentShape(Rectangle())
                            .gesture(cardGesture(width: geo.size.width))
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel("サポーターカード \(v.cardTotal) \(v.cardTimes)")
                            .accessibilityAddTraits(.isButton)
                            .accessibilityAction { flip() }
                    }
                }
                .aspectRatio(1.586, contentMode: .fit)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 18)
                .scaleEffect(appeared ? 1 : 0.97)

                HStack(spacing: 10) {
                    Text("\(v.cardTierName)カード").font(.system(size: 11.5, weight: .bold)).foregroundStyle(ink("ink-soft"))
                    Text("指でなぞると回せます").font(.system(size: 11.5)).foregroundStyle(ink("ink-mut"))
                }
                .padding(.top, 12)
                Text(v.cardNextText).font(.system(size: 12)).foregroundStyle(ink("ink-soft")).multilineTextAlignment(.center).lineSpacing(4).padding(.top, 16)

                Text("支えてくれて、ありがとう。").font(.system(size: 16)).foregroundStyle(ink("ink")).padding(.top, 26)
                Text("広告なし・通信なしのままで作りつづけます。").font(.system(size: 12.5)).foregroundStyle(ink("ink-soft")).multilineTextAlignment(.center).lineSpacing(6).padding(.top, 8)

                VStack(alignment: .leading, spacing: 8) {
                    Text("カードに載せる名前").font(.system(size: 12)).foregroundStyle(ink("ink-mut")).padding(.horizontal, 6)
                    TextField("空のままでもかまいません", text: $name)
                        .focused($nameFocus)
                        .font(.system(size: 15)).foregroundStyle(ink("ink"))
                        .padding(.horizontal, 14).padding(.vertical, 12)
                        .background(ink("card"), in: RoundedRectangle(cornerRadius: 13))
                        .overlay(RoundedRectangle(cornerRadius: 13).strokeBorder(ink("line")))
                        .submitLabel(.done)
                        .accessibilityIdentifier("card.name")
                        .onChange(of: name) { _, s in
                            let cut = JS.slice16(s, 20)
                            if cut != s { name = cut; return }
                            if JS.string(JS.or(model.state["settings"]?["supporterName"], "")) != cut { model.act { $0.setSupporterName(cut) } }
                        }
                    Text("この名前も端末の中だけに保存されます。").font(.system(size: 11)).foregroundStyle(ink("ink-faint")).padding(.horizontal, 6)
                }
                .padding(.top, 24)

                Button { model.shareSupporterCard() } label: {
                    HStack(spacing: 7) {
                        Image(systemName: "square.and.arrow.up").font(.system(size: 15, weight: .semibold))
                        Text("カードをシェア").font(.system(size: 15, weight: .bold))
                    }
                    .foregroundStyle(ink("ink"))
                    .frame(maxWidth: .infinity).padding(14)
                    .background(ink("card"), in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(ink("line")))
                }
                .buttonStyle(SettingsPressStyle(radius: 16))
                .padding(.top, 22)
            }
            .padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 40)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
        .background(ink("bg").ignoresSafeArea())
        .navigationTitle("サポーターカード")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(.hidden, for: .tabBar)
        .onAppear {
            name = JS.string(JS.or(model.state["settings"]?["supporterName"], ""))
            angle = 0; tilt = 0; settling = nil
            withAnimation(.timingCurve(0.2, 0.9, 0.2, 1, duration: 0.5)) { appeared = true }
        }
        .onDisappear { settling = nil }
    }

    /// いまの角度と傾き（落ち着いている途中なら、その時刻のぶん）
    private func current(_ now: Date) -> (Double, Double) {
        guard let s = settling else { return (angle, tilt) }
        let p = min(1, now.timeIntervalSince(s.start) / s.dur)
        if p >= 1 { return (s.to, 0) }
        let e = SupporterFlip.ease(p)
        return (s.from + (s.to - s.from) * e, s.tilt0 * (1 - e))
    }
    /// 進んでいる落ち着きを、いまの場所で止める（触れ始めたとき）
    private func stopSettle() {
        guard settling != nil else { return }
        let (a, t) = current(Date())
        settling = nil
        angle = a; tilt = t
    }
    /// 落ち着く先まで回す。傾きも一緒に戻す
    private func settleCard(_ to: Double) {
        stopSettle()
        let from = angle, t0 = tilt
        if from == to && t0 == 0 { angle = SupporterFlip.norm(to); tilt = 0; return }
        let dur = from == to ? 0.3 : SupporterFlip.settleTime(from, to)
        let token = Int.random(in: 1...Int.max)
        settling = Settle(from: from, to: to, tilt0: t0, start: Date(), dur: dur, token: token)
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(dur * 1_000_000_000))
            guard settling?.token == token else { return }
            settling = nil
            angle = SupporterFlip.norm(to); tilt = 0
        }
    }
    /// 押すと裏返る。なぞった直後の「押した」は無視する
    private func flip() {
        if Date() < tapOff { return }
        model.engine.haptic("light")
        stopSettle()
        settleCard(angle + 180)
    }

    private func cardGesture(width: Double) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .onChanged { g in
                if drag == nil {
                    stopSettle()
                    nameFocus = false
                    drag = Drag(axis: nil, base: angle, lastDeg: angle, lastAt: Date(), vel: 0, moved: false, width: width > 0 ? width : 320)
                }
                guard var d = drag else { return }
                let dx = g.translation.width, dy = g.translation.height
                // 最初の数 px で、回しているのか傾けているのかを決める
                if d.axis == nil {
                    if abs(dx) < 6 && abs(dy) < 6 { return }
                    d.axis = abs(dx) > abs(dy) * 1.2 ? "x" : "y"
                }
                let tl = SupporterFlip.tiltFor(dy)
                if d.axis != "x" { tilt = tl; drag = d; return }
                d.moved = true
                let deg = d.base + SupporterFlip.dragToDeg(dx, d.width)
                let now = Date(), dt = max(0.001, now.timeIntervalSince(d.lastAt))
                d.vel = (deg - d.lastDeg) / dt
                d.lastDeg = deg; d.lastAt = now
                drag = d
                angle = deg; tilt = tl
            }
            .onEnded { _ in
                guard let d = drag else { return }
                drag = nil
                if d.axis == nil { flip(); return }      // 動かさずに離した＝押した
                let moved = d.axis == "x" && d.moved
                let from = angle
                // 上下だけなぞったときも、傾きは元に戻す
                if !moved { if tilt != 0 { settleCard(from) }; return }
                tapOff = Date().addingTimeInterval(0.4)
                let to = SupporterFlip.settle(from, d.vel)
                if SupporterFlip.showsFront(from) != SupporterFlip.showsFront(to) { model.engine.haptic("light") }
                settleCard(to)
            }
    }
}

/// カード本体（表と裏）。角度と傾きから、どちらの面が見えるか・影・光を出す
struct SupporterCardView: View {
    let v: SupportView
    let angle: Double
    let tilt: Double
    let time: Double

    var body: some View {
        let front = SupporterFlip.showsFront(angle)
        GeometryReader { geo in
            let size = geo.size
            ZStack {
                SupporterCardFace(v: v, size: size, angle: angle, tilt: tilt, time: time, back: false)
                    .opacity(front ? 1 : 0)
                SupporterCardFace(v: v, size: size, angle: angle, tilt: tilt, time: time, back: true)
                    .rotation3DEffect(.degrees(180), axis: (x: 0, y: 1, z: 0))
                    .opacity(front ? 0 : 1)
            }
            .rotation3DEffect(.degrees(angle), axis: (x: 0, y: 1, z: 0), perspective: 0.34)
            .rotation3DEffect(.degrees(tilt), axis: (x: 1, y: 0, z: 0), perspective: 0.34)
        }
    }
}

/// 片面。紙・肌理・光・粒・字
struct SupporterCardFace: View {
    let v: SupportView
    let size: CGSize
    let angle: Double
    let tilt: Double
    let time: Double
    let back: Bool
    static let shadowInk = Color(.sRGB, red: 38.0 / 255.0, green: 37.0 / 255.0, blue: 31.0 / 255.0, opacity: 1)

    var body: some View {
        let tier = v.tier
        let shape = RoundedRectangle(cornerRadius: 18, style: .continuous)
        let sh = SupporterFlip.shadow(angle, back: back)
        ZStack(alignment: .topLeading) {
            // 紙（斜め 150° のグラデーション）
            shape.fill(LinearGradient(stops: SupporterLights.stops(tier.paperStops),
                                      startPoint: UnitPoint(x: 0.25, y: 0.067), endPoint: UnitPoint(x: 0.75, y: 0.933)))
            SupporterTextureView(width: size.width, height: size.height).clipShape(shape)
            if !back { lights(tier).clipShape(shape) }
            content(tier).padding(.horizontal, 22).padding(.vertical, 20)
        }
        .frame(width: size.width, height: size.height)
        .overlay(shape.strokeBorder(Palette.color(tier.edge, dark: false), lineWidth: 1))
        // 縁の面取り（左上に明かり、右下に影）と、内側の細い線 2 本（カードの厚み）
        .overlay(
            shape.strokeBorder(LinearGradient(colors: [Palette.color("rgba(255,251,232,.75)", dark: false), .clear, Palette.color("rgba(42,28,2,.5)", dark: false)],
                                              startPoint: .topLeading, endPoint: .bottomTrailing), lineWidth: 1.5)
                .blur(radius: 0.6)
        )
        .shadow(color: Self.shadowInk.opacity(sh.nearAlpha), radius: CGFloat(sh.nearBlur / 2), x: CGFloat(sh.nearX), y: CGFloat(sh.nearY))
        .shadow(color: Self.shadowInk.opacity(sh.alpha), radius: CGFloat(sh.blur / 2), x: CGFloat(sh.x), y: CGFloat(sh.y))
    }

    /// 斜めに流れる光（4.6 秒で一定に）・向きに連れて動く光・箔の粒
    @ViewBuilder func lights(_ tier: SupporterTier) -> some View {
        let L = SupporterLights(w: Double(size.width), h: Double(size.height), angle: angle, tilt: tilt, time: time)
        ZStack(alignment: .topLeading) {
            // 流れる光：幅 42%・高さ 220%、-120% → 220% を 4.6 秒で
            LinearGradient(colors: [.clear, Palette.color(tier.sheen, dark: false), .clear], startPoint: .leading, endPoint: .trailing)
                .frame(width: L.bw, height: L.bh)
                .rotationEffect(.degrees(18))
                .offset(x: L.sx, y: L.sy)
            // 向きに連れて動く光（250% の帯を、角度と傾きでずらす）
            LinearGradient(stops: SupporterLights.stops(tier.glint), startPoint: L.gStart, endPoint: L.gEnd)
                .frame(width: L.gw, height: L.gh)
                .offset(x: L.gx, y: L.gy)
            // 箔の粒（ゴールド・ブラックだけ）。下から昇って、ちらついて消える
            if let fl = tier.fleck {
                ForEach(0..<SupporterTier.flecks.count, id: \.self) { i in
                    SupporterFleck(index: i, color: Palette.color(fl, dark: false), lights: L)
                }
            }
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
        .allowsHitTesting(false)
    }

    /// 粒の動き（styles.css の @keyframes fleck：0% 透明・下 6px・半分 → 22% .85 → 62% .5 → 100% 透明・上 38px）
    static func fleckFrame(time: Double, index i: Int, delay: Double) -> (opacity: Double, dy: Double, scale: Double) {
        let dur = Double(6 + (i % 4))
        let t = time - delay
        if t < 0 { return (0, 6, 0.5) }
        let p = t.truncatingRemainder(dividingBy: dur) / dur
        func ease(_ x: Double) -> Double { x * x * (3 - 2 * x) }
        let op: Double
        if p < 0.22 { op = 0.85 * ease(p / 0.22) }
        else if p < 0.62 { op = 0.85 + (0.5 - 0.85) * ease((p - 0.22) / 0.4) }
        else { op = 0.5 * (1 - ease((p - 0.62) / 0.38)) }
        let q = ease(p)
        return (op, 6 + (-38 - 6) * q, 0.5 + 0.5 * q)
    }

    @ViewBuilder func content(_ tier: SupporterTier) -> some View {
        let foil = Palette.color(tier.foil, dark: false)
        let black = tier.key == "black"
        if back {
            VStack(alignment: .leading, spacing: 0) {
                SupporterStamped("RECORD", font: .system(size: 10, weight: .bold), tracking: 1.4, color: foil, black: black).padding(.bottom, 10)
                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(Array(v.cardHistory.enumerated()), id: \.offset) { _, h in
                            HStack {
                                SupporterStamped(h.when, font: .system(size: 10, weight: .bold).monospacedDigit(), tracking: 1.4, color: foil, black: black)
                                Spacer()
                                SupporterStamped(h.yen, font: .system(size: 12, weight: .bold).monospacedDigit(), tracking: 0, color: foil, black: black)
                            }
                            .padding(.vertical, 5)
                        }
                    }
                }
                .scrollIndicators(.hidden)
            }
        } else {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 3) {
                        SupporterStamped("LUKKO", font: .system(size: 17), tracking: 0.34, color: foil, black: black)
                        SupporterStamped("SUPPORTER", font: .system(size: 10, weight: .bold), tracking: 1.4, color: foil, black: black)
                    }
                    Spacer()
                    HStack(spacing: -2) {
                        Text("✓").foregroundStyle(SupportFont.teal)
                        Text("？").foregroundStyle(Palette.color(tier.mark, dark: false))
                    }
                    .font(.system(size: 17))
                }
                Spacer(minLength: 0)
                HStack(alignment: .bottom, spacing: 12) {
                    VStack(alignment: .leading, spacing: 5) {
                        SupporterStamped(v.cardOwnerShown, font: .system(size: 15), tracking: 0, color: foil, black: black)
                            .opacity(v.cardOwner.isEmpty ? 0.45 : 1).lineLimit(1)
                        SupporterStamped(v.cardSince, font: .system(size: 10, weight: .bold).monospacedDigit(), tracking: 1.4, color: foil, black: black)
                    }
                    Spacer(minLength: 0)
                    VStack(alignment: .trailing, spacing: 0) {
                        SupporterStamped(v.cardTotal, font: .system(size: 22, weight: .light).monospacedDigit(), tracking: -0.44, color: foil, black: black)
                        SupporterStamped(v.cardTimes, font: .system(size: 10, weight: .bold).monospacedDigit(), tracking: 1.4, color: foil, black: black)
                    }
                    .fixedSize()
                }
            }
        }
    }
}

/// 箔押しの字。紙に沈んで見えるように、上に影・下に明かりを置いてから刷る
struct SupporterStamped: View {
    let text: String, font: Font, tracking: CGFloat, color: Color, black: Bool
    init(_ text: String, font: Font, tracking: CGFloat, color: Color, black: Bool) {
        self.text = text; self.font = font; self.tracking = tracking; self.color = color; self.black = black
    }
    var body: some View {
        let dark = Palette.color(black ? "rgba(0,0,0,.65)" : "rgba(60,40,4,.45)", dark: false)
        let lite = Palette.color(black ? "rgba(255,240,196,.3)" : "rgba(255,252,232,.75)", dark: false)
        ZStack {
            Text(text).foregroundStyle(lite).offset(y: 1)
            Text(text).foregroundStyle(dark).offset(y: -0.5)
            Text(text).foregroundStyle(color)
        }
        .font(font).tracking(tracking).lineLimit(1).truncationMode(.tail)
    }
}

/// 紙の肌理（刷り目と粒子）。作るのは 1 度（回すたびに描き直さない）
struct SupporterTextureView: View, Equatable {
    let width: CGFloat
    let height: CGFloat
    private static let lines = SupporterTexture.brushLines(335, 211)
    private static let dots = SupporterTexture.tileDots()
    var body: some View {
        Canvas(rendersAsynchronously: false) { ctx, size in
            // 刷り目はカード全体に 1 枚（335×211 の絵を引き伸ばす）
            let sx = size.width / 335, sy = size.height / 211
            for l in Self.lines {
                var p = Path()
                p.move(to: CGPoint(x: CGFloat(l.x1) * sx, y: CGFloat(l.y1) * sy)); p.addLine(to: CGPoint(x: CGFloat(l.x2) * sx, y: CGFloat(l.y2) * sy))
                let c = l.light ? SupporterTexture.brushLight : SupporterTexture.brushDark
                ctx.stroke(p, with: .color(SupporterTexturePaint.rgb(c, l.op)), lineWidth: CGFloat(l.width) * sx)
            }
            // 粒子は 64px の型を繰り返す
            let t = CGFloat(SupporterTexture.tile)
            var y0: CGFloat = 0
            while y0 < size.height {
                var x0: CGFloat = 0
                while x0 < size.width {
                    for d in Self.dots {
                        let c = d.light ? SupporterTexture.grainLight : SupporterTexture.grainDark
                        ctx.fill(Path(CGRect(x: x0 + CGFloat(d.x), y: y0 + CGFloat(d.y), width: CGFloat(d.s), height: CGFloat(d.s))),
                                 with: .color(SupporterTexturePaint.rgb(c, SupporterTexture.grainAlpha(d.light))))
                    }
                    x0 += t
                }
                y0 += t
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - 書き出す画像（sharecard.js の drawSupporterCard）
/// 1080×681。画面のカードと同じ見立てで、静止画では正面のときの光を 1 本置く
struct SupporterCardDraw: View {
    let owner: String, since: String, total: String, times: String
    let tier: SupporterTier
    static let W: CGFloat = 1080
    static let H: CGFloat = (1080 / 1.586).rounded()

    var body: some View {
        Canvas(rendersAsynchronously: false) { ctx, _ in
            let W = Self.W, H = Self.H
            let C = { (s: String) in Palette.color(s, dark: false) }
            let all = CGRect(x: 0, y: 0, width: W, height: H)
            // 紙
            let stops = tier.paper.enumerated().map { Gradient.Stop(color: C($0.element), location: CGFloat($0.offset) / CGFloat(tier.paper.count - 1)) }
            ctx.fill(Path(all), with: .linearGradient(Gradient(stops: stops), startPoint: .zero, endPoint: CGPoint(x: W, y: H)))
            // 肌理
            for l in SupporterTexture.brushLines(W, H) {
                var p = Path(); p.move(to: CGPoint(x: l.x1, y: l.y1)); p.addLine(to: CGPoint(x: l.x2, y: l.y2))
                let c = l.light ? SupporterTexture.brushLight : SupporterTexture.brushDark
                ctx.stroke(p, with: .color(SupporterTexturePaint.rgb(c, l.op)), lineWidth: CGFloat(l.width))
            }
            for d in SupporterTexture.grainDots(W, H) {
                let c = d.light ? SupporterTexture.grainLight : SupporterTexture.grainDark
                ctx.fill(Path(CGRect(x: d.x, y: d.y, width: d.s, height: d.s)), with: .color(SupporterTexturePaint.rgb(c, SupporterTexture.grainAlpha(d.light))))
            }
            // 向きに連れて動く光（正面＝真ん中に 1 本）
            var gl: [Gradient.Stop] = [.init(color: C("rgba(255,255,255,0)"), location: 0.3)]
            if tier.key == "gold" {
                gl += [.init(color: C("rgba(255,246,200,.5)"), location: 0.44), .init(color: C("rgba(237,251,217,.6)"), location: 0.5), .init(color: C("rgba(255,239,192,.5)"), location: 0.56)]
            } else {
                gl.append(.init(color: C(tier.key == "black" ? "rgba(255,240,196,.22)" : "rgba(255,252,238,.42)"), location: 0.5))
            }
            gl.append(.init(color: C("rgba(255,255,255,0)"), location: 0.7))
            ctx.fill(Path(all), with: .linearGradient(Gradient(stops: gl), startPoint: CGPoint(x: W * 0.1, y: 0), endPoint: CGPoint(x: W * 0.62, y: H)))
            // 箔の光
            ctx.fill(Path(all), with: .linearGradient(Gradient(stops: [.init(color: C("rgba(255,255,255,0)"), location: 0), .init(color: C(tier.sheen), location: 0.5), .init(color: C("rgba(255,255,255,0)"), location: 1)]),
                                                     startPoint: CGPoint(x: W * 0.18, y: 0), endPoint: CGPoint(x: W * 0.52, y: H)))
            // 箔の粒
            if let fl = tier.fleck {
                for (i, f) in SupporterTier.flecks.enumerated() {
                    let r: CGFloat = i % 3 == 0 ? 2.3 : 1.6
                    let cx = CGFloat(f.x) / 100 * W, cy = CGFloat(f.y) / 100 * H
                    ctx.fill(Path(ellipseIn: CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2)), with: .color(C(fl).opacity(i % 3 == 0 ? 0.85 : 0.5)))
                }
            }
            // 縁の面取り
            func bevel(_ a: CGPoint, _ b: CGPoint, _ color: String) {
                var p = Path(); p.move(to: a); p.addLine(to: b)
                ctx.stroke(p, with: .color(C(color)), lineWidth: 6)
            }
            let B: CGFloat = 5
            bevel(CGPoint(x: B, y: B + 6), CGPoint(x: B, y: H - B - 6), "rgba(255,251,232,.75)")
            bevel(CGPoint(x: B + 6, y: B), CGPoint(x: W - B - 6, y: B), "rgba(255,251,232,.75)")
            bevel(CGPoint(x: W - B, y: B + 6), CGPoint(x: W - B, y: H - B - 6), "rgba(42,28,2,.5)")
            bevel(CGPoint(x: B + 6, y: H - B), CGPoint(x: W - B - 6, y: H - B), "rgba(42,28,2,.5)")
            ctx.stroke(Path(CGRect(x: 1.5, y: 1.5, width: W - 3, height: H - 3)), with: .color(C(tier.edge)), lineWidth: 3)

            // 字。箔押しは沈んで見える（上に影、下に明かりを置いてから刷る）。y は字の並ぶ線（ベースライン）
            let PAD: CGFloat = 62
            let darkC = C(tier.key == "black" ? "rgba(0,0,0,.65)" : "rgba(60,40,4,.45)")
            let liteC = C(tier.key == "black" ? "rgba(255,240,196,.3)" : "rgba(255,252,232,.75)")
            func f(_ size: CGFloat, _ w: UIFont.Weight) -> (Font, CGFloat) {
                (.system(size: size, weight: Font.Weight.supporterFromUI(w)), abs(UIFont.systemFont(ofSize: size, weight: w).descender))
            }
            func put(_ s: String, _ font: (Font, CGFloat), _ color: Color, _ x: CGFloat, _ y: CGFloat, right: Bool = false) {
                // 置く点は字の下の端。ベースライン（y）より、字の下の余白ぶん下げる
                let anchor: UnitPoint = right ? .bottomTrailing : .bottomLeading
                for (c, dy) in [(darkC, -1.6), (liteC, 2.6), (color, 0.0)] {
                    ctx.draw(Text(s).font(font.0).foregroundColor(c), at: CGPoint(x: x, y: y + font.1 + dy), anchor: anchor)
                }
            }
            let foil = C(tier.foil)
            put("LUKKO", f(40, .heavy), foil, PAD, PAD + 40)
            put("S U P P O R T E R", f(23, .bold), foil, PAD, PAD + 78)
            put("✓", f(40, .bold), SupportFont.teal, W - PAD - 34, PAD + 44, right: true)
            put("？", f(40, .bold), C(tier.mark), W - PAD, PAD + 44, right: true)
            if !owner.isEmpty { put(owner, f(34, .bold), foil, PAD, H - PAD - 42) }
            put(since, f(22, .bold), foil, PAD, H - PAD)
            put(total, f(50, .heavy), foil, W - PAD, H - PAD - 34, right: true)
            put(times, f(22, .bold), foil, W - PAD, H - PAD, right: true)
        }
        .frame(width: Self.W, height: Self.H)
    }
}

/// 押しているあいだ沈む（Web 版の pressed と同じ色）
struct SettingsPressStyle: ButtonStyle {
    var radius: CGFloat = 12
    @Environment(\.ink) private var ink
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .overlay(RoundedRectangle(cornerRadius: radius).fill(ink("press").opacity(configuration.isPressed ? 0.55 : 0)).allowsHitTesting(false))
            .contentShape(RoundedRectangle(cornerRadius: radius))
    }
}

extension Font.Weight {
    static func supporterFromUI(_ w: UIFont.Weight) -> Font.Weight {
        switch w {
        case .heavy: return .heavy
        case .bold: return .bold
        case .semibold: return .semibold
        case .light: return .light
        default: return .regular
        }
    }
}

/// 光の位置（角度・傾き・時刻から。式を分けて、型の推論を軽くする）
struct SupporterLights {
    let bw: CGFloat, bh: CGFloat, sx: CGFloat, sy: CGFloat
    let gw: CGFloat, gh: CGFloat, gx: CGFloat, gy: CGFloat
    let gStart: UnitPoint, gEnd: UnitPoint
    let w: CGFloat, h: CGFloat, time: Double
    init(w: Double, h: Double, angle: Double, tilt: Double, time: Double) {
        self.w = CGFloat(w); self.h = CGFloat(h); self.time = time
        let ph: Double = time.truncatingRemainder(dividingBy: 4.6) / 4.6
        let bw: Double = w * 0.42
        self.bw = CGFloat(bw); bh = CGFloat(h * 2.2)
        sx = CGFloat(bw * (-1.2 + 3.4 * ph)); sy = CGFloat(-h * 0.6)
        let gxv: Double = sin(angle * Double.pi / 180)
        let gyv: Double = sin(tilt * Double.pi / 180) * 3
        let rad: Double = (112 - tilt * 2) * Double.pi / 180
        let dx: Double = sin(rad) / 2, dy: Double = -cos(rad) / 2
        gStart = UnitPoint(x: 0.5 - dx, y: 0.5 - dy); gEnd = UnitPoint(x: 0.5 + dx, y: 0.5 + dy)
        gw = CGFloat(w * 2.5); gh = CGFloat(h * 2.5)
        let px: Double = (50 - gxv * 42) / 100, py: Double = (50 - gyv * 42) / 100
        gx = CGFloat(-1.5 * w * px); gy = CGFloat(-1.5 * h * py)
    }
    static func stops(_ g: [(color: String, at: Double)]) -> [Gradient.Stop] {
        g.map { Gradient.Stop(color: Palette.color($0.color, dark: false), location: CGFloat($0.at / 100)) }
    }
}

/// 箔の粒 1 つ
struct SupporterFleck: View {
    let index: Int
    let color: Color
    let lights: SupporterLights
    var body: some View {
        let f = SupporterTier.flecks[index]
        let k = SupporterCardFace.fleckFrame(time: lights.time, index: index, delay: f.delay)
        let d: CGFloat = index % 3 == 0 ? 3 : 2
        let x: CGFloat = lights.w * CGFloat(f.x) / 100
        let y: CGFloat = lights.h * CGFloat(f.y) / 100 + CGFloat(k.dy)
        Circle().fill(color).frame(width: d, height: d)
            .scaleEffect(CGFloat(k.scale))
            .opacity(k.opacity)
            .offset(x: x, y: y)
    }
}

enum SupporterTexturePaint {
    static func rgb(_ c: (Double, Double, Double), _ a: Double) -> Color {
        let r: Double = c.0 / 255, g: Double = c.1 / 255, b: Double = c.2 / 255
        return Color(.sRGB, red: r, green: g, blue: b, opacity: a)
    }
}
