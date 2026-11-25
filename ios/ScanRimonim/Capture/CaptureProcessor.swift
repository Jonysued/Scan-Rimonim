import ARKit
import CoreImage
import Vision
import UIKit

// Convierte un ARFrame en: imagen vertical, metadatos LiDAR (mismo formato que la app actual),
// contorno de la granada (Vision + filtro de profundidad) y color medido sobre píxeles.
struct CapturaProcesada {
    let jpeg: Data
    let imagen: UIImage
    let metadata: CaptureMetadata
    let fruta: Fruta?
}

struct Intrinsics: Encodable { let fx: Float; let fy: Float; let cx: Float; let cy: Float }

struct CaptureProtocol: Encodable {
    let id = "lidar-front-20cm-v2"
    let version = 2
    let tolerance_m = Config.toleranceM
    let range_verified = true
    let required_hold_s = Config.requiredHoldS
    let stability_span_m: Float
    let stable_duration_s: Double
    let target_distance_m = Config.targetDistanceM
    let distance_reference = "camera-plane-to-surface-at-reticle"
    let measured_distance_m: Float
    let precision_validation = "pending-physical-comparison"
    let maximum_stability_span_m = Config.maxStabilitySpanM
}

struct CaptureMetadata: Encodable {
    let width: Int
    let height: Int
    let source = "arkit-scene-depth"
    let version = 1
    let depth_mm: [Int]
    let confidence: [Int]
    let intrinsics: Intrinsics
    let distanceM: Float
    let validation = "experimental"
    let captured_at: String
    let image_width: Int
    let image_height: Int
    let orientation = "portrait-clockwise"
    let capture_protocol: CaptureProtocol
    let app = "scan-rimonim-ios-nativa"
}

enum CaptureError: LocalizedError {
    case sinProfundidad, imagen
    var errorDescription: String? {
        switch self {
        case .sinProfundidad: return "El LiDAR no devolvió profundidad. Volvé a intentar."
        case .imagen: return "No se pudo procesar la imagen."
        }
    }
}

enum CaptureProcessor {
    static let ciContext = CIContext()

    static func procesar(frame: ARFrame, distancia: Float, span: Float, duracion: Double) throws -> CapturaProcesada {
        guard let depth = frame.sceneDepth else { throw CaptureError.sinProfundidad }

        // 1) Imagen vertical (el sensor entrega horizontal; .right = 90° horario)
        let ci = CIImage(cvPixelBuffer: frame.capturedImage).oriented(.right)
        guard let cg = ciContext.createCGImage(ci, from: ci.extent) else { throw CaptureError.imagen }
        let ui = UIImage(cgImage: cg)
        guard let jpeg = ui.jpegData(compressionQuality: 0.85) else { throw CaptureError.imagen }
        let imgW = cg.width, imgH = cg.height

        // 2) Profundidad rotada a vertical, en mm
        let (dep, conf, dW, dH) = rotarProfundidad(depth)

        // 3) Intrínsecos escalados al mapa de profundidad y rotados
        let K = frame.camera.intrinsics
        let landW = Float(CVPixelBufferGetWidth(frame.capturedImage))
        let s = Float(dH) / landW // dH (vertical) = ancho horizontal original
        let intr = Intrinsics(fx: K[1][1] * s, fy: K[0][0] * s,
                              cx: Float(dW) - K[2][1] * s, cy: K[2][0] * s)

        // 4) Segmentación y color
        let fruta = segmentarYMedir(cg: cg, dep: dep, conf: conf, dW: dW, dH: dH, frente: distancia)

        let meta = CaptureMetadata(
            width: dW, height: dH, depth_mm: dep, confidence: conf, intrinsics: intr,
            distanceM: distancia, captured_at: Fecha.now(),
            image_width: imgW, image_height: imgH,
            capture_protocol: CaptureProtocol(stability_span_m: span, stable_duration_s: duracion, measured_distance_m: distancia))
        return CapturaProcesada(jpeg: jpeg, imagen: ui, metadata: meta, fruta: fruta)
    }

