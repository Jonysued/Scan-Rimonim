import ARKit
import SwiftUI

// Sesión ARKit con profundidad LiDAR. Mide la distancia en el centro (retícula) en vivo
// y avisa cuando está estable dentro del rango del protocolo.
final class LidarCamera: NSObject, ObservableObject, ARSessionDelegate {
    let session = ARSession()

    @Published var distanciaM: Float?
    @Published var enRango = false
    @Published var estable = false
    @Published var soportado = ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)

    private var historial: [(t: TimeInterval, d: Float)] = []
    private(set) var ultimoFrame: ARFrame?
    private(set) var inicioEstable: TimeInterval?

    func iniciar() {
        guard soportado else { return }
        let config = ARWorldTrackingConfiguration()
        config.frameSemantics = [.sceneDepth]
        if let formato = ARWorldTrackingConfiguration.supportedVideoFormats
            .first(where: { $0.imageResolution == CGSize(width: 1920, height: 1440) }) {
            config.videoFormat = formato
        }
        session.delegate = self
        session.run(config, options: [.resetTracking, .removeExistingAnchors])
    }

    func pausar() { session.pause() }

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        ultimoFrame = frame
        guard let depth = frame.sceneDepth else { return }
        let d = Self.profundidadCentro(depth)
        let t = frame.timestamp
        historial.append((t, d ?? 0))
        historial.removeAll { t - $0.t > Config.requiredHoldS }

        let dentro = d.map { abs($0 - Config.targetDistanceM) <= Config.toleranceM } ?? false
        let valores = historial.map(\.d).filter { $0 > 0 }
        let span = (valores.max() ?? 0) - (valores.min() ?? 0)
        let cubre = (historial.first.map { t - $0.t } ?? 0) >= Config.requiredHoldS * 0.95
        let esEstable = dentro && cubre && span <= Config.maxStabilitySpanM && valores.count == historial.count
        if esEstable { if inicioEstable == nil { inicioEstable = t } } else { inicioEstable = nil }

        DispatchQueue.main.async {
            self.distanciaM = d
            self.enRango = dentro
            self.estable = esEstable
        }
    }

    func spanReciente() -> Float {
        let v = historial.map(\.d).filter { $0 > 0 }
        return (v.max() ?? 0) - (v.min() ?? 0)
    }

    func duracionEstable() -> Double {
        guard let i = inicioEstable, let f = ultimoFrame else { return 0 }
        return f.timestamp - i + Config.requiredHoldS
    }

    // Mediana de una ventana 5x5 en el centro del mapa de profundidad (con confianza alta)
    static func profundidadCentro(_ depth: ARDepthData) -> Float? {
        let map = depth.depthMap
        CVPixelBufferLockBaseAddress(map, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(map, .readOnly) }
        let w = CVPixelBufferGetWidth(map), h = CVPixelBufferGetHeight(map)
        let row = CVPixelBufferGetBytesPerRow(map) / MemoryLayout<Float32>.size
        guard let base = CVPixelBufferGetBaseAddress(map)?.assumingMemoryBound(to: Float32.self) else { return nil }
        var conf: UnsafeMutablePointer<UInt8>?
        var confRow = 0
        if let c = depth.confidenceMap {
            CVPixelBufferLockBaseAddress(c, .readOnly)
            conf = CVPixelBufferGetBaseAddress(c)?.assumingMemoryBound(to: UInt8.self)
            confRow = CVPixelBufferGetBytesPerRow(c)
        }
        defer { if let c = depth.confidenceMap { CVPixelBufferUnlockBaseAddress(c, .readOnly) } }
        var vals: [Float] = []
        for y in (h / 2 - 2)...(h / 2 + 2) {
            for x in (w / 2 - 2)...(w / 2 + 2) {
                if let conf, conf[y * confRow + x] < 2 { continue }
                let v = base[y * row + x]
                if v.isFinite && v > 0 { vals.append(v) }
            }
        }
        guard !vals.isEmpty else { return nil }
        vals.sort()
        return vals[vals.count / 2]
    }
}

struct ARPreview: UIViewRepresentable {
    let session: ARSession
    func makeUIView(context: Context) -> ARSCNView {
        let v = ARSCNView()
        v.session = session
        v.automaticallyUpdatesLighting = false
        return v
    }
    func updateUIView(_ uiView: ARSCNView, context: Context) {}
}
