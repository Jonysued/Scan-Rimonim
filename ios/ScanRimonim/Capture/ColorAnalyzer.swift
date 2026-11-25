import CoreGraphics
import Foundation

// Color medido sobre los píxeles de la cáscara, en CIELAB.
// color_score = % de la superficie visible que es roja. Umbrales ajustables acá.
enum ColorAnalyzer {
    struct Umbrales {
        static let encoger = 0.85       // usar el 85% interior del contorno
        static let minL = 12.0          // descarta sombras
        static let maxLBrillo = 88.0    // descarta reflejos sin color
        static let cromaBaja = 12.0
        static let rojoMinA = 20.0
        static let tonoMin = -30.0, tonoMax = 60.0
        static let rosadoMin = 25.0, rojoMin = 60.0
        static let rojoOscuroMin = 85.0, rojoOscuroMaxL = 38.0
        static let rojoMaxL = 52.0      // rojo muy claro = rosado
    }

    struct Resultado { let score: Double; let categoria: String }

    static func analizar(cg: CGImage, contorno: [CGPoint]) -> Resultado? {
        // Reducir a ~480 px de ancho para velocidad
        let escala = min(1.0, 480.0 / Double(cg.width))
        let w = Int(Double(cg.width) * escala), h = Int(Double(cg.height) * escala)
        var px = [UInt8](repeating: 0, count: w * h * 4)
        guard let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                  space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return nil }
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))

        // Polígono escalado y encogido hacia el centro
        let cx = contorno.map { Double($0.x) }.reduce(0, +) / Double(contorno.count)
        let cy = contorno.map { Double($0.y) }.reduce(0, +) / Double(contorno.count)
        let poly: [CGPoint] = contorno.map { p -> CGPoint in
            let x: Double = (cx + (Double(p.x) - cx) * Umbrales.encoger) * escala
            let y: Double = (cy + (Double(p.y) - cy) * Umbrales.encoger) * escala
            return CGPoint(x: x, y: y)
        }
        let path = CGMutablePath()
        path.addLines(between: poly)
        path.closeSubpath()
        let box = path.boundingBox

        var validos = 0, rojos = 0
        var lRojos: [Double] = []
        for y in max(0, Int(box.minY))..<min(h, Int(box.maxY) + 1) {
            for x in max(0, Int(box.minX))..<min(w, Int(box.maxX) + 1) {
                guard path.contains(CGPoint(x: Double(x) + 0.5, y: Double(y) + 0.5)) else { continue }
                // En memoria la fila 0 es la parte superior de la imagen
                let i = (y * w + x) * 4
                let (L, a, b) = lab(px[i], px[i + 1], px[i + 2])
                let croma = (a * a + b * b).squareRoot()
                if L < Umbrales.minL { continue }
                if L > Umbrales.maxLBrillo && croma < Umbrales.cromaBaja { continue }
                validos += 1
                let tono = atan2(b, a) * 180 / .pi
                if a >= Umbrales.rojoMinA && tono >= Umbrales.tonoMin && tono <= Umbrales.tonoMax {
                    rojos += 1
                    lRojos.append(L)
                }
            }
        }
        guard validos >= 30 else { return nil }
        let cobertura = Double(rojos) / Double(validos) * 100
        lRojos.sort()
        let lMed = lRojos.isEmpty ? nil : lRojos[lRojos.count / 2]

        var cat = "verde"
        if cobertura >= Umbrales.rojoMin, let l = lMed, l > Umbrales.rojoMaxL {
            cat = "rosado"
        } else if cobertura >= Umbrales.rojoMin {
            cat = (cobertura >= Umbrales.rojoOscuroMin && (lMed ?? 100) < Umbrales.rojoOscuroMaxL) ? "rojo_oscuro" : "rojo"
        } else if cobertura >= Umbrales.rosadoMin {
            cat = "rosado"
        }
        return Resultado(score: cobertura.rounded(), categoria: cat)
    }

    static func lab(_ r: UInt8, _ g: UInt8, _ b: UInt8) -> (Double, Double, Double) {
        func lin(_ c: UInt8) -> Double {
            let v = Double(c) / 255
            return v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4)
        }
        let R = lin(r), G = lin(g), B = lin(b)
        let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
        let Y = R * 0.2126 + G * 0.7152 + B * 0.0722
        let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
        func f(_ t: Double) -> Double { t > 0.008856 ? cbrt(t) : 7.787 * t + 16.0 / 116 }
        let fx = f(X), fy = f(Y), fz = f(Z)
        return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))
    }
}