    // Rota 90° horario: (u, v) horizontal -> (H-1-v, u) vertical
    static func rotarProfundidad(_ depth: ARDepthData) -> ([Int], [Int], Int, Int) {
        let map = depth.depthMap
        CVPixelBufferLockBaseAddress(map, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(map, .readOnly) }
        let w = CVPixelBufferGetWidth(map), h = CVPixelBufferGetHeight(map)
        let row = CVPixelBufferGetBytesPerRow(map) / MemoryLayout<Float32>.size
        let base = CVPixelBufferGetBaseAddress(map)!.assumingMemoryBound(to: Float32.self)

        var cBase: UnsafeMutablePointer<UInt8>?
        var cRow = 0
        if let c = depth.confidenceMap {
            CVPixelBufferLockBaseAddress(c, .readOnly)
            cBase = CVPixelBufferGetBaseAddress(c)?.assumingMemoryBound(to: UInt8.self)
            cRow = CVPixelBufferGetBytesPerRow(c)
        }
        defer { if let c = depth.confidenceMap { CVPixelBufferUnlockBaseAddress(c, .readOnly) } }

        let pW = h, pH = w
        var dep = [Int](repeating: 0, count: pW * pH)
        var conf = [Int](repeating: 0, count: pW * pH)
        for v in 0..<h {
            for u in 0..<w {
                let x = h - 1 - v, y = u
                let z = base[v * row + u]
                dep[y * pW + x] = z.isFinite ? Int((z * 1000).rounded()) : 0
                conf[y * pW + x] = cBase.map { Int($0[v * cRow + u]) } ?? 2
            }
        }
        return (dep, conf, pW, pH)
    }

    // MARK: Segmentación

    static func segmentarYMedir(cg: CGImage, dep: [Int], conf: [Int], dW: Int, dH: Int, frente: Float) -> Fruta? {
        let W = cg.width, H = cg.height
        let seed = CGPoint(x: 0.5, y: 0.5)
        guard let mask = mascaraFruta(cg: cg, seed: seed) else { return nil }

        // Filtro de profundidad: descarta hojas y fondo que no estén a la profundidad de la fruta
        let frenteMM = Int(frente * 1000)
        func depthOK(_ x: Int, _ y: Int) -> Bool {
            let dx = min(dW - 1, x * dW / W), dy = min(dH - 1, y * dH / H)
            let z = dep[dy * dW + dx]
            return z == 0 || conf[dy * dW + dx] < 1 || (z >= frenteMM - 25 && z <= frenteMM + 90)
        }
        func dentro(_ x: Int, _ y: Int) -> Bool {
            x >= 0 && y >= 0 && x < W && y < H && mask.valor(x, y) && depthOK(x, y)
        }

        // Centroide aproximado desde la semilla
        let sx = Int(Double(seed.x) * Double(W)), sy = Int(Double(seed.y) * Double(H))
        guard dentro(sx, sy) else { return nil }

        // Contorno por 160 rayos desde la semilla, luego recentrado una vez
        func rayos(cx: Int, cy: Int) -> [CGPoint] {
            var pts: [CGPoint] = []
            let paso = 2.0
            let maxR = Double(max(W, H))
            for i in 0..<160 {
                let a = Double(i) / 160 * 2 * .pi
                let (ca, sa) = (cos(a), sin(a))
                var r = 0.0, ultimo = 0.0, fuera = 0
                while r < maxR {
                    let x = Int(Double(cx) + ca * r), y = Int(Double(cy) + sa * r)
                    if dentro(x, y) { ultimo = r; fuera = 0 } else { fuera += 1; if fuera > 6 { break } }
                    r += paso
                }
                pts.append(CGPoint(x: Double(cx) + ca * ultimo, y: Double(cy) + sa * ultimo))
            }
            return pts
        }
        var pts = rayos(cx: sx, cy: sy)
        let mx = Int(pts.map { Double($0.x) }.reduce(0, +) / Double(pts.count))
        let my = Int(pts.map { Double($0.y) }.reduce(0, +) / Double(pts.count))
        if dentro(mx, my) { pts = rayos(cx: mx, cy: my) }

        // Suavizado: mediana de radios vecinos (quita picos de hojas/pedúnculo)
        let ccx = pts.map { Double($0.x) }.reduce(0, +) / 160
        let ccy = pts.map { Double($0.y) }.reduce(0, +) / 160
        let radios: [Double] = pts.map { hypot(Double($0.x) - ccx, Double($0.y) - ccy) }
        var suav: [CGPoint] = []
        for i in 0..<160 {
            let vec = (-3...3).map { radios[(i + $0 + 160) % 160] }.sorted()
            let r = vec[3]
            let a = Double(i) / 160 * 2 * Double.pi
            suav.append(CGPoint(x: ccx + cos(a) * r, y: ccy + sin(a) * r))
        }

        let contorno = suav.map { Punto(x: Double($0.x) / Double(W) * 1000, y: Double($0.y) / Double(H) * 1000) }
        let color = ColorAnalyzer.analizar(cg: cg, contorno: suav)

        return Fruta(
            body_contour: contorno,
            segmentation_seed: Punto(x: Double(seed.x), y: Double(seed.y)),
            segmentation_model: "vision-foreground-depth-v1",
            localization_status: "located",
            localization_confidence: 0.9,
            localization_version: 5,
            color_score: color?.score,
            color_category: color?.categoria,
            red_coverage_pct: color?.score,
            color_analysis_version: 3,
            diameter_mm: nil, // lo calcula Supabase (lidar-silueta-v1)
            diameter_source: nil,
            measurement_status: "unmeasured",
            lidar_silueta: nil,
            defects: [])
    }

    struct Mascara {
        let datos: [Float]
        let w: Int, h: Int, imgW: Int, imgH: Int
        func valor(_ x: Int, _ y: Int) -> Bool {
            let mx = min(w - 1, x * w / imgW), my = min(h - 1, y * h / imgH)
            return datos[my * w + mx] > 0.5
        }
    }

    // Máscara de la instancia en primer plano que contiene la semilla (Vision, iOS 17)
    static func mascaraFruta(cg: CGImage, seed: CGPoint) -> Mascara? {
        let req = VNGenerateForegroundInstanceMaskRequest()
        let handler = VNImageRequestHandler(cgImage: cg, options: [:])
        do { try handler.perform([req]) } catch { return nil }
        guard let obs = req.results?.first else { return nil }

        // Instancia bajo la semilla (o la más cercana)
        let inst = obs.instanceMask
        CVPixelBufferLockBaseAddress(inst, .readOnly)
        let iw = CVPixelBufferGetWidth(inst), ih = CVPixelBufferGetHeight(inst)
        let irow = CVPixelBufferGetBytesPerRow(inst)
        let ibase = CVPixelBufferGetBaseAddress(inst)!.assumingMemoryBound(to: UInt8.self)
        let sx = Int(Double(seed.x) * Double(iw)), sy = Int(Double(seed.y) * Double(ih))
        var label = Int(ibase[sy * irow + sx])
        if label == 0 {
            var mejor = Int.max
            for y in stride(from: 0, to: ih, by: 2) {
                for x in stride(from: 0, to: iw, by: 2) {
                    let l = Int(ibase[y * irow + x])
                    if l > 0 {
                        let d = (x - sx) * (x - sx) + (y - sy) * (y - sy)
                        if d < mejor { mejor = d; label = l }
                    }
                }
            }
        }
        CVPixelBufferUnlockBaseAddress(inst, .readOnly)
        guard label > 0 else { return nil }

        guard let buf = try? obs.generateScaledMaskForImage(forInstances: IndexSet(integer: label), from: handler) else { return nil }
        CVPixelBufferLockBaseAddress(buf, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(buf, .readOnly) }
        let w = CVPixelBufferGetWidth(buf), h = CVPixelBufferGetHeight(buf)
        let row = CVPixelBufferGetBytesPerRow(buf)
        let fmt = CVPixelBufferGetPixelFormatType(buf)
        guard let base = CVPixelBufferGetBaseAddress(buf) else { return nil }
        // Se reduce a 1/4 para ahorrar memoria (suficiente para el contorno)
        let f = 4
        let ow = w / f, oh = h / f
        var datos = [Float](repeating: 0, count: ow * oh)
        for y in 0..<oh {
            for x in 0..<ow {
                let px = x * f, py = y * f
                let v: Float
                if fmt == kCVPixelFormatType_OneComponent32Float {
                    v = base.advanced(by: py * row).assumingMemoryBound(to: Float32.self)[px]
                } else {
                    v = Float(base.advanced(by: py * row).assumingMemoryBound(to: UInt8.self)[px]) / 255
                }
                datos[y * ow + x] = v
            }
        }
        return Mascara(datos: datos, w: ow, h: oh, imgW: cg.width, imgH: cg.height)
    }
}
